/**
 * landscapeEvidence.test.ts — fetchLandscapeEvidence()'s `lookbackDays`
 * time-horizon param (Historical evidence hydration, Step 1, 2026-08-24).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/api/landscapeEvidence.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { fetchLandscapeEvidence } from './landscapeEvidence.js'

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

function queryParams(url: string): URLSearchParams {
  return new URL(url).searchParams
}

console.log('1. lookbackDays present -> forwarded as the lookback_days query param')
await (async () => {
  let capturedUrl: string | null = null
  await withMockFetch(
    (async (url: any) => { capturedUrl = String(url); return new Response(JSON.stringify({ items: [] }), { status: 200 }) }) as typeof fetch,
    () => fetchLandscapeEvidence(['argenx'], 'generalized myasthenia gravis', 'MONDO:1060006', 30),
  )
  assert('lookback_days=30 present', queryParams(capturedUrl!).get('lookback_days'), '30')
})()

console.log('2. lookbackDays omitted -> byte-for-byte the pre-existing request, no lookback_days param sent at all')
await (async () => {
  let capturedUrl: string | null = null
  await withMockFetch(
    (async (url: any) => { capturedUrl = String(url); return new Response(JSON.stringify({ items: [] }), { status: 200 }) }) as typeof fetch,
    () => fetchLandscapeEvidence(['argenx'], 'generalized myasthenia gravis', 'MONDO:1060006'),
  )
  assert('lookback_days entirely absent, never sent as an empty/undefined string', queryParams(capturedUrl!).has('lookback_days'), false)
})()

console.log('3. lookbackDays=0 is falsy and correctly omitted (not a valid horizon; caller error, not a 0-day request)')
await (async () => {
  let capturedUrl: string | null = null
  await withMockFetch(
    (async (url: any) => { capturedUrl = String(url); return new Response(JSON.stringify({ items: [] }), { status: 200 }) }) as typeof fetch,
    () => fetchLandscapeEvidence(['argenx'], 'generalized myasthenia gravis', 'MONDO:1060006', 0),
  )
  assert('lookback_days omitted for 0', queryParams(capturedUrl!).has('lookback_days'), false)
})()

console.log('4. Empty companyIds still short-circuits with no network call, regardless of lookbackDays')
await (async () => {
  let fetchCalls = 0
  const items = await withMockFetch(
    (async () => { fetchCalls++; return new Response(JSON.stringify({ items: [{ id: 'x' }] }), { status: 200 }) }) as typeof fetch,
    () => fetchLandscapeEvidence([], 'generalized myasthenia gravis', null, 30),
  )
  assert('no network call for empty companyIds', fetchCalls, 0)
  assert('empty result', items, [])
})()

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
