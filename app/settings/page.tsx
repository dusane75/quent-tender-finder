import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import ProfileForm from "../ProfileForm";
import { deleteAccount, signOut } from "../actions";

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!p) redirect("/onboarding");
  const trialDays = Math.max(0, Math.ceil((new Date(p.trial_ends_at).getTime() - Date.now()) / 86400000));

  return (
    <div className="wrap narrow stack" style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 32 }}>Settings</h1>
      {saved && <div className="notice ok">Saved. Your matches are updated.</div>}
      {error === "confirm" ? <div className="notice err">Type DELETE to confirm deleting your account.</div> : error ? <div className="notice err">{error}</div> : null}
      <div className="card row between">
        <div><b>Plan:</b> {p.plan === "trial" ? `Free trial — ${trialDays} days left` : p.plan}</div>
        <span className="muted small">Paid plans start after your trial.</span>
      </div>

      <ProfileForm p={p} back="/settings" />

      <div className="card stack">
        <h2>Your data</h2>
        <p className="muted small">Download everything we store about your business, or delete it all permanently.</p>
        <div className="row">
          <Link className="btn ghost" href="/api/my-data">Download my data</Link>
          <form action={signOut}><button className="btn ghost">Sign out</button></form>
        </div>
        <form action={deleteAccount} className="stack">
          <label>Delete my account <span className="hint">— type DELETE to confirm. This cannot be undone.</span></label>
          <div className="row">
            <input type="text" name="confirm" placeholder="DELETE" style={{ maxWidth: 200 }} />
            <button className="btn" style={{ background: "var(--red)", borderColor: "var(--red)" }}>Delete everything</button>
          </div>
        </form>
      </div>
    </div>
  );
}
