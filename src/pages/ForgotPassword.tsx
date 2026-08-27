import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ForgotPassword.tsx — V1 final auth requirements checkpoint (2026-08-27).
 *
 * Email -> Supabase resetPasswordForEmail() -> one neutral success state,
 * regardless of whether the email actually belongs to an account
 * (checkpoint requirement: "Do not reveal whether a particular account
 * exists unnecessarily" -- Supabase's own resetPasswordForEmail() is
 * neutral by design, and this page never branches on the result to say
 * otherwise). Reuses SignIn.tsx's visual layout.
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

export default function ForgotPasswordPage() {
  const { mode, configError, requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required.'); return }
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSubmitted(true)
    } catch (err: unknown) {
      // Only a real configuration/network failure reaches here -- Supabase's
      // resetPasswordForEmail() itself does not error just because the
      // email doesn't exist, so this never leaks account existence either.
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
              Password reset is only available with Supabase auth configured.
            </p>
          )}

          {mode === 'supabase' && configError && (
            <p style={{
              margin: 0, fontSize: '13px', color: '#c0392b', lineHeight: 1.5,
              padding: '12px 14px', background: 'rgba(192,57,43,0.06)', borderRadius: '8px', textAlign: 'left',
            }}>
              {configError}
            </p>
          )}

          {mode === 'supabase' && !configError && submitted && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>
                Check your email
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                If an account exists for that address, we've sent a link to reset the password.
              </p>
              <Link to="/sign-in" style={{ fontSize: '13px', color: '#0A2472', fontWeight: 600, textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </>
          )}

          {mode === 'supabase' && !configError && !submitted && (
            <>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5, textAlign: 'left' }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#1a1a2e' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={loading}
                    autoComplete="email"
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = '#0A2472' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
                  />
                </div>

                {error && (
                  <p style={{
                    margin: 0, fontSize: '12px', color: '#c0392b', textAlign: 'center',
                    padding: '8px 10px', background: 'rgba(192,57,43,0.06)', borderRadius: '6px',
                  }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  style={{
                    padding: '12px',
                    background: (loading || !email) ? '#6b80b8' : '#0A2472',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: (loading || !email) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p style={{ margin: '18px 0 0', fontSize: '13px', color: '#6b7280' }}>
                <Link to="/sign-in" style={{ color: '#0A2472', fontWeight: 600, textDecoration: 'none' }}>
                  Back to sign in
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
