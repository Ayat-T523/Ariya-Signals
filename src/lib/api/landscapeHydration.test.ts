/**
 * landscapeHydration.test.ts — historical evidence hydration (Step 1,
 * 2026-08-24) frontend client tests.
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/api/landscapeHydration.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * global.fetch is monkeypatched directly, matching discovery.test.ts's own
 * convention -- no MSW/nock.
 */
import { triggerLandscapeHydration, toHydrationUIStatus, hydrationStatusLabel, type HydrationRequest } from './landscapeHydration.js'

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

const realFetch = globalThis.fetch
async function withMockFetch<T>(mock: typeof fetch, fn: () => Promise<T>): Promise<T> {
  globalThis.fetch = mock as typeof fetch
  try { return await fn() } finally { globalThis.fetch = realFetch }
}

const RAW_COMPLETE_RESPONSE = {
  status: 'complete',
  hydration: {
    disease_id: 'mondo:1060006', home_asset: 'RYSTIGGO', status: 'complete',
    covered_from: null, covered_to: null, last_hydrated_at: '2026-08-24T00:00:00+00:00',
    source_statuses: [{ source_id: 'ctgov_disease_discovery', entity_name: 'RYSTIGGO', run_state: 'succeeded_with_results' }],
  },
}

// ── 1. Request body uses the correct snake_case field names ─────────────────

console.log('1. Request body shape')
await (async () => {
  let capturedBody: any = null
  let capturedUrl: string | null = null
  await withMockFetch(
    (async (url: any, init: any) => {
      capturedUrl = String(url)
      capturedBody = JSON.parse(init.body)
      return new Response(JSON.stringify(RAW_COMPLETE_RESPONSE), { status: 200 })
    }) as typeof fetch,
    () => triggerLandscapeHydration({
      homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis',
      homeCompany: 'UCB', indicationId: 'MONDO:1060006',
    }),
  )
  assertTrue('POSTs to /api/landscape/hydrate', capturedUrl!.includes('/api/landscape/hydrate'))
  assert('body carries snake_case fields, home_company/indication_id included when present', capturedBody, {
    home_asset: 'RYSTIGGO', indication: 'generalized myasthenia gravis',
    home_company: 'UCB', indication_id: 'MONDO:1060006',
  })
})()

