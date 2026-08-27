import { supabase } from './supabase'

/**
 * auth.ts — V1 Login/Auth Restoration checkpoint (2026-08-27), extended by
 * the V1 final auth requirements checkpoint (2026-08-27, later pass) with
 * signUp/resetPasswordForEmail/updatePassword -- deliberately still no
 * OAuth/MFA/role management (out of scope for both checkpoints).
 * AuthContext.tsx is the ONLY caller.
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

/**
 * A session comes back immediately when the Supabase project has email
 * confirmation disabled; when confirmation is required, signUp() still
 * succeeds but `data.session` is null -- the caller must show an honest
 * "check your email" state rather than pretending the user is logged in.
 */
export async function signUp(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
  if (!supabase) throw new Error('Auth not configured')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return { needsEmailConfirmation: !data.session }
}

/** Neutral by design -- Supabase itself returns success here whether or not the email exists, so this never leaks account existence. */
export async function resetPasswordForEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Auth not configured')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

/** Must be called while a real Supabase password-recovery session is active (see AuthContext.tsx's PASSWORD_RECOVERY handling) -- there is no separate token parameter here because Supabase's client already holds that session. */
export async function updatePassword(newPassword: string): Promise<void> {
  if (!supabase) throw new Error('Auth not configured')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
