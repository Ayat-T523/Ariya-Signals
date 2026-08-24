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

/**
 * Sort order: importance (HIGH -> MEDIUM -> LOW) first -- the Signal's own
 * factual significance always wins the primary sort. Within the same
 * importance tier, a Direct-relationship company's Signal ranks above an
 * Indirect one (report section 17's own example) -- presentation only, per
 * this module's own docstring. Recency breaks any remaining tie.
 */
export function rankSignalsForAttention(
  signalsList: LandscapeSignal[],
  userRelationshipByCompanyId: Map<string, 'direct' | 'indirect'>,
): LandscapeSignal[] {
  return [...signalsList].sort((a, b) => {
    const importanceDiff = IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance]
    if (importanceDiff !== 0) return importanceDiff
    const aDirect = userRelationshipByCompanyId.get(a.companyId) === 'direct' ? 1 : 0
    const bDirect = userRelationshipByCompanyId.get(b.companyId) === 'direct' ? 1 : 0
    if (aDirect !== bDirect) return bDirect - aDirect
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  })
}
