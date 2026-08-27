import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { signIn, signOut } from '../lib/auth'

/**
 * AuthContext.tsx — provider-independent authentication (Frontend Step 3.5;
 * V1 Login/Auth Restoration checkpoint, 2026-08-27, restores real Supabase
 * auth as a first-class mode).
 *
 * Nothing outside this file should import `@supabase/supabase-js` for
 * identity or session purposes -- src/lib/supabase.ts's client remains in
 * use elsewhere only for product-data queries (see useCompetitorSupabase.ts,
 * lib/db/index.ts), a separate, still-legitimate use of the same package.
 *
 * Three modes, chosen by VITE_AUTH_MODE (default 'local' -- unset stays
 * exactly as backward-compatible as before this checkpoint, so no existing
 * local dev workflow silently breaks):
 *
 *   'local'    -- explicit local-development session. No credentials, no
 *                 password field, no fake sign-in form. `login()` grants an
 *                 immediate session as a neutral "Local Developer" identity.
 *                 Persists across reload (localStorage flag).
 *
 *   'supabase' -- THE restored real V1 login flow (this checkpoint). Session
 *                 state is Supabase's own -- a single `onAuthStateChange`
 *                 subscription (the same pattern this repo's own pre-decouple
 *                 history used in AppContext.tsx) supplies the INITIAL
 *                 session, every subsequent SIGNED_IN/SIGNED_OUT/TOKEN_
 *                 REFRESHED transition, and cross-tab/refresh persistence --
 *                 Supabase's own localStorage-backed session store is the
 *                 ONE source of truth, never re-implemented here. `login()`
 *                 requires real email/password credentials and calls
 *                 lib/auth.ts's signIn(); `logout()` calls signOut(). When
 *                 `supabase` is null (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
 *                 unset), this mode surfaces an honest configError instead
 *                 of a form that could never authenticate anyone -- the same
 *                 "no silent fallback" discipline 'http' mode already
 *                 established below.
 *
 *   'http'     -- the future seam for POST /api/auth/login, POST
 *                 /api/auth/logout, GET /api/auth/me (a Python Ariya API,
 *                 unrelated to Supabase). Not implemented yet -- selecting it
 *                 produces a clear configError instead of silently behaving
 *                 like 'local'. Untouched by this checkpoint.
 */

export interface AuthUser {
  id: string
  email?: string
  displayName?: string
}

export type AuthMode = 'local' | 'http' | 'supabase'

export interface AuthCredentials {
  email: string
  password: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  mode: AuthMode
  /** Set in 'http' mode (API not implemented) and in 'supabase' mode when
   *  the Supabase client isn't configured -- both are honest configuration
   *  errors, never a silent fallback to a working-looking state. */
  configError: string | null
  /** 'local' mode ignores `credentials` entirely (no form exists to supply
   *  them). 'supabase' mode requires them -- omitting them is a caller bug,
   *  not a valid unauthenticated attempt, so it throws rather than silently
   *  no-op-ing. */
  login: (credentials?: AuthCredentials) => Promise<void>
  logout: () => Promise<void>
}

// No vite-env.d.ts exists anywhere in this repo (a pre-existing, repo-wide
// gap -- src/App.tsx's own import.meta.env.VITE_BYPASS_AUTH usage had the
// identical TS2339 before this file existed). Ambient-declared here rather
// than adding the missing repo-wide vite/client type reference.
declare global {
  interface ImportMeta {
    env: Record<string, string | undefined>
  }
}

/**
 * Pure -- exported for testing without needing to render React.
 *
 * PRODUCTION FAIL-CLOSED FIX (2026-08-27, fourth pass): the three literal
 * recognized values ('http'/'supabase'/'local') always resolve to
 * themselves, in ANY environment -- an explicit `VITE_AUTH_MODE=local`
 * still works in a production build, for an intentional local-only
 * preview deploy (checkpoint's own instruction: "explicit development/
 * local mode may remain available for intentional local development").
 * Only the FALLBACK for an unset/empty/unrecognized value is environment-
 * aware: in a production build (`isProd`), it resolves to 'supabase' --
 * never 'local' -- so a missing or malformed VITE_AUTH_MODE on a real
 * deployment can NEVER silently grant a credential-free session. 'supabase'
 * mode itself already fails closed to an honest configError when
 * VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY aren't set (unchanged from the
 * prior pass) -- this fix only changes WHICH mode an absent/garbage value
 * defaults to, never what either mode does once selected. In a dev build
 * (`isProd` false), the fallback stays 'local', byte-for-byte the
 * pre-existing default -- no existing local dev workflow changes. */
export function resolveAuthMode(raw: string | undefined, isProd: boolean): AuthMode {
  if (raw === 'http') return 'http'
  if (raw === 'supabase') return 'supabase'
  if (raw === 'local') return 'local'
  return isProd ? 'supabase' : 'local'
}

