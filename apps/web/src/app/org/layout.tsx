import { redirect } from "next/navigation";
import { Aurora } from "@/components/ui/Aurora";
import { OrgSidebar } from "@/components/org/OrgSidebar";
import { OrgTopBar } from "@/components/org/OrgTopBar";
import { getMyOrg } from "@/lib/org";
import { supabaseServer } from "@/lib/supabase-server";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/org");

  const org = await getMyOrg();
  if (!org) redirect("/login?next=/org");

  return (
    <div className="relative min-h-dvh">
      <Aurora />
      <OrgSidebar orgName={org.name} orgType={org.type} />
      <div className="relative z-10 lg:pl-[248px]">
        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <OrgTopBar email={user.email ?? ""} status={org.status} />
          {children}
        </div>
      </div>
    </div>
  );
}
