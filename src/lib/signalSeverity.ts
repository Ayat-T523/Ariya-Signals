/**
 * signalSeverity.ts — shared severity classification + windowed count helper.
 *
 * Phase 3.2 (war-room-spec.md §3.3): "Per-competitor and per-window counts
 * must come from one shared helper used by the War Room, Competitors list,
 * and competitor profile, so the same competitor never shows different
 * numbers on different pages." computeSeverity was previously private to
 * WarRoom.tsx; moved here so it has one real home instead of risking a
 * second, drifting copy the next time a page needs severity classification.
 *
 * Callers own their own window (getRecentSignals(days, ...)) and lexicon
 * (useConfig()) — this module only turns an already-fetched signal array
 * into a labeled breakdown, consistently, wherever it's called from.
 */
import type { DbRecentSignal } from './db'

export type Lexicon = { inns: string[]; ta_terms: string[] }

function isCLevelChange(text: string): boolean {
  return /chief executive|ceo|chief medical|cmo|chief commercial|cco|chief financial|cfo|board chair|president/.test(text)
}

// Body-text CRITICAL classification requires co-occurrence with a HAE lexicon term in
// the same sentence — prevents Phase 3 safety trials (testing adverse events) from
// matching /phase 3.*result/ and being rated CRITICAL when they shouldn't be.
function criticalCoOccursWithHAE(text: string, lexicon: Lexicon): boolean {
  // Match forward ("Phase 3 results") AND reverse ("results from the Phase 3 trial")
  const CRITICAL_BODY_RE = /phase\s*[23].*result|result.*phase\s*[23]|pivotal.*result|topline.*result|primary endpoint|phase\s*[23].*data/i
  const sentences = text.split(/(?<=[.!?])\s+/)
  return sentences.some(sentence => {
    const s = sentence.toLowerCase()
    if (!CRITICAL_BODY_RE.test(s)) return false
    return (
      lexicon.inns.some(t => s.includes(t)) ||
      lexicon.ta_terms.some(t => s.includes(t))
    )
  })
}

function isRelevant(s: DbRecentSignal, lexicon: Lexicon): boolean {
  const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`.toLowerCase()
  return (
    lexicon.inns.some(term => text.includes(term.toLowerCase())) ||
    lexicon.ta_terms.some(term => text.includes(term.toLowerCase()))
  )
}

export function computeSeverity(s: DbRecentSignal, lexicon: Lexicon, today: Date): 'high' | 'medium' | 'low' {
  if (!isRelevant(s, lexicon)) {
    // exec_change and deal are strategically important regardless of TA lexicon match
    return (s.signal_type === 'exec_change' || s.signal_type === 'deal') ? 'medium' : 'low'
  }

  const items = (s.items ?? '').split(',').map(i => i.trim())
  const text  = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`.toLowerCase()
  const rawText = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`

  let band: 'critical' | 'high' | 'moderate' | 'low' = 'low'

  // CRITICAL: M&A via items code OR hard regulatory setbacks OR body-text readout
  // co-occurring with a HAE term (guards against safety-trial false positives)
  const isCritical = (
    (items.includes('2.01') && (text.includes('acqui') || text.includes('merger'))) ||
    /complete response letter|crl|market withdrawal|black.?box warning/i.test(text) ||
    criticalCoOccursWithHAE(rawText, lexicon)
  )
  if (isCritical) band = 'critical'

  // HIGH: material agreements, NDA/MAA filings, PDUFA, AdCom, Phase 2 results, HTA decisions
  else if (
    items.includes('1.01') ||
    /nda|bla|maa|submitted|filing accepted|pdufa|adcom|advisory committee/i.test(text) ||
    /phase\s*2.*result|hta decision|nice.*recomm|label.*expan|indication.*expan/i.test(text)
  ) band = 'high'

  // MODERATE: early-phase activity, earnings, guidelines, C-suite changes
  else if (
    /phase\s*(1|2).*start|enrollment.*complet|trial.*initiat/i.test(text) ||
    items.includes('2.02') ||
    /guideline.*update|congress.*presentation/i.test(text) ||
    (items.includes('5.02') && isCLevelChange(text))
  ) band = 'moderate'

  // Step 3: Proximity bump — imminent catalyst (≤60 days out) raises MODERATE → HIGH
  if (band === 'moderate') {
    const daysOut = (new Date(s.date ?? '').getTime() - today.getTime()) / 86_400_000
    if (daysOut > 0 && daysOut <= 60) band = 'high'
  }

  // Step 4: Collapse to UI tiers (critical and high both render as 'high')
  return band === 'critical' || band === 'high' ? 'high'
       : band === 'moderate'                    ? 'medium'
       : 'low'
}

export interface SeverityBreakdown {
  total: number
  high: number
  medium: number
  low: number
}

/**
 * Turns an already-window-scoped signal array into a labeled severity
 * breakdown. The caller is responsible for the window itself (how the
 * array was fetched) and for stating that window in the UI — this only
 * guarantees the classification and the counting are identical everywhere
 * it's called, so the same competitor never gets a different "2 high" on
 * one page and "3 high" on another for the same underlying signals.
 */
export function summarizeSeverity(signals: DbRecentSignal[], lexicon: Lexicon, today: Date = new Date()): SeverityBreakdown {
  const result: SeverityBreakdown = { total: signals.length, high: 0, medium: 0, low: 0 }
  for (const s of signals) {
    result[computeSeverity(s, lexicon, today)]++
  }
  return result
}
