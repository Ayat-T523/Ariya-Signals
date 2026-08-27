/**
 * userScopedStorage.test.ts — V1 final auth requirements checkpoint (2026-08-27).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/userScopedStorage.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Covers the actual security-relevant mechanism behind this checkpoint's
 * cross-user isolation requirement: scopedKey()'s namespacing and
 * migrateLegacyStateIfNeeded()'s one-time, one-user-only legacy claim. This
 * is where "User B must NOT see User A's landscape" and "User A's setup
 * survives User B signing up" are actually decided, independent of React.
 */
import assert from 'node:assert/strict'

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, value) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
}
;(globalThis as any).localStorage = new MemoryStorage()

import { scopedKey, migrateLegacyStateIfNeeded, SCOPED_STATE_KEYS } from './userScopedStorage'

let passed = 0
let failed = 0
function check(label: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓  ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${label}`)
    console.error(`     ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

console.log('1. scopedKey()')
check('null userId returns the bare key unchanged (auth not yet resolved, legacy behavior)', () => {
  assert.equal(scopedKey(null, 'onboardingComplete'), 'onboardingComplete')
})
check('a real userId namespaces the key', () => {
  assert.equal(scopedKey('user-a', 'onboardingComplete'), 'ariya:user-a:onboardingComplete')
})
check('two different userIds never collide on the same base key', () => {
  assert.notEqual(scopedKey('user-a', 'ariya-tracked-competitors'), scopedKey('user-b', 'ariya-tracked-competitors'))
})

console.log('2. migrateLegacyStateIfNeeded() — first real user inherits legacy state')
;(globalThis.localStorage as any).clear()
localStorage.setItem('onboardingComplete', 'true')
localStorage.setItem('onboardingVersion', 'v7')
localStorage.setItem('ariya-tracked-competitors', JSON.stringify([{ companyId: 'alexion' }]))
migrateLegacyStateIfNeeded('user-a')
check('User A (first real user) inherits the legacy onboardingComplete value under their own scoped key', () => {
  assert.equal(localStorage.getItem(scopedKey('user-a', 'onboardingComplete')), 'true')
})
check('User A inherits the legacy tracked-competitors value under their own scoped key', () => {
  assert.equal(localStorage.getItem(scopedKey('user-a', 'ariya-tracked-competitors')), JSON.stringify([{ companyId: 'alexion' }]))
})
check('the legacy bare key is left untouched (never deleted -- only copied)', () => {
  assert.equal(localStorage.getItem('onboardingComplete'), 'true')
})
check('the claim marker now records User A', () => {
  assert.equal(localStorage.getItem('ariya-legacy-state-claimed-by'), 'user-a')
})

console.log('3. migrateLegacyStateIfNeeded() — a second, different user never inherits the same legacy state')
migrateLegacyStateIfNeeded('user-b')
check('User B (second real user) does NOT inherit onboardingComplete', () => {
  assert.equal(localStorage.getItem(scopedKey('user-b', 'onboardingComplete')), null)
})
check('User B does NOT inherit tracked competitors', () => {
  assert.equal(localStorage.getItem(scopedKey('user-b', 'ariya-tracked-competitors')), null)
})
check('every one of User B\'s scoped keys is genuinely absent -- a brand-new user enters setup, not a partially-migrated state', () => {
  for (const k of SCOPED_STATE_KEYS) {
    assert.equal(localStorage.getItem(scopedKey('user-b', k)), null, `expected ${k} to be absent for user-b`)
  }
})

console.log('4. User A / User B isolation survives independent writes, and switching back to A restores A\'s own setup')
localStorage.setItem(scopedKey('user-b', 'ariya-tracked-competitors'), JSON.stringify([{ companyId: 'takeda' }]))
localStorage.setItem(scopedKey('user-b', 'onboardingComplete'), 'true')
check('User B completing their own setup does not touch User A\'s scoped competitors', () => {
  assert.equal(localStorage.getItem(scopedKey('user-a', 'ariya-tracked-competitors')), JSON.stringify([{ companyId: 'alexion' }]))
})
check('User A\'s onboardingComplete is unaffected by User B\'s own completion', () => {
  assert.equal(localStorage.getItem(scopedKey('user-a', 'onboardingComplete')), 'true')
})
check('User B\'s own data is independently correct', () => {
  assert.equal(localStorage.getItem(scopedKey('user-b', 'ariya-tracked-competitors')), JSON.stringify([{ companyId: 'takeda' }]))
})

console.log('5. migrateLegacyStateIfNeeded() is idempotent/safe to call on every login')
const beforeA = localStorage.getItem(scopedKey('user-a', 'ariya-tracked-competitors'))
migrateLegacyStateIfNeeded('user-a')
migrateLegacyStateIfNeeded('user-b')
check('re-running migration for a user who already has scoped state changes nothing', () => {
  assert.equal(localStorage.getItem(scopedKey('user-a', 'ariya-tracked-competitors')), beforeA)
})

console.log('6. A genuinely fresh browser (no legacy state at all) migrates nothing for the first user')
;(globalThis.localStorage as any).clear()
migrateLegacyStateIfNeeded('user-c')
check('no claim marker is written when there was nothing to migrate', () => {
  assert.equal(localStorage.getItem('ariya-legacy-state-claimed-by'), null)
})
check('a later real user on this same fresh browser can still be the one who claims legacy state, if any appears before their first login', () => {
  localStorage.setItem('onboardingComplete', 'true')
  localStorage.setItem('onboardingVersion', 'v7')
  migrateLegacyStateIfNeeded('user-d')
  assert.equal(localStorage.getItem(scopedKey('user-d', 'onboardingComplete')), 'true')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
