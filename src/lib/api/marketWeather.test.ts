/**
 * marketWeather.test.ts — Market Weather V1 read client (War Room
 * semantic-integrity checkpoint, 2026-08-25).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/api/marketWeather.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { fetchMarketWeather } from './marketWeather.js'

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

const RAW_OK_RESPONSE = {
  status: 'ok', window_days: 30, signal_count: 5, bundle_count: 5,
  state: 'ACTIVE', summary: 'Moderate activity.',
  movements: [{ title: 'Clinical activity increased', signal_ids: ['sig-1', 'sig-2'], summary: 'Two competitors posted trial updates.' }],
  implications: [{ text: 'Pressure appears stable.', signal_ids: ['sig-1'] }],
}

console.log('1. Empty companyIds short-circuits with no network call')
await (async () => {
  let calls = 0
  const result = await withMockFetch(
    (async () => { calls++; return new Response(JSON.stringify(RAW_OK_RESPONSE), { status: 200 }) }) as typeof fetch,
    () => fetchMarketWeather([], 'heart failure', null, 30),
  )
  assert('no network call', calls, 0)
  assert('null result', result, null)
})()

console.log('2. No indication/indicationId at all short-circuits with no network call')
await (async () => {
  let calls = 0
  const result = await withMockFetch(
    (async () => { calls++; return new Response(JSON.stringify(RAW_OK_RESPONSE), { status: 200 }) }) as typeof fetch,
    () => fetchMarketWeather(['astrazeneca'], null, null, 30),
  )
  assert('no network call without a disease', calls, 0)
  assert('null result', result, null)
})()

console.log('3. Real request forwards companies/indication_id/window_days and maps the response')
await (async () => {
  let capturedUrl: string | null = null
  const result = await withMockFetch(
    (async (url: any) => { capturedUrl = String(url); return new Response(JSON.stringify(RAW_OK_RESPONSE), { status: 200 }) }) as typeof fetch,
    () => fetchMarketWeather(['astrazeneca', 'sanofi'], 'heart failure', 'mondo:0005252', 30),
  )
  const params = new URL(capturedUrl!).searchParams
  assert('companies forwarded', params.get('companies'), 'astrazeneca,sanofi')
  assert('indication_id forwarded', params.get('indication_id'), 'mondo:0005252')
  assert('window_days forwarded', params.get('window_days'), '30')
  assert('status mapped', result?.status, 'ok')
  assert('state mapped', result?.state, 'ACTIVE')
  assert('movement signalIds mapped from signal_ids', result?.movements[0].signalIds, ['sig-1', 'sig-2'])
  assert('implication signalIds mapped from signal_ids', result?.implications[0].signalIds, ['sig-1'])
})()

console.log('4. no_signals status maps cleanly with empty movements/implications')
await (async () => {
  const raw = { status: 'no_signals', window_days: 7, signal_count: 0, bundle_count: 0, state: null, summary: null, movements: [], implications: [] }
  const result = await withMockFetch(
    (async () => new Response(JSON.stringify(raw), { status: 200 })) as typeof fetch,
    () => fetchMarketWeather(['astrazeneca'], 'heart failure', null, 7),
  )
  assert('status is no_signals', result?.status, 'no_signals')
  assert('empty movements', result?.movements, [])
  assert('state is null', result?.state, null)
})()

console.log('5. unavailable status is passed through, never silently upgraded to ok', )
await (async () => {
  const raw = { status: 'unavailable', window_days: 90, signal_count: 3, bundle_count: 0, state: null, summary: null, movements: [], implications: [] }
  const result = await withMockFetch(
    (async () => new Response(JSON.stringify(raw), { status: 200 })) as typeof fetch,
    () => fetchMarketWeather(['astrazeneca'], 'heart failure', null, 90),
  )
  assert('status is unavailable', result?.status, 'unavailable')
})()

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
