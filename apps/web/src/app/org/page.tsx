import type { Metadata } from "next";
import {
  ClipboardList,
  CreditCard,
  IndianRupee,
  LayoutGrid,
  Receipt,
  Utensils,
} from "lucide-react";
import { getMyOrg } from "@/lib/org";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const TYPE_BLURB: Record<string, string> = {
  franchise:
    "Franchise dashboard — live operations, billing and reports for your outlets land here.",
  investor:
    "Investor dashboard — portfolio performance and organization reports land here.",
};

function StatTile({
  icon: Icon,
  label,
  hint,
}: {
  icon: typeof IndianRupee;
  label: string;
  hint: string;
}) {
  return (
    <div className="glass rounded-[var(--r-lg)] p-4">
      <div className="relative z-10">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[12px]"
          style={{ background: "#14170f" }}
        >
          <Icon size={16} className="text-[var(--lime)]" />
        </span>
        <p className="tnum mt-3 text-[26px] font-extrabold leading-none tracking-tight">
          —
        </p>
        <p className="mt-1.5 text-[13px] font-bold">{label}</p>
        <p className="t-small text-muted">{hint}</p>
      </div>
    </div>
  );
}

function EmptySection({
  icon: Icon,
  title,
  blurb,
}: {
  icon: typeof IndianRupee;
  title: string;
  blurb: string;
}) {
  return (
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="text-[var(--lime-deep)]" />
          <h2 className="t-h3">{title}</h2>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
            style={{ background: "rgb(242 169 59 / 0.15)", color: "var(--warn)" }}
          >
            Coming soon
          </span>
        </div>
        <div className="mt-4 rounded-[14px] border border-dashed border-[var(--line-strong)] px-5 py-8 text-center">
          <p className="t-small text-muted">{blurb}</p>
        </div>
      </div>
    </div>
  );
}

export default async function OrgOverview() {
  const org = await getMyOrg();

  return (
    <div className="space-y-5">
      {/* Org identity — mirrors the inspiration's outlet header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="t-h1">{org?.name ?? "Overview"}</h1>
          <p className="mt-1 text-[14.5px] text-muted">
            {TYPE_BLURB[org?.type ?? ""] ??
              "Your organization dashboard lands here."}
          </p>
        </div>
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold capitalize"
          style={{
            background: "rgb(180 238 42 / 0.16)",
            color: "var(--lime-deep)",
          }}
        >
          <LayoutGrid size={12} strokeWidth={2.6} />
          {org?.type} · {org?.myRole.replace("_", " ")}
        </span>
      </div>

      {/* KPI row — real numbers once POS/orders go live */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={IndianRupee} label="Today's sales" hint="From POS billing" />
        <StatTile icon={ClipboardList} label="Live orders" hint="Across all channels" />
        <StatTile icon={CreditCard} label="Awaiting payment" hint="Bills not settled" />
        <StatTile icon={Utensils} label="Active tables" hint="Dining areas" />
      </div>

      <EmptySection
        icon={Receipt}
        title="Pending table orders"
        blurb="Open bills from POS Billing will appear here — tap a table to resume billing, just like the reference layout."
      />
      <EmptySection
        icon={CreditCard}
        title="Awaiting payment · other channels"
        blurb="QR, delivery and captain orders waiting on settlement will scroll here."
      />
      <EmptySection
        icon={Utensils}
        title="Menu"
        blurb="Your categories and dishes will show here once the menu module is built."
      />
    </div>
  );
}
