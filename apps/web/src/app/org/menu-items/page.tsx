import type { Metadata } from "next";
import { UtensilsCrossed } from "lucide-react";
import { getMyOrg } from "@/lib/org";
import { listCategories, listMenuItems } from "@/lib/pos";
import { MenuItemsManager } from "@/components/org/MenuItemsManager";

export const metadata: Metadata = { title: "Menu Items" };
export const dynamic = "force-dynamic";

/** Must match MENU_MANAGER_ROLES in ./actions.ts. */
const MANAGER_ROLES = ["org_admin", "manager", "biller"];

export default async function MenuItemsPage() {
  const org = await getMyOrg();
  if (!org) return null;

  const canManage = MANAGER_ROLES.includes(org.myRole);
  const [categories, items] = await Promise.all([
    listCategories(org.id),
    listMenuItems(org.id),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-h1">Menu Items</h1>
          <p className="mt-2 text-[15px] text-muted">
            The menu your POS grid sells from. Switch an item off and it
            disappears from billing instantly.
          </p>
        </div>
      </div>

      {canManage ? (
        <MenuItemsManager
          organizationId={org.id}
          categories={categories}
          items={items}
        />
      ) : (
        <div className="glass rounded-[var(--r-xl)] p-6">
          <div className="relative z-10 flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
              style={{ background: "#14170f" }}
            >
              <UtensilsCrossed size={17} className="text-[var(--lime)]" />
            </span>
            <div>
              <h2 className="t-h3">View only</h2>
              <p className="t-small text-muted">
                Only org admins, managers and billers can edit the menu. Your
                role is <span className="font-bold capitalize">{org.myRole}</span>.
              </p>
            </div>
          </div>
          <ul className="relative z-10 mt-5 divide-y divide-[var(--line)]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold">
                    {item.name}
                  </span>
                  <span className="tnum block text-[12px] text-muted">
                    ₹{item.price.toFixed(2)}
                  </span>
                </span>
                <span
                  className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                  style={
                    item.is_available
                      ? { background: "rgb(79 191 106 / 0.15)", color: "var(--ok)" }
                      : { background: "rgb(226 86 75 / 0.12)", color: "var(--danger)" }
                  }
                >
                  {item.is_available ? "On" : "Off"}
                </span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="py-8 text-center t-small text-muted">
                No menu items yet.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
