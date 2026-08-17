/**
 * Single-series order volume, 14 days. Bars because the values are discrete
 * daily totals, not a continuous signal. Brand lime carries the series; the
 * final (current) day is emphasised rather than colour-coded, so the chart
 * stays readable without introducing a second hue.
 */
export function VolumeChart({ data }: { data: number[] }) {
  const max = Math.max(...data);

  return (
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="t-h3">Platform order volume</h2>
            <p className="mt-1 t-small text-muted">
              Last 14 days · all organizations
            </p>
          </div>
          <div className="text-right">
            <div className="tnum text-[26px] font-extrabold leading-none tracking-[-0.04em]">
              {data.reduce((a, b) => a + b, 0).toLocaleString("en-IN")}k
            </div>
            <div className="mt-1 t-small text-muted">total orders</div>
          </div>
        </div>

        <div
          className="mt-7 flex h-40 items-end gap-[5px]"
          role="img"
          aria-label={`Order volume over the last 14 days, rising from ${data[0]} to ${data[data.length - 1]} thousand orders per day.`}
        >
          {data.map((v, i) => {
            const isLast = i === data.length - 1;
            return (
              <div
                key={i}
                className="group relative flex-1 rounded-t-[6px] transition-all duration-300 hover:opacity-100"
                style={{
                  height: `${(v / max) * 100}%`,
                  background: isLast
                    ? "linear-gradient(180deg, var(--lime-bright), var(--lime-deep))"
                    : "linear-gradient(180deg, var(--lime), rgb(180 238 42 / 0.35))",
                  opacity: isLast ? 1 : 0.62,
                  boxShadow: isLast
                    ? "0 8px 22px -6px rgb(121 188 13 / .7)"
                    : "none",
                }}
              >
                <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 rounded-[8px] bg-[#14170f] px-2 py-1 text-[11px] font-bold tabular-nums text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {v}k
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
