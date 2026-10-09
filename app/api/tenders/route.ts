import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { aiReady, extractTender } from "@/lib/ai";
import { cleanDistrict, cleanState } from "@/lib/places";

export const maxDuration = 60;

function cleanNum(v: unknown) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}
function cleanDate(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!aiReady()) return NextResponse.json({ error: "AI reading is not switched on yet. Please try again later." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { filePath, text, url, library } = body as { filePath?: string; text?: string; url?: string; library?: boolean };

  let isPublic = false;
  if (library) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    isPublic = Boolean(isAdmin);
  }

  type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
  const parts: Part[] = [];
  if (filePath) {
    if (!filePath.startsWith(`${user.id}/`)) return NextResponse.json({ error: "Not your file." }, { status: 403 });
    const dl = await supabase.storage.from("tender-docs").download(filePath);
    if (dl.error || !dl.data) return NextResponse.json({ error: "Could not open the uploaded PDF." }, { status: 400 });
    const buf = Buffer.from(await dl.data.arrayBuffer());
    parts.push({ inline_data: { mime_type: "application/pdf", data: buf.toString("base64") } });
    parts.push({ text: "Read this tender document." });
  } else if (text && text.trim().length > 50) {
    parts.push({ text: "TENDER NOTICE TEXT:\n" + text.slice(0, 60000) });
  } else {
    return NextResponse.json({ error: "Upload a PDF or paste the tender text." }, { status: 400 });
  }

  let ex;
  try {
    ex = await extractTender(parts);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI could not read this tender." }, { status: 502 });
  }

  const row = {
    is_public: isPublic,
    source: isPublic ? "library" : "upload",
    created_by: user.id,
    title: String(ex.title || "Untitled tender").slice(0, 300),
    organisation: ex.organisation ? String(ex.organisation).slice(0, 200) : null,
    location: ex.location ? String(ex.location).slice(0, 200) : null,
    state: cleanState(ex.state),
    district: cleanDistrict(ex.district),
    tender_ref: ex.tender_ref ? String(ex.tender_ref).slice(0, 200) : null,
    url: url && /^https?:\/\//.test(url) ? url.slice(0, 500) : null,
    value: cleanNum(ex.value),
    emd: cleanNum(ex.emd),
    fee: cleanNum(ex.fee),
    published_on: cleanDate(ex.published_on)?.slice(0, 10) || null,
    closing_at: cleanDate(ex.closing_at),
    work_description: ex.work_description ? String(ex.work_description).slice(0, 2000) : null,
    eligibility: Array.isArray(ex.eligibility) ? ex.eligibility.slice(0, 30) : [],
    documents: Array.isArray(ex.documents) ? ex.documents.slice(0, 40) : [],
    keywords: Array.isArray(ex.keywords) ? ex.keywords.map((k) => String(k).toLowerCase().slice(0, 40)).slice(0, 12) : [],
    raw_text: text ? text.slice(0, 60000) : null,
    file_path: filePath || null,
  };

  const { data: inserted, error } = await supabase.from("tenders").insert(row).select("id").single();
  if (error || !inserted) return NextResponse.json({ error: error?.message || "Could not save." }, { status: 500 });

  // track it for the person who added it
  await supabase.from("user_tenders").upsert({
    user_id: user.id, tender_id: inserted.id, status: "saved", match_reason: "Added by you",
  });

  return NextResponse.json({ id: inserted.id });
}
