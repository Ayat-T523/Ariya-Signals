/**
 * userScopedStorage.ts — V1 auth requirements checkpoint (2026-08-27).
 *
 * Setup/landscape identity (onboarding completion, Therapeutic Area/Disease
 * Area, home asset, tracked competitors) was previously stored under plain,
 * global localStorage keys -- correct for a single-user dev browser, but a
 * second real Supabase user signing in on the SAME browser would silently
 * inherit the first user's entire landscape. Every key in SCOPED_STATE_KEYS
 * is namespaced by the authenticated user's stable `user.id` (AuthContext's
 * AuthUser.id -- LOCAL_DEV_USER.id in local-dev mode, which is always the
 * same value, so local dev keeps behaving exactly as before this
 * checkpoint). `userId` null (auth not yet resolved) falls back to the bare
 * legacy key, matching this app's exact pre-checkpoint behavior for that
 * window -- AuthGuard never renders protected content until auth resolves,
 * so that fallback is never user-visible.
 */

export function scopedKey(userId: string | null | undefined, baseKey: string): string {
  return userId ? `ariya:${userId}:${baseKey}` : baseKey
}

/** Every plain localStorage key this checkpoint scopes per authenticated user. */
export const SCOPED_STATE_KEYS = [
  'onboardingComplete',
  'onboardingVersion',
  'ariya-landscape-configuration',
  'ariya-tracked-competitors',
  'ariya-manual-home-asset',
  'ariya-resolved-home-asset',
  'ariya-manual-disease-area',
  'ariya-resolved-disease-area',
  'ariya-user-indication',
  'ariya-user-asset',
  'ariya-user-asset-id',
] as const

const LEGACY_CLAIM_KEY = 'ariya-legacy-state-claimed-by'

/**
 * One-time migration: the FIRST real authenticated user on this browser
 * (per browser, not per user) inherits whatever pre-auth-era global setup
 * state already exists, preserving that landscape instead of discarding it.
 * LEGACY_CLAIM_KEY records who claimed it, so no later, different user.id
 * is ever handed the same legacy data (checkpoint requirement: "never let
 * subsequent/new users inherit that same legacy setup"). A no-op once this
 * user already has their own scoped keys, or once ANY user has claimed the
 * legacy state -- so calling this on every login is safe and idempotent.
 */
export function migrateLegacyStateIfNeeded(userId: string): void {
  try {
    const hasOwnScopedState = SCOPED_STATE_KEYS.some((k) => localStorage.getItem(scopedKey(userId, k)) !== null)
    if (hasOwnScopedState) return
    if (localStorage.getItem(LEGACY_CLAIM_KEY)) return
    let migratedAnything = false
    for (const k of SCOPED_STATE_KEYS) {
      const legacyValue = localStorage.getItem(k)
      if (legacyValue !== null) {
        localStorage.setItem(scopedKey(userId, k), legacyValue)
        migratedAnything = true
      }
    }
    if (migratedAnything) localStorage.setItem(LEGACY_CLAIM_KEY, userId)
  } catch { /* noop -- scoped state simply stays empty, same failure mode as every other localStorage read/write in this app */ }
}
