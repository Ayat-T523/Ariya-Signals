/**
 * landscapeSignals.test.ts — V1 Signal engine read client (2026-08-24).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/api/landscapeSignals.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { fetchLandscapeSignals, SIGNAL_TYPE_LABELS, sourceTypeLabel } from './landscapeSignals.js'

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

const realFetch = globalThis.fetch
async function withMockFetch<T>(mock: typeof fetch, fn: () => Promise<T>): Promise<T> {
  globalThis.fetch = mock as typeof fetch
  try { return await fn() } finally { globalThis.fetch = realFetch }
}

const RAW_SIGNAL = {
  id: 'sig1', signal_type: 'CLINICAL_TRIAL_ACTIVITY', disease_id: 'mondo:1060006', company_id: 'argenx',
  company_name: 'argenx', asset_id: 'efgartigimod-iv', asset_name: 'Efgartigimod IV',
  occurred_at: '2026-08-21T00:00:00+00:00', detected_at: '2026-08-24T00:00:00+00:00',
  title: 'argenx — ClinicalTrials.gov update for Efgartigimod IV',
  description: 'A ClinicalTrials.gov record was updated.', importance: 'MEDIUM',
  source_type: 'clinicaltrials_gov', source_locator: 'https://clinicaltrials.gov/study/NCT1', evidence_id: 'ev1',
  prior_evidence_id: null,
}

console.log('1. Empty companyIds short-circuits with no network call')
await (async () => {
  let calls = 0
  const items = await withMockFetch(
    (async () => { calls++; return new Response(JSON.stringify({ items: [RAW_SIGNAL] }), { status: 200 }) }) as typeof fetch,
    () => fetchLandscapeSignals([], 'generalized myasthenia gravis'),
  )
  assert('no network call', calls, 0)
  assert('empty result', items, [])
})()

console.log('2. No indication/indicationId at all short-circuits with no network call')
await (async () => {
  let calls = 0
  const items = await withMockFetch(
    (async () => { calls++; return new Response(JSON.stringify({ items: [RAW_SIGNAL] }), { status: 200 }) }) as typeof fetch,
    () => fetchLandscapeSignals(['argenx']),
  )
  assert('no network call without a disease', calls, 0)
  assert('empty result', items, [])
})()

console.log('3. Real request forwards companies/indication_id/lookback_days and maps the response')
await (async () => {
  let capturedUrl: string | null = null
  const items = await withMockFetch(
    (async (url: any) => { capturedUrl = String(url); return new Response(JSON.stringify({ items: [RAW_SIGNAL] }), { status: 200 }) }) as typeof fetch,
    () => fetchLandscapeSignals(['argenx', 'alexion'], 'generalized myasthenia gravis', 'MONDO:1060006', 30),
  )
  const params = new URL(capturedUrl!).searchParams
  assert('companies forwarded', params.get('companies'), 'argenx,alexion')
  assert('indication_id forwarded', params.get('indication_id'), 'MONDO:1060006')
  assert('lookback_days forwarded', params.get('lookback_days'), '30')
  assert('one item mapped', items.length, 1)
  assert('signalType mapped from signal_type', items[0].signalType, 'CLINICAL_TRIAL_ACTIVITY')
  assert('companyName mapped', items[0].companyName, 'argenx')
  assert('priorEvidenceId null when absent, never fabricated', items[0].priorEvidenceId, null)
})()

console.log('4. V1 PubMed integration checkpoint (2026-08-26): PUBLICATION_RESULTS is a first-class type')
;(() => {
  assert('PUBLICATION_RESULTS has a real label, never undefined', SIGNAL_TYPE_LABELS.PUBLICATION_RESULTS, 'Publication results')
  assert('pubmed source_type maps to an intelligible label', sourceTypeLabel('pubmed'), 'PubMed')
  assert('an unrecognized source_type falls back to the raw value, never crashes', sourceTypeLabel('some_future_source'), 'some_future_source')
  assert('a missing source_type falls back to a safe placeholder, never crashes', sourceTypeLabel(null), 'Unknown source')
})()

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
