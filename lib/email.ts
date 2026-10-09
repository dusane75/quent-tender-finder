// Sends email through Resend when a key is set; otherwise does nothing.
export function emailReady() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!emailReady()) return { skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
  return { sent: true };
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
