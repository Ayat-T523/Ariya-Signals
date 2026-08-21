/**
 * discovery.test.ts — Frontend Step 4B acceptance tests.
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/api/discovery.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * global.fetch is monkeypatched directly (Node 18+ has a native fetch) --
 * no MSW/nock, matching this repo's own "no heavy testing framework" rule.
 */

import { mapDiscoveryResponse, fetchDiscoveredCompetitors, type DiscoveryRequest } from './discovery.js'
import { ApiError, ApiUnreachableError } from './client.js'
import {
  getAssetsForDiseaseArea,
  isLandscapeConfigurationSubmittable,
  type LandscapeConfiguration,
} from '../../config/landscape-configuration.js'

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

function assertTrue(label: string, actual: boolean): void {
  assert(label, actual, true)
}

async function assertRejects(label: string, fn: () => Promise<unknown>, check: (err: unknown) => boolean): Promise<void> {
  try {
    await fn()
    console.error(`  ✗  ${label} (did not reject)`)
    failed++
  } catch (err) {
    if (check(err)) { console.log(`  ✓  ${label}`); passed++ }
    else {
      console.error(`  ✗  ${label} (rejected with wrong error)`)
      console.error(`     received: ${err}`)
      failed++
    }
  }
}

const RAW_CANDIDATE = {
  competitor_identity_key: 'Acme Biotech',
  candidate_status: 'needs_more_evidence',
  relationship_status: 'success',
  ai_proposed_relationship: 'direct',
  final_relationship: null,
  final_rationale: 'Real ClinicalTrials.gov Phase 2 study in the same indication.',
  validation_reasons: ['affirmative_overlap_present'],
  evidence_gaps: ['development_stage_unresolved'],
  durable_evidence_refs: [{ local_ref: 'ref-1', source_ref: 'NCT00000001', source_type: 'clinicaltrials_gov' }],
  detail: null,
  source_references: ['https://clinicaltrials.gov/study/NCT00000001'],
  reason_detail: ['trial sponsor unresolved'],
  unresolved_questions: ['Is Acme Biotech the sponsor of record?'],
  organization_name: 'Acme Biotech',
  organization_source_status: 'no_verified_official_source',
  verified_domains: [],
}

const RAW_EXECUTION = {
  source_id: 'ctgov_disease_discovery', entity_name: 'x', run_state: 'succeeded_with_results',
  error_detail: null, documents_retrieved: [],
}

const RAW_RESPONSE = {
  home_asset: 'ZILBRYSQ', indication: 'generalized myasthenia gravis',
  discovery_execution: RAW_EXECUTION,
  home_evidence_executions: [], home_population_evidence_count: 0,
  comparator_execution: RAW_EXECUTION, comparator_observation_count: 0,
  candidates: [RAW_CANDIDATE],
}

// ── 1. Request generation from a valid configuration ────────────────────────

console.log('1. Request generation from a valid configuration')
const validConfig: LandscapeConfiguration = { therapeuticAreaId: 'immunology', diseaseAreaId: 'hae', homeAssetId: 'ekterly' }
assertTrue('a configured HAE landscape is submittable', isLandscapeConfigurationSubmittable(validConfig))

// ── 2. Unmapped/invalid config refuses discovery ─────────────────────────────

console.log('2. Unmapped configuration refuses discovery (gMG has no catalogued Home Asset)')
assert('gMG has zero catalogued Home Assets', getAssetsForDiseaseArea('gmg').length, 0)
const gmgConfig: LandscapeConfiguration = { therapeuticAreaId: 'neurology', diseaseAreaId: 'gmg', homeAssetId: null }
assertTrue('an unconfigured gMG landscape is NOT submittable', !isLandscapeConfigurationSubmittable(gmgConfig))

// ── 3. Candidates mapped without losing candidate_status ─────────────────────

console.log('3. Candidates mapped without losing candidate_status')
const mapped = mapDiscoveryResponse(RAW_RESPONSE)
assert('candidate_status preserved verbatim', mapped.candidates[0].candidateStatus, 'needs_more_evidence')
assertTrue('needs_more_evidence candidate is NOT dropped (no status filtering)', mapped.candidates.length === 1)

// ── 4. Evidence/provenance survives mapping ───────────────────────────────────

console.log('4. Evidence/provenance survives mapping')
assert('sourceReferences preserved', mapped.candidates[0].sourceReferences, ['https://clinicaltrials.gov/study/NCT00000001'])
assert('organizationName preserved', mapped.candidates[0].organizationName, 'Acme Biotech')
assert('evidenceGaps preserved', mapped.candidates[0].evidenceGaps, ['development_stage_unresolved'])
assert('durableEvidenceRefs preserved with all three sub-fields', mapped.candidates[0].durableEvidenceRefs, [
  { localRef: 'ref-1', sourceRef: 'NCT00000001', sourceType: 'clinicaltrials_gov' },
])

