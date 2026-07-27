/**
 * Deterministic importance score — D11 (backend spec §4.2).
 *
 * Ranks every signal from facts only, in this precedence:
 *   1. arc weight   (regulatory > trial > deal > ip > commercial > evidence > personnel)
 *   2. recency
 *   3. source count (how many sources carry the same event)
 *   4. a nudge for a near-dated forward catalyst
 *
 * No input is a judgment — that is what keeps this inside the no-AI line. It
 * replaces the previous keyword classifier, which inferred importance from
 * wording ("material agreement", "hard regulatory setback") and therefore made
 * interpretive calls the free tier is not allowed to make.
 *
 * Interpretive importance ("what this signal means for your product") is a paid
 * tease and is never computed here.
 *
 * NOTE ON THE ARC ORDER: the importance weighting below is NOT the §4.5 arc
 * *display* order used to sequence a thread. Display order is
 * trial → evidence → regulatory → commercial → ip → deal → personnel;
 * importance order is regulatory → trial → deal → ip → commercial → evidence →
 * personnel. Two different jobs. Do not unify them.
 *
 * CURRENT DATA REALITY (re-verify before relying on it): terms 3 and 4 are wired
 * and configurable but contribute nothing yet, because the data cannot support
 * them honestly:
 *   - source count: no event is carried by more than one source today (sources
 *     cover disjoint event types and source_hash dedup prevents duplicates), so
 *     every signal has exactly one source.
 *   - forward catalyst: regulatory_calendar has no future row carrying a
 *     competitor or drug link, so no signal can be tied to an upcoming catalyst.
 * Both activate automatically once the data lands. Neither is faked in the
 * meantime.
 */

import { arcOf, type Arc } from './facets'

// ── Config (weights live here, never as literals in the scoring code) ──────────

export const IMPORTANCE_CONFIG = {
  /**
   * Arc weight, highest first (§4.2 precedence 1).
   *
   * Steps of 100 with all lower-precedence terms capped below 100 in total
   * guarantee true precedence: recency + source count + catalyst can reorder
   * signals *within* an arc but can never lift one arc above another.
   */
  arcWeight: {
    regulatory: 700,
    trial:      600,
    deal:       500,
    ip:         400,
    commercial: 300,
    evidence:   200,
    personnel:  100,
  } as Record<Arc, number>,

  /** Recency (precedence 2). Linear decay to zero across the window. */
  recency: {
    windowDays: 90,
    maxPoints:  50,
  },

  /**
   * Recency for dates known only to the year (date_precision 'year').
   *
   * A year-only date is stored as YYYY-01-01, which for most of the year sits
   * outside the 90-day window and would score zero — ranking a paper published
   * this year as though it were ancient. "Published this year" is genuine recency
   * information at the precision the source gave, so it earns credit on a coarser
   * scale, deliberately capped below what a precisely-dated recent signal gets so
   * a vague date can never outrank a sharp one.
   */
  coarseRecency: {
    sameYearPoints: 30,
    lastYearPoints: 12,
  },

  /** Source count (precedence 3). Corroboration across independent sources. */
  sourceCount: {
    pointsPerExtraSource: 15,
    maxPoints:            30,
  },

  /** Near-dated forward catalyst (precedence 4). A nudge, not a reranking. */
  forwardCatalyst: {
    windowDays: 60,
    points:     15,
  },

  /**
   * Band thresholds on the total score. Set at arc-tier boundaries so a band is
   * always explainable ("this is act because it is regulatory"), never a magic
   * number. The frontend document owns the final act/watch/context presentation;
   * these are the deterministic defaults.
   */
  bands: {
    act:   500,   // regulatory, trial, deal
    watch: 300,   // ip, commercial
  },
} as const

// Sum of every lower-precedence term. Kept below the arc step (100) so
// precedence 1 can never be overturned by 2-4.
const MAX_LOWER_TERMS =
  IMPORTANCE_CONFIG.recency.maxPoints +
  IMPORTANCE_CONFIG.sourceCount.maxPoints +
  IMPORTANCE_CONFIG.forwardCatalyst.points

export type ImportanceBand = 'act' | 'watch' | 'context'

/** Minimum signal shape the score needs. */
export interface ScorableSignal {
  signal_type?: string | null
  date?: string | null
  /**
   * How precisely `date` is known. A 'year' value is stored as YYYY-01-01 and
   * must be scored on the coarse scale, not treated as a 1 January event.
   */
  date_precision?: 'day' | 'month' | 'year' | null
}

export interface ImportanceContext {
  /** Evaluation date. Passed in so scoring is pure and testable. */
  today: Date
  /**
   * How many distinct sources carry this same event. Defaults to 1 (no
   * corroboration). Never inferred — the caller must know it.
   */
  sourceCount?: number
  /**
   * Days until this signal's asset has a known forward catalyst, or null when
   * there is none. Never guessed.
   */
  daysToCatalyst?: number | null
}

