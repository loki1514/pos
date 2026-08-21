"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CloudSun, LoaderCircle, Palette, TriangleAlert, Type } from "lucide-react";
import {
  saveAppearanceAction,
  type AppearanceState,
} from "@/app/admin/organizations/[id]/appearance-actions";
import {
  FONT_CATALOG,
  PLATFORM_ACCENT,
  fontById,
  fontHref,
  themeVars,
  type OrgTheme,
} from "@/lib/theme";
import { haptic } from "@/lib/haptics";

const INITIAL: AppearanceState = { ok: false, error: null };

const PRESETS = [
  { hex: PLATFORM_ACCENT, label: "Vini lime" },
  { hex: "#f97316", label: "Amber" },
  { hex: "#e11d48", label: "Rose" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#14b8a6", label: "Teal" },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="press btn-lime inline-flex h-11 items-center gap-2 rounded-[13px] px-5 text-[14px] font-extrabold disabled:opacity-50"
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {pending ? (
          <>
            <LoaderCircle size={15} className="animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Check size={15} strokeWidth={3} /> Save appearance
          </>
        )}
      </span>
    </button>
  );
}

/**
 * Per-organization appearance. Everything previews live against the real
 * shell tokens, so what you see in the preview is literally what the org's
 * staff will see — same `themeVars()` the server uses.
 */
export function OrgAppearanceCard({
  organizationId,
  orgName,
  initial,
}: {
  organizationId: string;
  orgName: string;
  initial: OrgTheme;
}) {
  const [accent, setAccent] = useState(initial.accent ?? PLATFORM_ACCENT);
  const [font, setFont] = useState(initial.font ?? "");
  const [weather, setWeather] = useState(Boolean(initial.weatherHint));

  const action = saveAppearanceAction.bind(null, organizationId);
  const [state, formAction] = useActionState(action, INITIAL);

  useEffect(() => {
    if (state.ok) haptic("success");
    else if (state.error) haptic("warn");
  }, [state]);

  // Load the previewed font so the sample renders in the real typeface.
  const href = fontHref(font);
  useEffect(() => {
    if (!href) return;
    const id = `font-preview-${font}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [href, font]);

  const preview = {
    ...themeVars({ accent }),
    fontFamily: fontById(font).stack,
  } as React.CSSProperties;

  const entry = fontById(font);

  return (
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: "#14170f" }}
          >
            <Palette size={15} className="text-[var(--lime)]" />
          </span>
          <h2 className="t-h3">Appearance</h2>
        </div>

        <p className="mt-3 t-small text-muted">
          Applies to everyone at {orgName} — one brand per organization, not
          per person. Changes flow in over ~600ms rather than snapping.
        </p>

        <form action={formAction} className="mt-5 space-y-5">
          {/* Live preview */}
          <div
            className="chameleon rounded-[var(--r-lg)] border border-[var(--line)] p-4"
            style={preview}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="inline-flex h-9 items-center rounded-[11px] px-3.5 text-[13px] font-extrabold"
                style={{
                  background:
                    "linear-gradient(180deg, var(--lime-bright), var(--lime))",
                  color: "var(--lime-ink)",
                }}
              >
                Primary action
              </span>
              <span
                className="inline-flex h-9 items-center rounded-[11px] border px-3.5 text-[13px] font-bold"
                style={{ borderColor: "var(--lime-deep)", color: "var(--lime-deep)" }}
              >
                Secondary
              </span>
              <span className="text-[13px] text-muted">
                The quick brown fox jumps over the lazy dog 0123
              </span>
            </div>
          </div>

          {/* Accent */}
          <div>
            <span className="t-label mb-2 block text-muted">Accent colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={accent.toLowerCase() === p.hex.toLowerCase()}
                  onClick={() => {
                    haptic("light");
                    setAccent(p.hex);
                  }}
                  className="press h-8 w-8 rounded-[9px] ring-offset-2"
                  style={{
                    background: p.hex,
                    boxShadow:
                      accent.toLowerCase() === p.hex.toLowerCase()
                        ? "0 0 0 2px var(--ink)"
                        : "inset 0 0 0 1px rgb(0 0 0 / .12)",
                  }}
                />
              ))}
              <label className="glass-inset ml-1 inline-flex h-9 items-center gap-2 rounded-[11px] px-2.5">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                  aria-label="Custom accent colour"
                />
                <span className="tnum text-[12.5px] font-bold uppercase">
                  {accent}
                </span>
              </label>
            </div>
            <input type="hidden" name="accent" value={accent} />
          </div>

          {/* Font */}
          <div>
            <label htmlFor="font" className="t-label mb-2 block text-muted">
              <Type size={12} className="mr-1 inline" />
              Typeface
            </label>
            <select
              id="font"
              name="font"
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="glass-inset h-11 w-full rounded-[13px] px-3.5 text-[14.5px] font-medium outline-none focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]"
            >
              {FONT_CATALOG.map((f) => (
                <option key={f.id || "default"} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            {entry.hint && (
              <p className="mt-1.5 t-small text-muted">{entry.hint}</p>
            )}
          </div>

          {/* Weather */}
          <div className="glass-inset rounded-[13px] p-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="weatherHint"
                checked={weather}
                onChange={(e) => {
                  haptic("light");
                  setWeather(e.target.checked);
                }}
                className="mt-0.5 h-4 w-4 accent-[var(--lime-deep)]"
              />
              <span>
                <span className="flex items-center gap-1.5 text-[14px] font-bold">
                  <CloudSun size={14} className="text-[var(--lime-deep)]" />
                  Weather hint
                </span>
                <span className="mt-0.5 block t-small text-muted">
                  The accent warms slightly on clear days and cools in rain.
                  Asks for approximate location once an hour; if it&apos;s
                  denied, the theme simply stays put.
                </span>
              </span>
            </label>
          </div>

          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium"
              style={{
                background: "rgb(226 86 75 / 0.1)",
                color: "var(--danger)",
                border: "1px solid rgb(226 86 75 / 0.24)",
              }}
            >
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </div>
          )}

          {state.ok && (
            <div
              className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium"
              style={{
                background: "rgb(79 191 106 / 0.12)",
                color: "var(--ok)",
                border: "1px solid rgb(79 191 106 / 0.28)",
              }}
            >
              <Check size={14} strokeWidth={3} />
              Saved — {orgName} sees this on their next load.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <SaveButton />
            <button
              type="submit"
              name="useDefault"
              value="true"
              onClick={() => {
                setAccent(PLATFORM_ACCENT);
                setFont("");
                setWeather(false);
              }}
              className="press glass-inset inline-flex h-11 items-center rounded-[13px] px-4 text-[13.5px] font-bold text-muted hover:text-ink"
            >
              Use Vini standard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
