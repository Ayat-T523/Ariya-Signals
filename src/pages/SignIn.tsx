import { SignIn } from '@clerk/clerk-react'
import { DEMO, APP_VERSION } from '../config/demo-config'

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #050A44 0%, #0d1f5c 60%, #152d61 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Logo + app name */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <p style={{
          margin: '0 0 4px',
          fontSize: '22px',
          fontWeight: 700,
          fontFamily: 'Satoshi, sans-serif',
          color: '#FFFFFF',
          letterSpacing: '-0.01em',
        }}>
          {DEMO.appName}
        </p>
        <p style={{
          margin: 0,
          fontSize: '13px',
          fontFamily: 'Satoshi, sans-serif',
          color: 'rgba(255,255,255,0.50)',
        }}>
          {DEMO.appTagline}
        </p>
      </div>

      {/* Clerk sign-in widget */}
      <SignIn routing="path" path="/sign-in" />

      {/* Footer */}
      <p style={{
        marginTop: '28px',
        fontSize: '11px',
        fontFamily: 'Satoshi, sans-serif',
        color: 'rgba(255,255,255,0.25)',
        textAlign: 'center',
      }}>
        {DEMO.appName} demo · {APP_VERSION} · {DEMO.demoBadgeLabel}
      </p>
    </div>
  )
}
