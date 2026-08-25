/**
 * marketWeatherPresentation.ts — Market Weather V1 honesty-fix extraction
 * (War Room semantic-integrity checkpoint, 2026-08-25).
 *
 * Extracted from WarRoom.tsx's own previously-inline computation so it can
 * be independently unit-tested (this repo's own convention: pure lib/
 * functions + a dedicated .test.ts, no DOM testing library — see
 * upcomingEvents.ts/.test.ts from this same checkpoint). Covers ONLY the
 * active-V1-landscape presentation; WarRoom.tsx still owns choosing between
 * this and the legacy (`!hasActiveLandscape`) computation, unchanged.
 *
 * PRODUCT BOUNDARY (do not violate): a genuine 'clearing'/'stable'/
 * 'pressure'/'storm' verdict may render ONLY from a validated, successful
 * backend result (status 'ok' with a real `state`). Loading, zero
 * qualifying Signals, synthesis-unavailable, and validation-failed are four
 * DIFFERENT conditions — none of them may collapse onto 'clearing' (or any
 * other real verdict). 'pending' is the single honest "no assessment yet"
 * badge state for all four; which one applies is carried in
 * `pressureQualifier`/`rowsEmptyMessage` text, not a second state model.
 * `MARKET_WEATHER_STATE_MAP` (the accepted backend-state -> frontend-state
 * mapping) is unchanged from the pre-checkpoint implementation.
 */
import type { WeatherState } from '../components/signals/types'
import type { MarketWeatherResult } from './api/marketWeather'

export const MARKET_WEATHER_STATE_MAP: Record<string, WeatherState> = {
  CALM: 'clearing', ACTIVE: 'stable', PRESSURE_BUILDING: 'pressure', HIGH_PRESSURE: 'storm',
}

export interface MarketWeatherPresentationInput {
  marketWeatherResult: MarketWeatherResult | null
  marketWeatherLoading: boolean
  /** The real V1 tracked-company scope (`discoveredCompanyIds.length`) —
   *  never the legacy HAE-only namespace (report section 3's own fix). */
  discoveredCompanyCount: number
  weatherWindow: 7 | 30 | 90
}

export interface MarketWeatherPresentation {
  pressureState: WeatherState
  pressureQualifier: string
  rowsEmptyMessage: string
}

export function computeMarketWeatherPresentation({
  marketWeatherResult, marketWeatherLoading, discoveredCompanyCount, weatherWindow,
}: MarketWeatherPresentationInput): MarketWeatherPresentation {
  const assessed = marketWeatherResult?.status === 'ok' && !!marketWeatherResult.state
  const pressureState: WeatherState = marketWeatherResult?.status === 'ok' && marketWeatherResult.state
    ? MARKET_WEATHER_STATE_MAP[marketWeatherResult.state]
    : 'pending'

  const pressureQualifier = assessed
    ? `over the last ${weatherWindow} days`
    : marketWeatherLoading
      ? 'assessment loading…'
      : marketWeatherResult?.status === 'no_signals'
        ? `no signals in the last ${weatherWindow} days`
        : 'assessment unavailable'

  const weatherWindowLabel = `${weatherWindow}-day`
  const rowsEmptyMessage = marketWeatherLoading
    ? 'Loading market assessment…'
    : marketWeatherResult?.status === 'no_signals'
      ? `No material competitive movement detected in this ${weatherWindowLabel} window.`
      : marketWeatherResult?.status === 'unavailable' || marketWeatherResult?.status === 'invalid'
        ? 'Market Weather synthesis unavailable.'
        : discoveredCompanyCount === 0
          ? 'Track competitors to see their weekly moves here.'
          : `No material competitive movement detected in this ${weatherWindowLabel} window.`

  return { pressureState, pressureQualifier, rowsEmptyMessage }
}
