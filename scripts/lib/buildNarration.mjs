/**
 * Name: buildNarration
 * Description: Phase 2C — per-competitor rolling narration generator.
 *   Deterministic only — no external API calls. Rides the same engine as extractWhy.mjs.
 *
 *   Given a list of recent signals for one competitor, produces a 1-2 sentence
 *   narration of activity. Returns null when there are no signals (UI shows honest
 *   empty state instead).
 *
 * Usage:
 *   import { buildNarration, NARRATION_DAYS } from './lib/buildNarration.mjs'
 *   const text = buildNarration(signals, competitorName)
 */

/** How many days back ingest looks when building the narration. Must match getRecentSignals() window. */
export const NARRATION_DAYS = 90

// ── Signal priority ranking ────────────────────────────────────────────────────
// Picks the most competitively significant signal to lead the narration.

const HAE_PHASE3_RE = /HAE Phase 3|hereditary angioedema.*phase 3|phase 3.*HAE/i
const DEAL_WHY_RE   = /strategic move|loan agreement|merger|acquisition/i

function signalPriority(s) {
  const why = s.why_it_matters ?? ''
  if (HAE_PHASE3_RE.test(why))       return 0   // highest: HAE Phase 3 readout
  if (s.signal_type === 'deal')       return 1
  if (DEAL_WHY_RE.test(why))         return 1
  if (why.includes('Senior leader'))  return 2
  if (s.signal_type === 'exec_change') return 3
  if (why.includes('HAE-relevant'))   return 4
  if (s.signal_type === 'press_release') return 5
  return 6
}

// ── Type breakdown helper ─────────────────────────────────────────────────────

function typeBreakdown(signals) {
  const deals = signals.filter(s => s.signal_type === 'deal').length
  const execs  = signals.filter(s => s.signal_type === 'exec_change').length
  const press  = signals.filter(s => s.signal_type === 'press_release').length
  const parts = []
  if (deals > 0) parts.push(`${deals} deal${deals > 1 ? 's' : ''}`)
  if (execs > 0) parts.push(`${execs} leadership change${execs > 1 ? 's' : ''}`)
  if (press > 0) parts.push(`${press} press release${press > 1 ? 's' : ''}`)
  return parts.join(', ')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a 1-2 sentence narration for a competitor's recent signal activity.
 *
 * @param {Array<{signal_type: string, why_it_matters: string|null}>} signals
 *   Recent signals for this competitor (caller applies the date filter).
 * @param {string} competitorName  Display name of the competitor.
 * @param {object} [opts]
 * @param {number} [opts.days=NARRATION_DAYS]  Window size — used only in null label.
 * @returns {string|null}  Narration text, or null when no signals.
 */
export function buildNarration(signals, competitorName, { days = NARRATION_DAYS } = {}) {
  if (!signals || signals.length === 0) return null

  // Sort by priority so the most significant leads
  const sorted   = [...signals].sort((a, b) => signalPriority(a) - signalPriority(b))
  const topSignal = sorted[0]
  const topWhy    = topSignal?.why_it_matters ?? null
  const rest      = signals.length - 1

  if (signals.length === 1) {
    // Single signal: lead directly with its why
    return topWhy ?? `${competitorName} filed 1 disclosure in the last ${days} days.`
  }

  // Multiple signals: lead with top insight, append rest count
  const restLabel = rest === 1 ? '1 other disclosure' : `${rest} other disclosures`
  const breakdown = typeBreakdown(signals)

  if (topWhy) {
    return `${topWhy} Plus ${restLabel} (${breakdown}).`
  }

  // No why_it_matters on any signal — fall back to count + breakdown
  return `${signals.length} recent disclosures: ${breakdown}.`
}
