import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

/**
 * SignIn.tsx — Frontend Step 3.5; V1 Login/Auth Restoration checkpoint
 * (2026-08-27): restores the real email/password form for 'supabase' mode,
 * reusing this repo's own last known-good pre-decouple SignIn.tsx layout
 * (Field/PasswordField, branding panel) rather than inventing a new design.
 * Deliberately narrower than that prior version -- no sign-up toggle, no
 * forgot-password, no OAuth buttons (checkpoint's own explicit scope: "Do
 * not add... password-reset flows... or unrelated account features"; this
 * restores the minimum sign-in flow only).
 *
 * 'local' mode keeps its existing no-credentials "Enter workspace" entry
 * point; 'http' mode keeps its existing configuration-error display.
 */

const INPUT_STYLE: React.CSSProperties = {
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
}

function Field({
  label, type, value, onChange, placeholder, disabled,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: '#1a1a2e' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="email"
        style={INPUT_STYLE}
        onFocus={e => { e.currentTarget.style.borderColor = '#0A2472' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
      />
    </div>
  )
}

function PasswordField({
  label, value, onChange, placeholder, disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: '#1a1a2e' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="current-password"
          style={{ ...INPUT_STYLE, paddingRight: '40px' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#0A2472' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px', display: 'flex', alignItems: 'center',
            color: '#9ca3af',
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}

export default function SignInPage() {
  const navigate = useNavigate()
  const { mode, configError, login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleEnterWorkspace() {
    setLoading(true)
    setError('')
    try {
      await login()
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSupabaseSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ email, password })
      navigate('/')
    } catch (err: unknown) {
      // Supabase's own error.message (e.g. "Invalid login credentials") is
      // passed through as-is -- never rewritten into a fabricated "invalid
      // password" claim when the real failure could be something else
      // (network, project paused, etc.). See lib/auth.ts's signIn().
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

      {/* ── Right panel ──────────────────────────────────────────────── */}
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
        <div style={{ width: '100%', maxWidth: '300px', textAlign: 'center' }}>

          <h1 style={{
            margin: '0 0 8px',
            fontSize: '20px',
            fontWeight: 700,
            color: '#1a1a2e',
            letterSpacing: '-0.01em',
          }}>
            Ariya Signals
          </h1>

          {mode === 'http' && (
            <>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                Configuration error
              </p>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: '#c0392b',
                lineHeight: 1.5,
                padding: '12px 14px',
                background: 'rgba(192,57,43,0.06)',
                borderRadius: '8px',
                textAlign: 'left',
              }}>
                {configError}
              </p>
            </>
          )}

          {mode === 'supabase' && configError && (
            <>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                Configuration error
              </p>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: '#c0392b',
                lineHeight: 1.5,
                padding: '12px 14px',
                background: 'rgba(192,57,43,0.06)',
                borderRadius: '8px',
                textAlign: 'left',
              }}>
                {configError}
              </p>
            </>
          )}

          {mode === 'supabase' && !configError && (
            <>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5, textAlign: 'left' }}>
                Sign in to Ariya
              </p>
              <form onSubmit={handleSupabaseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  disabled={loading}
                />
                <PasswordField
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Password"
                  disabled={loading}
                />

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
                  disabled={loading || !email || !password}
                  style={{
                    padding: '12px',
                    background: (loading || !email || !password) ? '#6b80b8' : '#0A2472',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: (loading || !email || !password) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          {mode === 'local' && (
            <>
              <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                Local development environment
              </p>

              {error && (
                <p style={{
                  margin: '0 0 14px',
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
                type="button"
                onClick={handleEnterWorkspace}
                disabled={loading}
                style={{
                  width: '100%',
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
                {loading ? 'Entering…' : 'Enter workspace'}
              </button>
            </>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: '20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#9ca3af' }}>
            © 2026 Ariya Signals. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
