import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Aurora } from "@/components/ui/Aurora";
import { Rail } from "@/components/admin/Rail";
import { TopBar } from "@/components/admin/TopBar";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gates /admin; this is defence in depth and gives the
  // layout the session it needs to render the account chip.
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  return (
    <div className="relative min-h-dvh">
      <Aurora />
      <Rail />
      <div className="relative z-10 px-4 pb-24 md:pb-6 md:pl-[92px] md:pr-6">
        <div className="mx-auto max-w-[1400px]">
          <TopBar email={session.sub} />
          {children}
        </div>
      </div>
    </div>
  );
}
