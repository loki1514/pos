import { ArrowRight, Check, Flame, Timer } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

const TICKET = [
  { qty: 2, name: "Paneer Tikka", note: "Extra spicy", done: true },
  { qty: 1, name: "Dal Makhani", note: null, done: true },
  { qty: 3, name: "Butter Naan", note: "No butter · 1", done: false },
  { qty: 1, name: "Veg Biryani", note: null, done: false },
];

export function Hero() {
  return (
    <section className="relative z-10 px-5 pb-16 pt-32 sm:pt-40">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
        {/* ---- Copy ---- */}
        <div className="rise">
          <span className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5">
            <span className="relative z-10 rounded-full bg-[var(--lime)] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--lime-ink)]">
              v1
            </span>
            <span className="relative z-10 text-[13px] font-semibold text-ink-2">
              One platform. Every restaurant workflow.
            </span>
          </span>

          <h1 className="t-display mt-6 text-balance">
            Run the whole
            <br />
            restaurant on{" "}
            <span className="relative inline-block">
              <span className="relative z-10">one system</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 -z-0 h-[38%] rounded-[6px]"
                style={{
                  background:
                    "linear-gradient(180deg, var(--lime-bright), var(--lime))",
                  boxShadow: "0 8px 26px -8px rgb(121 188 13 / 0.7)",
                }}
              />
            </span>
            .
          </h1>

          <p className="mt-6 max-w-lg text-[16.5px] leading-[1.65] text-muted">
            Vini POS is a modular operations platform — orders, billing, kitchen,
            captain, payments and inventory. Not a different product per
            restaurant. The same modules, configured per organization.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login" variant="lime" size="lg" feedback="medium">
              Open the console
              <ArrowRight size={17} strokeWidth={2.6} />
            </ButtonLink>
            <ButtonLink href="#platform" variant="glass" size="lg">
              See how it works
            </ButtonLink>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-5">
            {[
              ["10", "core modules"],
              ["7", "order sources"],
              ["1", "order model"],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="tnum text-[30px] font-extrabold leading-none tracking-[-0.04em]">
                  {n}
                </dt>
                <dd className="mt-1.5 t-small text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---- Product visual ---- */}
        <div className="relative rise [animation-delay:140ms]">
          {/* KOT ticket */}
          <div className="glass relative rounded-[var(--r-2xl)] p-5 sm:p-6">
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="t-label text-muted">Kitchen · KOT</div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <span className="t-h2">Table 14</span>
                    <span className="rounded-full bg-[#14170f] px-2.5 py-1 text-[11px] font-bold text-white">
                      DINE-IN
                    </span>
                  </div>
                </div>
                <div className="glass-inset flex items-center gap-1.5 rounded-full px-3 py-1.5">
                  <Timer size={14} className="text-[var(--warn)]" />
                  <span className="tnum text-[13px] font-bold">08:24</span>
                </div>
              </div>

              <div className="mt-5 space-y-1.5">
                {TICKET.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 transition-colors"
                    style={{
                      background: item.done
                        ? "rgb(180 238 42 / 0.13)"
                        : "rgb(18 21 15 / 0.032)",
                    }}
                  >
                    <span
                      className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-extrabold"
                      style={{
                        background: item.done
                          ? "var(--lime)"
                          : "rgb(18 21 15 / 0.07)",
                        color: item.done ? "var(--lime-ink)" : "var(--ink)",
                      }}
                    >
                      {item.qty}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold leading-tight">
                        {item.name}
                      </span>
                      {item.note && (
                        <span className="block truncate text-[12.5px] text-muted">
                          {item.note}
                        </span>
                      )}
                    </span>
                    {item.done && (
                      <Check
                        size={16}
                        strokeWidth={3}
                        className="shrink-0 text-[var(--lime-deep)]"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2.5">
                <button className="btn-lime press press-glass h-11 flex-1 rounded-[14px] text-[14.5px] font-bold">
                  <span className="relative z-10">Mark ready</span>
                </button>
                <button className="glass press press-glass h-11 rounded-[14px] px-4 text-[14.5px] font-semibold">
                  <span className="relative z-10">+ Delay</span>
                </button>
              </div>
            </div>
          </div>

          {/* Floating source chip */}
          <div className="glass absolute -left-3 -top-6 hidden items-center gap-2.5 rounded-[var(--r-lg)] px-3.5 py-2.5 sm:flex">
            <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#14170f]">
              <Flame size={14} className="text-[var(--lime)]" />
            </span>
            <span className="relative z-10">
              <span className="block text-[12px] font-bold leading-tight">
                Order #4821
              </span>
              <span className="block text-[11px] text-muted">
                source · Captain
              </span>
            </span>
          </div>

          {/* Floating live counter */}
          <div className="glass absolute -bottom-6 -right-2 hidden items-center gap-3 rounded-[var(--r-lg)] px-4 py-3 sm:flex">
            <span
              className="relative z-10 h-2 w-2 shrink-0 rounded-full pulse-dot"
              style={{ background: "var(--ok)" }}
            />
            <span className="relative z-10">
              <span className="tnum block text-[17px] font-extrabold leading-none">
                12
              </span>
              <span className="block text-[11px] text-muted">
                tickets in kitchen
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
