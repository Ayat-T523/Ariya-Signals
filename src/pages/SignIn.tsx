import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * SignIn.tsx — Frontend Step 3.5.
 *
 * No email/password form: there is no user database behind this app yet
 * (Supabase auth removed, the Python auth API doesn't exist). In local mode
 * this is an explicit, clearly-labelled development entry point, not a
 * pretend sign-in. In http mode (VITE_AUTH_MODE=http, selected before the
 * real API exists) it shows the configuration error instead of a form that
 * could never actually authenticate anyone.
 */
export default function SignInPage() {
  const navigate = useNavigate()
  const { mode, configError, login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

          {mode === 'http' ? (
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
          ) : (
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
