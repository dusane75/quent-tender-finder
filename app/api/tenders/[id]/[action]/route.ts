import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { aiReady, checkEligibility, makeBidPack, summarise } from "@/lib/ai";
import { DOCUMENTS, type Lang } from "@/lib/constants";

export const maxDuration = 60;

function tenderForAI(t: Record<string, unknown>) {
  const { raw_text, file_path, created_by, ...rest } = t; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...rest, notice_text_excerpt: typeof raw_text === "string" ? raw_text.slice(0, 15000) : undefined };
}
function profileForAI(p: Record<string, unknown>) {
  const held = ((p.documents_held as string[]) || []).map((id) => DOCUMENTS.find((d) => d.id === id)?.label || id);
  return {
    business_name: p.business_name, owner_name: p.owner_name, phone: p.phone, email: p.email, address: p.address,
    business_type: p.business_type, years_experience: p.years_experience, annual_turnover_rupees: p.annual_turnover,
    past_works: p.past_works, registrations: p.registrations, gstin: p.gstin, pan: p.pan, udyam: p.udyam,
    documents_held: held,
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!aiReady()) return NextResponse.json({ error: "AI is not switched on yet." }, { status: 503 });

  const { data: tender } = await supabase.from("tenders").select("*").eq("id", id).maybeSingle();
  if (!tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Please complete your profile first." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  try {
    if (action === "summary") {
      const lang: Lang = ["mr", "hi", "en"].includes(body.lang) ? body.lang : profile.language;
      const { data: cached } = await supabase.from("tender_summaries").select("summary").eq("tender_id", id).eq("language", lang).maybeSingle();
      if (cached && !body.refresh) return NextResponse.json(cached.summary);
      const s = await summarise(tenderForAI(tender), lang);
      await supabase.from("tender_summaries").upsert({ tender_id: id, language: lang, summary: s });
      return NextResponse.json(s);
    }
    if (action === "eligibility") {
      const e = await checkEligibility(tenderForAI(tender), profileForAI(profile), profile.language);
      await supabase.from("user_tenders").upsert({ user_id: user.id, tender_id: id, eligibility: e, updated_at: new Date().toISOString() });
      return NextResponse.json(e);
    }
    if (action === "bid-pack") {
      const b = await makeBidPack(tenderForAI(tender), profileForAI(profile));
      await supabase.from("user_tenders").upsert({ user_id: user.id, tender_id: id, bid_pack: b, updated_at: new Date().toISOString() });
      return NextResponse.json(b);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed." }, { status: 502 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
}
