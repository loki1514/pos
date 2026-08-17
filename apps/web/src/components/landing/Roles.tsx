import { ChefHat, ClipboardList, ReceiptText, Smartphone } from "lucide-react";

const ROLES = [
  {
    name: "Biller / POS",
    icon: ReceiptText,
    points: ["Create and manage orders", "Billing and payments", "Sees kitchen delays"],
  },
  {
    name: "Captain",
    icon: Smartphone,
    points: ["Mobile-first table ordering", "Live order status", "Runs the floor"],
  },
  {
    name: "KOT / Kitchen",
    icon: ChefHat,
    points: ["Receive and prepare", "Add delay", "Raise low-stock alerts"],
  },
  {
    name: "Manager",
    icon: ClipboardList,
    points: ["Operational oversight", "Configuration", "Analytics"],
  },
];

export function Roles() {
  return (
    <section id="roles" className="relative z-10 px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="t-label text-[var(--lime-deep)]">Roles</span>
          <h2 className="t-h1 mt-3 text-balance">
            Configurable from day one.
          </h2>
          <p className="mt-4 text-[16.5px] leading-[1.65] text-muted">
            The organization admin creates users, assigns roles and sets
            permissions without waiting on Vini. New roles can be added later
            without a release.
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(({ name, icon: Icon, points }) => (
            <div
              key={name}
              className="glass press press-glass rounded-[var(--r-xl)] p-5"
            >
              <div className="relative z-10">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[12px]"
                  style={{ background: "#14170f" }}
                >
                  <Icon size={17} className="text-[var(--lime)]" />
                </span>
                <h3 className="mt-4 text-[15.5px] font-bold tracking-[-0.02em]">
                  {name}
                </h3>
                <ul className="mt-3 space-y-2">
                  {points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2 t-small text-muted"
                    >
                      <span
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                        style={{ background: "var(--lime-deep)" }}
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
