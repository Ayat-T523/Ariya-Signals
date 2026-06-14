/**
 * ErrorBoundary.tsx
 *
 * Class-based React error boundary. Catches runtime exceptions in the
 * component tree and renders a recovery UI instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <Suspense ...>
 *       <Routes> ... </Routes>
 *     </Suspense>
 *   </ErrorBoundary>
 */

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional slim fallback rendered inside the content area (route-level use). */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '12px',
            fontFamily: 'inherit',
          }}
        >
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--font-bold)' }}>
            Something went wrong.
          </p>
          {this.state.message && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--font-secondary)', maxWidth: '400px', textAlign: 'center' }}>
              {this.state.message}
            </p>
          )}
          <button
            onClick={this.handleReload}
            className="ariya-focus"
            style={{
              marginTop: '4px',
              padding: '8px 22px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--blue-primary)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// ── Slim in-page fallback rendered when a route-level boundary catches ────────
export function PageErrorFallback() {
  return (
    <div
      role="alert"
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px', gap: '10px',
        fontFamily: 'Satoshi, sans-serif',
      }}
    >
      <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'rgba(5,10,68,0.75)' }}>
        This page couldn't load.
      </p>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.45)', maxWidth: '340px', textAlign: 'center' }}>
        Use the navigation on the left to go to another page, or reload to try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="ariya-focus"
        style={{
          marginTop: '8px',
          padding: '7px 20px',
          borderRadius: '6px',
          background: '#2A76F4',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'inherit',
        }}
      >
        Reload
      </button>
    </div>
  )
}
