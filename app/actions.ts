"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { DOCUMENTS } from "@/lib/constants";

function list(v: FormDataEntryValue | null) {
  return String(v || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}
function num(v: FormDataEntryValue | null) {
  const s = String(v || "").replace(/[,₹\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

export async function saveProfile(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const back = String(form.get("back") || "/onboarding") === "/settings" ? "/settings" : "/onboarding";
  const fail = (m: string) => redirect(`${back}?error=${encodeURIComponent(m)}`);
  if (!form.get("consent")) fail("Please agree to the privacy terms to continue.");

  const states = form.getAll("states").map(String).filter(Boolean);
  const districts = list(form.get("districts"));
  const docs = form.getAll("documents").map(String).filter((d) => DOCUMENTS.some((x) => x.id === d));
  const lakh = 100000;
  const row = {
    id: user.id,
    email: user.email,
    business_name: String(form.get("business_name") || "").trim().slice(0, 200),
    owner_name: String(form.get("owner_name") || "").trim().slice(0, 120) || null,
    phone: String(form.get("phone") || "").trim().slice(0, 20) || null,
    address: String(form.get("address") || "").trim().slice(0, 400) || null,
    states: states.length ? states : ["Maharashtra"],
    districts,
    keywords: list(form.get("keywords")),
    min_value: (num(form.get("min_lakh")) ?? 0) * lakh,
    max_value: num(form.get("max_lakh")) === null ? null : num(form.get("max_lakh"))! * lakh,
    language: ["mr", "hi", "en"].includes(String(form.get("language"))) ? String(form.get("language")) : "mr",
    business_type: String(form.get("business_type") || "") || null,
    years_experience: num(form.get("years_experience")),
    annual_turnover: num(form.get("turnover_lakh")) === null ? null : num(form.get("turnover_lakh"))! * lakh,
    past_works: String(form.get("past_works") || "").trim().slice(0, 3000) || null,
    registrations: String(form.get("registrations") || "").trim().slice(0, 1000) || null,
    documents_held: docs,
    gstin: String(form.get("gstin") || "").trim().toUpperCase().slice(0, 15) || null,
    pan: String(form.get("pan") || "").trim().toUpperCase().slice(0, 10) || null,
    udyam: String(form.get("udyam") || "").trim().toUpperCase().slice(0, 25) || null,
    email_alerts: Boolean(form.get("email_alerts")),
    updated_at: new Date().toISOString(),
  };
  if (!row.business_name) fail("Business name is required.");
  if (!row.keywords.length) fail("Add at least one work keyword.");

  const { error } = await supabase.from("profiles").upsert(row);
  if (error) fail(error.message);
  revalidatePath("/dashboard");
  redirect(back === "/settings" ? "/settings?saved=1" : "/dashboard?welcome=1");
}

export async function setStatus(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const tenderId = String(form.get("tender_id"));
  const status = String(form.get("status"));
  if (!["matched", "saved", "applied", "won", "lost", "dismissed"].includes(status)) return;
  await supabase.from("user_tenders").upsert({
    user_id: user.id, tender_id: tenderId, status, updated_at: new Date().toISOString(),
  });
  revalidatePath(`/tenders/${tenderId}`);
  revalidatePath("/dashboard");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccount(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  if (String(form.get("confirm")).trim().toUpperCase() !== "DELETE") {
    redirect("/settings?error=confirm");
  }
  // remove uploaded files, private tenders, tracking and profile
  const { data: files } = await supabase.storage.from("tender-docs").list(user.id, { limit: 1000 });
  if (files?.length) await supabase.storage.from("tender-docs").remove(files.map((f) => `${user.id}/${f.name}`));
  await supabase.from("user_tenders").delete().eq("user_id", user.id);
  await supabase.from("tenders").delete().eq("created_by", user.id).eq("is_public", false);
  await supabase.from("profiles").delete().eq("id", user.id);
  await supabase.rpc("delete_my_account");
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
