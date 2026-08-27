import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validateResetPasswordForm } from '../lib/authFormValidation'
import { Eye, EyeOff } from 'lucide-react'

/**
 * ResetPassword.tsx — V1 final auth requirements checkpoint (2026-08-27).
 *
 * Public route (App.tsx) so an unauthenticated browser following the email
 * link can reach it -- Supabase's client detects the recovery token in the
 * URL and fires a PASSWORD_RECOVERY event (AuthContext.tsx), which is the
 * ONLY thing that makes `isPasswordRecovery` true here. Anyone who lands on
 * this route WITHOUT a real recovery session (direct navigation, an
 * expired/already-used link) sees an honest "invalid or expired" state --
 * never a working-looking password form that couldn't actually update
 * anything (checkpoint requirement: "Do not merely implement the 'send
 * email' half"). Never logs the recovery token -- Supabase's client
 * consumes it from the URL fragment itself; this component never reads or
 * prints it.
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
          autoComplete="new-password"
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

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { mode, configError, isPasswordRecovery, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateResetPasswordForm(password, confirmPassword)
    if (validationError) { setError(validationError); return }
    setError('')
    setLoading(true)
    try {
      await updatePassword(password)
      setSuccess(true)
    } catch (err: unknown) {
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

          {mode === 'supabase' && configError && (
            <p style={{
              margin: 0, fontSize: '13px', color: '#c0392b', lineHeight: 1.5,
              padding: '12px 14px', background: 'rgba(192,57,43,0.06)', borderRadius: '8px', textAlign: 'left',
            }}>
              {configError}
            </p>
          )}

          {mode === 'supabase' && !configError && success && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>
                Password updated
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                Your password has been changed.
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  width: '100%', padding: '12px', background: '#0A2472', color: '#ffffff',
                  border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Continue to Ariya
              </button>
            </>
          )}

          {mode === 'supabase' && !configError && !success && !isPasswordRecovery && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>
                This link is invalid or has expired
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                Request a new password-reset link and follow it from this device.
              </p>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: '#0A2472', fontWeight: 600, textDecoration: 'none' }}>
                Request a new link
              </Link>
            </>
          )}

          {mode === 'supabase' && !configError && !success && isPasswordRecovery && (
            <>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5, textAlign: 'left' }}>
                Choose a new password
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <PasswordField
                  label="New password"
                  value={password}
                  onChange={setPassword}
                  placeholder="New password"
                  disabled={loading}
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm new password"
                  disabled={loading}
                />

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
                  disabled={loading || !password || !confirmPassword}
                  style={{
                    padding: '12px',
                    background: (loading || !password || !confirmPassword) ? '#6b80b8' : '#0A2472',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: (loading || !password || !confirmPassword) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
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
