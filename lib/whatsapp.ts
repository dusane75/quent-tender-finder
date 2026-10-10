// Sends and receives WhatsApp messages through Meta's Cloud API (Graph API).
import crypto from "crypto";

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;

export function whatsappReady() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

// Turns anything the user typed into the form WhatsApp expects: 919890123456
export function normalisePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = "91" + d;                  // plain Indian mobile
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  else if (d.length === 12 && d.startsWith("91")) { /* already right */ }
  else if (d.length < 10 || d.length > 15) return null;
  return d;
}

async function graph(path: string, body: unknown) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// Free-form reply. Only allowed within 24 hours of the person messaging us.
export async function sendText(to: string, body: string) {
  if (!whatsappReady()) return { skipped: true };
  return graph(`${process.env.WHATSAPP_PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: true, body: body.slice(0, 4000) },
  });
}

// Business-initiated message. Must use a template Meta has approved.
export async function sendTemplate(to: string, name: string, lang: string, bodyParams: string[]) {
  if (!whatsappReady()) return { skipped: true };
  return graph(`${process.env.WHATSAPP_PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: String(t).slice(0, 900) })) }]
        : [],
    },
  });
}

export async function markRead(messageId: string) {
  if (!whatsappReady()) return { skipped: true };
  try {
    return await graph(`${process.env.WHATSAPP_PHONE_ID}/messages`, {
      messaging_product: "whatsapp", status: "read", message_id: messageId,
    });
  } catch {
    return { skipped: true };
  }
}

// Confirms the webhook call really came from Meta.
export function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // not configured yet — the verify token still guards the webhook
  if (!header?.startsWith("sha256=")) return false;
  const mine = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(mine);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Which template to use for each kind of alert (create these in Meta Business Manager)
export const TEMPLATES = {
  newMatches: process.env.WA_TEMPLATE_MATCHES || "new_tender_matches",
  reminder: process.env.WA_TEMPLATE_REMINDER || "tender_deadline_reminder",
  weekly: process.env.WA_TEMPLATE_WEEKLY || "weekly_tender_report",
};

// Meta needs the language code of the approved template, not our app's code.
export function templateLang(appLang: string) {
  return appLang === "mr" ? "mr" : appLang === "hi" ? "hi" : "en";
}
