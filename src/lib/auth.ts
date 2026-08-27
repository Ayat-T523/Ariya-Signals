import { supabase } from './supabase'

/**
 * auth.ts — V1 Login/Auth Restoration checkpoint (2026-08-27).
 *
 * Restored from this repo's own pre-"Decouple Ariya frontend from Supabase
 * runtime" history (commit a46854c's parent) -- the last known-good real
 * Supabase auth implementation. Deliberately narrower than that version:
 * signUp/signInWithGoogle/signInWithMicrosoft/password-reset are NOT
 * restored here (V1 Login/Auth Restoration checkpoint's own explicit scope:
 * "Do not add role management, invitations, password-reset flows, admin UI,
 * organization management, MFA, or unrelated account features" -- this is
 * restoration of the minimum sign-in/sign-out flow, not the full prior
 * surface). AuthContext.tsx is the ONLY caller.
 */
export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Auth not configured')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
