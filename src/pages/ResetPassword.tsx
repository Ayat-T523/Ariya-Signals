import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

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
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')
  const [loading, setLoading]   = useState(false)

  // null = still checking; true = valid recovery session; false = no/expired link
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    if (!supabase) { setHasSession(false); return }

    // A recovery link establishes a session via detectSessionInUrl. It may land
    // slightly after mount, so listen for it as well as checking the current one.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(prev => (prev === null ? !!data.session : prev))
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: upErr } = await supabase!.auth.updateUser({ password })
      if (upErr) throw upErr
      setMessage('Password updated. Signing you in…')
      setTimeout(() => navigate('/'), 900)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update your password. Please try again.'
      setError(msg)
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
            Set a new password
          </h1>

          {hasSession === false ? (
            /* ── Invalid / expired link ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{
                margin: 0, fontSize: '13px', color: '#c0392b', textAlign: 'center',
                padding: '10px 12px', background: 'rgba(192,57,43,0.06)', borderRadius: '6px', lineHeight: 1.5,
              }}>
                This password reset link is invalid or has expired. Please request a new one from the sign-in page.
              </p>
              <button
                type="button"
                onClick={() => navigate('/sign-in')}
                style={{
                  padding: '12px', background: '#0A2472', color: '#ffffff', border: 'none',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            /* ── New-password form (also shown while checking session) ── */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <PasswordField
                label="New password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                disabled={loading || hasSession === null}
              />
              <PasswordField
                label="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Re-enter your password"
                disabled={loading || hasSession === null}
              />

              {error && (
                <p style={{
                  margin: 0, fontSize: '12px', color: '#c0392b', textAlign: 'center',
                  padding: '8px 10px', background: 'rgba(192,57,43,0.06)', borderRadius: '6px',
                }}>
                  {error}
                </p>
              )}

              {message && (
                <p style={{
                  margin: 0, fontSize: '12px', color: '#065f46', textAlign: 'center',
                  padding: '8px 10px', background: 'rgba(6,95,70,0.06)', borderRadius: '6px',
                }}>
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || hasSession === null || !password || !confirm}
                style={{
                  padding: '12px',
                  background: (loading || hasSession === null || !password || !confirm) ? '#6b80b8' : '#0A2472',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: (loading || hasSession === null || !password || !confirm) ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
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
