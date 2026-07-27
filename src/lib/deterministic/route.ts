/**
 * Route of administration — RG-1 (backend spec §4.6).
 *
 * `[LOCKED]` Route is a GROUPING KEY, not a label, so it must be complete and
 * inspectable. Derive it live from `dosing_regimens` where present, fall back to
 * dated reference data for the remaining investigational assets, and carry the
 * source PER VALUE — not once for the row.
 *
 * Route as a fixed physical fact is reference data like a lexicon alias, not
 * invented intelligence. That permission has a hard edge though: a reference
 * value we cannot source is not reference data, it is a guess. Where no source
 * exists this returns null and the caller renders "not established" rather than a
 * plausible-looking route.
 *
 * `[DATA-FACT]` dosing_regimens is a JSONB column on `assets` (not a table), and
 * is populated for the 5 marketed assets. There is no route column.
 */

export type Route =
  | 'oral'
  | 'subcutaneous'
  | 'intravenous'
  | 'intramuscular'
  | 'inhaled'
  | 'topical'

/** Where a single route value came from. Travels with the value (§4.6). */
export type RouteSource = 'label-dosing' | 'reference'

export interface RouteValue {
  route: Route
  source: RouteSource
  /** Human description of the specific source, for display on hover. */
  sourceDetail: string
  /** Date the source was current. Reference values are re-checked when trials land. */
  asOf: string | null
  /** The dose string this was derived from, when live-derived. */
  derivedFrom: string | null
}

/**
 * Dose-string patterns, most specific first. These read the label's own dosing
 * text, so a match is evidence rather than inference.
 */
const DOSE_ROUTE: Array<[RegExp, Route]> = [
  [/\bsubcutaneous|\bsub-?cut\b|\bSC\b|\bs\.c\.\b/i, 'subcutaneous'],
  [/\bintravenous|\binfusion\b|\bIV\b|\bi\.v\.\b/i,  'intravenous'],
  [/\bintramuscular|\bIM\b|\bi\.m\.\b/i,             'intramuscular'],
  [/\boral\b|\bPO\b|capsule|tablet|pellet|syrup|suspension/i, 'oral'],
  [/\binhal|nebuli[sz]|\bMDI\b/i,                    'inhaled'],
  [/\btopical|\bcream\b|\bointment\b/i,              'topical'],
]

/** Route implied by a single dose string, or null when it says nothing. */
export function routeFromDose(dose: string | null | undefined): Route | null {
  if (!dose) return null
  for (const [pattern, route] of DOSE_ROUTE) {
    if (pattern.test(dose)) return route
  }
  return null
}

/**
 * Dated reference routes for assets with no dosing data.
 *
 * DELIBERATELY EMPTY. Six assets (deucrictibant, lonvoguran ziclumeran,
 * mezagitamab, bcx17725, navenibart, sebetralstat) have no dosing_regimens, and
 * §4.6 allows dated reference data for exactly that case — but a reference entry
 * has to name a source and a date to be reference data at all. Filling these from
 * general knowledge would be a fabricated value wearing a provenance label, which
 * is the one thing the free tier must never do.
 *
 * Add entries here only with a citable source, and they will flow through with
 * source 'reference' and their own asOf date. Until then those assets report no
 * established route, which is true.
 */
const REFERENCE_ROUTES: Record<string, { route: Route; sourceDetail: string; asOf: string }> = {
  // 'deucrictibant': { route: 'oral', sourceDetail: '<source>', asOf: '<YYYY-MM-DD>' },
}

/** Minimum asset shape the route derivation needs. */
export interface RouteBearingAsset {
  inn?: string | null
  /** JSONB array on `assets`. Entries carry a `dose` string. */
  dosing_regimens?: Array<{ dose?: string | null }> | null
  /** Label version date, used as the asOf for live-derived values. */
  label_effective_date?: string | null
}

/**
 * Every distinct route for an asset, each carrying its own source.
 *
 * Returns an array because an asset can genuinely have more than one route, and
 * §4.6 requires the grouping key to be complete rather than collapsed to a
 * primary. An empty array means no route is established — render that honestly.
 */
export function routesOfAsset(asset: RouteBearingAsset): RouteValue[] {
  const regimens = Array.isArray(asset.dosing_regimens) ? asset.dosing_regimens : []
  const byRoute = new Map<Route, RouteValue>()

  for (const r of regimens) {
    const route = routeFromDose(r?.dose)
    if (!route || byRoute.has(route)) continue
    byRoute.set(route, {
      route,
      source: 'label-dosing',
      sourceDetail: asset.label_effective_date
        ? `Derived from the approved dosing on the product label, effective ${asset.label_effective_date}`
        : 'Derived from the approved dosing on the product label',
      asOf: asset.label_effective_date ?? null,
      derivedFrom: r?.dose ?? null,
    })
  }

  if (byRoute.size > 0) return [...byRoute.values()]

  const ref = asset.inn ? REFERENCE_ROUTES[asset.inn.toLowerCase()] : undefined
  if (ref) {
    return [{
      route: ref.route,
      source: 'reference',
      sourceDetail: ref.sourceDetail,
      asOf: ref.asOf,
      derivedFrom: null,
    }]
  }

  return []
}

/** Reader-facing label for a route. */
export const ROUTE_LABEL: Record<Route, string> = {
  oral:          'Oral',
  subcutaneous:  'Subcutaneous',
  intravenous:   'Intravenous',
  intramuscular: 'Intramuscular',
  inhaled:       'Inhaled',
  topical:       'Topical',
}

/**
 * Short provenance sentence for one route value, for display beside it. Names how
 * the value was established, because §4.6 requires the source to be visible per
 * value rather than once for the row.
 */
export function describeRouteSource(v: RouteValue): string {
  return v.source === 'label-dosing'
    ? `${v.sourceDetail}${v.derivedFrom ? ` ("${v.derivedFrom}")` : ''}`
    : `Reference value. ${v.sourceDetail}`
}
