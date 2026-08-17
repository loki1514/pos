/**
 * Tactile feedback for the press model (see /docs/DESIGN_SPEC.md §5).
 * Silently no-ops on desktop and wherever the Vibration API is absent.
 */

type Weight = "light" | "medium" | "heavy" | "success" | "warn";

const PATTERNS: Record<Weight, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  success: [10, 40, 16],
  warn: [18, 60, 18],
};

export function haptic(weight: Weight = "light"): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;

  // Respect the user's motion preference — haptics are motion too.
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  try {
    navigator.vibrate(PATTERNS[weight]);
  } catch {
    /* some browsers throw when the document is not focused */
  }
}
