// Runs every morning (see vercel.json). Four jobs, in order:
// 1) checks the public tender pages we follow and adds new tenders
// 2) emails each business its new matching tenders
// 3) deadline reminders 7, 3 and 1 day before closing
// 4) weekly report on Mondays
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emailReady, emailShell, esc, sendEmail } from "@/lib/email";
import { fmtDate, rupees } from "@/lib/constants";
import { aiReady, extractTenderList } from "@/lib/ai";
import { fetchAsText, robotsAllows } from "@/lib/fetchSource";
import { cleanDistrict, cleanState } from "@/lib/places";
import { TEMPLATES, sendTemplate, templateLang, whatsappReady } from "@/lib/whatsapp";

export const maxDuration = 60;

type Source = { id: string; name: string; url: string; kind: string; state: string | null; district: string | null; robots_allowed: boolean | null };
type Match = { user_id: string; email: string; business_name: string; tender_id: string; title: string; organisation: string | null; closing_at: string | null; value: number | null };
type Reminder = { user_id: string; email: string; business_name: string; tender_id: string; title: string; closing_at: string; days_left: number; status: string };
type Weekly = {
  user_id: string; email: string; wa_phone: string | null; whatsapp_alerts: boolean;
  business_name: string; language: string; new_matches: number; closing_soon: number;
};

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const started = Date.now();
  const budget = () => Date.now() - started < 42000; // leave room for the emails
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const report = {
    emailOn: emailReady(), aiOn: aiReady(), whatsappOn: whatsappReady(),
    sourcesChecked: 0, sourcesSkipped: 0, tendersFound: 0, tendersAdded: 0,
    whatsappSent: 0, newMatchEmails: 0, reminders: 0, weekly: 0, errors: [] as string[],
  };

  // 1) Check the tender pages we follow — but only where the site's rules allow it
  if (report.aiOn) {
    const { data: sources, error } = await db.rpc("job_sources_due", { p_secret: secret, p_limit: 6 });
    if (error) report.errors.push(`sources: ${error.message}`);
    for (const s of (sources || []) as Source[]) {
      if (!budget()) break;
      let status = "ok", found = 0, added = 0, robots: boolean | null = null;
      try {
        const check = await robotsAllows(s.url);
        robots = check.allowed;
        if (!check.allowed) {
          status = `skipped — ${check.why}`;
          report.sourcesSkipped++;
        } else {
          const page = await fetchAsText(s.url);
          if (page.status >= 400) {
            status = `page returned ${page.status}`;
          } else if (page.text.length < 200) {
            status = "page had no readable text";
          } else {
            const out = await extractTenderList(
              [{ text: `SOURCE: ${s.name} (${s.url})\n\nPAGE TEXT:\n${page.text}` }],
              { state: s.state, district: s.district }
            );
            const list = Array.isArray(out?.tenders) ? out.tenders.slice(0, 40) : [];
            found = list.length;
            for (const t of list) {
              if (!t?.title || String(t.title).trim().length < 6) continue;
              const payload = {
                ...t,
                source: "site",
                url: (t as unknown as { url?: string }).url || s.url,
                state: cleanState(t.state) || s.state,
                district: cleanDistrict(t.district) || s.district,
              };
              const { data: id } = await db.rpc("job_add_public_tender", { p_secret: secret, p: payload });
              if (id) added++;
            }
            status = `read ${found} tenders, ${added} new`;
            report.sourcesChecked++;
          }
        }
      } catch (e) {
        status = `error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200);
      }
      report.tendersFound += found;
      report.tendersAdded += added;
      await db.rpc("job_source_result", { p_secret: secret, p_id: s.id, p_status: status, p_items: added, p_robots: robots });
      await db.rpc("job_log_intake", { p_secret: secret, p_kind: "site", p_detail: `${s.name}: ${status}`, p_found: found, p_added: added, p_error: null });
    }
  }

  // 2) WhatsApp alerts — new matches and deadline reminders
  if (report.whatsappOn) {
    type WaRow = { kind: string; user_id: string; wa_phone: string; business_name: string; language: string; payload: Record<string, unknown> };
    const { data: outbox, error: wErr } = await db.rpc("job_wa_outbox", { p_secret: secret });
    if (wErr) report.errors.push(`whatsapp outbox: ${wErr.message}`);
    for (const row of (outbox || []) as WaRow[]) {
      try {
        const lang = templateLang(row.language);
        if (row.kind === "match") {
          const list = (row.payload.tenders as { title: string; closing_at: string | null }[]) || [];
          const count = Number(row.payload.count || list.length);
          const first = list[0];
          // Template body: {{1}} business, {{2}} how many, {{3}} the closest one
          await sendTemplate(row.wa_phone, TEMPLATES.newMatches, lang, [
            row.business_name,
            String(count),
            first ? `${first.title} (last date ${fmtDate(first.closing_at)})` : "see your dashboard",
          ]);
          await db.rpc("job_mark_notified", { p_secret: secret, p_user: row.user_id });
        } else if (row.kind === "reminder") {
          // Template body: {{1}} business, {{2}} tender, {{3}} days left, {{4}} last date
          await sendTemplate(row.wa_phone, TEMPLATES.reminder, lang, [
            row.business_name,
            String(row.payload.title || ""),
            String(row.payload.days_left || ""),
            fmtDate(row.payload.closing_at as string),
          ]);
          await db.rpc("job_mark_reminded", {
            p_secret: secret, p_user: row.user_id,
            p_tender: row.payload.tender_id, p_days: row.payload.days_left,
          });
        }
        report.whatsappSent++;
      } catch (e) {
        report.errors.push(`whatsapp ${row.kind}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
      }
    }
  }

  // 3) The same alerts by email, for anyone without WhatsApp
  const { data: matches, error: mErr } = await db.rpc("job_new_matches", { p_secret: secret });
  if (mErr) report.errors.push(mErr.message);
  const byUser = new Map<string, Match[]>();
  for (const m of (matches || []) as Match[]) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id)!.push(m);
  }
  for (const [userId, list] of byUser) {
    try {
      if (report.emailOn && list[0].email) {
        const items = list.slice(0, 20).map((m) =>
          `<li style="margin-bottom:10px"><a href="${site}/tenders/${m.tender_id}"><b>${esc(m.title)}</b></a><br>
           <span style="color:#78716c">${esc(m.organisation || "")} · ${esc(rupees(m.value))} · Last date ${esc(fmtDate(m.closing_at))}</span></li>`
        ).join("");
        await sendEmail(list[0].email, `${list.length} new tender${list.length > 1 ? "s" : ""} match your work`,
          emailShell(`New tenders for ${list[0].business_name}`, `<ul style="padding-left:18px">${items}</ul>`));
        report.newMatchEmails++;
      }
      await db.rpc("job_mark_notified", { p_secret: secret, p_user: userId });
    } catch (e) { report.errors.push(String(e)); }
  }

  // 4) Deadline reminders by email
  const { data: due, error: rErr } = await db.rpc("job_due_reminders", { p_secret: secret });
  if (rErr) report.errors.push(rErr.message);
  for (const r of (due || []) as Reminder[]) {
    try {
      if (report.emailOn && r.email) {
        await sendEmail(r.email, `⏰ ${r.days_left} day${r.days_left > 1 ? "s" : ""} left: ${r.title}`,
          emailShell(`Deadline in ${r.days_left} day${r.days_left > 1 ? "s" : ""}`,
            `<p><a href="${site}/tenders/${r.tender_id}"><b>${esc(r.title)}</b></a></p>
             <p>Last date to submit: <b>${esc(fmtDate(r.closing_at))}</b></p>
             <p>${r.status === "applied" ? "You marked this as applied — check your submission acknowledgement is saved." : "Your bid papers and document checklist are ready in the app."}</p>`));
        report.reminders++;
      }
      await db.rpc("job_mark_reminded", { p_secret: secret, p_user: r.user_id, p_tender: r.tender_id, p_days: r.days_left });
    } catch (e) { report.errors.push(String(e)); }
  }

  // 5) Weekly report on Mondays (India time), by WhatsApp and email
  const istDay = new Date(Date.now() + 5.5 * 3600000).getUTCDay();
  if (istDay === 1 && (report.emailOn || report.whatsappOn)) {
    const { data: weekly } = await db.rpc("job_weekly_report_v2", { p_secret: secret });
    for (const w of (weekly || []) as Weekly[]) {
      try {
        if (report.whatsappOn && w.wa_phone && w.whatsapp_alerts) {
          // Template body: {{1}} business, {{2}} new matches, {{3}} closing soon
          await sendTemplate(w.wa_phone, TEMPLATES.weekly, templateLang(w.language), [
            w.business_name, String(w.new_matches), String(w.closing_soon),
          ]);
          report.weekly++;
          continue;
        }
        if (!report.emailOn || !w.email) continue;
        await sendEmail(w.email, `Your weekly tender report: ${w.new_matches} new matches`,
          emailShell(`This week for ${w.business_name}`,
            `<p><b>${w.new_matches}</b> new tenders matched your work in the last 7 days.</p>
             <p><b>${w.closing_soon}</b> of your tenders close in the next 7 days.</p>`));
        report.weekly++;
      } catch (e) { report.errors.push(String(e)); }
    }
  }

  return NextResponse.json(report);
}
