/**
 * assetSearch.test.ts — Issue #4 focused tests: typed Home Asset search
 * (searchAssets) now carries the currently-selected Disease Area through
 * as an `indication` query param, alongside `q`, when given.
 *
 * No test runner is configured in this repo (see discovery.test.ts's own
 * note) -- run with:  npx tsx src/lib/api/assetSearch.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * global.fetch is monkeypatched directly, same convention as
 * discovery.test.ts -- no MSW/nock.
 */

import { searchAssets, searchAssetsByIndication, mapAssetSearchResponse } from './assetSearch.js'

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

const EMPTY_RESPONSE = { query: '', results: [], diagnostics: { known_catalog_count: 0, live_discovered_count: 0, source_run_state: null } }

const realFetch = globalThis.fetch
async function withCapturedRequest<T>(fn: () => Promise<T>): Promise<{ result: T; url: string }> {
  let capturedUrl = ''
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = typeof input === 'string' ? input : input.toString()
    return new Response(JSON.stringify(EMPTY_RESPONSE), { status: 200 })
  }) as typeof fetch
  try {
    const result = await fn()
    return { result, url: capturedUrl }
  } finally {
    globalThis.fetch = realFetch
  }
}

// ── 1. Selected Disease Area + typed asset sends BOTH asset and disease context ──

console.log('1. Selected Disease Area + typed asset query sends both q and indication')
await (async () => {
  const { url } = await withCapturedRequest(() => searchAssets('TAGRISSO', 'Non-Small Cell Lung Cancer'))
  const params = new URL(url).searchParams
  assert('q param', params.get('q'), 'TAGRISSO')
  assert('indication param', params.get('indication'), 'Non-Small Cell Lung Cancer')
})()

// ── 2. Manual/MONDO Disease Area value is also propagated ────────────────────

console.log('2. A MONDO-id-style or manually-entered Disease Area value propagates identically')
await (async () => {
  const { url } = await withCapturedRequest(() => searchAssets('TAGRISSO', 'MONDO:0005233'))
  const params = new URL(url).searchParams
  assert('q param', params.get('q'), 'TAGRISSO')
  assert('indication param (MONDO id)', params.get('indication'), 'MONDO:0005233')
})()
await (async () => {
  const { url } = await withCapturedRequest(() => searchAssets('TAGRISSO', 'My Own Manually-Typed Disease'))
  const params = new URL(url).searchParams
  assert('indication param (manual entry)', params.get('indication'), 'My Own Manually-Typed Disease')
})()

// ── 3. No Disease Area preserves the existing query-only behavior ────────────

console.log('3. No Disease Area selected sends the original query-only request, no fabricated indication')
await (async () => {
  const { url } = await withCapturedRequest(() => searchAssets('TAGRISSO'))
  const params = new URL(url).searchParams
  assert('q param', params.get('q'), 'TAGRISSO')
  assertTrue('no indication param at all', params.get('indication') === null)
})()
await (async () => {
  const { url } = await withCapturedRequest(() => searchAssets('TAGRISSO', undefined))
  const params = new URL(url).searchParams
  assertTrue('undefined indication -> no indication param', params.get('indication') === null)
})()
await (async () => {
  const { url } = await withCapturedRequest(() => searchAssets('TAGRISSO', ''))
  const params = new URL(url).searchParams
  assertTrue('blank-string indication -> no indication param (not fabricated as empty)', params.get('indication') === null)
})()

// ── 4. Automatic pre-typing disease suggestions still behave as before ───────

console.log('4. searchAssetsByIndication() (automatic pre-typing suggestions) is unchanged')
await (async () => {
  const { url } = await withCapturedRequest(() => searchAssetsByIndication('Non-Small Cell Lung Cancer'))
  const params = new URL(url).searchParams
  assert('indication param', params.get('indication'), 'Non-Small Cell Lung Cancer')
  assertTrue('no q param sent by the indication-only path', params.get('q') === null)
})()

// ── Response mapping is unaffected (sanity check, not the focus of this file) ─

console.log('5. Response mapping still round-trips the same shape')
assert('mapAssetSearchResponse handles the empty-response shape', mapAssetSearchResponse(EMPTY_RESPONSE), {
  query: '', results: [], diagnostics: { knownCatalogCount: 0, liveDiscoveredCount: 0, sourceRunState: null },
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
