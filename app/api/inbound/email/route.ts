// Receives official tender-alert emails and turns them into tenders automatically.
// Works with any inbound-email provider (Resend, Mailgun, SendGrid, Postmark, CloudMailin,
// Cloudflare Email Workers): it looks for the subject and body under the usual field names.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { aiReady, extractTenderList } from "@/lib/ai";
import { htmlToText } from "@/lib/fetchSource";
import { cleanDistrict, cleanState } from "@/lib/places";

export const maxDuration = 60;

function pick(obj: unknown, keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const parts = k.split(".");
    let v: unknown = o;
    for (const p of parts) {
      if (v && typeof v === "object") v = (v as Record<string, unknown>)[p];
      else { v = undefined; break; }
    }
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get("x-intake-secret") || url.searchParams.get("key") || "";
  if (!secret || given !== secret) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  if (!aiReady()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected JSON" }, { status: 400 });

  // providers wrap the email in different shapes
  const data = (body as Record<string, unknown>).data ?? (body as Record<string, unknown>).email ?? body;
  const subject = pick(data, ["subject", "Subject", "headers.subject"]);
  const from = pick(data, ["from", "From", "sender", "from.address", "envelope.from"]);
  const text = pick(data, ["text", "plain", "TextBody", "text_body", "body-plain", "plainBody"]);
  const html = pick(data, ["html", "HtmlBody", "html_body", "body-html", "htmlBody"]);
  const content = (text || htmlToText(html)).slice(0, 45000);

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const label = `${from || "unknown"} — ${subject || "(no subject)"}`.slice(0, 200);

  if (content.trim().length < 60) {
    await db.rpc("job_log_intake", { p_secret: secret, p_kind: "email", p_detail: label, p_found: 0, p_added: 0, p_error: "Email had no readable text" });
    return NextResponse.json({ found: 0, added: 0, note: "nothing to read" });
  }

  let found = 0, added = 0, error: string | null = null;
  try {
    const out = await extractTenderList([{ text: `EMAIL SUBJECT: ${subject}\n\nEMAIL BODY:\n${content}` }]);
    const list = Array.isArray(out?.tenders) ? out.tenders.slice(0, 40) : [];
    found = list.length;
    for (const t of list) {
      if (!t?.title || String(t.title).trim().length < 6) continue;
      const payload = {
        ...t,
        source: "email",
        state: cleanState(t.state),
        district: cleanDistrict(t.district),
        raw_text: content.slice(0, 4000),
      };
      const { data: id } = await db.rpc("job_add_public_tender", { p_secret: secret, p: payload });
      if (id) added++;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  await db.rpc("job_log_intake", {
    p_secret: secret, p_kind: "email", p_detail: label, p_found: found, p_added: added, p_error: error,
  });
  return NextResponse.json({ found, added, error });
}
