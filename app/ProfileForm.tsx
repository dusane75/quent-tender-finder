import { saveProfile } from "./actions";
import { BUSINESS_TYPES, DOCUMENTS, LANGUAGES, STATES } from "@/lib/constants";

/* eslint-disable @typescript-eslint/no-explicit-any */
type P = Record<string, any> | null;

export default function ProfileForm({ p, back }: { p: P; back: "/onboarding" | "/settings" }) {
  const lakh = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(Number(v) / 100000));
  const states: string[] = p?.states?.length ? p.states : ["Maharashtra"];
  const districts: string[] = (p?.districts || []).filter((d: string) => d && d !== "Any");
  const docs: string[] = p?.documents_held || [];
  return (
    <form action={saveProfile} className="stack">
      <input type="hidden" name="back" value={back} />

      <div className="card stack">
        <h2>1. Your business</h2>
        <div className="grid two">
          <div><label>Business name *</label><input type="text" name="business_name" required defaultValue={p?.business_name || ""} /></div>
          <div><label>Owner / contact person</label><input type="text" name="owner_name" defaultValue={p?.owner_name || ""} /></div>
          <div><label>Mobile (for WhatsApp alerts later)</label><input type="tel" name="phone" defaultValue={p?.phone || ""} placeholder="98xxxxxxxx" /></div>
          <div>
            <label>Type of business</label>
            <select name="business_type" defaultValue={p?.business_type || ""}>
              <option value="">Choose…</option>
              {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div><label>Business address</label><input type="text" name="address" defaultValue={p?.address || ""} /></div>
      </div>

      <div className="card stack">
        <h2>2. What tenders do you want?</h2>
        <div>
          <label>Your work keywords * <span className="hint">— separate with commas</span></label>
          <input type="text" name="keywords" required defaultValue={(p?.keywords || []).join(", ")} placeholder="road work, printing, CCTV, furniture" />
        </div>
        <div>
          <label>States <span className="hint">— hold Ctrl / long-press to choose more than one</span></label>
          <select name="states" multiple size={8} defaultValue={states}>
            <option value="All India">All India (every state)</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Districts <span className="hint">— optional, separate with commas. Leave empty for the whole state.</span></label>
          <input type="text" name="districts" defaultValue={districts.join(", ")} placeholder="Nashik, Pune" />
        </div>
        <div className="grid two">
          <div><label>Smallest tender (₹ lakh)</label><input type="number" step="0.1" min="0" name="min_lakh" defaultValue={lakh(p?.min_value) || "0"} /></div>
          <div><label>Largest tender you can handle (₹ lakh)</label><input type="number" step="0.1" min="0" name="max_lakh" defaultValue={lakh(p?.max_value)} placeholder="e.g. 50" /></div>
        </div>
        <div>
          <label>Language for summaries</label>
          <div className="row">
            {LANGUAGES.map((l) => (
              <label key={l.code} className="inline">
                <input type="radio" name="language" value={l.code} defaultChecked={(p?.language || "mr") === l.code} /> {l.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2>3. Your experience & documents</h2>
        <p className="muted small">Used only to check eligibility and fill your bid papers. Skip anything you’re not sure about.</p>
        <div className="grid two">
          <div><label>Years in business</label><input type="number" min="0" name="years_experience" defaultValue={p?.years_experience ?? ""} /></div>
          <div><label>Average yearly turnover (₹ lakh)</label><input type="number" step="0.1" min="0" name="turnover_lakh" defaultValue={lakh(p?.annual_turnover)} /></div>
          <div><label>GSTIN</label><input type="text" name="gstin" defaultValue={p?.gstin || ""} /></div>
          <div><label>Business PAN</label><input type="text" name="pan" defaultValue={p?.pan || ""} /></div>
          <div><label>Udyam number</label><input type="text" name="udyam" defaultValue={p?.udyam || ""} /></div>
          <div><label>Registrations <span className="hint">e.g. PWD Class-IV</span></label><input type="text" name="registrations" defaultValue={p?.registrations || ""} /></div>
        </div>
        <div>
          <label>Past government / big works <span className="hint">— one per line: work, department, value, year</span></label>
          <textarea name="past_works" defaultValue={p?.past_works || ""} placeholder="Road resurfacing, Nashik ZP, ₹18 lakh, 2024" />
        </div>
        <div>
          <label>Documents you already have</label>
          <div className="checks">
            {DOCUMENTS.map((d) => (
              <label key={d.id}><input type="checkbox" name="documents" value={d.id} defaultChecked={docs.includes(d.id)} /> {d.label}</label>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <label className="inline"><input type="checkbox" name="email_alerts" defaultChecked={p ? p.email_alerts : true} /> Email me new matching tenders, deadline reminders (7, 3 and 1 day before) and a weekly report.</label>
        <label className="inline">
          <input type="checkbox" name="consent" required defaultChecked={Boolean(p)} />
          <span>I agree that my business details are stored securely and used only to find tenders, check eligibility and prepare my bid papers, as explained in the <a href="/privacy" target="_blank">privacy notice</a>. I can delete them any time.</span>
        </label>
        <button className="btn">{back === "/onboarding" ? "Save and show my tenders" : "Save changes"}</button>
      </div>
    </form>
  );
}
