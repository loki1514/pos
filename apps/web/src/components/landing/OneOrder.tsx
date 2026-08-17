import {
  Bike,
  Monitor,
  QrCode,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
} from "lucide-react";

const SOURCES = [
  { label: "Captain", icon: Smartphone },
  { label: "POS", icon: Monitor },
  { label: "QR", icon: QrCode },
  { label: "Swiggy", icon: Bike },
  { label: "Zomato", icon: Bike },
  { label: "Pickup", icon: ShoppingBag },
  { label: "Delivery", icon: UtensilsCrossed },
];

export function OneOrder() {
  return (
    <section id="platform" className="relative z-10 px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="t-label text-[var(--lime-deep)]">One Order</span>
          <h2 className="t-h1 mt-3 text-balance">
            Seven sources. One order model.
          </h2>
          <p className="mt-4 text-[16.5px] leading-[1.65] text-muted">
            Every channel resolves to the same order entity — the source is just
            a field on it. The kitchen never needs different logic for a Swiggy
            order than for a captain&apos;s.
          </p>
        </div>

        <div className="glass mt-14 rounded-[var(--r-2xl)] p-6 sm:p-10">
          <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            {/* Sources */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
              {SOURCES.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="glass-inset flex items-center gap-2.5 rounded-[var(--r-md)] px-3.5 py-3"
                >
                  <Icon size={15} className="shrink-0 text-muted" />
                  <span className="truncate text-[13.5px] font-semibold">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Converge */}
            <div
              className="mx-auto h-px w-full max-w-[140px] lg:h-40 lg:w-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--lime-deep), transparent)",
              }}
            />

            {/* The order */}
            <div className="mx-auto w-full max-w-xs">
              <div
                className="relative overflow-hidden rounded-[var(--r-xl)] p-6 text-center"
                style={{
                  background:
                    "linear-gradient(180deg, var(--lime-bright), var(--lime) 55%, var(--lime-deep))",
                  boxShadow:
                    "inset 0 1px 0 rgb(255 255 255 / .7), 0 20px 50px -14px rgb(121 188 13 / .65)",
                }}
              >
                <div
                  className="t-label"
                  style={{ color: "rgb(26 40 0 / 0.62)" }}
                >
                  Core entity
                </div>
                <div
                  className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.045em]"
                  style={{ color: "var(--lime-ink)" }}
                >
                  ORDER
                </div>
                <div
                  className="mt-3 text-[13.5px] font-semibold"
                  style={{ color: "rgb(26 40 0 / 0.7)" }}
                >
                  items · table · instructions · status ·{" "}
                  <span className="font-extrabold">source</span>
                </div>
              </div>

              <p className="mt-5 text-center text-[13.5px] leading-relaxed text-muted">
                Routed onward by the organization&apos;s configured workflow —
                not by hardcoded branches.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
