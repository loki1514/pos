# Vini POS — Design Spec v1

Single source of truth for the visual system. Every screen implements this; nothing is styled ad hoc.

## 1. Reference language

Primary reference: **Outvetch — Retail POS Dashboard** by Odama (Dribbble shot 26099355), supplied by the user and inspected directly.

What was extracted from it:

| Element | Observation | What we steal |
|---|---|---|
| Canvas | Warm off-white, not pure white | Warm neutral canvas so white surfaces read as *lifted* |
| Cards | Pure white, ~20–24px radius, hairline border, wide soft shadow | Card = light object floating on warm ground |
| Nav | Narrow near-black icon rail, rounded, **lime active pill** | Rail + single lime selection marker |
| Accent | Lime/chartreuse used *only* on the primary CTA and active state | One accent, high restraint |
| Badges | Solid black pills, white text, small | Status/among-image chips |
| Type | Geometric grotesque; bold near-black titles, medium-grey body | High weight contrast, low color contrast |
| Density | Generous padding, 8pt rhythm | Breathing room over density |

The reference's lime is effectively the Vini logo green — the brand and the reference agree, so lime is the accent with no compromise.

**Our departure:** the brief asks for glass and translucency. The reference is opaque. So we keep its *layout, restraint and rhythm* and swap its opaque surfaces for a calibrated glass system (§4). Glass is applied to floating/interactive layers only — never to dense data tables, where it hurts legibility.

## 2. Palette

Tokens are CSS custom properties in `globals.css`. Never hardcode a hex in a component.

### Light (default)
| Token | Value | Use |
|---|---|---|
| `--canvas` | `#F1F1EE` | Page ground (warm) |
| `--canvas-2` | `#E7E8E2` | Recessed wells, track fills |
| `--ink` | `#12150F` | Primary text, near-black w/ green cast |
| `--ink-2` | `#383D33` | Secondary text |
| `--muted` | `#6C7267` | Tertiary text, labels |
| `--line` | `rgba(18,21,15,.08)` | Hairline borders, dividers |

### Dark
| Token | Value |
|---|---|
| `--canvas` | `#0A0C08` |
| `--canvas-2` | `#12160D` |
| `--ink` | `#F3F6EC` |
| `--ink-2` | `#C4CBBA` |
| `--muted` | `#8F978A` |
| `--line` | `rgba(255,255,255,.10)` |

### Brand (identical in both themes)
| Token | Value | Use |
|---|---|---|
| `--lime` | `#B4EE2A` | Primary CTA, active state |
| `--lime-bright` | `#D6FF63` | Gloss highlight, glow |
| `--lime-deep` | `#79BC0D` | Gradient foot, pressed lime |
| `--lime-ink` | `#1A2800` | Text *on* lime (passes AA) |

### State
`--ok #4FBF6A` · `--warn #F2A93B` · `--danger #E2564B` · `--info #4C93E8`

Delay/late states in KOT map to `--warn` → `--danger`; never use lime for status, it is reserved for *primary action*.

## 3. Typography

**Plus Jakarta Sans** (geometric grotesque, closest match to the reference) via `next/font`. Numerals use `font-variant-numeric: tabular-nums` everywhere money or counts appear — non-negotiable in a POS.

| Role | Size / Line | Weight | Tracking |
|---|---|---|---|
| Display | 60 / 1.0 | 800 | −0.045em |
| H1 | 40 / 1.06 | 800 | −0.035em |
| H2 | 28 / 1.16 | 700 | −0.025em |
| H3 | 20 / 1.3 | 700 | −0.02em |
| Body | 15 / 1.6 | 450 | −0.005em |
| Small | 13.5 / 1.5 | 450 | 0 |
| Label | 11.5 / 1.4 | 700 | +0.09em, uppercase |

Levers that make it read premium: **weight contrast** (800 display against 450 body), **restraint** (one accent), and **light** (specular highlights doing the work instead of color).

## 4. The glass system

Three tiers. Using the right tier is what separates crisp glass from muddy glass.

**Tier 1 — `.glass` (floating panels, nav, hero cards)**
- fill: vertical white gradient `.72 → .55` alpha
- `backdrop-filter: blur(20px) saturate(180%)`
- 1px border at `rgba(255,255,255,.7)`
- shadow stack: inset top specular + inset bottom rim + 3 ambient layers
- `::before` specular sweep across the top ~55%

**Tier 2 — `.glass-solid` (data surfaces: tables, lists, KOT tickets)**
Same geometry and shadow, but ~`.93` alpha and lighter blur. Legibility wins over effect.

**Tier 3 — `.glass-dark` (the admin rail, dark overlays)**
Near-black at `.72` with blur, white hairline at `.08`.

Rules:
- Never nest Tier 1 inside Tier 1 — blur compounds into mud. Inner elements use `.glass-inset` (a recessed well, no blur).
- Always give glass something to refract: the aurora field (§6) sits behind everything.
- Provide a `@supports not (backdrop-filter: blur(1px))` fallback that raises alpha to near-opaque.

## 5. Pressure / press feedback

The brief calls for a "pressure feel". Implemented as a physical model, not just an opacity change — on press the object moves *toward* the surface and its shadow collapses accordingly:

```
--ease-press: cubic-bezier(.2, .9, .25, 1);

.press            { transition: transform 160ms var(--ease-press),
                                box-shadow 160ms var(--ease-press); }
.press:active     { transform: translateY(1.5px) scale(.976); }
```

- Shadow ramps *down* on press (object is closer to the ground) and an inset shadow appears (it is being compressed).
- Lime buttons additionally dim their gloss `::before` on press.
- Hover lifts by `−1px` with an expanded shadow — the inverse of press.
- **Haptics:** `navigator.vibrate(8)` on `pointerdown` for primary actions (`lib/haptics.ts`). Silently no-ops on desktop.
- All of it disabled under `prefers-reduced-motion: reduce`.

## 6. Surface, shape, depth

- **Radii:** `sm 10 · md 14 · lg 20 · xl 26 · 2xl 34 · pill 999`
- **Spacing:** 4/8pt scale.
- **Aurora field:** two soft lime radial blobs + one neutral, heavily blurred, fixed behind content. This is what the glass refracts. Low opacity (.
  18–.28) so it never becomes decoration.
- **Grain:** a 2% SVG noise overlay across the page kills gradient banding and adds the "crisp" tactile read.

## 7. Components

Card · glass button (primary lime / secondary glass / ghost) · icon button · input · pill chip · badge · stat tile · data table row · icon rail · top bar · modal · empty state.

Every interactive component ships: default / hover / **active(press)** / focus-visible / disabled / loading.

## 8. Ten-steps-ahead checklist

1. Responsive — landing reflows at 1024/768/420; admin rail collapses to a bottom bar under 900px.
2. Theme — light + dark both authored, `prefers-color-scheme` + manual override attribute.
3. States — all six, on every control.
4. Data variance — longest org name truncates with ellipsis; tables handle 0 rows (empty state) and 500 rows.
5. Motion budget — transform/opacity only; no layout-animating properties. Backdrop-filter is capped to ~12 concurrent nodes.
6. A11y — AA contrast, visible focus rings, ≥44px hit targets, `prefers-reduced-motion`.
7. Haptics on primary actions.
8. Must not break — auth redirect, route protection.
9. Perf — fonts subset via `next/font`, logo served from `public/brand`, no CLS.
10. Reuse — everything is a token so POS / KOT / Captain inherit this system free.