/** Full breakdown, so a score can always be explained rather than asserted. */
export interface ImportanceBreakdown {
  arc: Arc | null
  arcPoints: number
  recencyPoints: number
  sourceCountPoints: number
  catalystPoints: number
  total: number
  band: ImportanceBand
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000
}

/**
 * Precedence 2: linear decay over the window; older than the window scores 0.
 *
 * A year-only date is scored on the coarse scale instead, because YYYY-01-01 is a
 * storage artefact rather than the event's day: for most of the year it falls
 * outside the window and would score zero, ranking a paper published this year as
 * though it were ancient.
 */
function recencyPoints(
  date: string | null | undefined,
  today: Date,
  precision?: 'day' | 'month' | 'year' | null,
): number {
  if (!date) return 0
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 0

  if (precision === 'year') {
    const { sameYearPoints, lastYearPoints } = IMPORTANCE_CONFIG.coarseRecency
    const diff = today.getUTCFullYear() - parsed.getUTCFullYear()
    if (diff <= 0) return sameYearPoints
    if (diff === 1) return lastYearPoints
    return 0
  }

  const { windowDays, maxPoints } = IMPORTANCE_CONFIG.recency
  const age = daysBetween(parsed, today)
  if (age < 0) return maxPoints          // dated today or ahead: freshest
  if (age >= windowDays) return 0
  return Math.round(maxPoints * (1 - age / windowDays))
}

/** Precedence 3: each corroborating source beyond the first, capped. */
function sourceCountPoints(sourceCount: number | undefined): number {
  const n = sourceCount ?? 1
  if (n <= 1) return 0
  const { pointsPerExtraSource, maxPoints } = IMPORTANCE_CONFIG.sourceCount
  return Math.min((n - 1) * pointsPerExtraSource, maxPoints)
}

/** Precedence 4: flat nudge when a forward catalyst falls inside the window. */
function catalystPoints(daysToCatalyst: number | null | undefined): number {
  if (daysToCatalyst == null) return 0
  const { windowDays, points } = IMPORTANCE_CONFIG.forwardCatalyst
  return daysToCatalyst >= 0 && daysToCatalyst <= windowDays ? points : 0
}

/** Band for a total score, from config thresholds. */
export function bandOf(total: number): ImportanceBand {
  if (total >= IMPORTANCE_CONFIG.bands.act) return 'act'
  if (total >= IMPORTANCE_CONFIG.bands.watch) return 'watch'
  return 'context'
}

/**
 * Score one signal, returning the full breakdown so the UI or a reviewer can
 * see exactly which facts produced it.
 */
export function importanceBreakdown(
  s: ScorableSignal,
  ctx: ImportanceContext,
): ImportanceBreakdown {
  const arc = arcOf(s.signal_type)
  const arcPoints = arc ? IMPORTANCE_CONFIG.arcWeight[arc] : 0
  const rec = recencyPoints(s.date, ctx.today, s.date_precision)
  const src = sourceCountPoints(ctx.sourceCount)
  const cat = catalystPoints(ctx.daysToCatalyst)
  const total = arcPoints + rec + src + cat
  return {
    arc,
    arcPoints,
    recencyPoints: rec,
    sourceCountPoints: src,
    catalystPoints: cat,
    total,
    band: bandOf(total),
  }
}

/** Total score only. */
export function importanceScore(s: ScorableSignal, ctx: ImportanceContext): number {
  return importanceBreakdown(s, ctx).total
}

/** Band only. */
export function importanceBand(s: ScorableSignal, ctx: ImportanceContext): ImportanceBand {
  return importanceBreakdown(s, ctx).band
}

/** Comparator for the Importance sort: highest score first, newest as tiebreak. */
export function compareByImportance(
  a: ScorableSignal,
  b: ScorableSignal,
  ctx: ImportanceContext,
): number {
  const diff = importanceScore(b, ctx) - importanceScore(a, ctx)
  if (diff !== 0) return diff
  return (b.date ?? '').localeCompare(a.date ?? '')
}

/**
 * Legacy tier mapping. The existing UI renders high/medium/low badges; this maps
 * the deterministic band onto them so the vocabulary can migrate to
 * act/watch/context in the frontend without a behavioural cliff.
 */
export function bandToLegacyTier(band: ImportanceBand): 'high' | 'medium' | 'low' {
  return band === 'act' ? 'high' : band === 'watch' ? 'medium' : 'low'
}

/**
 * True when the configured weights still guarantee §4.2 precedence. Exported so
 * a future weight edit that breaks precedence is caught rather than shipped.
 */
export function precedenceHolds(): boolean {
  const weights = Object.values(IMPORTANCE_CONFIG.arcWeight).sort((x, y) => x - y)
  const smallestGap = weights.slice(1).reduce(
    (min, w, i) => Math.min(min, w - weights[i]),
    Number.POSITIVE_INFINITY,
  )
  return smallestGap > MAX_LOWER_TERMS
}