// ── 5. Candidate status does not auto-filter ──────────────────────────────────

console.log('5. A NOT_PRESENTABLE_FOR_TARGET candidate is not dropped by mapping')
const weakCandidateResponse = {
  ...RAW_RESPONSE,
  candidates: [{ ...RAW_CANDIDATE, candidate_status: 'not_presentable_for_target', ai_proposed_relationship: null }],
}
const weakMapped = mapDiscoveryResponse(weakCandidateResponse)
assert('weak candidate is still present', weakMapped.candidates.length, 1)
assert('weak candidate keeps its real status', weakMapped.candidates[0].candidateStatus, 'not_presentable_for_target')

// ── 6. AI-proposed relationship never becomes a user classification ──────────

console.log('6. AI-proposed relationship stays a distinct, advisory-only field')
assertTrue('DiscoveredCandidate has aiProposedRelationship', 'aiProposedRelationship' in mapped.candidates[0])
assertTrue('DiscoveredCandidate has NO userRelationship field', !('userRelationship' in mapped.candidates[0]))

// ── 7. Empty response -> empty candidate list ─────────────────────────────────

console.log('7. Empty backend response maps to an empty candidate list, not an error')
const emptyMapped = mapDiscoveryResponse({ ...RAW_RESPONSE, candidates: [] })
assert('candidates is []', emptyMapped.candidates, [])

// ── 8. Backend error -> ApiError, distinct from unreachable ──────────────────

console.log('8. Backend error responses surface as a distinct ApiError')
const realFetch = globalThis.fetch
async function withMockFetch<T>(mock: typeof fetch, fn: () => Promise<T>): Promise<T> {
  globalThis.fetch = mock as typeof fetch
  try { return await fn() } finally { globalThis.fetch = realFetch }
}

const request: DiscoveryRequest = { homeAsset: 'Ekterly', indication: 'Hereditary Angioedema' }

await (async () => {
  await withMockFetch(
    (async () => new Response(JSON.stringify({ error: 'discovery_source_unavailable', message: 'CT.gov unreachable' }), { status: 502 })) as typeof fetch,
    () => assertRejects('502 discovery_source_unavailable becomes ApiError', () => fetchDiscoveredCompetitors(request),
      (err) => err instanceof ApiError && err.errorCode === 'discovery_source_unavailable'),
  )
})()

// ── 9. Retry performs another real request (no caching hides a retry) ────────

console.log('9. Retry performs a genuinely new request, not a cached one')
await (async () => {
  let callCount = 0
  await withMockFetch(
    (async () => { callCount++; return new Response(JSON.stringify(RAW_RESPONSE), { status: 200 }) }) as typeof fetch,
    async () => {
      await fetchDiscoveredCompetitors(request)
      await fetchDiscoveredCompetitors(request)
    },
  )
  assert('fetch was called twice for two calls (no silent caching)', callCount, 2)
})()

// ── 10. No static suggestedCompetitors fallback anywhere in this module ──────

console.log('10. No static suggestedCompetitors/discovered-candidates.json fallback on network failure')
await (async () => {
  await withMockFetch(
    (async () => { throw new TypeError('network error') }) as unknown as typeof fetch,
    () => assertRejects('unreachable API rejects with ApiUnreachableError, never a static fallback', () => fetchDiscoveredCompetitors(request),
      (err) => err instanceof ApiUnreachableError),
  )
})()

