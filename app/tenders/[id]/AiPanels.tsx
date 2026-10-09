"use client";
import { useEffect, useState } from "react";
import { LANGUAGES, type Lang } from "@/lib/constants";
import type { Eligibility, Summary } from "@/lib/ai";

const VERDICT: Record<string, { cls: string; label: string }> = {
  eligible: { cls: "green", label: "Looks eligible" },
  not_eligible: { cls: "red", label: "Probably not eligible" },
  check: { cls: "amber", label: "Needs checking" },
};
const ITEM: Record<string, { cls: string; label: string }> = {
  met: { cls: "green", label: "Met" },
  not_met: { cls: "red", label: "Not met" },
  check: { cls: "amber", label: "Check" },
};

export default function AiPanels({ tenderId, defaultLang, cachedSummaries, eligibility }: {
  tenderId: string; defaultLang: Lang; cachedSummaries: Record<string, Summary>; eligibility: Eligibility | null;
}) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [sums, setSums] = useState<Record<string, Summary>>(cachedSummaries);
  const [sErr, setSErr] = useState("");
  const [sBusy, setSBusy] = useState(false);
  const [elig, setElig] = useState<Eligibility | null>(eligibility);
  const [eBusy, setEBusy] = useState(false);
  const [eErr, setEErr] = useState("");

  async function call<T>(action: string, body: object): Promise<T> {
    const r = await fetch(`/api/tenders/${tenderId}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Something went wrong");
    return d as T;
  }

  useEffect(() => {
    if (sums[lang]) return;
    setSBusy(true); setSErr("");
    call<Summary>("summary", { lang })
      .then((s) => setSums((p) => ({ ...p, [lang]: s })))
      .catch((e) => setSErr(e.message))
      .finally(() => setSBusy(false));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runElig() {
    setEBusy(true); setEErr("");
    try { setElig(await call<Eligibility>("eligibility", {})); } catch (e) { setEErr(e instanceof Error ? e.message : String(e)); }
    setEBusy(false);
  }

  const s = sums[lang];
  return (
    <>
      <div className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Simple summary</h2>
          <div className="row">
            {LANGUAGES.map((l) => (
              <button key={l.code} className={"btn small" + (lang === l.code ? "" : " ghost")} onClick={() => setLang(l.code)}>{l.label}</button>
            ))}
          </div>
        </div>
        {sBusy && <p className="muted">Writing the summary…</p>}
        {sErr && <div className="notice err">{sErr}</div>}
        {s && !sBusy && (
          <div className="stack">
            <h3>{s.headline}</h3>
            <p>{s.what_work}</p>
            <table className="sheet"><tbody>
              <tr><td>₹</td><td>{s.value}</td></tr>
              <tr><td>📍</td><td>{s.location}</td></tr>
              <tr><td>📅</td><td>{s.last_date}</td></tr>
              <tr><td>EMD</td><td>{s.emd}</td></tr>
            </tbody></table>
            {s.eligibility?.length > 0 && (<><b>✔</b><ul className="clean">{s.eligibility.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
            {s.watch_out?.length > 0 && <div className="notice"><b>⚠ </b>{s.watch_out.join(" · ")}</div>}
            <p className="hint">AI summary — always confirm with the official tender document.</p>
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Am I eligible?</h2>
          <button className="btn small" onClick={runElig} disabled={eBusy}>{eBusy ? "Checking…" : elig ? "Check again" : "Check now"}</button>
        </div>
        {eErr && <div className="notice err">{eErr}</div>}
        {!elig && !eBusy && <p className="muted">We compare the tender’s rules with your profile (turnover, experience, registrations, documents).</p>}
        {elig && (
          <div className="stack">
            <div className="row"><span className={"pill " + (VERDICT[elig.verdict]?.cls || "amber")}>{VERDICT[elig.verdict]?.label || elig.verdict}</span><b>{elig.headline}</b></div>
            <table className="sheet"><tbody>
              {elig.items?.map((it, i) => (
                <tr key={i}>
                  <td>{it.rule}</td>
                  <td><span className={"pill " + (ITEM[it.status]?.cls || "amber")}>{ITEM[it.status]?.label || it.status}</span> {it.reason}</td>
                </tr>
              ))}
            </tbody></table>
            {elig.next_steps?.length > 0 && <ul className="clean">{elig.next_steps.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <p className="hint">Based on your profile. Update Settings if something is missing.</p>
          </div>
        )}
      </div>
    </>
  );
}
