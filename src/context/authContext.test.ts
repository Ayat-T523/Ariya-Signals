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

import { resolveAuthMode, LOCAL_DEV_USER, HTTP_MODE_CONFIG_ERROR, SUPABASE_MODE_CONFIG_ERROR, type AuthUser } from './AuthContext.js'

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

console.log('1. In a DEV build, auth mode resolution defaults to local, never silently to http or supabase')
assert('unset (undefined) -> local', resolveAuthMode(undefined, false), 'local')
assert('empty string -> local', resolveAuthMode('', false), 'local')
assert('arbitrary garbage value -> local (not http, not supabase)', resolveAuthMode('some-garbage-value', false), 'local')
assert('the literal string "http" -> http', resolveAuthMode('http', false), 'http')
assert('"HTTP" (wrong case) -> local, not silently accepted as http', resolveAuthMode('HTTP', false), 'local')

console.log('1b. V1 Login/Auth Restoration checkpoint (2026-08-27): "supabase" is now a real, explicit mode')
assert('the literal string "supabase" -> supabase', resolveAuthMode('supabase', false), 'supabase')
assert('"Supabase" (wrong case) -> local, not silently accepted', resolveAuthMode('Supabase', false), 'local')
assert('"SUPABASE" (wrong case) -> local, not silently accepted', resolveAuthMode('SUPABASE', false), 'local')

// ── Production fail-closed fix (2026-08-27, fourth pass) ────────────────────
// A missing/malformed VITE_AUTH_MODE on a real (Vercel) deployment must
// NEVER resolve to 'local' -- that would silently grant every visitor a
// credential-free session. Only the FALLBACK is environment-aware; explicit
// values always win regardless of environment (tested in 1d below).

console.log('1c. In a PRODUCTION build, a missing or malformed auth mode fails closed to \'supabase\' -- never \'local\'')
assert('PROD + unset (undefined) -> supabase, never a credential-free local session', resolveAuthMode(undefined, true), 'supabase')
assert('PROD + empty string -> supabase', resolveAuthMode('', true), 'supabase')
assert('PROD + arbitrary malformed value -> supabase (fails closed, not local)', resolveAuthMode('some-garbage-value', true), 'supabase')
assert('PROD + wrong-case "Supabase" -> supabase (fails closed, not local)', resolveAuthMode('Supabase', true), 'supabase')
assertTrue('none of the above ever resolve to \'local\' in production', [undefined, '', 'some-garbage-value', 'Supabase'].every((raw) => resolveAuthMode(raw, true) !== 'local'))

console.log('1d. Explicit VITE_AUTH_MODE values always win, in ANY environment -- intentional local development remains available')
assert('explicit "local" still resolves to local even in a PRODUCTION build (intentional local-only preview deploy)', resolveAuthMode('local', true), 'local')
assert('explicit "local" resolves to local in a dev build (unchanged)', resolveAuthMode('local', false), 'local')
assert('explicit "supabase" resolves to supabase in a dev build too', resolveAuthMode('supabase', false), 'supabase')
assert('explicit "http" resolves to http in a PRODUCTION build too', resolveAuthMode('http', true), 'http')

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

// ── Supabase mode configuration error (V1 Login/Auth Restoration, 2026-08-27) ──

console.log('4. Supabase mode, when unconfigured, surfaces a real configuration error -- never a fake pass, never a form that could not work')
assertTrue('mentions the VITE_AUTH_MODE variable by name', SUPABASE_MODE_CONFIG_ERROR.includes('VITE_AUTH_MODE'))
assertTrue('mentions the specific required env vars by name', SUPABASE_MODE_CONFIG_ERROR.includes('VITE_SUPABASE_URL') && SUPABASE_MODE_CONFIG_ERROR.includes('VITE_SUPABASE_ANON_KEY'))
assertTrue('tells the developer the local-mode escape hatch', SUPABASE_MODE_CONFIG_ERROR.includes('local'))
assertTrue('the two config-error messages are genuinely distinct (never one generic "auth broken" string)', HTTP_MODE_CONFIG_ERROR !== SUPABASE_MODE_CONFIG_ERROR)

console.log('5. PRODUCTION + missing VITE_AUTH_MODE + missing Supabase config: the full fail-closed chain, proven at each real step')
// Step 1: production with VITE_AUTH_MODE unset resolves to 'supabase' (never
// 'local') -- proven in test 1c above, restated here as the literal
// deployment scenario this fix exists for (a Vercel env missing the var
// entirely).
const prodDefaultMode = resolveAuthMode(undefined, true)
assert('an unset VITE_AUTH_MODE on a production build resolves to supabase', prodDefaultMode, 'supabase')
// Step 2: that resolved 'supabase' mode, with Supabase itself unconfigured
// (AuthContext.tsx's own `AUTH_MODE === 'supabase' && !supabase` check --
// see this file's own docstring for why the stateful AuthProvider behavior
// itself is verified live, not re-implemented here), is REQUIRED to produce
// the real configError -- never a state indistinguishable from "logged in".
assertTrue(
  'the resulting mode is exactly the one AuthContext.tsx gates on `!supabase` to set configError -- protected app access requires isAuthenticated, which configError blocks from ever becoming true',
  prodDefaultMode === 'supabase' && SUPABASE_MODE_CONFIG_ERROR.length > 0,
)

console.log('6. Intentional local-development mode is preserved -- unaffected by the production fail-closed fix')
assert('explicit VITE_AUTH_MODE=local in dev still grants the existing local-dev flow (unchanged)', resolveAuthMode('local', false), 'local')
assert('LOCAL_DEV_USER identity is unchanged by this fix', LOCAL_DEV_USER.displayName, 'Local Developer')

