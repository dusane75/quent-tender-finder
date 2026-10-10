// Receives WhatsApp messages from Meta and replies automatically.
// Meta calls GET once to verify the webhook, then POSTs every incoming message.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { aiReady, whatsappReply } from "@/lib/ai";
import { markRead, sendText, verifySignature, whatsappReady } from "@/lib/whatsapp";
import { daysLeft, fmtDate, rupees, type Lang } from "@/lib/constants";

export const maxDuration = 60;

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") || "", { status: 200 });
  }
  return new NextResponse("Not allowed", { status: 403 });
}

type Snapshot = {
  business_name?: string; language?: string; new_matches?: number; saved?: number; applied?: number;
  open_tenders?: { id: string; title: string; value: number | null; closing_at: string | null; status: string }[];
};

// Plain reply used when the AI is unavailable — still useful, never made up.
function fallbackReply(snap: Snapshot | null, site: string): string {
  if (!snap) {
    return `Namaste! This is Tender Finder — we send you government tenders that match your work, in Marathi, Hindi or English.\n\nSign up free for 30 days: ${site}`;
  }
  const open = snap.open_tenders || [];
  const lines = open.slice(0, 5).map((t) => {
    const d = daysLeft(t.closing_at);
    return `• ${t.title} — ${rupees(t.value)}, last date ${fmtDate(t.closing_at)}${d !== null && d >= 0 ? ` (${d} days)` : ""}`;
  });
  return [
    `Namaste ${snap.business_name || ""}!`.trim(),
    `New matches: ${snap.new_matches ?? 0} · Saved: ${snap.saved ?? 0} · Applied: ${snap.applied ?? 0}`,
    lines.length ? "\nYour open tenders:\n" + lines.join("\n") : "\nNo open tenders right now.",
    `\nFull details: ${site}/dashboard\nReply STOP to switch off alerts.`,
  ].join("\n");
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Bad signature", { status: 401 });
  }

  // Always answer Meta quickly with 200, or it keeps retrying.
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  const secret = process.env.CRON_SECRET;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const entries = (body.entry as any[]) || [];
  for (const entry of entries) {
    for (const change of (entry?.changes as any[]) || []) {
      const value = change?.value;
      for (const msg of (value?.messages as any[]) || []) {
        const from: string = msg?.from || "";
        if (!from) continue;
        const text: string =
          msg?.text?.body || msg?.button?.text || msg?.interactive?.button_reply?.title ||
          (msg?.type && msg.type !== "text" ? `(sent a ${msg.type})` : "");

        let outcome = "replied";
        try {
          if (msg?.id) await markRead(msg.id);

          // Switching alerts off and on, in any of the three languages
          const t = text.trim().toLowerCase();
          if (secret && /^(stop|band|बंद|थांबा|रोको)\b/.test(t)) {
            await db.rpc("job_wa_set_alerts", { p_secret: secret, p_phone: from, p_on: false });
            await sendText(from, "Done — WhatsApp alerts are off. Reply START any time to switch them back on.");
            outcome = "alerts off";
          } else if (secret && /^(start|chalu|सुरु|चालू|शुरू)\b/.test(t)) {
            await db.rpc("job_wa_set_alerts", { p_secret: secret, p_phone: from, p_on: true });
            await sendText(from, "WhatsApp alerts are on again. You'll hear from us when a tender matches your work.");
            outcome = "alerts on";
          } else {
            const { data: snap } = secret
              ? await db.rpc("job_wa_lookup", { p_secret: secret, p_phone: from })
              : { data: null };
            const snapshot = (snap as Snapshot | null) || null;
            const lang = (snapshot?.language as Lang) || "mr";

            let reply = "";
            if (aiReady()) {
              try {
                const out = await whatsappReply(text || "(empty message)", snapshot, lang, site);
                reply = String(out?.reply || "").trim();
              } catch (e) {
                outcome = `ai failed: ${e instanceof Error ? e.message : "error"}`.slice(0, 150);
              }
            }
            if (!reply) reply = fallbackReply(snapshot, site);
            await sendText(from, reply);
            if (!snapshot) outcome += " (unregistered number)";
          }
        } catch (e) {
          outcome = `failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200);
        }

        if (secret) {
          await db.rpc("job_log_intake", {
            p_secret: secret, p_kind: "whatsapp",
            p_detail: `${from}: ${text.slice(0, 120)} → ${outcome}`,
            p_found: 1, p_added: 0, p_error: outcome.startsWith("failed") ? outcome : null,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, whatsapp: whatsappReady() });
}
