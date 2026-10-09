import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { STATES } from "@/lib/constants";
import { addSource, toggleSource } from "./actions";

export default async function Sources({ searchParams }: { searchParams: Promise<{ error?: string; added?: string }> }) {
  const { error, added } = await searchParams;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/dashboard");

  const [{ data: sources }, { data: log }] = await Promise.all([
    supabase.from("sources").select("*").order("created_at", { ascending: false }),
    supabase.from("intake_log").select("*").order("created_at", { ascending: false }).limit(25),
  ]);

  return (
    <div className="wrap stack" style={{ paddingTop: 24 }}>
      <div>
        <h1 style={{ fontSize: 30 }}>Automatic tender sources</h1>
        <p className="muted">
          Every morning the app checks these pages and adds any new tenders, then alerts every business whose work matches.
          Before each check it reads the site’s own robots.txt rules and skips the page if the site asks robots not to read it.
        </p>
      </div>
      {added && <div className="notice ok">Added. It will be checked on the next run.</div>}
      {error && <div className="notice err">{error}</div>}

      <form action={addSource} className="card stack">
        <h2>Add a page</h2>
        <div className="grid two">
          <div><label>Name *</label><input type="text" name="name" required placeholder="Nashik Municipal Corporation — tenders" /></div>
          <div><label>Page address *</label><input type="text" name="url" required placeholder="https://…/tenders" /></div>
          <div>
            <label>State</label>
            <select name="state" defaultValue="">
              <option value="">(the page will say)</option>
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label>District</label><input type="text" name="district" placeholder="Nashik" /></div>
        </div>
        <button className="btn">Add page</button>
      </form>

      <div className="card stack">
        <h2>Pages being followed ({sources?.length || 0})</h2>
        {!sources?.length ? (
          <p className="muted">None yet. Add the tender pages of municipal corporations, Zilla Parishads and departments you want covered.</p>
        ) : (
          <table className="sheet">
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    <div className="muted small" style={{ fontWeight: 400 }}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a>
                      {s.district || s.state ? ` · ${[s.district, s.state].filter(Boolean).join(", ")}` : ""}
                    </div>
                  </td>
                  <td>
                    <span className={"pill " + (!s.enabled ? "grey" : s.robots_allowed === false ? "red" : s.robots_allowed ? "green" : "amber")}>
                      {!s.enabled ? "Off" : s.robots_allowed === false ? "Site says no" : s.robots_allowed ? "Allowed" : "Not checked yet"}
                    </span>
                    <div className="muted small" style={{ fontWeight: 400 }}>
                      {s.last_status || "waiting for first check"}
                      {s.last_checked_at ? ` · ${new Date(s.last_checked_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}
                    </div>
                    <form action={toggleSource}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="enabled" value={s.enabled ? "0" : "1"} />
                      <button className="btn small ghost">{s.enabled ? "Turn off" : "Turn on"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card stack">
        <h2>What arrived recently</h2>
        {!log?.length ? <p className="muted">Nothing yet. The first run happens tomorrow morning.</p> : (
          <table className="sheet">
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td>{l.kind}<div className="muted small" style={{ fontWeight: 400 }}>{new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div></td>
                  <td>{l.detail}<div className="muted small">found {l.found}, added {l.added}{l.error ? ` · ${l.error}` : ""}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
