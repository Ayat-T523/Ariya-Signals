/**
 * timeHorizon.ts — the ONE shared Month/Quarter/Year time-horizon contract
 * (Historical evidence hydration, Step 1, 2026-08-24).
 *
 * A single source of truth for the three selectable horizons, consumed
 * identically by WarRoom.tsx and Portal.tsx (both read/write the SAME
 * AppContext slice -- see AppContext.tsx's own timeHorizon field) so
 * switching the horizon on one page is reflected on the other, never two
 * independently-drifting local states.
 *
 * `lookbackDays` for a horizon is a PURE read-side filter passed straight
 * through to GET /api/landscape/evidence's own `lookback_days` param (see
 * evidence_store.query_landscape_evidence()'s own docstring on the backend)
 * -- it never triggers a second hydration call. One completed hydration run
 * already covers every horizon simultaneously, since CT.gov's discovery
 * query is not itself date-windowed.
 */
export type TimeHorizon = 'month' | 'quarter' | 'year'

export const TIME_HORIZON_DAYS: Record<TimeHorizon, number> = {
  month: 30,
  quarter: 90,
  year: 365,
}

/** Short labels for a compact segmented-control UI (WarRoom.tsx/Portal.tsx's own time-horizon selector). */
export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}

export const DEFAULT_TIME_HORIZON: TimeHorizon = 'month'

export const TIME_HORIZONS: TimeHorizon[] = ['month', 'quarter', 'year']

export function isTimeHorizon(value: unknown): value is TimeHorizon {
  return value === 'month' || value === 'quarter' || value === 'year'
}
