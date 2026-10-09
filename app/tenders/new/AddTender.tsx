"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function AddTender({ userId, library }: { userId: string; library: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      let filePath: string | null = null;
      if (mode === "pdf") {
        if (!file) throw new Error("Choose the tender PDF first.");
        if (file.size > 18 * 1024 * 1024) throw new Error("This PDF is over 18 MB. Upload just the notice (NIT) part, or paste its text.");
        setBusy("Uploading the PDF…");
        const supabase = createClient();
        filePath = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("tender-docs").upload(filePath, file, { contentType: "application/pdf" });
        if (up.error) throw new Error(up.error.message);
      } else if (text.trim().length < 80) {
        throw new Error("Please paste the full tender notice text (at least a few lines).");
      }
      setBusy("Reading the tender with AI… (10–40 seconds)");
      const res = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, text: mode === "text" ? text : null, url: url || null, library }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push(`/tenders/${data.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <div className="tabs" style={{ marginBottom: 0 }}>
        <a href="#" className={mode === "pdf" ? "on" : ""} onClick={(e) => { e.preventDefault(); setMode("pdf"); }}>Upload PDF</a>
        <a href="#" className={mode === "text" ? "on" : ""} onClick={(e) => { e.preventDefault(); setMode("text"); }}>Paste text</a>
      </div>
      {mode === "pdf" ? (
        <div>
          <label>Tender PDF</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <p className="hint">Download it from the official portal yourself (enter their CAPTCHA there), then upload it here.</p>
        </div>
      ) : (
        <div>
          <label>Tender notice text</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full notice: work name, estimated cost, EMD, last date, eligibility…" style={{ minHeight: 220 }} />
        </div>
      )}
      <div>
        <label>Link to the tender <span className="hint">(optional)</span></label>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mahatenders.gov.in/…" />
      </div>
      {err && <div className="notice err">{err}</div>}
      <button className="btn" disabled={Boolean(busy)}>{busy || (library ? "Add to library and alert matches" : "Read this tender")}</button>
    </form>
  );
}
