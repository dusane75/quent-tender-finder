"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setErr(error.message); setState("error"); } else setState("sent");
  }

  return (
    <div className="wrap narrow" style={{ paddingTop: 40 }}>
      <div className="card stack">
        <h1 style={{ fontSize: 30 }}>Sign in or start free</h1>
        <p className="muted">Enter your email. We’ll send a link — click it to sign in. No password needed.</p>
        {state === "sent" ? (
          <div className="notice ok">Check your inbox for <b>{email}</b> and click the sign-in link. (Look in Spam if you don’t see it.)</div>
        ) : (
          <form onSubmit={send} className="stack">
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
            </div>
            <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send sign-in link"}</button>
            {state === "error" && <div className="notice err">{err}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
