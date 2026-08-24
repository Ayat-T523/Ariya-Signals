/**
 * timeHorizon.test.ts — the shared Month/Quarter/Year contract (Historical
 * evidence hydration, Step 1, 2026-08-24).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/timeHorizon.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { TIME_HORIZON_DAYS, DEFAULT_TIME_HORIZON, TIME_HORIZONS, isTimeHorizon } from './timeHorizon.js'

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

console.log('1. Exact day counts the task itself specifies')
assert('month = 30', TIME_HORIZON_DAYS.month, 30)
assert('quarter = 90', TIME_HORIZON_DAYS.quarter, 90)
assert('year = 365', TIME_HORIZON_DAYS.year, 365)

console.log('2. Default horizon is Month')
assert('DEFAULT_TIME_HORIZON is month', DEFAULT_TIME_HORIZON, 'month')

console.log('3. isTimeHorizon type guard')
assertTrue('"month" is a valid horizon', isTimeHorizon('month'))
assertTrue('"quarter" is a valid horizon', isTimeHorizon('quarter'))
assertTrue('"year" is a valid horizon', isTimeHorizon('year'))
assertTrue('an unrelated string is rejected, never silently coerced', !isTimeHorizon('week'))
assertTrue('null is rejected', !isTimeHorizon(null))
assertTrue('undefined is rejected -- a caller reading a corrupted localStorage value must fall back explicitly, never crash', !isTimeHorizon(undefined))

console.log('4. TIME_HORIZONS enumerates exactly the three real horizons, in a stable order')
assert('month, quarter, year -- in that order', TIME_HORIZONS, ['month', 'quarter', 'year'])

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
