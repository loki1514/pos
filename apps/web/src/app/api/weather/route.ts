import { NextResponse } from "next/server";
import { conditionFromWmo } from "@/lib/theme";

/**
 * Ambient weather for the chameleon hue drift.
 *
 * open-meteo rather than OpenWeatherMap: no API key, so there is no secret to
 * leak and no client-side key at all.
 *
 * Privacy: coordinates are rounded to 1 decimal (~11 km) before they leave
 * this process, and nothing is persisted — the rounding doubles as the cache
 * key, so a whole city shares one upstream call.
 */

type Cached = { at: number; body: unknown };
const CACHE = new Map<string, Cached>();
const TTL_MS = 60 * 60 * 1000; // one hour, per the spec
const MAX_KEYS = 500;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required." }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Coordinates out of range." }, { status: 400 });
  }

  // Round before use, not just before logging — the precise value never
  // reaches the upstream service.
  const rLat = Math.round(lat * 10) / 10;
  const rLon = Math.round(lon * 10) / 10;
  const key = `${rLat},${rLon}`;

  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.body, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  }

  try {
    const upstream = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${rLat}&longitude=${rLon}` +
        `&current=temperature_2m,weather_code`,
      { signal: AbortSignal.timeout(4000) },
    );

    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);

    const data = (await upstream.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };

    const code = data.current?.weather_code ?? -1;
    const body = {
      condition: conditionFromWmo(code),
      tempC: data.current?.temperature_2m ?? null,
    };

    if (CACHE.size >= MAX_KEYS) CACHE.clear();
    CACHE.set(key, { at: Date.now(), body });

    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    // Fail silent by contract: an unknown condition maps to a zero shift, so
    // the theme is simply left alone rather than erroring at the user.
    return NextResponse.json({ condition: "unknown", tempC: null });
  }
}