export const LOCAL_SESSION_KEY = 'ariya-local-auth-session'

// Neutral, explicitly-development identity -- never "David"/"Pharma Inc".
export const LOCAL_DEV_USER: AuthUser = {
  id: 'local-dev',
  displayName: 'Local Developer',
}

export const HTTP_MODE_CONFIG_ERROR =
  'HTTP auth mode is configured (VITE_AUTH_MODE=http) but no Ariya API is available yet. ' +
  'Set VITE_AUTH_MODE=local (or leave it unset) for local development.'

export const SUPABASE_MODE_CONFIG_ERROR =
  'Supabase auth mode is configured (VITE_AUTH_MODE=supabase) but VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ' +
  'are not set. Configure them (see .env.example), or set VITE_AUTH_MODE=local for local development without Supabase.'

// Optional chaining on `env` itself: import.meta.env is a Vite-injected
// global, absent when this module is loaded directly under plain Node (e.g.
// `npx tsx` running authContext.test.ts) rather than bundled through Vite.
// `PROD` is Vite's own always-present build-mode boolean (true for `vite
// build`, false for `vite dev`/plain Node) -- Boolean(...) rather than a
// strict `=== true` comparison since this file's ambient ImportMeta.env
// type (below) types every key as `string | undefined` for the VITE_*
// custom vars, and Boolean() coerces either representation correctly
// without widening that shared type just for this one field.
const AUTH_MODE: AuthMode = resolveAuthMode(import.meta.env?.VITE_AUTH_MODE, Boolean(import.meta.env?.PROD))

function toAuthUser(supabaseUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): AuthUser | null {
  if (!supabaseUser) return null
  const meta = supabaseUser.user_metadata ?? {}
  const fromMetadata = [meta.full_name, meta.name, meta.display_name]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find((v) => v.length > 0)
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? undefined,
    displayName: fromMetadata || undefined,
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(
    AUTH_MODE === 'http' ? HTTP_MODE_CONFIG_ERROR
    : AUTH_MODE === 'supabase' && !supabase ? SUPABASE_MODE_CONFIG_ERROR
    : null,
  )

  // Restore an existing session on mount. 'local' reads its own localStorage
  // flag. 'supabase' subscribes to Supabase's own onAuthStateChange, which
  // (per the Supabase v2 client contract) fires once immediately with
  // whatever session it already has restored from ITS OWN localStorage
  // storage, then again on every real sign-in/sign-out/token-refresh -- this
  // one subscription is the entire session-resolving + persistence +
  // reactive-update mechanism, matching this repo's own pre-decouple
  // AppContext.tsx precedent. 'http' never auto-restores -- there is nothing
  // to restore until the real API exists.
  useEffect(() => {
    if (AUTH_MODE === 'local') {
      try {
        if (localStorage.getItem(LOCAL_SESSION_KEY) === 'true') {
          setUser(LOCAL_DEV_USER)
        }
      } catch { /* noop */ }
      setIsLoading(false)
      return
    }
    if (AUTH_MODE === 'supabase') {
      if (!supabase) { setIsLoading(false); return }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(toAuthUser(session?.user))
        setIsLoading(false)
      })
      return () => subscription.unsubscribe()
    }
    setIsLoading(false)
  }, [])

  async function login(credentials?: AuthCredentials): Promise<void> {
    if (AUTH_MODE === 'http') {
      // Seam for POST /api/auth/login. No implementation yet -- surface the
      // configuration error rather than granting access.
      setConfigError(HTTP_MODE_CONFIG_ERROR)
      throw new Error(HTTP_MODE_CONFIG_ERROR)
    }
    if (AUTH_MODE === 'supabase') {
      if (!supabase) {
        setConfigError(SUPABASE_MODE_CONFIG_ERROR)
        throw new Error(SUPABASE_MODE_CONFIG_ERROR)
      }
      if (!credentials) throw new Error('Email and password are required.')
      // No manual setUser() here -- the onAuthStateChange subscription above
      // receives the resulting SIGNED_IN event and updates state from that
      // one real source of truth, never a second, potentially-divergent path.
      await signIn(credentials.email, credentials.password)
      return
    }
    try { localStorage.setItem(LOCAL_SESSION_KEY, 'true') } catch { /* noop */ }
    setUser(LOCAL_DEV_USER)
  }

  async function logout(): Promise<void> {
    if (AUTH_MODE === 'local') {
      try { localStorage.removeItem(LOCAL_SESSION_KEY) } catch { /* noop */ }
      setUser(null)
      return
    }
    if (AUTH_MODE === 'supabase') {
      // onAuthStateChange's SIGNED_OUT event clears `user`; no manual
      // setUser(null) needed (and calling it early would race the real event).
      await signOut()
      return
    }
    // Seam for POST /api/auth/logout in 'http' mode -- no-op today since
    // 'http' mode never successfully logs in yet.
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        mode: AUTH_MODE,
        configError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
