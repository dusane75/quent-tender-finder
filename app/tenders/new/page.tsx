import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import AddTender from "./AddTender";

export default async function NewTender({ searchParams }: { searchParams: Promise<{ library?: string }> }) {
  const { library } = await searchParams;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const asLibrary = Boolean(isAdmin) && library === "1";
  return (
    <div className="wrap narrow stack" style={{ paddingTop: 28 }}>
      <div>
        <h1 style={{ fontSize: 30 }}>{asLibrary ? "Add a tender to the shared library" : "Add a tender"}</h1>
        <p className="muted">
          {asLibrary
            ? "Every business whose work matches will be alerted. Use public notices only (NMC, ZP, newspaper, portal listings)."
            : "Upload the tender PDF you downloaded from the portal, or paste the tender notice text. The AI reads it in a few seconds."}
        </p>
        {Boolean(isAdmin) && (
          <p className="small">
            {asLibrary ? <a href="/tenders/new">Add just for me instead</a> : <a href="/tenders/new?library=1">Admin: add to shared library instead</a>}
          </p>
        )}
      </div>
      <AddTender userId={user.id} library={asLibrary} />
    </div>
  );
}
