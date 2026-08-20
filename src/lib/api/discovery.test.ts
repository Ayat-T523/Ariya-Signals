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

// ── Summary ─────────────────────────────────────────────────────────────────

declare const process: { exit(code: number): void }

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
