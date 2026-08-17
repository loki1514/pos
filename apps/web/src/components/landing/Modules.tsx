import {
  BarChart3,
  ChefHat,
  CreditCard,
  LayoutGrid,
  Package,
  Plug,
  ReceiptText,
  ScrollText,
  Smartphone,
  Users,
} from "lucide-react";

const MODULES = [
  { name: "Orders", desc: "The single order model every source feeds.", icon: ScrollText },
  { name: "POS / Biller", desc: "Create orders, bill, take payment.", icon: ReceiptText },
  { name: "KOT / Kitchen", desc: "Receive, prepare, delay, mark ready.", icon: ChefHat },
  { name: "Captain", desc: "Mobile-first table ordering and status.", icon: Smartphone },
  { name: "Tables", desc: "Floor layout, occupancy, transfers.", icon: LayoutGrid },
  { name: "Payments", desc: "Split, part-pay, settle, reconcile.", icon: CreditCard },
  { name: "Inventory", desc: "Stock levels and low-stock alerts.", icon: Package },
  { name: "Customers", desc: "Profiles, history, loyalty.", icon: Users },
  { name: "Integrations", desc: "Swiggy, Zomato, QR, aggregators.", icon: Plug },
  { name: "Analytics", desc: "Sales, throughput, kitchen timing.", icon: BarChart3 },
];

export function Modules() {
  return (
    <section id="modules" className="relative z-10 px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="t-label text-[var(--lime-deep)]">Modules</span>
          <h2 className="t-h1 mt-3 text-balance">
            Reusable capabilities, not separate products.
          </h2>
          <p className="mt-4 text-[16.5px] leading-[1.65] text-muted">
            An organization switches on the modules it needs. The code beneath
            them is shared by every organization on the platform.
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ name, desc, icon: Icon }) => (
            <div
              key={name}
              className="glass press press-glass group cursor-default rounded-[var(--r-xl)] p-5"
            >
              <div className="relative z-10">
                <span className="glass-inset inline-flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors group-hover:bg-[rgb(180_238_42_/_0.2)]">
                  <Icon
                    size={17}
                    className="text-ink-2 transition-colors group-hover:text-[var(--lime-deep)]"
                  />
                </span>
                <h3 className="mt-4 text-[15.5px] font-bold tracking-[-0.02em]">
                  {name}
                </h3>
                <p className="mt-1.5 t-small text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
