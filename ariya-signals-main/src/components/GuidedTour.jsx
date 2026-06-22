import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

// Step explanation text — paired with TOUR_ROUTES in AppContext
const TOUR_STEP_TEXT = [
  "This is your home page. It shows the signals that moved the needle this week, your Ekterly momentum status, and your weekly digest — all tailored to your role.",
  "All 8 tracked competitors in one view. Each card shows their strategic posture, latest signal, and pipeline activity. Click any card to go deeper.",
  "This is the full profile for Pharvaris — your highest-priority monitoring target. Pipeline, company watch, and messaging drift are all here. The timeline fields let your team log expected milestones for each asset.",
  "A rolling calendar of regulatory, clinical, and commercial events across the HAE landscape. Switch to Leadership priority to see only the events that require your attention.",
  "Post-earnings digests for each tracked competitor, available within 24 hours of a call. Filter by competitor or digest type.",
  "HAE deal activity and HTA decisions in one place. Use the Deals and HTA filters to focus on what matters for your role.",
  "The full signal feed. Filter by competitor, signal type, or severity. Every alert shows why it matters and how confident Ariya is in the underlying data.",
  "Configure how and when Ariya reaches you — channel, cadence, and format. You can also upload personal documents that only you can see.",
]

export const TOUR_TOTAL_STEPS = TOUR_STEP_TEXT.length
const AUTO_ADVANCE_MS = 8000

export default function GuidedTour() {
  const { tourActive, currentTourStep, nextTourStep, prevTourStep, endTour } = useApp()
  const [paused, setPaused] = useState(false)

  // Auto-advance through steps (paused on hover, stops on last step)
  useEffect(() => {
    if (!tourActive) return
    const isLast = currentTourStep === TOUR_TOTAL_STEPS - 1
    if (isLast) return // wait for user to click Finish
    if (paused) return

    const timer = setTimeout(() => {
      nextTourStep()
    }, AUTO_ADVANCE_MS)

    return () => clearTimeout(timer)
  }, [tourActive, currentTourStep, paused, nextTourStep])

  // Reset paused state when tour ends / restarts
  useEffect(() => {
    if (!tourActive) setPaused(false)
  }, [tourActive])

  if (!tourActive) return null

  const isFirst = currentTourStep === 0
  const isLast  = currentTourStep === TOUR_TOTAL_STEPS - 1
  const text    = TOUR_STEP_TEXT[currentTourStep] ?? ''

  return (
    <>
      <style>{`
        @keyframes ariya-tour-progress {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>

      <div
        role="region"
        aria-label="Guided tour"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150,
          background: '#0F766E',
          color: '#FFFFFF',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 -10px 28px rgba(5,10,68,0.28)',
        }}
      >
        {/* Per-step progress bar (visual countdown to auto-advance) */}
        {!isLast && (
          <div
            key={`${currentTourStep}-${paused ? 'p' : 'r'}`}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0, left: 0,
              height: '2px',
              width: '100%',
              transformOrigin: 'left center',
              background: 'rgba(255,255,255,0.65)',
              animation: paused
                ? 'none'
                : `ariya-tour-progress ${AUTO_ADVANCE_MS}ms linear forwards`,
            }}
          />
        )}

        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '22px 32px',
          display: 'flex', alignItems: 'center', gap: '24px',
          minHeight: '108px',
          boxSizing: 'border-box',
        }}>
          {/* Step indicator */}
          <span style={{
            fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.10em',
            color: 'rgba(255,255,255,0.70)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            Step {currentTourStep + 1} of {TOUR_TOTAL_STEPS}
          </span>

          {/* Explanation text */}
          <p style={{
            margin: 0, flex: 1, minWidth: 0,
            fontSize: '14px', lineHeight: '1.55',
            color: '#FFFFFF',
          }}>
            {text}
          </p>

          {/* Skip tour link */}
          <button
            onClick={endTour}
            style={{
              background: 'none', border: 'none', padding: '4px 8px',
              color: 'rgba(255,255,255,0.65)',
              fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', textDecoration: 'underline',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Skip tour
          </button>

          {/* Back */}
          {!isFirst && (
            <button
              onClick={prevTourStep}
              style={{
                padding: '7px 16px', borderRadius: '9999px',
                background: 'transparent',
                color: '#FFFFFF',
                border: '1.5px solid rgba(255,255,255,0.40)',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit', flexShrink: 0,
                transition: 'background 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.65)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
            >
              Back
            </button>
          )}

          {/* Next / Finish */}
          <button
            onClick={nextTourStep}
            style={{
              padding: '7px 18px', borderRadius: '9999px',
              background: '#FFFFFF',
              color: '#0F766E',
              border: 'none',
              fontSize: '13px', fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
              transition: 'transform 120ms ease, box-shadow 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = ''
            }}
          >
            {isLast ? 'Finish tour →' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  )
}
