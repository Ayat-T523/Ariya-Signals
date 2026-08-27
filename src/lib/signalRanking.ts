/**
 * signalRanking.ts — user-specific PRESENTATION ranking for landscape
 * Signals (V1 Signal engine, 2026-08-24).
 *
 * PRODUCT BOUNDARY (do not violate, report section 17): Direct/Indirect is
 * the USER's own landscape relationship (TrackedCompetitor.userRelationship),
 * never a fact the global Signal itself carries. This module only REORDERS
 * an already-fetched LandscapeSignal[] for display -- it never rewrites
 * `importance` (the Signal's own factual significance) and never persists
 * anything. The same Signal, ranked for two different users' landscapes
 * (different Direct/Indirect calls), can legitimately appear in a different
 * position for each -- the Signal object itself is byte-for-byte identical
 * either way.
 */
import type { LandscapeSignal, SignalImportance } from './api/landscapeSignals'

const IMPORTANCE_RANK: Record<SignalImportance, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 }

export function toSeverity(importance: SignalImportance): 'high' | 'medium' | 'low' {
  return importance === 'HIGH' ? 'high' : importance === 'MEDIUM' ? 'medium' : 'low'
}

/**
 * SIGNAL QUALITY GATE (2026-08-24, report section 7): "What needs your
 * attention" is for the most CONSEQUENTIAL Signals, not every qualifying
 * one -- a LOW-importance registry-level item belongs in the broader
 * Signal feed (Intelligence Feed / signalVolume), never crowding out the
 * attention panel merely because Signals exist. Deterministic only (no
 * Groq): HIGH/MEDIUM qualify, LOW does not. Never mutates `importance`
 * itself -- purely a display-membership filter, same non-mutation
 * discipline as rankSignalsForAttention() above.
 */
export function isAttentionWorthy(signal: LandscapeSignal): boolean {
  return signal.importance === 'HIGH' || signal.importance === 'MEDIUM'
}

const IMPORTANCE_TIERS: SignalImportance[] = ['HIGH', 'MEDIUM', 'LOW']

/**
 * Within-tier tiebreak: a Direct-relationship company's Signal ranks above
 * an Indirect one (report section 17's own example) -- presentation only,
 * per this module's own docstring. Recency breaks any remaining tie.
 * Unchanged from before the source-rebalancing fix below -- only WHERE
 * this comparator is applied changed, not what it compares.
 */
function compareWithinTier(
  a: LandscapeSignal, b: LandscapeSignal, userRelationshipByCompanyId: Map<string, 'direct' | 'indirect'>,
): number {
  const aDirect = userRelationshipByCompanyId.get(a.companyId) === 'direct' ? 1 : 0
  const bDirect = userRelationshipByCompanyId.get(b.companyId) === 'direct' ? 1 : 0
  if (aDirect !== bDirect) return bDirect - aDirect
  return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
}

/**
 * Sort order: importance (HIGH -> MEDIUM -> LOW) first -- the Signal's own
 * factual significance always wins the primary sort; a tier boundary is
 * NEVER crossed by anything below. Within each tier, source rebalancing
 * (Visible Signal Source Rebalancing checkpoint, 2026-08-27): CT.gov's
 * real volume advantage means, un-corrected, a single HIGH-importance tier
 * can be 20+ routine CT.gov trial-registry updates deep before an equally
 * HIGH-importance but older FDA approval or EMA marketing authorisation
 * ever surfaces -- live-proven against the real gMG landscape, where the
 * top 6 "Top signals to triage" slots were 5 CT.gov + 1 PubMed despite 4
 * real HIGH-importance FDA approvals and 2 real HIGH-importance EMA
 * approvals existing in the SAME tier.
 *
 * Fix, deliberately NOT a quota: within each tier, the single BEST
 * Signal (by the existing Direct/Indirect + recency tiebreak) from every
 * DISTINCT sourceType actually present is surfaced first, in best-first
 * order across sources -- never one-per-source regardless of strength,
 * never a fixed source list (a source with zero eligible Signals in this
 * tier contributes nothing, exactly as before). Every remaining Signal in
 * the tier (including further Signals from an already-represented source)
 * fills the rest of the tier in the SAME existing order. A tier with only
 * one real source degenerates to exactly the prior plain sort -- "if only
 * CT.gov has eligible Signals, the result is truthfully all CT.gov" holds
 * by construction, never forced diversity. This is a pure REORDER of the
 * same full Signal list (never a subset, never mutated) -- callers that
 * slice(0, N) for a bounded surface see the effect; callers that consume
 * the full ordering (e.g. War Room's hiddenCount) are unaffected in size.
 */
export function rankSignalsForAttention(
  signalsList: LandscapeSignal[],
  userRelationshipByCompanyId: Map<string, 'direct' | 'indirect'>,
): LandscapeSignal[] {
  const result: LandscapeSignal[] = []
  for (const tier of IMPORTANCE_TIERS) {
    const tierSignals = signalsList.filter((s) => s.importance === tier)
    const sortedTier = [...tierSignals].sort((a, b) => compareWithinTier(a, b, userRelationshipByCompanyId))
    const seenSources = new Set<string>()
    const representatives: LandscapeSignal[] = []
    const remainder: LandscapeSignal[] = []
    for (const s of sortedTier) {
      if (!seenSources.has(s.sourceType)) { seenSources.add(s.sourceType); representatives.push(s) }
      else remainder.push(s)
    }
    result.push(...representatives, ...remainder)
  }
  return result
}

/**
 * Priority Signals "Recency" mode (War Room semantic-integrity checkpoint,
 * 2026-08-25) -- newest event/occurrence date first, over the SAME
 * qualifying Signal universe rankSignalsForAttention() operates on (never
 * a different backend scope, never a new global recency cutoff -- this is
 * a pure in-memory reorder of an already-fetched LandscapeSignal[]).
 * Deliberately does NOT apply an importance or Direct/Indirect tiebreak --
 * "Recency genuinely means the newest qualifying Signals" is this mode's
 * entire contract. `id` is the final deterministic tiebreak for two
 * Signals sharing the identical occurredAt instant, so ordering never
 * depends on input array order.
 */
export function rankSignalsByRecency(signalsList: LandscapeSignal[]): LandscapeSignal[] {
  return [...signalsList].sort((a, b) => {
    const dateDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    if (dateDiff !== 0) return dateDiff
    return a.id.localeCompare(b.id)
  })
}
