import { createContext, useContext, useEffect, useState } from 'react'

/**
 * AuthContext.tsx — provider-independent authentication (Frontend Step 3.5).
 *
 * Replaces direct `supabase.auth.*` coupling throughout the app. Nothing
 * outside this file should import `@supabase/supabase-js` for identity or
 * session purposes — src/lib/supabase.ts's client remains in use elsewhere
 * only for product-data queries (see useCompetitorSupabase.ts, lib/db/index.ts),
 * which is a separate, still-legitimate use of the same package pending the
 * Python API (see this step's checkpoint for exactly which calls those are).
 *
 * Two modes, chosen by VITE_AUTH_MODE (default 'local' -- there is no Python
 * auth API yet, so defaulting to 'http' would break every dev/preview build):
 *
 *   'local' -- explicit local-development session. No credentials, no
 *              password field, no fake sign-in form. `login()` grants an
 *              immediate session as a neutral "Local Developer" identity.
 *              Persists across reload (localStorage flag) so a dev isn't
 *              kicked back to /sign-in on every hot-reload.
 *
 *   'http'  -- the future seam for POST /api/auth/login, POST /api/auth/logout,
 *              GET /api/auth/me. Not implemented yet -- selecting it produces
 *              a clear configError instead of silently behaving like 'local'.
 *              Building the real implementation is a later phase's job; this
 *              mode exists now so route guards and pages never need to change
 *              shape when it lands.
 */

export interface AuthUser {
  id: string
  email?: string
  displayName?: string
}

export type AuthMode = 'local' | 'http'

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  mode: AuthMode
  /** Set only in 'http' mode today -- selecting it before the API exists is a configuration error, not a silent fallback. */
  configError: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
}

// No vite-env.d.ts exists anywhere in this repo (a pre-existing, repo-wide gap
// -- src/App.tsx's own import.meta.env.VITE_BYPASS_AUTH usage had the identical
// TS2339 before this file existed). Ambient-declared here rather than adding
// the missing repo-wide vite/client type reference, which is out of this
// phase's scope.
declare global {
  interface ImportMeta {
    env: Record<string, string | undefined>
  }
}

/** Pure -- exported for testing without needing to render React. Default 'local' for any value other than the literal string 'http'. */
export function resolveAuthMode(raw: string | undefined): AuthMode {
  return raw === 'http' ? 'http' : 'local'
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

// Optional chaining on `env` itself: import.meta.env is a Vite-injected
// global, absent when this module is loaded directly under plain Node (e.g.
// `npx tsx` running authContext.test.ts) rather than bundled through Vite.
const AUTH_MODE: AuthMode = resolveAuthMode(import.meta.env?.VITE_AUTH_MODE)

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(
    AUTH_MODE === 'http' ? HTTP_MODE_CONFIG_ERROR : null,
  )

  // Restore an existing local session on mount so a refresh doesn't sign the
  // developer out. 'http' mode never auto-restores -- GET /api/auth/me would
  // be the real check once that endpoint exists; until then there is nothing
  // to restore, and restoring silently would be exactly the fallback Step 6
  // forbids.
  useEffect(() => {
    if (AUTH_MODE === 'local') {
      try {
        if (localStorage.getItem(LOCAL_SESSION_KEY) === 'true') {
          setUser(LOCAL_DEV_USER)
        }
      } catch { /* noop */ }
    }
    setIsLoading(false)
  }, [])

  async function login(): Promise<void> {
    if (AUTH_MODE === 'http') {
      // Seam for POST /api/auth/login. No implementation yet -- surface the
      // configuration error rather than granting access.
      setConfigError(HTTP_MODE_CONFIG_ERROR)
      throw new Error(HTTP_MODE_CONFIG_ERROR)
    }
    try { localStorage.setItem(LOCAL_SESSION_KEY, 'true') } catch { /* noop */ }
    setUser(LOCAL_DEV_USER)
  }

  async function logout(): Promise<void> {
    if (AUTH_MODE === 'local') {
      try { localStorage.removeItem(LOCAL_SESSION_KEY) } catch { /* noop */ }
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
