/**
 * marketWeatherPresentation.test.ts — Market Weather honesty-fix tests
 * (War Room semantic-integrity checkpoint, 2026-08-25).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/marketWeatherPresentation.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { computeMarketWeatherPresentation } from './marketWeatherPresentation.js'
import type { MarketWeatherResult } from './api/marketWeather.js'

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

function okResult(overrides: Partial<MarketWeatherResult> = {}): MarketWeatherResult {
  return {
    status: 'ok', windowDays: 90, signalCount: 2, bundleCount: 2, state: 'ACTIVE',
    summary: 'Two competitors posted new clinical trial information.',
    movements: [{ title: 'Abbott Medical Devices posted results', summary: '...', signalIds: ['sig-1'] }],
    implications: [{ text: 'Clinical activity is present but limited.', signalIds: ['sig-1'] }],
    ...overrides,
  }
}

console.log('1. Successful assessment (status ok, real state) renders the mapped state, never pending')
assert(
  'CALM maps to clearing',
  computeMarketWeatherPresentation({ marketWeatherResult: okResult({ state: 'CALM' }), marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }).pressureState,
  'clearing',
)
assert(
  'ACTIVE maps to stable',
  computeMarketWeatherPresentation({ marketWeatherResult: okResult({ state: 'ACTIVE' }), marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }).pressureState,
  'stable',
)
assert(
  'HIGH_PRESSURE maps to storm',
  computeMarketWeatherPresentation({ marketWeatherResult: okResult({ state: 'HIGH_PRESSURE' }), marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }).pressureState,
  'storm',
)
assert(
  'genuine assessment qualifier names the real window',
  computeMarketWeatherPresentation({ marketWeatherResult: okResult(), marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }).pressureQualifier,
  'over the last 90 days',
)

console.log('2. Loading never becomes Clearing')
assert(
  'loading -> pending, not clearing',
  computeMarketWeatherPresentation({ marketWeatherResult: null, marketWeatherLoading: true, discoveredCompanyCount: 3, weatherWindow: 90 }).pressureState,
  'pending',
)
assert(
  'loading empty-message is an honest loading message',
  computeMarketWeatherPresentation({ marketWeatherResult: null, marketWeatherLoading: true, discoveredCompanyCount: 3, weatherWindow: 90 }).rowsEmptyMessage,
  'Loading market assessment…',
)

console.log('3. Backend unavailable/invalid never become Clearing')
for (const status of ['unavailable', 'invalid'] as const) {
  const raw = okResult({ status, state: null, movements: [], implications: [] })
  assert(`${status} -> pending, not clearing`, computeMarketWeatherPresentation({ marketWeatherResult: raw, marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }).pressureState, 'pending')
  assert(`${status} empty-message is an honest unavailable message`, computeMarketWeatherPresentation({ marketWeatherResult: raw, marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }).rowsEmptyMessage, 'Market Weather synthesis unavailable.')
}

console.log('4. no_signals never becomes Clearing, and its zero-state copy is window-dynamic (7D/30D/90D)')
for (const weatherWindow of [7, 30, 90] as const) {
  const raw = okResult({ status: 'no_signals', state: null, movements: [], implications: [] })
  const result = computeMarketWeatherPresentation({ marketWeatherResult: raw, marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow })
  assert(`no_signals (${weatherWindow}D) -> pending, not clearing`, result.pressureState, 'pending')
  assert(`no_signals (${weatherWindow}D) zero-state names the real window`, result.rowsEmptyMessage, `No material competitive movement detected in this ${weatherWindow}-day window.`)
}

console.log('5. Tracked V1 companies not in the legacy HAE list do not trigger "Track competitors"')
assert(
  'real V1 companies tracked (discoveredCompanyCount > 0) -> real zero-state copy, never "Track competitors"',
  computeMarketWeatherPresentation({ marketWeatherResult: okResult({ status: 'ok', state: 'ACTIVE', movements: [] }), marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }).rowsEmptyMessage,
  'No material competitive movement detected in this 90-day window.',
)
assert(
  'zero real V1 companies tracked -> "Track competitors" (never gated on the legacy HAE namespace)',
  computeMarketWeatherPresentation({ marketWeatherResult: null, marketWeatherLoading: false, discoveredCompanyCount: 0, weatherWindow: 90 }).rowsEmptyMessage,
  'Track competitors to see their weekly moves here.',
)

console.log('6. A genuine calm/clearing backend verdict still renders correctly (not swallowed by the honesty fix)')
assert(
  'CALM with real movements is a real, live clearing assessment',
  computeMarketWeatherPresentation({ marketWeatherResult: okResult({ state: 'CALM' }), marketWeatherLoading: false, discoveredCompanyCount: 3, weatherWindow: 90 }),
  { pressureState: 'clearing', pressureQualifier: 'over the last 90 days', rowsEmptyMessage: 'No material competitive movement detected in this 90-day window.' },
)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
