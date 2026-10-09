// Sends email through whichever provider has a key set: Brevo, Resend or ZeptoMail.
// If none is set, emails are skipped quietly so the rest of the app still works.
type Provider = "brevo" | "resend" | "zepto" | null;

function provider(): Provider {
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.ZEPTOMAIL_TOKEN) return "zepto";
  return null;
}

export function emailReady() {
  return Boolean(provider() && process.env.EMAIL_FROM);
}

function fromParts() {
  const raw = process.env.EMAIL_FROM || "";
  const m = raw.match(/^\s*(.*?)\s*<(.+)>\s*$/);
  return m ? { name: m[1] || "Tender Finder", email: m[2] } : { name: "Tender Finder", email: raw.trim() };
}

export async function sendEmail(to: string, subject: string, html: string) {
  const p = provider();
  if (!p || !process.env.EMAIL_FROM) return { skipped: true };
  const from = fromParts();

  let url: string, headers: Record<string, string>, body: unknown;
  if (p === "brevo") {
    url = "https://api.brevo.com/v3/smtp/email";
    headers = { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json", accept: "application/json" };
    body = { sender: from, to: [{ email: to }], subject, htmlContent: html };
  } else if (p === "resend") {
    url = "https://api.resend.com/emails";
    headers = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" };
    body = { from: process.env.EMAIL_FROM, to, subject, html };
  } else {
    url = "https://api.zeptomail.in/v1.1/email";
    headers = { Authorization: process.env.ZEPTOMAIL_TOKEN!, "Content-Type": "application/json" };
    body = {
      from: { address: from.email, name: from.name },
      to: [{ email_address: { address: to } }],
      subject, htmlbody: html,
    };
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Email failed (${p} ${res.status}): ${(await res.text()).slice(0, 200)}`);
  return { sent: true, via: p };
}

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

export function emailShell(title: string, body: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c1917">
  <h2 style="color:#9a3412;margin:0 0 12px">${esc(title)}</h2>
  ${body}
  <p style="margin-top:24px"><a href="${site}/dashboard" style="background:#c2410c;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open my dashboard</a></p>
  <p style="font-size:12px;color:#78716c;margin-top:24px">You get these because you signed up for tender alerts. Turn them off any time in Settings.</p>
</div>`;
}
