/**
 * The field the glass refracts (see /docs/DESIGN_SPEC.md §6).
 * Server component — pure CSS, no JS cost.
 */
export function Aurora({ dense = false }: { dense?: boolean }) {
  return (
    <div className="aurora" aria-hidden>
      <div
        className="aurora-blob"
        style={{
          top: "-14%",
          left: "-6%",
          width: "46vw",
          height: "46vw",
          background:
            "radial-gradient(circle, rgb(180 238 42 / 0.5), transparent 66%)",
          opacity: dense ? 0.7 : 0.5,
          animation: "drift 22s ease-in-out infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          top: "8%",
          right: "-12%",
          width: "40vw",
          height: "40vw",
          background:
            "radial-gradient(circle, rgb(214 255 99 / 0.42), transparent 68%)",
          opacity: dense ? 0.6 : 0.42,
          animation: "drift 28s ease-in-out infinite reverse",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          bottom: "-18%",
          left: "24%",
          width: "52vw",
          height: "38vw",
          background:
            "radial-gradient(circle, rgb(121 188 13 / 0.24), transparent 70%)",
          opacity: 0.4,
          animation: "drift 34s ease-in-out infinite",
        }}
      />
    </div>
  );
}