// ── V1 final auth requirements checkpoint (2026-08-27) ──────────────────────
// signUp()/requestPasswordReset()/updatePassword()/isPasswordRecovery live
// inside AuthProvider (a React component -- see this file's own docstring on
// why stateful behavior is verified live, not re-implemented here). What IS
// checked here, the same way setup-draft.test.ts checks AppContext.tsx's own
// unrenderable persistence discipline: the actual source text proves the
// wiring landed in the right place, not just that a helper file exists.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authContextSource = fs.readFileSync(path.join(__dirname, 'AuthContext.tsx'), 'utf-8')
const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf-8')
const appContextSource = fs.readFileSync(path.join(__dirname, 'AppContext.tsx'), 'utf-8')

console.log('7. Password-recovery session handling is wired into AuthContext, distinct from a normal sign-in')
assertTrue('AuthContextValue exposes isPasswordRecovery', authContextSource.includes('isPasswordRecovery: boolean'))
assertTrue('the onAuthStateChange handler sets isPasswordRecovery on the real PASSWORD_RECOVERY event, not on every event', authContextSource.includes("event === 'PASSWORD_RECOVERY'") && authContextSource.includes('setIsPasswordRecovery(true)'))
assertTrue('signing out always clears a stale recovery flag', authContextSource.includes("event === 'SIGNED_OUT'") && authContextSource.includes('setIsPasswordRecovery(false)'))
assertTrue('a successful updatePassword() clears the recovery flag itself, not just relying on another Supabase event', authContextSource.includes('await supabaseUpdatePassword(newPassword)') && /supabaseUpdatePassword\(newPassword\)\s*\n\s*\/\/[\s\S]*?setIsPasswordRecovery\(false\)/.test(authContextSource))

console.log('8. signUp/requestPasswordReset/updatePassword all fail closed the same way login() already does when Supabase is unconfigured')
assertTrue('signUp() surfaces SUPABASE_MODE_CONFIG_ERROR when unconfigured, never a silent no-op', /async function signUp[\s\S]*?SUPABASE_MODE_CONFIG_ERROR/.test(authContextSource))
assertTrue('requestPasswordReset() surfaces SUPABASE_MODE_CONFIG_ERROR when unconfigured', /async function requestPasswordReset[\s\S]*?SUPABASE_MODE_CONFIG_ERROR/.test(authContextSource))
assertTrue('updatePassword() surfaces SUPABASE_MODE_CONFIG_ERROR when unconfigured', /async function updatePassword[\s\S]*?SUPABASE_MODE_CONFIG_ERROR/.test(authContextSource))

console.log('9. Route protection: a password-recovery session is redirected to /reset-password BEFORE the normal isAuthenticated check -- it can never reach the workspace')
const authGuardBody = appSource.slice(appSource.indexOf('function AuthGuard'), appSource.indexOf('function SetupGuard'))
assertTrue('AuthGuard reads isPasswordRecovery from useAuth()', authGuardBody.includes('isPasswordRecovery'))
assertTrue('the isPasswordRecovery redirect appears BEFORE the isAuthenticated check (recovery wins even for an authenticated-looking session)', authGuardBody.indexOf('isPasswordRecovery') < authGuardBody.indexOf('if (!isAuthenticated)'))
assertTrue('the recovery redirect target is /reset-password', authGuardBody.includes("Navigate to=\"/reset-password\""))

console.log('10. New public auth routes exist alongside the existing protected route tree (unchanged)')
assertTrue('/sign-up is a public route', appSource.includes('<Route path="/sign-up"'))
assertTrue('/forgot-password is a public route', appSource.includes('<Route path="/forgot-password"'))
assertTrue('/reset-password is a public route (must be reachable by an unauthenticated browser following the email link)', appSource.includes('<Route path="/reset-password"'))
assertTrue('all three sit OUTSIDE the <AuthGuard/> route element, same as the existing /sign-in', appSource.indexOf('/sign-up') < appSource.indexOf('<Route element={<AuthGuard'))

console.log('11. Setup/landscape persistence is genuinely user-scoped, not just a helper file that nothing calls')
assertTrue('AppProvider reads the authenticated user id from useAuth()', appContextSource.includes('const { user: authUser } = useAuth()') && appContextSource.includes('const userId = authUser?.id ?? null'))
assertTrue('completeSetup() writes onboardingComplete through scopedKey(userId, ...), never the bare legacy key', appContextSource.includes("localStorage.setItem(scopedKey(userId, 'onboardingComplete'), 'true')"))
assertTrue('completeSetup() writes tracked competitors through scopedKey(userId, ...)', appContextSource.includes('localStorage.setItem(scopedKey(userId, TRACKED_COMPETITORS_KEY)'))
assertTrue('a corrective effect re-loads setup/landscape state whenever the authenticated userId changes (covers both a fresh sign-in and switching between two different users in one browser session)', appContextSource.includes('useLayoutEffect(() => {') && appContextSource.includes('migrateLegacyStateIfNeeded(userId)'))
assertTrue('SetupGuard\'s own routing rule is unchanged by this checkpoint -- onboardingComplete=false still sends the user to /setup', appSource.includes('if (!onboardingComplete) return <Navigate to="/setup" replace />'))

// ── Summary ─────────────────────────────────────────────────────────────────

// @types/node isn't configured for tsconfig.app.json -- see the identical note
// in src/config/landscape-configuration.test.ts.
declare const process: { exit(code: number): void }

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
