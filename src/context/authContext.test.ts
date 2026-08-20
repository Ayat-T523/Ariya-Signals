/**
 * authContext.test.ts — Frontend Step 3.5 acceptance tests.
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/context/authContext.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Scope note: AuthProvider's login()/logout()/session-restore live inside a
 * React component (useState/useEffect) and there is no React/DOM testing
 * library in this repo (per the product contract's own "do not introduce a
 * heavy testing framework" instruction). What's genuinely pure -- mode
 * resolution, the local-dev identity shape, the http-mode config-error
 * message -- is tested here. The stateful behaviors (session persists across
 * reload, logout clears it, protected routes redirect, useAccountIdentity
 * reads AuthContext, http mode never silently falls back to local) were
 * verified live in the running app instead -- see this step's checkpoint,
 * section Q, for exactly what was exercised and how.
 */

import { resolveAuthMode, LOCAL_DEV_USER, HTTP_MODE_CONFIG_ERROR, type AuthUser } from './AuthContext.js'

let passed = 0
let failed = 0

function assert(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     received: ${JSON.stringify(actual)}`)
    failed++
  }
}

function assertTrue(label: string, actual: boolean): void {
  assert(label, actual, true)
}

// ── Auth mode resolution ────────────────────────────────────────────────────

console.log('1. Auth mode resolution defaults to local, never silently to http')
assert('unset (undefined) -> local', resolveAuthMode(undefined), 'local')
assert('empty string -> local', resolveAuthMode(''), 'local')
assert('arbitrary garbage value -> local (not http)', resolveAuthMode('supabase'), 'local')
assert('the literal string "http" -> http', resolveAuthMode('http'), 'http')
assert('"HTTP" (wrong case) -> local, not silently accepted as http', resolveAuthMode('HTTP'), 'local')

// ── Local development identity ──────────────────────────────────────────────

console.log('2. Local development identity is neutral, not fabricated')
assert('displayName is the neutral "Local Developer"', LOCAL_DEV_USER.displayName, 'Local Developer')
assertTrue('displayName is NOT "David"', LOCAL_DEV_USER.displayName !== 'David')
assertTrue('no field on AuthUser holds a password', !('password' in LOCAL_DEV_USER))
assertTrue('no field on AuthUser holds a company/organisation', !('company' in LOCAL_DEV_USER) && !('organisation' in LOCAL_DEV_USER))
assert('AuthUser shape is exactly {id, email?, displayName?}', Object.keys(LOCAL_DEV_USER).sort(), ['displayName', 'id'])

// Structural check on the type itself: a value satisfying AuthUser can never
// carry credentials -- this is enforced at compile time (TS would reject
// `{ id: 'x', password: 'y' } satisfies AuthUser`), not re-derivable at
// runtime, so it's asserted here as documentation of the contract tsc already
// checks whenever AuthContext.tsx changes.
const _typeContractCheck: AuthUser = { id: 'x', email: 'x@example.com', displayName: 'X' }
assertTrue('AuthUser type-contract sanity value constructs without a password field', !('password' in _typeContractCheck))

// ── HTTP mode configuration error ───────────────────────────────────────────

console.log('3. HTTP mode surfaces a real configuration error, not a vague failure')
assertTrue('mentions the VITE_AUTH_MODE variable by name', HTTP_MODE_CONFIG_ERROR.includes('VITE_AUTH_MODE'))
assertTrue('mentions the Ariya API', HTTP_MODE_CONFIG_ERROR.toLowerCase().includes('api'))
assertTrue('tells the developer the local-mode escape hatch', HTTP_MODE_CONFIG_ERROR.includes('local'))

// ── Summary ─────────────────────────────────────────────────────────────────

// @types/node isn't configured for tsconfig.app.json -- see the identical note
// in src/config/landscape-configuration.test.ts.
declare const process: { exit(code: number): void }

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
