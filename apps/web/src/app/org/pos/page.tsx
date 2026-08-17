import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getMyOrg } from "@/lib/org";
import {
  listCategories,
  listMenuItems,
  listOrderItems,
  listPendingOrders,
  listTables,
} from "@/lib/pos";
import { PosScreen } from "@/components/org/pos/PosScreen";

export const metadata: Metadata = { title: "POS Billing" };
export const dynamic = "force-dynamic";

/** Roles that may run the till. */
const POS_ROLES = new Set(["org_admin", "manager", "biller"]);

export default async function PosPage() {
  const org = await getMyOrg();

  if (!org || !POS_ROLES.has(org.myRole)) {
    return (
      <div className="glass rounded-[var(--r-xl)] p-8 text-center">
        <div className="relative z-10 mx-auto max-w-sm space-y-3">
          <ShieldAlert size={28} className="mx-auto text-[var(--warn)]" />
          <h1 className="t-h3">Billing access needed</h1>
          <p className="text-[14px] text-muted">
            The POS billing screen is available to Organization Admins, Managers
            and Billers. Ask your admin to update your role.
          </p>
        </div>
      </div>
    );
  }

  const [categories, items, tables, pending] = await Promise.all([
    listCategories(org.id),
    listMenuItems(org.id),
    listTables(org.id),
    listPendingOrders(org.id),
  ]);
  const pendingItems = await listOrderItems(pending.map((o) => o.id));

  return (
    <PosScreen
      orgId={org.id}
      categories={categories}
      menuItems={items}
      tables={tables}
      pendingOrders={pending}
      pendingItems={pendingItems}
    />
  );
}
