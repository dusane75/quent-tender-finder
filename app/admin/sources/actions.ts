"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function addSource(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const url = String(form.get("url") || "").trim();
  if (!/^https?:\/\/.+\..+/.test(url)) redirect("/admin/sources?error=" + encodeURIComponent("That doesn't look like a web address."));
  const { error } = await supabase.from("sources").insert({
    name: String(form.get("name") || "").trim().slice(0, 200),
    url: url.slice(0, 500),
    state: String(form.get("state") || "") || null,
    district: String(form.get("district") || "").trim().slice(0, 60) || null,
  });
  if (error) redirect("/admin/sources?error=" + encodeURIComponent(error.message));
  revalidatePath("/admin/sources");
  redirect("/admin/sources?added=1");
}

export async function toggleSource(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  await supabase.from("sources")
    .update({ enabled: String(form.get("enabled")) === "1" })
    .eq("id", String(form.get("id")));
  revalidatePath("/admin/sources");
}
