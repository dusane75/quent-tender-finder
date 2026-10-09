"use client";
import { useState } from "react";
import type { BidPack } from "@/lib/ai";

export default function BidPackView({ tenderId, initial, portalUrl }: { tenderId: string; initial: BidPack | null; portalUrl: string | null }) {
  const [pack, setPack] = useState<BidPack | null>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function make() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/tenders/${tenderId}/bid-pack`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Something went wrong");
      setPack(d);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  function copy(text: string) { navigator.clipboard?.writeText(text); }

  if (!pack) {
    return (
      <div className="card stack">
        <p>Takes about 20–40 seconds.</p>
        {err && <div className="notice err">{err}</div>}
        <div><button className="btn" onClick={make} disabled={busy}>{busy ? "Preparing your papers…" : "Prepare my bid papers"}</button></div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row noprint">
        <button className="btn" onClick={() => window.print()}>Print / save as PDF</button>
        <button className="btn ghost" onClick={make} disabled={busy}>{busy ? "Preparing again…" : "Prepare again"}</button>
        {portalUrl && <a className="btn ghost" href={portalUrl} target="_blank" rel="noopener noreferrer">Go to official portal ↗</a>}
      </div>
      {err && <div className="notice err">{err}</div>}

      {pack.missing_info?.length > 0 && (
        <div className="card stack noprint">
          <h2>Still to arrange</h2>
          <ul className="clean">{pack.missing_info.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}

      <div className="card stack noprint">
        <h2>Document checklist</h2>
        <table className="sheet"><tbody>
          {pack.checklist?.map((c, i) => (
            <tr key={i}>
              <td>{c.document}</td>
              <td><span className={"pill " + (c.have ? "green" : "amber")}>{c.have ? "You have" : "Arrange"}</span> {c.note}</td>
            </tr>
          ))}
        </tbody></table>
      </div>

      <div className="card stack">
        <div className="row between noprint"><h2 style={{ margin: 0 }}>1. Covering letter</h2><button className="btn small ghost" onClick={() => copy(pack.cover_letter)}>Copy</button></div>
        <div className="doc">{pack.cover_letter}</div>
      </div>

      <div className="card stack pagebreak">
        <h2>2. Bidder information sheet</h2>
        <table className="sheet"><tbody>
          {pack.info_sheet?.map((r, i) => <tr key={i}><td>{r.field}</td><td>{r.value}</td></tr>)}
        </tbody></table>
      </div>

      {pack.declarations?.map((d, i) => (
        <div key={i} className="card stack pagebreak">
          <div className="row between noprint"><h2 style={{ margin: 0 }}>{3 + i}. {d.title}</h2><button className="btn small ghost" onClick={() => copy(d.body)}>Copy</button></div>
          <h3 className="print-only">{d.title}</h3>
          <div className="doc">{d.body}</div>
        </div>
      ))}

      <div className="card stack noprint">
        <h2>How to submit (you do this yourself)</h2>
        <ol>{pack.submission_steps?.map((x, i) => <li key={i}>{x}</li>)}</ol>
        <p className="hint">After submitting, come back and tap “I applied” on the tender so we remind you about results and deadlines.</p>
      </div>
    </div>
  );
}
