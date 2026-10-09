import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import BidPackView from "./BidPackView";

export default async function BidPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: t } = await supabase.from("tenders").select("id, title, tender_ref, organisation, url").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: track } = await supabase.from("user_tenders").select("bid_pack").eq("user_id", user.id).eq("tender_id", id).maybeSingle();

  return (
    <div className="wrap stack" style={{ paddingTop: 24 }}>
      <Link href={`/tenders/${id}`} className="small noprint">← Back to tender</Link>
      <div className="noprint">
        <h1 style={{ fontSize: 28 }}>Bid papers: {t.title}</h1>
        <div className="notice">
          <b>Please read:</b> these are drafts filled from your profile. Check every line, fill the blanks [ ______ ], print on your letterhead,
          sign and stamp. Then upload and submit on the official portal yourself with your digital signature. We never submit bids for you.
        </div>
      </div>
      <BidPackView tenderId={id} initial={track?.bid_pack || null} portalUrl={t.url} />
    </div>
  );
}
