/**
 * signalRanking.test.ts — V1 Signal engine presentation ranking.
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/signalRanking.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { rankSignalsForAttention, rankSignalsByRecency, toSeverity, isAttentionWorthy } from './signalRanking.js'
import type { LandscapeSignal } from './api/landscapeSignals.js'

let passed = 0
let failed = 0

function assert(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { console.log(`  ✓  ${label}`); passed++ }
  else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     received: ${JSON.stringify(actual)}`)
    failed++
  }
}

function sig(overrides: Partial<LandscapeSignal>): LandscapeSignal {
  return {
    id: 'x', signalType: 'CLINICAL_TRIAL_ACTIVITY', diseaseId: 'd', companyId: 'argenx', companyName: 'argenx',
    assetId: 'a', assetName: 'AssetX', occurredAt: '2026-08-20T00:00:00+00:00', detectedAt: '2026-08-24T00:00:00+00:00',
    title: 't', description: 'd', importance: 'LOW', sourceType: 'clinicaltrials_gov', sourceLocator: 'u',
    evidenceId: 'e', priorEvidenceId: null,
    ...overrides,
  }
}

console.log('1. toSeverity maps importance to the existing lowercase Severity type')
assert('HIGH -> high', toSeverity('HIGH'), 'high')
assert('MEDIUM -> medium', toSeverity('MEDIUM'), 'medium')
assert('LOW -> low', toSeverity('LOW'), 'low')

console.log('2. Importance is the primary sort key -- HIGH before MEDIUM before LOW')
const byImportance = rankSignalsForAttention(
  [sig({ id: 'low', importance: 'LOW' }), sig({ id: 'high', importance: 'HIGH' }), sig({ id: 'medium', importance: 'MEDIUM' })],
  new Map(),
)
assert('order is high, medium, low', byImportance.map((s) => s.id), ['high', 'medium', 'low'])

console.log('3. Within the same importance tier, Direct ranks above Indirect (presentation only)')
const byRelationship = rankSignalsForAttention(
  [sig({ id: 'indirect-co', companyId: 'indirect-co', importance: 'MEDIUM' }), sig({ id: 'direct-co', companyId: 'direct-co', importance: 'MEDIUM' })],
  new Map([['direct-co', 'direct'], ['indirect-co', 'indirect']]),
)
assert('direct-co ranks first', byRelationship.map((s) => s.id), ['direct-co', 'indirect-co'])

console.log('4. Direct/Indirect never overrides a real importance difference')
const importanceWins = rankSignalsForAttention(
  [sig({ id: 'direct-low', companyId: 'direct-co', importance: 'LOW' }), sig({ id: 'indirect-high', companyId: 'indirect-co', importance: 'HIGH' })],
  new Map([['direct-co', 'direct'], ['indirect-co', 'indirect']]),
)
assert('indirect-high (HIGH) still ranks above direct-low (LOW)', importanceWins.map((s) => s.id), ['indirect-high', 'direct-low'])

console.log('5. Recency breaks ties within the same importance and relationship tier')
const byRecency = rankSignalsForAttention(
  [sig({ id: 'older', occurredAt: '2026-08-01T00:00:00+00:00' }), sig({ id: 'newer', occurredAt: '2026-08-20T00:00:00+00:00' })],
  new Map(),
)
assert('newer ranks first', byRecency.map((s) => s.id), ['newer', 'older'])

console.log('6. Ranking never mutates the input array or the Signal objects themselves')
const original = [sig({ id: 'a', importance: 'LOW' }), sig({ id: 'b', importance: 'HIGH' })]
const originalCopy = JSON.stringify(original)
rankSignalsForAttention(original, new Map())
assert('input array order/content unchanged after ranking', JSON.stringify(original), originalCopy)

console.log('7. isAttentionWorthy excludes LOW-importance activity (SIGNAL QUALITY GATE, report section 7)')
assert('HIGH is attention-worthy', isAttentionWorthy(sig({ importance: 'HIGH' })), true)
assert('MEDIUM is attention-worthy', isAttentionWorthy(sig({ importance: 'MEDIUM' })), true)
assert('LOW is NOT attention-worthy', isAttentionWorthy(sig({ importance: 'LOW' })), false)

console.log('8. Filtering a ranked list to attention-worthy Signals drops LOW items but keeps HIGH/MEDIUM order')
const mixed = rankSignalsForAttention(
  [sig({ id: 'low', importance: 'LOW' }), sig({ id: 'high', importance: 'HIGH' }), sig({ id: 'medium', importance: 'MEDIUM' })],
  new Map(),
).filter(isAttentionWorthy)
assert('only high, medium remain, in that order', mixed.map((s) => s.id), ['high', 'medium'])

console.log('9. An all-LOW Signal list filters down to empty -- "You\'re caught up" over a low-value-filled panel')
const allLow = rankSignalsForAttention(
  [sig({ id: 'low1', importance: 'LOW' }), sig({ id: 'low2', importance: 'LOW' })],
  new Map(),
).filter(isAttentionWorthy)
assert('empty result', allLow, [])

console.log('10. rankSignalsByRecency (Priority Signals "Recency" mode) sorts by occurredAt DESC only -- no importance/relationship tiebreak')
const recencyOnly = rankSignalsByRecency([
  sig({ id: 'old-high', importance: 'HIGH', occurredAt: '2026-01-01T00:00:00+00:00' }),
  sig({ id: 'new-low', importance: 'LOW', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 'mid-medium', importance: 'MEDIUM', occurredAt: '2026-05-01T00:00:00+00:00' }),
])
assert('newest first regardless of importance', recencyOnly.map((s) => s.id), ['new-low', 'mid-medium', 'old-high'])

console.log('11. rankSignalsByRecency includes LOW-importance Signals (they are never pre-filtered)')
const withLow = rankSignalsByRecency([sig({ id: 'only-low', importance: 'LOW' })])
assert('LOW Signal is present', withLow.map((s) => s.id), ['only-low'])

console.log('12. rankSignalsByRecency is deterministic for two Signals sharing the identical occurredAt instant')
const tie = rankSignalsByRecency([
  sig({ id: 'zzz', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 'aaa', occurredAt: '2026-08-20T00:00:00+00:00' }),
])
assert('id breaks the tie deterministically', tie.map((s) => s.id), ['aaa', 'zzz'])
const tieReversed = rankSignalsByRecency([
  sig({ id: 'aaa', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 'zzz', occurredAt: '2026-08-20T00:00:00+00:00' }),
])
assert('same result regardless of input order', tieReversed.map((s) => s.id), tie.map((s) => s.id))

console.log('13. rankSignalsByRecency never mutates the input array')
const recencyInput = [sig({ id: 'a', occurredAt: '2026-01-01T00:00:00+00:00' }), sig({ id: 'b', occurredAt: '2026-08-01T00:00:00+00:00' })]
const recencyInputCopy = JSON.stringify(recencyInput)
rankSignalsByRecency(recencyInput)
assert('input array order/content unchanged', JSON.stringify(recencyInput), recencyInputCopy)

console.log('14. Importance mode and Recency mode over the SAME Signal universe produce genuinely different orderings')
const sameUniverse = [
  sig({ id: 'high-old', importance: 'HIGH', occurredAt: '2026-01-01T00:00:00+00:00' }),
  sig({ id: 'low-new', importance: 'LOW', occurredAt: '2026-08-20T00:00:00+00:00' }),
]
const byImportanceMode = rankSignalsForAttention(sameUniverse, new Map()).map((s) => s.id)
const byRecencyMode = rankSignalsByRecency(sameUniverse).map((s) => s.id)
assert('importance mode ranks high-old first', byImportanceMode, ['high-old', 'low-new'])
assert('recency mode ranks low-new first', byRecencyMode, ['low-new', 'high-old'])

// ─────────────────────────────────────────────────────────────────────────
// Visible Signal Source Rebalancing checkpoint (2026-08-27). All tests
// below share one importance tier (HIGH) unless stated otherwise -- the
// bug this fixes only ever manifests WITHIN a tier (materiality always
// wins first; this never lets a lower tier bleed into a higher one).
// ─────────────────────────────────────────────────────────────────────────

console.log('15. Many routine CT.gov events + strong FDA/EMA events: alternate-source events are no longer buried')
const manyCtgovOneEach = [
  ...Array.from({ length: 8 }, (_, i) => sig({
    id: `ctgov-${i}`, importance: 'HIGH', sourceType: 'clinicaltrials_gov',
    occurredAt: `2026-08-${String(20 - i).padStart(2, '0')}T00:00:00+00:00`,
  })),
  sig({ id: 'fda-1', importance: 'HIGH', sourceType: 'fda_drugs_at_fda', occurredAt: '2023-10-17T00:00:00+00:00' }),
  sig({ id: 'ema-1', importance: 'HIGH', sourceType: 'ema_epar', occurredAt: '2024-01-05T00:00:00+00:00' }),
]
const rebalanced = rankSignalsForAttention(manyCtgovOneEach, new Map())
const top4 = rebalanced.slice(0, 4).map((s) => s.id)
assert('FDA and EMA both surface within the first 4 slots, not buried behind all 8 CT.gov events', {
  fdaInTop4: top4.includes('fda-1'), emaInTop4: top4.includes('ema-1'),
}, { fdaInTop4: true, emaInTop4: true })
assert('the single best (most recent) CT.gov event still leads (real strength, not suppressed)', rebalanced[0].id, 'ctgov-0')

console.log('16. A highly material CT.gov event can still outrank weaker alternative-source events')
const ctgovStillWins = rankSignalsForAttention([
  sig({ id: 'ctgov-strong', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 'fda-older', importance: 'HIGH', sourceType: 'fda_drugs_at_fda', occurredAt: '2018-01-01T00:00:00+00:00' }),
  sig({ id: 'ema-older', importance: 'HIGH', sourceType: 'ema_epar', occurredAt: '2017-01-01T00:00:00+00:00' }),
], new Map())
assert('the most recent HIGH event (CT.gov here) still ranks #1 -- diversity never overrides real strength', ctgovStillWins[0].id, 'ctgov-strong')

console.log('17. A weak (LOW-importance) alternate-source Signal is never promoted merely because that source is otherwise absent')
const weakSourceNeverPromoted = rankSignalsForAttention([
  sig({ id: 'ctgov-high-1', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 'ctgov-high-2', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-19T00:00:00+00:00' }),
  sig({ id: 'pubmed-low', importance: 'LOW', sourceType: 'pubmed', occurredAt: '2026-08-25T00:00:00+00:00' }),
], new Map())
assert(
  'the LOW-importance PubMed item (even though newer) ranks LAST, behind both HIGH CT.gov events -- never jumped ahead for diversity',
  weakSourceNeverPromoted.map((s) => s.id),
  ['ctgov-high-1', 'ctgov-high-2', 'pubmed-low'],
)

console.log('18. Missing source families never create artificial slots (only sources with real eligible Signals ever appear)')
const onlyTwoSources = rankSignalsForAttention([
  sig({ id: 'ctgov-a', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 'fda-a', importance: 'HIGH', sourceType: 'fda_drugs_at_fda', occurredAt: '2023-01-01T00:00:00+00:00' }),
], new Map())
const sourcesPresent = new Set(onlyTwoSources.map((s) => s.sourceType))
assert('only the two real sources appear -- no ema_epar/pubmed/sec_edgar/company_disclosure slot is fabricated', [...sourcesPresent].sort(), ['clinicaltrials_gov', 'fda_drugs_at_fda'])

console.log('19. A single-source dataset ranks truthfully as entirely that source (no forced diversity)')
const singleSource = rankSignalsForAttention([
  sig({ id: 's1', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 's2', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-19T00:00:00+00:00' }),
  sig({ id: 's3', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-18T00:00:00+00:00' }),
], new Map())
assert('plain recency order, unchanged from the pre-fix behavior, when only one source is eligible', singleSource.map((s) => s.id), ['s1', 's2', 's3'])

console.log('20. Same input produces the exact same ordering every time (determinism)')
const detInput = [
  sig({ id: 'ctgov-1', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-20T00:00:00+00:00' }),
  sig({ id: 'fda-1', importance: 'HIGH', sourceType: 'fda_drugs_at_fda', occurredAt: '2023-10-17T00:00:00+00:00' }),
  sig({ id: 'ctgov-2', importance: 'HIGH', sourceType: 'clinicaltrials_gov', occurredAt: '2026-08-15T00:00:00+00:00' }),
  sig({ id: 'ema-1', importance: 'HIGH', sourceType: 'ema_epar', occurredAt: '2024-01-05T00:00:00+00:00' }),
]
const run1 = rankSignalsForAttention(detInput, new Map()).map((s) => s.id)
const run2 = rankSignalsForAttention(detInput, new Map()).map((s) => s.id)
const run3 = rankSignalsForAttention([...detInput].reverse(), new Map()).map((s) => s.id)
assert('repeated calls on the same input produce identical ordering', run1, run2)
assert('input array order does not affect the result', run1, run3)

console.log('21. The underlying Signal collection is unchanged -- ranking only reorders, never adds/drops/mutates')
const mixedTiers = [
  sig({ id: 'a', importance: 'HIGH', sourceType: 'clinicaltrials_gov' }),
  sig({ id: 'b', importance: 'MEDIUM', sourceType: 'fda_drugs_at_fda' }),
  sig({ id: 'c', importance: 'LOW', sourceType: 'pubmed' }),
]
const mixedRanked = rankSignalsForAttention(mixedTiers, new Map())
assert('same length', mixedRanked.length, mixedTiers.length)
assert('same set of ids, none dropped or duplicated', [...mixedRanked.map((s) => s.id)].sort(), [...mixedTiers.map((s) => s.id)].sort())
assert('every Signal object is referentially the SAME object, never a copy/mutation', mixedRanked.every((s) => mixedTiers.includes(s)), true)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
