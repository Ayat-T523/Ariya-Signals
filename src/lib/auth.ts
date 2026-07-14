import { supabase } from './supabase'

const REDIRECT_TO = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Auth not configured')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Auth not configured')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: REDIRECT_TO },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Auth not configured')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_TO },
  })
  if (error) throw error
}

export async function signInWithMicrosoft() {
  if (!supabase) throw new Error('Auth not configured')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { scopes: 'email', redirectTo: REDIRECT_TO },
  })
  if (error) throw error
}