// ── Targeted Implementation 6A: in-flight discovery request de-duplication ──
//
// Deterministic fetch mocking throughout -- no real backend, no timers,
// no sleeps. Concurrency is proven by controlling exactly when the mocked
// fetch's own Promise resolves (a manually-resolvable "gate"), never by
// racing against real network/timing.

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const requestA: DiscoveryRequest = { homeAsset: 'TAGRISSO', indication: 'Non-Small Cell Lung Cancer', homeCompany: 'AstraZeneca' }
const requestAIdenticalCopy: DiscoveryRequest = { homeAsset: 'TAGRISSO', indication: 'Non-Small Cell Lung Cancer', homeCompany: 'AstraZeneca' }
const requestB: DiscoveryRequest = { homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis', homeCompany: 'UCB' }

// ── 11/12. Two concurrent identical calls -> exactly ONE fetch, both callers get the SAME result ──
console.log('11/12. Two concurrent identical discovery calls (request still in flight when the second starts) produce exactly ONE underlying fetch -- both callers receive the same successful result')
await (async () => {
  let callCount = 0
  const gate = deferred<Response>()
  await withMockFetch(
    (async () => { callCount++; return gate.promise }) as unknown as typeof fetch,
    async () => {
      // Both calls start BEFORE the mocked fetch has resolved -- genuine
      // concurrency, not just "called in the same synchronous tick".
      const p1 = fetchDiscoveredCompetitors(requestA)
      const p2 = fetchDiscoveredCompetitors(requestAIdenticalCopy)
      assert('exactly one real fetch was issued for two concurrent identical requests', callCount, 1)
      gate.resolve(new Response(JSON.stringify(RAW_RESPONSE), { status: 200 }))
      const [r1, r2] = await Promise.all([p1, p2])
      assertTrue('both callers receive the SAME result object (the shared promise\'s own resolution)', r1 === r2)
      assert('the result itself is the real mapped response', r1.homeAsset, RAW_RESPONSE.home_asset)
    },
  )
})()

// ── 13. Different landscape payloads -> separate fetches, even when concurrent ──
console.log('13. Different landscape payloads (different homeAsset/indication/homeCompany) never collide -- separate fetches even when concurrent')
await (async () => {
  let callCount = 0
  const gateA = deferred<Response>()
  const gateB = deferred<Response>()
  let calls = 0
  await withMockFetch(
    (async () => { calls++; callCount++; return calls === 1 ? gateA.promise : gateB.promise }) as unknown as typeof fetch,
    async () => {
      const pA = fetchDiscoveredCompetitors(requestA)
      const pB = fetchDiscoveredCompetitors(requestB)
      assert('two DIFFERENT landscapes issue two separate fetches, not deduplicated', callCount, 2)
      gateA.resolve(new Response(JSON.stringify(RAW_RESPONSE), { status: 200 }))
      gateB.resolve(new Response(JSON.stringify({ ...RAW_RESPONSE, home_asset: 'RYSTIGGO' }), { status: 200 }))
      await Promise.all([pA, pB])
    },
  )
})()

// ── 14. After an in-flight request settles, a later call (Retry) makes a genuinely NEW fetch ──
console.log('14. Once a request settles, the in-flight entry is removed -- a later call for the SAME landscape (Retry) makes a brand-new fetch, never reuses the old result')
await (async () => {
  let callCount = 0
  await withMockFetch(
    (async () => { callCount++; return new Response(JSON.stringify(RAW_RESPONSE), { status: 200 }) }) as typeof fetch,
    async () => {
      await fetchDiscoveredCompetitors(requestA)
      await fetchDiscoveredCompetitors(requestA) // simulates an explicit Retry after the first fully settled
    },
  )
  assert('two SEQUENTIAL calls (second after the first fully settled) -> two real fetches, no permanent cache', callCount, 2)
})()

// ── 15. An error clears the in-flight entry too -- Retry after a failure still works ──
console.log('15. A rejected (errored) in-flight request still clears its own entry -- a subsequent call for the same landscape is a genuinely new fetch, not stuck reusing the failed promise')
await (async () => {
  let callCount = 0
  await withMockFetch(
    (async () => {
      callCount++
      if (callCount === 1) return new Response(JSON.stringify({ error: 'discovery_source_unavailable', message: 'CT.gov unreachable' }), { status: 502 })
      return new Response(JSON.stringify(RAW_RESPONSE), { status: 200 })
    }) as typeof fetch,
    async () => {
      await assertRejects('first call rejects as ApiError', () => fetchDiscoveredCompetitors(requestA), (err) => err instanceof ApiError)
      const retried = await fetchDiscoveredCompetitors(requestA)
      assert('the Retry after a failure succeeds with a real (non-stale) result', retried.homeAsset, RAW_RESPONSE.home_asset)
    },
  )
  assert('two real fetches: the failed attempt and the successful retry', callCount, 2)
})()

// ── 16. StrictMode-style mount/remount simulation: two synchronous calls from the "same effect firing twice" pattern never produce two fetches ──
console.log('16. Simulating React 18 dev StrictMode\'s mount -> cleanup -> mount effect churn (two synchronous calls to fetchDiscoveredCompetitors for the identical request, exactly as Stage2Discover.tsx\'s own effect would trigger) still produces only ONE fetch')
await (async () => {
  let callCount = 0
  await withMockFetch(
    (async () => { callCount++; return new Response(JSON.stringify(RAW_RESPONSE), { status: 200 }) }) as typeof fetch,
    async () => {
      // Exactly how Stage2Discover.tsx's useEffect(() => { runDiscovery() }, [])
      // fires under StrictMode: two synchronous, back-to-back calls with the
      // identical request, neither awaited before the other starts.
      const strictModeCall1 = fetchDiscoveredCompetitors(requestA)
      const strictModeCall2 = fetchDiscoveredCompetitors(requestA)
      await Promise.all([strictModeCall1, strictModeCall2])
    },
  )
  assert('StrictMode\'s double-invoke pattern results in exactly one real network request', callCount, 1)
})()

// ── Summary ─────────────────────────────────────────────────────────────────

declare const process: { exit(code: number): void }

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
