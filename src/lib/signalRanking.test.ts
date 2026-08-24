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

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
