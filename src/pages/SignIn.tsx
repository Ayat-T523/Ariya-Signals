import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { signIn, signUp, signInWithGoogle, signInWithMicrosoft } from '../lib/auth'

type Mode = 'sign-in' | 'sign-up'

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
        autoComplete={type === 'password' ? 'current-password' : 'email'}
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
  )
}

export default function SignInPage() {
  const navigate = useNavigate()
  const [mode, setMode]         = useState<Mode>('sign-in')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')
  const [loading, setLoading]   = useState(false)

  // SSO buttons are only shown when Supabase is configured
  const showSSO = !!supabase

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'sign-in') {
        await signIn(email, password)
        navigate('/')
      } else {
        const result = await signUp(email, password)
        if (result.session) {
          navigate('/')
        } else {
          setMessage('Account created! Check your email to confirm your address, then sign in.')
          setMode('sign-in')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in unavailable.'
      setError(msg)
    }
  }

  async function handleMicrosoft() {
    setError('')
    try {
      await signInWithMicrosoft()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microsoft sign-in unavailable.'
      setError(msg)
    }
  }

  async function handleForgotPassword() {
    if (!supabase || !email.trim()) {
      alert('Enter your email address above, then click Forgot password.')
      return
    }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    })
    if (resetErr) {
      setError(resetErr.message)
    } else {
      setMessage('Password reset email sent. Check your inbox.')
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
        <div style={{ width: '100%', maxWidth: '300px' }}>

          <h1 style={{
            margin: '0 0 24px',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a1a2e',
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}>
            {mode === 'sign-in' ? 'Sign in to Ariya' : 'Create your account'}
          </h1>

          {/* ── SSO buttons (hidden when Supabase not configured) ── */}
          {showSSO && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '11px 14px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    background: '#fff',
                    color: '#1a1a2e',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    width: '100%',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={handleMicrosoft}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '11px 14px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    background: '#fff',
                    color: '#1a1a2e',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    width: '100%',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
                    <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
                    <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  Continue with Microsoft
                </button>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                margin: '0 0 16px',
              }}>
                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />
                <span style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>or</span>
                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />
              </div>
            </>
          )}

          {/* ── Email / password form ── */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              disabled={loading}
            />
            <Field
              label="Password"
              type="password"
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

            {message && (
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#065f46',
                textAlign: 'center',
                padding: '8px 10px',
                background: 'rgba(6,95,70,0.06)',
                borderRadius: '6px',
              }}>
                {message}
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
              {loading
                ? (mode === 'sign-in' ? 'Signing in…' : 'Creating account…')
                : (mode === 'sign-in' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          {/* ── Forgot password (sign-in mode only) ── */}
          {mode === 'sign-in' && (
            <p style={{ margin: '10px 0 0', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: '12px', color: '#2A76F4', fontFamily: 'inherit',
                }}
              >
                Forgot password?
              </button>
            </p>
          )}

          {/* ── Mode toggle ── */}
          <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
            {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: '13px', color: '#2A76F4', fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
            </button>
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
