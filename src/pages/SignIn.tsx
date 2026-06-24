import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { signIn, signUp } from '../lib/auth'
import { Eye, EyeOff } from 'lucide-react'

type Mode = 'sign-in' | 'sign-up'

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
          autoComplete={autoComplete ?? 'current-password'}
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
  const [mode, setMode]         = useState<Mode>('sign-in')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')
  const [loading, setLoading]   = useState(false)

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
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Password"
              disabled={loading}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
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
