import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validateSignUpForm } from '../lib/authFormValidation'
import { Eye, EyeOff } from 'lucide-react'

/**
 * SignUp.tsx — V1 final auth requirements checkpoint (2026-08-27).
 *
 * Minimal email/password/confirm-password signup, 'supabase' mode only
 * (checkpoint's own explicit scope: no OAuth). Reuses SignIn.tsx's exact
 * visual layout (branding panel + Field/PasswordField) rather than
 * inventing a new design. Two outcomes after a successful signUp() call:
 *
 *   - Supabase returns a session immediately (project has email
 *     confirmation disabled) -- AuthContext's onAuthStateChange picks up
 *     the new session from that one real source of truth, and this page
 *     navigates to `/`, where SetupGuard (App.tsx) sends a genuinely new
 *     user (onboardingComplete false, freshly user-scoped -- see
 *     AppContext.tsx's user-scoped persistence) to /setup, never straight
 *     into the workspace.
 *   - Supabase requires confirmation -- no session exists yet, so this page
 *     shows an honest "check your email" state instead of navigating
 *     anywhere. The new user only becomes authenticated (and only then
 *     enters setup) once they confirm and sign in for real.
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
  label, type, value, onChange, placeholder, disabled, autoComplete,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  autoComplete?: string
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
        autoComplete={autoComplete ?? 'email'}
        style={INPUT_STYLE}
        onFocus={e => { e.currentTarget.style.borderColor = '#0A2472' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
      />
    </div>
  )
}

function PasswordField({
  label, value, onChange, placeholder, disabled, autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  autoComplete?: string
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
          autoComplete={autoComplete ?? 'new-password'}
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <p style={{
      margin: 0, fontSize: '12px', color: '#c0392b', textAlign: 'center',
      padding: '8px 10px', background: 'rgba(192,57,43,0.06)', borderRadius: '6px',
    }}>
      {message}
    </p>
  )
}

export default function SignUpPage() {
  const navigate = useNavigate()
  const { mode, configError, signUp } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateSignUpForm(email, password, confirmPassword)
    if (validationError) { setError(validationError); return }
    setError('')
    setLoading(true)
    try {
      const result = await signUp({ email: email.trim(), password })
      if (result.needsEmailConfirmation) {
        setNeedsEmailConfirmation(true)
      } else {
        // A session was created immediately -- AuthContext's
        // onAuthStateChange has already picked it up from Supabase's own
        // event; SetupGuard sends this brand-new user to /setup.
        navigate('/')
      }
    } catch (err: unknown) {
      // Supabase's own error.message (e.g. "User already registered") is
      // passed through as-is -- same discipline SignIn.tsx's submit handler
      // already follows for signIn() errors.
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = mode !== 'supabase' || !!configError

  return (
    <div style={{
      display: 'flex',
      position: 'fixed',
      inset: 0,
      fontFamily: 'Satoshi, Inter, sans-serif',
      background: '#ffffff',
    }}>
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

          {mode !== 'supabase' && (
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
              Sign up is only available with Supabase auth configured.
            </p>
          )}

          {mode === 'supabase' && configError && (
            <>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                Configuration error
              </p>
              <p style={{
                margin: 0, fontSize: '13px', color: '#c0392b', lineHeight: 1.5,
                padding: '12px 14px', background: 'rgba(192,57,43,0.06)', borderRadius: '8px', textAlign: 'left',
              }}>
                {configError}
              </p>
            </>
          )}

          {mode === 'supabase' && !configError && needsEmailConfirmation && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>
                Check your email
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                We sent a confirmation link to <strong>{email.trim()}</strong>. Follow it to activate your account, then sign in.
              </p>
              <Link to="/sign-in" style={{ fontSize: '13px', color: '#0A2472', fontWeight: 600, textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </>
          )}

          {mode === 'supabase' && !configError && !needsEmailConfirmation && (
            <>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5, textAlign: 'left' }}>
                Create your Ariya account
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  disabled={loading || disabled}
                />
                <PasswordField
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Password"
                  disabled={loading || disabled}
                />
                <PasswordField
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm password"
                  disabled={loading || disabled}
                  autoComplete="new-password"
                />

                {error && <ErrorBanner message={error} />}

                <button
                  type="submit"
                  disabled={loading || disabled || !email || !password || !confirmPassword}
                  style={{
                    padding: '12px',
                    background: (loading || disabled || !email || !password || !confirmPassword) ? '#6b80b8' : '#0A2472',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: (loading || disabled || !email || !password || !confirmPassword) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Creating account…' : 'Sign up'}
                </button>
              </form>

              <p style={{ margin: '18px 0 0', fontSize: '13px', color: '#6b7280' }}>
                Already have an account?{' '}
                <Link to="/sign-in" style={{ color: '#0A2472', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </p>
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
