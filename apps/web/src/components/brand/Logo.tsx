import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The supplied logo is a glossy 3D lockup with the wordmark baked in.
 * `mark` crops to the V for tight chrome; `full` uses the whole lockup.
 */
export function Logo({
  size = 34,
  className,
  withWordmark = true,
}: {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="relative shrink-0 overflow-hidden rounded-[10px]"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/vini-pos-logo-transparent.png"
          alt="Vini POS"
          width={size * 3}
          height={size * 3}
          priority
          className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-[62%]"
          style={{ width: size * 1.62, height: "auto" }}
        />
      </span>
      {withWordmark && (
        <span
          className="text-[17px] font-extrabold tracking-[-0.035em]"
          style={{ color: "var(--ink)" }}
        >
          Vini<span style={{ color: "var(--lime-deep)" }}>POS</span>
        </span>
      )}
    </span>
  );
}
