import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { daysLeft, fmtDate, rupees } from "@/lib/constants";

const TABS = [
  { id: "new", label: "New matches", statuses: ["matched"] },
  { id: "saved", label: "Saved", statuses: ["saved"] },
  { id: "applied", label: "Applied", statuses: ["applied", "won", "lost"] },
  { id: "deadlines", label: "Upcoming deadlines", statuses: ["matched", "saved", "applied"] },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; welcome?: string }> }) {
  const { tab = "new", welcome } = await searchParams;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("business_name, keywords, states, districts, trial_ends_at, plan").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data: rows } = await supabase
    .from("user_tenders")
    .select("status, match_reason, created_at, tenders(id, title, organisation, state, district, location, value, emd, closing_at, is_public)")
    .eq("user_id", user.id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(300);

  type Row = { status: string; match_reason: string | null; created_at: string; tenders: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const all = (rows || []) as Row[];
  const current = TABS.find((t) => t.id === tab) || TABS[0];
  let list = all.filter((r) => r.tenders && current.statuses.includes(r.status));
  if (current.id === "deadlines") {
    list = list
      .filter((r) => { const d = daysLeft(r.tenders.closing_at); return d !== null && d >= 0 && d <= 14; })
      .sort((a, b) => new Date(a.tenders.closing_at).getTime() - new Date(b.tenders.closing_at).getTime());
  }
  const counts = Object.fromEntries(TABS.map((t) => [t.id, all.filter((r) => r.tenders && t.statuses.includes(r.status)).length]));
  const trialLeft = Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / 86400000));

  return (
    <div className="wrap stack" style={{ paddingTop: 24 }}>
      {welcome && (
        <div className="notice ok">
          Welcome, {profile.business_name}! We’ll show tenders matching <b>{(profile.keywords || []).join(", ")}</b> here. You can also add any tender yourself.
        </div>
      )}
      <div className="row between">
        <div>
          <h1 style={{ fontSize: 30, marginBottom: 4 }}>{profile.business_name}</h1>
          <span className="muted small">
            {[(profile.districts || []).join(", "), (profile.states || []).join(", ")].filter(Boolean).join(" · ")}
            {" · "}{profile.plan === "trial" ? `${trialLeft} days of free trial left` : profile.plan}
          </span>
        </div>
        <Link href="/tenders/new" className="btn">+ Add a tender</Link>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.id} href={`/dashboard?tab=${t.id}`} className={t.id === current.id ? "on" : ""}>
            {t.label} ({counts[t.id]})
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="card stack">
          <h3>Nothing here yet</h3>
          {current.id === "new" ? (
            <p className="muted">
              New tenders that match your work will appear here and in your email. Got a tender PDF or notice already?
              Add it and we’ll explain it, check your eligibility and prepare your papers.
            </p>
          ) : (
            <p className="muted">Open a tender and tap “Save” or “I applied” to see it here.</p>
          )}
          <div><Link href="/tenders/new" className="btn ghost">Add a tender</Link></div>
        </div>
      ) : (
        <div className="tlist">
          {list.map((r) => {
            const t = r.tenders;
            const d = daysLeft(t.closing_at);
            return (
              <Link key={t.id} href={`/tenders/${t.id}`} className="titem">
                <div className="card">
                  <div className="row between">
                    <h3>{t.title}</h3>
                    {d !== null && (
                      <span className={"pill " + (d < 0 ? "grey" : d <= 3 ? "red" : d <= 7 ? "amber" : "green")}>
                        {d < 0 ? "Closed" : d === 0 ? "Closes today" : `${d} days left`}
                      </span>
                    )}
                  </div>
                  <div className="muted small">{t.organisation || "—"} · {[t.district, t.state].filter(Boolean).join(", ") || t.location || "Location not given"}</div>
                  <div className="row small" style={{ marginTop: 8 }}>
                    <span><b>Value:</b> {rupees(t.value)}</span>
                    <span><b>EMD:</b> {rupees(t.emd)}</span>
                    <span><b>Last date:</b> {fmtDate(t.closing_at)}</span>
                    {r.status !== "matched" && <span className="pill">{r.status}</span>}
                    {!t.is_public && <span className="pill grey">Added by you</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
