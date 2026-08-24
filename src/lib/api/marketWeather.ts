/**
 * marketWeather.ts — Market Weather V1 read client (War Room semantic-
 * integrity checkpoint, 2026-08-25).
 *
 * Talks to GET /api/landscape/market-weather on the Ariya HTTP API
 * (ariya-lightci-python/market_weather_synthesis.py + api_server.py's
 * own `_handle_market_weather()` -- see that handler's own comment).
 *
 * PRODUCT BOUNDARY (do not violate): this client sends ONLY landscape
 * identity/scope + the selected window. It never sends Signal content,
 * never calls Groq itself, and never receives an API key -- the backend
 * reads and validates the real Signals server-side. This is a
 * PRESENTATION/interpretation read, never a mutation: repeating the same
 * request is always safe.
 */
import { apiGet } from './client'

export type MarketWeatherWindowDays = 7 | 30 | 90
export type MarketWeatherState = 'CALM' | 'ACTIVE' | 'PRESSURE_BUILDING' | 'HIGH_PRESSURE'
export type MarketWeatherStatus = 'ok' | 'no_signals' | 'unavailable' | 'invalid'

export interface MarketWeatherMovement {
  title: string
  summary: string
  signalIds: string[]
}

export interface MarketWeatherImplication {
  text: string
  signalIds: string[]
}

export interface MarketWeatherResult {
  status: MarketWeatherStatus
  windowDays: MarketWeatherWindowDays
  signalCount: number
  bundleCount: number
  state: MarketWeatherState | null
  summary: string | null
  movements: MarketWeatherMovement[]
  implications: MarketWeatherImplication[]
}

function toMarketWeatherResult(raw: any): MarketWeatherResult {
  return {
    status: raw.status,
    windowDays: raw.window_days,
    signalCount: raw.signal_count ?? 0,
    bundleCount: raw.bundle_count ?? 0,
    state: raw.state ?? null,
    summary: raw.summary ?? null,
    movements: (raw.movements ?? []).map((m: any) => ({ title: m.title, summary: m.summary, signalIds: m.signal_ids ?? [] })),
    implications: (raw.implications ?? []).map((i: any) => ({ text: i.text, signalIds: i.signal_ids ?? [] })),
  }
}

/**
 * `companyIds` must be canonical backend company keys -- same contract as
 * fetchLandscapeSignals()'s own docstring. Returns null (no network call)
 * when the caller has no real scope to ask about yet, matching that same
 * client's own short-circuit discipline.
 */
export async function fetchMarketWeather(
  companyIds: string[],
  indication: string | null | undefined,
  indicationId: string | null | undefined,
  windowDays: MarketWeatherWindowDays,
): Promise<MarketWeatherResult | null> {
  if (companyIds.length === 0) return null
  if (!indication && !indicationId) return null
  const params: Record<string, string> = { companies: companyIds.join(','), window_days: String(windowDays) }
  if (indication) params.indication = indication
  if (indicationId) params.indication_id = indicationId
  const raw = await apiGet<any>('/api/landscape/market-weather', params)
  return toMarketWeatherResult(raw)
}
