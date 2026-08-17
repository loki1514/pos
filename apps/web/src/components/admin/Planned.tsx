import { Hammer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Honest placeholder for screens that exist in the build order but have not
 * been built yet. Better than a 404: it tells you where the screen sits in the
 * plan instead of implying the route is broken.
 */
export function Planned({
  title,
  phase,
  position,
  blurb,
  scope,
  icon: Icon,
}: {
  title: string;
  phase: string;
  position: string;
  blurb: string;
  scope: string[];
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-h1">{title}</h1>
        <p className="mt-2 text-[15.5px] text-muted">{blurb}</p>
      </div>

      <div className="glass rounded-[var(--r-xl)] p-6 sm:p-8">
        <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]"
            style={{ background: "#14170f" }}
          >
            <Icon size={22} className="text-[var(--lime)]" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
                style={{
                  background: "rgb(242 169 59 / 0.14)",
                  color: "var(--warn)",
                }}
              >
                <Hammer size={12} strokeWidth={2.8} />
                Not built yet
              </span>
              <span className="rounded-full border border-[var(--line-strong)] px-2.5 py-1 text-[12px] font-bold">
                {phase}
              </span>
              <span className="t-small text-muted">Step {position}</span>
            </div>

            <h2 className="t-h3 mt-4">What this screen will do</h2>
            <ul className="mt-3 space-y-2">
              {scope.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-[14.5px]">
                  <span
                    className="mt-[9px] h-1 w-1 shrink-0 rounded-full"
                    style={{ background: "var(--lime-deep)" }}
                  />
                  <span className="text-ink-2">{s}</span>
                </li>
              ))}
            </ul>

            <p className="mt-5 t-small text-muted">
              Built in build order, one screen at a time — PRD → UI → code →
              migration → business logic → testing → approve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
