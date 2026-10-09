import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME, PLANS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <div className="wrap">
      <section className="hero">
        <span className="pill">For contractors, suppliers & MSMEs across India</span>
        <h1 style={{ marginTop: 14 }}>
          Never miss a government tender again.
          <br />
          <span style={{ color: "var(--accent)" }}>सरकारी टेंडर, आता सोप्या भाषेत.</span>
        </h1>
        <p className="lead">
          Tell us what work you do and where. {APP_NAME} watches public tender notices every day, explains the matching
          ones in Marathi, Hindi or English, checks if you are eligible, and prepares your bid papers. You submit — we never do.
        </p>
        <div className="row">
          <Link href="/login" className="btn">Start 30-day free trial</Link>
          <a href="#how" className="btn ghost">How it works</a>
        </div>
      </section>

      <section id="how">
        <h2>How it works</h2>
        <div className="steps">
          <div className="card"><h3>Tell us your work</h3><p className="muted">“Road work”, “printing”, “CCTV”… plus your states, districts and the tender size you can handle.</p></div>
          <div className="card"><h3>Get matching tenders</h3><p className="muted">We check public tender notices daily. You get only the ones that fit, with a summary in your language.</p></div>
          <div className="card"><h3>Check eligibility</h3><p className="muted">See which rules you meet, which you don’t, and which documents you need.</p></div>
          <div className="card"><h3>Prepare & submit</h3><p className="muted">Get a ready cover letter, declarations and checklist. Submit on the portal yourself.</p></div>
        </div>
      </section>

      <section id="pricing">
        <h2>Simple pricing</h2>
        <p className="muted">Free for 30 days. No card needed.</p>
        <div className="grid three">
          {PLANS.map((p) => (
            <div key={p.name} className={"card" + (p.featured ? " featured" : "")}>
              <div className="row between"><h3>{p.name}</h3>{p.featured && <span className="pill">Most popular</span>}</div>
              <div className="price">₹{p.price}<span className="small muted">/month</span></div>
              <ul className="clean">{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="card">
          <h3>Our promise</h3>
          <ul className="clean">
            <li>We only use public tender information and follow every portal’s rules.</li>
            <li>We never submit a bid for you. You stay in control with your own digital signature.</li>
            <li>Your business data stays private, is used only for matching and preparing your papers, and you can delete it any time.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
