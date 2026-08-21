"use client";

import { useEffect, useState } from "react";
import {
  themeVars,
  weatherShift,
  type OrgTheme,
  type ThemeVars,
  type WeatherCondition,
} from "@/lib/theme";

/**
 * Applies the org's accent to the shell and, when opted in, drifts it with
 * local weather.
 *
 * The server already rendered the base accent inline (no flash of the stock
 * theme). This only *adds* the weather drift, client-side, because it needs
 * geolocation. If anything fails — permission denied, offline, upstream down
 * — we simply never override, and the server's colours stand.
 */
export function ChameleonShell({
  theme,
  children,
}: {
  theme: OrgTheme;
  children: React.ReactNode;
}) {
  const [drift, setDrift] = useState<ThemeVars | null>(null);

  useEffect(() => {
    if (!theme.weatherHint) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          );
          if (!res.ok) return;
          const { condition, tempC } = (await res.json()) as {
            condition: WeatherCondition;
            tempC: number | null;
          };
          if (cancelled) return;
          setDrift(themeVars(theme, weatherShift(condition, tempC)));
        } catch {
          /* fail silent — server theme stands */
        }
      },
      () => {
        /* permission denied — fail silent, exactly as specified */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 },
    );

    return () => {
      cancelled = true;
    };
  }, [theme]);

  // Only the drift is applied here; the base accent is already inline on the
  // server-rendered wrapper, so there is nothing to re-apply on first paint.
  return (
    <div className="chameleon contents" style={drift as React.CSSProperties}>
      {children}
    </div>
  );
}
