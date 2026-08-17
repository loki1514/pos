"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

const FLOWS = [
  {
    key: "dine-in",
    label: "Dine-in",
    blurb:
      "The captain opens the order at the table. Payment settles at the end of the meal.",
    steps: ["Captain", "Order", "Kitchen", "Ready", "Table", "Bill", "Payment"],
  },
  {
    key: "counter",
    label: "Counter service",
    blurb:
      "The biller takes payment up front, then the kitchen begins preparation.",
    steps: ["Biller", "Order", "Payment", "Kitchen", "Ready", "Customer"],
  },
  {
    key: "qr",
    label: "QR ordering",
    blurb:
      "The customer orders and pays from their own phone. No staff step at all.",
    steps: ["Customer", "QR Order", "Payment", "Kitchen", "Ready", "Customer"],
  },
] as const;

export function Workflows() {
  const [active, setActive] = useState(0);
  const flow = FLOWS[active];

  return (
    <section id="workflows" className="relative z-10 px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="t-label text-[var(--lime-deep)]">Workflows</span>
          <h2 className="t-h1 mt-3 text-balance">
            The order journey is configuration, not code.
          </h2>
          <p className="mt-4 text-[16.5px] leading-[1.65] text-muted">
            Three restaurants, three completely different journeys — all running
            the same Vini POS codebase.
          </p>
        </div>

        <div className="glass mt-12 rounded-[var(--r-2xl)] p-5 sm:p-8">
          <div className="relative z-10">
            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Workflow examples"
              className="glass-inset inline-flex flex-wrap gap-1 rounded-[16px] p-1"
            >
              {FLOWS.map((f, i) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={i === active}
                  onPointerDown={() => haptic("light")}
                  onClick={() => setActive(i)}
                  className={cn(
                    "press rounded-[12px] px-4 py-2.5 text-[13.5px] font-bold transition-colors",
                    i === active
                      ? "btn-lime"
                      : "text-muted hover:text-ink",
                  )}
                >
                  <span className="relative z-10">{f.label}</span>
                </button>
              ))}
            </div>

            <p className="mt-6 max-w-xl text-[15px] text-muted">{flow.blurb}</p>

            {/* Chain */}
            <div className="mt-7 flex flex-wrap items-center gap-x-1.5 gap-y-3">
              {flow.steps.map((step, i) => (
                <div key={`${flow.key}-${step}-${i}`} className="flex items-center gap-1.5">
                  <span
                    className="rise rounded-[13px] px-3.5 py-2.5 text-[13.5px] font-bold"
                    style={{
                      animationDelay: `${i * 55}ms`,
                      background:
                        i === flow.steps.length - 1
                          ? "linear-gradient(180deg, var(--lime-bright), var(--lime))"
                          : "rgb(18 21 15 / 0.05)",
                      color:
                        i === flow.steps.length - 1
                          ? "var(--lime-ink)"
                          : "var(--ink)",
                      border:
                        i === flow.steps.length - 1
                          ? "1px solid rgb(121 188 13 / .5)"
                          : "1px solid var(--line)",
                    }}
                  >
                    {step}
                  </span>
                  {i < flow.steps.length - 1 && (
                    <ChevronRight
                      size={15}
                      strokeWidth={2.6}
                      className="shrink-0 text-muted/60"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
