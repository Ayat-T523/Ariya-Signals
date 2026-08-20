import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { analytics } from '../../lib/analytics'
import { DEMO } from '../../config/demo-config'
import { useAccountIdentity } from '../../context/AppContext'

type Stage = 'closed' | 'open' | 'submitting' | 'success'

const RATINGS = [
  { emoji: '😕', label: 'Not great', value: '😕' },
  { emoji: '😐', label: "It's okay", value: '😐' },
  { emoji: '🤩', label: 'Love it',   value: '🤩' },
]

export default function FeedbackWidget() {
  const [stage, setStage]     = useState<Stage>('closed')
  const [rating, setRating]   = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const location  = useLocation()
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Real signed-in identity, not the shared demo persona — see demo-config.ts.
  const { email: accountEmail } = useAccountIdentity()

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function open() {
    setStage('open')
    setRating(null)
    setComment('')
    analytics.feedback_opened()
  }

  function close() {
    setStage('closed')
    setRating(null)
    setComment('')
  }

  async function submit() {
    if (!rating || stage === 'submitting') return
    setStage('submitting')

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
          userEmail: accountEmail ?? DEMO.personaEmail,
          organisation: DEMO.companyLabel,
          route: location.pathname,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch {
      // network failure — still show success to user
    }

    analytics.feedback_submitted(rating)
    setStage('success')
    timerRef.current = setTimeout(close, 2500)
  }

  const isOpen = stage !== 'closed'

  return (
    <>
      {/* ── Popover ─────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Feedback"
          style={{
            position: 'fixed',
            bottom: 68,
            right: 24,
            width: 300,
            background: 'var(--bg-1)',
            border: '1px solid var(--blue-light)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-overlay)',
            padding: 20,
            zIndex: 300,
            fontFamily: 'var(--font-family)',
          }}
        >
          {stage === 'success' ? (
            <p style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--dark-blue)',
              textAlign: 'center',
              padding: '10px 0',
              lineHeight: 1.5,
            }}>
              ✓ Thanks — this goes straight to the team building Ariya.
            </p>
          ) : (
            <>
              {/* Close */}
              <button
                onClick={close}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'none', border: 'none',
                  color: 'var(--font-secondary)', cursor: 'pointer',
                  fontSize: 18, lineHeight: 1, padding: 4,
                }}
              >
                ×
              </button>

              {/* Heading */}
              <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--dark-blue)' }}>
                How is your experience so far?
              </p>

              {/* Emoji row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {RATINGS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setRating(r.value)}
                    style={{
                      flex: 1,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 4px',
                      background: rating === r.value ? 'rgba(42,118,244,0.08)' : 'transparent',
                      border: `1.5px solid ${rating === r.value ? 'var(--blue-primary, #2A76F4)' : 'var(--blue-light)'}`,
                      borderRadius: 'var(--radius-xs)',
                      cursor: 'pointer',
                      transition: 'border-color 150ms ease, background 150ms ease',
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{r.emoji}</span>
                    <span style={{ fontSize: 11, color: 'var(--font-secondary)', fontFamily: 'var(--font-family)', lineHeight: 1 }}>
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Optional comment */}
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Tell us more (optional)"
                maxLength={500}
                rows={3}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box' as const,
                  resize: 'none',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'var(--font-family)',
                  color: 'var(--font-primary)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--blue-light)',
                  borderRadius: 'var(--radius-xs)',
                  outline: 'none',
                  marginBottom: 12,
                }}
              />

              {/* Submit */}
              <button
                onClick={submit}
                disabled={!rating || stage === 'submitting'}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 0',
                  background: rating ? 'var(--dark-blue)' : 'var(--blue-light)',
                  color: rating ? '#fff' : 'var(--font-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                  cursor: rating ? 'pointer' : 'default',
                  transition: 'background 150ms ease',
                  opacity: stage === 'submitting' ? 0.7 : 1,
                }}
              >
                {stage === 'submitting' ? 'Sending…' : 'Submit'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Pill button ──────────────────────────────────────────────────────── */}
      <button
        onClick={isOpen ? close : open}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 300,
          background: 'var(--dark-blue)',
          color: '#fff',
          border: 'none',
          borderRadius: 9999,
          padding: '9px 18px',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'var(--font-family)',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
          lineHeight: 1,
        }}
      >
        {isOpen ? '✕ Close' : 'Feedback'}
      </button>
    </>
  )
}
