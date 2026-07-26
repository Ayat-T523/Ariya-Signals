/**
 * Name: buildNarration
 * Description: Per-competitor rolling activity summary. Deterministic and
 *   STRUCTURAL only (§4-1) — a factual count of recent signals by event class.
 *   No interpretation, no "what this means", no reading of why_it_matters.
 *   Returns null when there are no signals (UI shows an honest empty state).
 *
 * Usage:
 *   import { buildNarration, NARRATION_DAYS } from './lib/buildNarration.mjs'
 *   const text = buildNarration(signals, competitorName)
 */

/** How many days back ingest looks when building the narration. Must match getRecentSignals() window. */
export const NARRATION_DAYS = 90

const EVENT_LABEL = {
  deal:                'deal',
  exec_change:         'leadership change',
  press_release:       'press release',
  publication:         'publication',
  hta_decision:        'HTA decision',
  regulatory_catalyst: 'regulatory event',
  congress_abstract:   'congress abstract',
  trial_update:        'trial update',
}

// Factual "N type(s)" breakdown across every event class present.
function typeBreakdown(signals) {
  const counts = {}
  for (const s of signals) counts[s.signal_type] = (counts[s.signal_type] ?? 0) + 1
  const parts = []
  for (const [type, n] of Object.entries(counts)) {
    const label = EVENT_LABEL[type] ?? type
    parts.push(`${n} ${label}${n > 1 ? 's' : ''}`)
  }
  return parts.join(', ')
}

/**
 * Build a factual 1-sentence activity summary for a competitor's recent signals.
 *
 * @param {Array<{signal_type: string}>} signals  Recent signals (caller applies the date filter).
 * @param {string} competitorName                 Display name of the competitor.
 * @param {object} [opts]
 * @param {number} [opts.days=NARRATION_DAYS]      Window size — used in the fallback label.
 * @returns {string|null}  Structural summary, or null when no signals.
 */
export function buildNarration(signals, competitorName, { days = NARRATION_DAYS } = {}) {
  if (!signals || signals.length === 0) return null
  const n = signals.length
  const breakdown = typeBreakdown(signals)
  if (breakdown) return `${n} recent disclosure${n > 1 ? 's' : ''}: ${breakdown}.`
  return `${competitorName} filed ${n} disclosure${n > 1 ? 's' : ''} in the last ${days} days.`
}
