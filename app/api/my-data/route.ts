import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const [profile, tracking, uploads] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_tenders").select("*").eq("user_id", user.id),
    supabase.from("tenders").select("*").eq("created_by", user.id),
  ]);
  return new NextResponse(
    JSON.stringify({ profile: profile.data, tracked_tenders: tracking.data, my_uploaded_tenders: uploads.data }, null, 2),
    { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-tender-data.json"' } }
  );
}
