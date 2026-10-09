import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { DOCUMENTS, daysLeft, fmtDate, rupees } from "@/lib/constants";
import { setStatus } from "@/app/actions";
import AiPanels from "./AiPanels";

export default async function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: t } = await supabase.from("tenders").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const where = [t.location, t.district, t.state].filter(Boolean).join(", ");
  const [{ data: track }, { data: profile }, { data: summaries }] = await Promise.all([
    supabase.from("user_tenders").select("*").eq("user_id", user.id).eq("tender_id", id).maybeSingle(),
    supabase.from("profiles").select("language, documents_held").eq("id", user.id).maybeSingle(),
    supabase.from("tender_summaries").select("language, summary").eq("tender_id", id),
  ]);
  if (!profile) redirect("/onboarding");

  const d = daysLeft(t.closing_at);
  const status = track?.status || "matched";
  const held: string[] = profile.documents_held || [];
  const required: string[] = Array.isArray(t.documents) ? t.documents : [];
  const haveDoc = (name: string) => {
    const n = name.toLowerCase();
    return DOCUMENTS.some((doc) => held.includes(doc.id) && doc.label.toLowerCase().split(/[ /()]+/).some((w) => w.length > 3 && n.includes(w)));
  };

  const StatusBtn = ({ s, label }: { s: string; label: string }) => (
    <form action={setStatus}>
      <input type="hidden" name="tender_id" value={id} />
      <input type="hidden" name="status" value={s} />
      <button className={"btn small" + (status === s ? "" : " ghost")}>{label}</button>
    </form>
  );

  return (
    <div className="wrap stack" style={{ paddingTop: 24 }}>
      <Link href="/dashboard" className="small">← Back to dashboard</Link>
      <div className="card stack">
        <div className="row between">
          <span className="muted small">{t.organisation || "Organisation not given"}{t.tender_ref ? ` · Ref ${t.tender_ref}` : ""}</span>
          {d !== null && <span className={"pill " + (d < 0 ? "grey" : d <= 3 ? "red" : d <= 7 ? "amber" : "green")}>{d < 0 ? "Closed" : `${d} days left`}</span>}
        </div>
        <h1 style={{ fontSize: 28 }}>{t.title}</h1>
        {t.work_description && <p>{t.work_description}</p>}
        <div className="facts">
          <div className="fact"><span>Tender value</span><b>{rupees(t.value)}</b></div>
          <div className="fact"><span>EMD (deposit)</span><b>{rupees(t.emd)}</b></div>
          <div className="fact"><span>Last date</span><b style={{ fontSize: 15 }}>{fmtDate(t.closing_at)}</b></div>
          <div className="fact"><span>Location</span><b style={{ fontSize: 15 }}>{where || "—"}</b></div>
        </div>
        <div className="row">
          <StatusBtn s="saved" label="★ Save" />
          <StatusBtn s="applied" label="✓ I applied" />
          {status === "applied" || status === "won" || status === "lost" ? (
            <>
              <StatusBtn s="won" label="Won" />
              <StatusBtn s="lost" label="Lost" />
            </>
          ) : null}
          <StatusBtn s="dismissed" label="Not for me" />
          {t.url && <a className="btn small ghost" href={t.url} target="_blank" rel="noopener noreferrer">Open on official portal ↗</a>}
        </div>
        {track?.match_reason && <span className="muted small">{track.match_reason}</span>}
      </div>

      <AiPanels
        tenderId={id}
        defaultLang={profile.language}
        cachedSummaries={Object.fromEntries((summaries || []).map((s) => [s.language, s.summary]))}
        eligibility={track?.eligibility || null}
      />

      <div className="card stack">
        <h2>Document checklist</h2>
        {required.length === 0 ? (
          <p className="muted">The tender didn’t list documents clearly. Check the full tender document on the portal.</p>
        ) : (
          <ul className="clean" style={{ listStyle: "none", paddingLeft: 0 }}>
            {required.map((doc, i) => {
              const ok = haveDoc(doc);
              return (
                <li key={i} className="row" style={{ alignItems: "flex-start" }}>
                  <span className={"pill " + (ok ? "green" : "amber")}>{ok ? "You have" : "Arrange"}</span>
                  <span>{doc}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint">“You have” is based on the documents you ticked in Settings. Always check the latest tender document.</p>
      </div>

      <div className="card stack">
        <h2>Prepare your bid</h2>
        <p className="muted">
          We’ll fill a cover letter, standard declarations and a bidder information sheet with your details, ready to print on your letterhead.
          You review, sign and upload them on the portal yourself — we never submit bids.
        </p>
        <div><Link href={`/tenders/${id}/bid-pack`} className="btn">{track?.bid_pack ? "Open my bid papers" : "Prepare my bid papers"}</Link></div>
      </div>
    </div>
  );
}