console.log('2. Optional fields omitted, never sent as null/empty-string')
await (async () => {
  let capturedBody: any = null
  await withMockFetch(
    (async (_url: any, init: any) => { capturedBody = JSON.parse(init.body); return new Response(JSON.stringify(RAW_COMPLETE_RESPONSE), { status: 200 }) }) as typeof fetch,
    () => triggerLandscapeHydration({ homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis' }),
  )
  assert('no home_company/indication_id/force keys at all when omitted', capturedBody, {
    home_asset: 'RYSTIGGO', indication: 'generalized myasthenia gravis',
  })
})()

console.log('3. force:true is sent explicitly, never silently dropped')
await (async () => {
  let capturedBody: any = null
  await withMockFetch(
    (async (_url: any, init: any) => { capturedBody = JSON.parse(init.body); return new Response(JSON.stringify(RAW_COMPLETE_RESPONSE), { status: 200 }) }) as typeof fetch,
    () => triggerLandscapeHydration({ homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis', force: true }),
  )
  assert('force:true present', capturedBody.force, true)
})()

// ── 4. Response mapping ──────────────────────────────────────────────────────

console.log('4. Response mapping to camelCase HydrationResult')
await (async () => {
  const result = await withMockFetch(
    (async () => new Response(JSON.stringify(RAW_COMPLETE_RESPONSE), { status: 200 })) as typeof fetch,
    () => triggerLandscapeHydration({ homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis' }),
  )
  assert('status mapped verbatim', result.status, 'complete')
  assert('hydration.diseaseId mapped from disease_id', result.hydration?.diseaseId, 'mondo:1060006')
  assert('hydration.lastHydratedAt mapped from last_hydrated_at', result.hydration?.lastHydratedAt, '2026-08-24T00:00:00+00:00')
})()

console.log('5. A null hydration in the raw response maps to null, never a fabricated object')
await (async () => {
  const result = await withMockFetch(
    (async () => new Response(JSON.stringify({ status: 'already_covered', hydration: null }), { status: 200 })) as typeof fetch,
    () => triggerLandscapeHydration({ homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis' }),
  )
  assert('hydration is null, not {}', result.hydration, null)
})()

// ── 6. In-flight de-duplication (same discipline as fetchDiscoveredCompetitors) ─

console.log('6. Two concurrent identical requests share one underlying fetch call')
await (async () => {
  let fetchCalls = 0
  const req: HydrationRequest = { homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis' }
  await withMockFetch(
    (async () => {
      fetchCalls++
      await new Promise((r) => setTimeout(r, 10))
      return new Response(JSON.stringify(RAW_COMPLETE_RESPONSE), { status: 200 })
    }) as typeof fetch,
    async () => {
      const [a, b] = await Promise.all([triggerLandscapeHydration(req), triggerLandscapeHydration(req)])
      assert('both calls resolve to the same result', a, b)
    },
  )
  assert('exactly one real fetch call made for two concurrent identical requests', fetchCalls, 1)
})()

console.log('7. force:true and force:false/absent are treated as DIFFERENT requests, never deduplicated together')
await (async () => {
  let fetchCalls = 0
  await withMockFetch(
    (async () => { fetchCalls++; return new Response(JSON.stringify(RAW_COMPLETE_RESPONSE), { status: 200 }) }) as typeof fetch,
    async () => {
      await Promise.all([
        triggerLandscapeHydration({ homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis' }),
        triggerLandscapeHydration({ homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis', force: true }),
      ])
    },
  )
  assert('two distinct fetch calls -- force is part of request identity', fetchCalls, 2)
})()

console.log('8. CORRECTNESS GATE FIX: partial_recent status and home_company/scope_id map through untouched')
await (async () => {
  const raw = {
    status: 'partial_recent',
    hydration: {
      scope_id: 'mondo:1060006::rystiggo::ucb', disease_id: 'mondo:1060006', home_asset: 'RYSTIGGO', home_company: 'UCB',
      status: 'partial', covered_from: null, covered_to: null, last_hydrated_at: '2026-08-24T00:00:00+00:00', source_statuses: null,
    },
  }
  const result = await withMockFetch(
    (async () => new Response(JSON.stringify(raw), { status: 200 })) as typeof fetch,
    () => triggerLandscapeHydration({ homeAsset: 'RYSTIGGO', indication: 'generalized myasthenia gravis', homeCompany: 'UCB' }),
  )
  assert('status is partial_recent, distinct from already_covered', result.status, 'partial_recent')
  assert('hydration.homeCompany mapped from home_company', result.hydration?.homeCompany, 'UCB')
  assert('hydration.scopeId mapped from scope_id', result.hydration?.scopeId, 'mondo:1060006::rystiggo::ucb')
  assert('hydration.status (the underlying coverage state) stays "partial", distinct from the outer partial_recent', result.hydration?.status, 'partial')
})()

console.log('9. toHydrationUIStatus collapses skip-reason variants to coverage-quality states (gate test N)')
assert('complete -> complete', toHydrationUIStatus('complete'), 'complete')
assert('already_covered -> complete (same coverage quality, different skip reason)', toHydrationUIStatus('already_covered'), 'complete')
assert('partial -> partial', toHydrationUIStatus('partial'), 'partial')
assert('partial_recent -> partial (still honestly incomplete, even though this call did not re-run)', toHydrationUIStatus('partial_recent'), 'partial')
assert('failed -> failed', toHydrationUIStatus('failed'), 'failed')

console.log('10. hydrationStatusLabel: compact text only for the exceptional states, never for idle/complete')
assert('idle -> no banner', hydrationStatusLabel('idle'), null)
assert('complete -> no banner (the good default state)', hydrationStatusLabel('complete'), null)
assert('hydrating -> "Updating evidence…"', hydrationStatusLabel('hydrating'), 'Updating evidence…')
assert('partial -> "Some sources unavailable"', hydrationStatusLabel('partial'), 'Some sources unavailable')
assert('failed -> "Couldn\'t refresh evidence"', hydrationStatusLabel('failed'), "Couldn't refresh evidence")

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
