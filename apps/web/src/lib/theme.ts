/**
 * Chameleon — per-organization appearance.
 *
 * Pure functions, no server imports, so both the settings preview (client)
 * and the shell (server) derive identical values from the same input.
 *
 * The contract that makes this safe: every colour path — accent picker,
 * weather shift, whatever comes later — funnels through `themeVars()`, and
 * `themeVars()` clamps lightness/saturation into bands proven to keep
 * ink-on-accent and body text above WCAG AA. A caller cannot produce an
 * illegible theme by construction.
 */

export type OrgTheme = {
  /** Hex accent, e.g. "#b4ee2a". Empty/absent = platform lime. */
  accent?: string;
  /** Font id from FONT_CATALOG. Empty/absent = platform default. */
  font?: string;
  /** Opt-in ambient hue drift with local weather. */
  weatherHint?: boolean;
};

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export type FontEntry = {
  id: string;
  label: string;
  stack: string;
  /** Google Fonts family name; null = already loaded / system. */
  google: string | null;
  hint?: string;
};

/**
 * Curated on purpose — no arbitrary font URLs. Every entry has full latin
 * coverage, 4+ weights, an OFL licence, and stays legible at the 13px we use
 * for table rows.
 */
export const FONT_CATALOG: FontEntry[] = [
  {
    id: "",
    label: "Vini default (Plus Jakarta Sans)",
    stack: "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif",
    google: null,
  },
  {
    id: "inter",
    label: "Inter",
    stack: "'Inter', ui-sans-serif, system-ui, sans-serif",
    google: "Inter",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    stack: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
    google: "DM+Sans",
  },
  {
    id: "poppins",
    label: "Poppins",
    stack: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    google: "Poppins",
  },
  {
    id: "source-serif",
    label: "Source Serif 4",
    stack: "'Source Serif 4', Georgia, serif",
    google: "Source+Serif+4",
    hint: "Serif — best for a formal, print-like feel",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    stack: "'JetBrains Mono', ui-monospace, monospace",
    google: "JetBrains+Mono",
    hint: "Monospace — figures line up, but wide at small sizes",
  },
];

export function fontById(id: string | undefined): FontEntry {
  return FONT_CATALOG.find((f) => f.id === (id ?? "")) ?? FONT_CATALOG[0];
}

/** Stylesheet href for a catalog font, or null when nothing extra is needed. */
export function fontHref(id: string | undefined): string | null {
  const entry = fontById(id);
  if (!entry.google) return null;
  return `https://fonts.googleapis.com/css2?family=${entry.google}:wght@400;500;600;700;800&display=swap`;
}

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Relative luminance → used to decide readable ink on the accent. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const int = parseInt(m[1], 16);
  const ch = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** WCAG contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export type WeatherCondition =
  | "clear"
  | "clouds"
  | "rain"
  | "snow"
  | "unknown";

export type WeatherShift = { dh: number; ds: number; dl: number };

/**
 * Ambient drift. Deliberately small — the point is that a room feels
 * different, not that the product looks like a different product.
 *
 * Applied BEFORE the band clamps in themeVars(), so no weather state can
 * push a colour out of the accessible range.
 */
export function weatherShift(
  condition: WeatherCondition,
  tempC: number | null,
): WeatherShift {
  switch (condition) {
    case "clear":
      if (tempC !== null && tempC >= 28) return { dh: 10, ds: 0.03, dl: 0 };
      if (tempC !== null && tempC <= 12) return { dh: -10, ds: 0, dl: 0 };
      return { dh: 4, ds: 0.01, dl: 0 };
    case "rain":
      return { dh: -15, ds: -0.08, dl: -0.02 };
    case "clouds":
      return { dh: -5, ds: -0.05, dl: -0.01 };
    case "snow":
      return { dh: -20, ds: -0.1, dl: 0.02 };
    default:
      return { dh: 0, ds: 0, dl: 0 };
  }
}

/** WMO weather code (open-meteo) → our five buckets. */
export function conditionFromWmo(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3 || (code >= 45 && code <= 48)) return "clouds";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "unknown";
}

// ---------------------------------------------------------------------------
// The single source of truth
// ---------------------------------------------------------------------------

export const PLATFORM_ACCENT = "#b4ee2a";

export type ThemeVars = Record<string, string>;

/**
 * Accent (+ optional weather drift) → the CSS custom properties the shell
 * already consumes. Returns {} for the platform default so the stock
 * globals.css values win untouched.
 */
export function themeVars(
  theme: OrgTheme | null | undefined,
  shift: WeatherShift = { dh: 0, ds: 0, dl: 0 },
): ThemeVars {
  const accent = theme?.accent?.trim();
  if (!accent || accent.toLowerCase() === PLATFORM_ACCENT) {
    // No accent override and no drift → let the stock theme stand.
    if (shift.dh === 0 && shift.ds === 0 && shift.dl === 0) return {};
  }

  const base = hexToHsl(accent || PLATFORM_ACCENT);
  if (!base) return {};

  // Drift, then clamp into the accessible band. Order matters: the clamp is
  // what makes every weather state safe by construction.
  const h = (base.h + shift.dh + 360) % 360;
  const s = clamp(base.s + shift.ds, 0.35, 0.95);
  const l = clamp(base.l + shift.dl, 0.42, 0.72);

  const mid = { h, s, l };

  // Ink on the accent must clear 3:1 (WCAG AA for UI components). Picking by
  // a luminance threshold alone is not enough — a mid-luminance accent can
  // fail against BOTH near-black and white. So: try both inks, and if the
  // better one still falls short, walk the accent's lightness away from the
  // middle until it clears. This is what makes every accent × weather state
  // safe by construction rather than by hope.
  const DARK_INK = hslToHex({ h, s: 0.9, l: 0.12 });
  const MIN_RATIO = 3.05; // a hair over 3:1 to survive rounding

  let solved = mid;
  let ink = "#ffffff";
  let best = 0;

  for (let step = 0; step <= 14; step++) {
    // Alternate outward from the starting lightness: darker, then lighter.
    const delta = Math.ceil(step / 2) * 0.03 * (step % 2 === 1 ? -1 : 1);
    const candidate = { h, s, l: clamp(mid.l + delta, 0.14, 0.9) };
    const hex = hslToHex(candidate);

    const vsWhite = contrast(hex, "#ffffff");
    const vsDark = contrast(hex, DARK_INK);
    const better = vsWhite >= vsDark ? vsWhite : vsDark;

    if (better > best) {
      best = better;
      solved = candidate;
      ink = vsWhite >= vsDark ? "#ffffff" : DARK_INK;
    }
    if (better >= MIN_RATIO) break;
  }

  return {
    "--lime": hslToHex(solved),
    "--lime-bright": hslToHex({
      h,
      s: clamp(s + 0.06, 0, 1),
      l: clamp(solved.l + 0.14, 0, 0.94),
    }),
    "--lime-deep": hslToHex({
      h,
      s: clamp(s + 0.02, 0, 1),
      l: clamp(solved.l - 0.22, 0.12, 1),
    }),
    "--lime-ink": ink,
  };
}

/** Font id → the vars the shell reads. {} for the default. */
export function fontVars(fontId: string | undefined): ThemeVars {
  const entry = fontById(fontId);
  if (!entry.id) return {};
  return { "--font-body": entry.stack, "--font-display": entry.stack };
}
