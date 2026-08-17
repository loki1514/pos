import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function StatTile({
  label,
  value,
  delta,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  hint?: string;
}) {
  const up = (delta ?? 0) >= 0;

  return (
    <div className="glass press press-glass rounded-[var(--r-xl)] p-5">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <span className="t-label text-muted">{label}</span>
          <span className="glass-inset inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
            <Icon size={15} className="text-ink-2" />
          </span>
        </div>

        <div className="mt-4 flex items-end gap-2.5">
          <span className="tnum text-[32px] font-extrabold leading-none tracking-[-0.04em]">
            {value}
          </span>
          {delta !== undefined && (
            <span
              className="tnum mb-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[12px] font-bold"
              style={{
                background: up
                  ? "rgb(79 191 106 / 0.14)"
                  : "rgb(226 86 75 / 0.12)",
                color: up ? "var(--ok)" : "var(--danger)",
              }}
            >
              {up ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>

        {hint && <p className="mt-2 text-[12.5px] text-muted">{hint}</p>}
      </div>
    </div>
  );
}
