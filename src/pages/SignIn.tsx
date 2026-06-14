import { useState } from 'react'
import { useSignIn } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { DEMO } from '../config/demo-config'
import { useApp } from '../context/AppContext'

const DEMO_PASSWORD_HASH = import.meta.env.VITE_DEMO_PASSWORD_HASH?.trim()
const DEMO_IDENTIFIER    = import.meta.env.VITE_DEMO_EMAIL?.trim() || DEMO.personaEmail

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Shared inner form (layout only, no auth logic) ────────────────────────
function PasswordForm({
  password, onChange, onSubmit, error, loading,
}: {
  password: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  error: string
  loading: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      position: 'fixed',
      inset: 0,
      fontFamily: 'Satoshi, Inter, sans-serif',
      background: '#ffffff',
    }}>

      {/* ── Left branding panel ───────────────────────────────────────── */}
      <div style={{
        width: 'calc(75% - 100px)',
        background: 'linear-gradient(180deg, #4E9FD4 0%, #0A2472 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomRightRadius: '120px',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <img
          src="/ariya_logo.svg"
          alt="Ariya"
          style={{ width: '55%', maxWidth: '340px', objectFit: 'contain' }}
        />
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        minWidth: 0,
      }}>
        <div style={{ width: '100%', maxWidth: '280px' }}>

          <h1 style={{
            margin: '0 0 24px',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a1a2e',
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}>
            Login to Ariya
          </h1>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#1a1a2e' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => onChange(e.target.value)}
                placeholder="Password"
                disabled={loading}
                autoComplete="current-password"
                autoFocus
                style={{
                  padding: '11px 14px',
                  fontSize: '14px',
                  fontFamily: 'Satoshi, Inter, sans-serif',
                  border: '1.5px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  background: '#fff',
                  color: '#1a1a2e',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#0A2472' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
              />
            </div>

            {error && (
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#c0392b',
                textAlign: 'center',
                padding: '8px 10px',
                background: 'rgba(192,57,43,0.06)',
                borderRadius: '6px',
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                padding: '12px',
                background: loading ? '#6b80b8' : '#0A2472',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ margin: '12px 0 0', textAlign: 'center' }}>
            <a
              href="#"
              style={{ fontSize: '12px', color: '#2A76F4', textDecoration: 'none' }}
              onClick={e => {
                e.preventDefault()
                alert('To reset your password, contact ariya@phamax.ch')
              }}
            >
              Forgot Password?
            </a>
          </p>

          <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
            Want to view the demo?{' '}
            <a href={DEMO.requestAccessUrl} style={{ color: '#2A76F4', fontWeight: 600, textDecoration: 'none' }}>
              Contact us
            </a>
          </p>
        </div>

        <div style={{ position: 'absolute', bottom: '20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#9ca3af' }}>
            © 2026 phamax. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Shared-password sign-in (no Clerk) ────────────────────────────────────
// Used when VITE_DEMO_PASSWORD is set. One password for all clients.
function DemoPasswordSignIn() {
  const navigate = useNavigate()
  const { openOnboarding } = useApp()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const entered = await sha256hex(password)
    if (entered === DEMO_PASSWORD_HASH) {
      const firstLogin = !localStorage.getItem('ariya-demo-unlocked')
      localStorage.setItem('ariya-demo-unlocked', '1')
      if (firstLogin) {
        localStorage.removeItem('onboardingComplete')
        openOnboarding()
      }
      navigate('/')
    } else {
      setError('Incorrect password. Please try again.')
      setLoading(false)
    }
  }

  return <PasswordForm password={password} onChange={setPassword} onSubmit={handleSubmit} error={error} loading={loading} />
}

// ── Clerk-backed sign-in (per-user accounts) ──────────────────────────────
// Fallback when VITE_DEMO_PASSWORD is not set but Clerk is configured.
function ClerkSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setLoading(true)
    setError('')
    try {
      const result = await signIn.create({ identifier: DEMO_IDENTIFIER, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        navigate('/')
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] }
      setError(clerkErr.errors?.[0]?.message ?? 'Incorrect password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return <PasswordForm password={password} onChange={setPassword} onSubmit={handleSubmit} error={error} loading={loading} />
}

// ── Page export ───────────────────────────────────────────────────────────
// VITE_DEMO_PASSWORD set  → shared-password mode (no Clerk needed)
// Clerk configured only   → per-user Clerk auth
// Neither                 → pass-through (local dev without credentials)
export default function SignInPage() {
  if (DEMO_PASSWORD_HASH) return <DemoPasswordSignIn />
  return <ClerkSignIn />
}
