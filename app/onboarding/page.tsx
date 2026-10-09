import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import ProfileForm from "../ProfileForm";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (p && !error) redirect("/dashboard");
  return (
    <div className="wrap narrow stack" style={{ paddingTop: 28 }}>
      <div>
        <h1 style={{ fontSize: 32 }}>Set up your tender alerts</h1>
        <p className="muted">Takes 2 minutes. Your 30-day free trial starts now.</p>
      </div>
      {error && <div className="notice err">{error}</div>}
      <ProfileForm p={p} back="/onboarding" />
    </div>
  );
}
