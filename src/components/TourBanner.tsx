import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useConfig } from '../context/AppContext'

interface TourStep {
  route: string
  text: string
}

// 180 WPM for comprehension + 3 s screen time, min 6 s
function computeDuration(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(6000, Math.round((words / 180) * 60_000 + 3000))
}

function buildSteps(assetName: string, indication: string): TourStep[] {
  return [
    {
      route: '/',
      text: `This is the page that shows the signals that moved the needle this week. Your ${assetName} momentum status, and your weekly digest — all tailored to your role.`,
    },
    {
      route: '/competitors',
      text: 'All 8 tracked competitors in one view. Each card shows their strategic posture, latest signal, and pipeline activity. Click any card to go deeper.',
    },
    {
      route: '/competitors/pharvaris',
      text: 'This is the full profile for Pharvaris — your highest-priority monitoring target. Pipeline, company watch, and messaging drift are all here. The timeline feeds your per-asset lag-expected milestones for each asset.',
    },
    {
      route: '/intelligence',
      text: `Every regulatory, clinical, and commercial signal across the ${indication} landscape, grouped by theme so you can go straight to what you're tracking. Switch to Leadership priority to see only the events that require your attention.`,
    },
    {
      route: '/alerts',
      text: 'The full signal feed. Filter by competitor, signal type, or severity. Every alert shows why it matters and how confident Ariya is in the underlying data.',
    },
    {
      route: '/myspace',
      text: 'Configure how and when Ariya reaches you — channel, cadence, and format. You can also upload personal documents that only you can see.',
    },
  ]
}

export default function TourBanner() {
  const { tourActive, endTour } = useApp()
  const { assetName, indication } = useConfig()
  const STEPS = useMemo(() => buildSteps(assetName, indication), [assetName, indication])
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepRef = useRef(step)
  stepRef.current = step

  const duration = useMemo(() => computeDuration(STEPS[step].text), [step])
  const progress = Math.min(100, (elapsed / duration) * 100)

  function clearTimer() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Navigate on step change
  useEffect(() => {
    if (!tourActive) { setStep(0); return }
    navigate(STEPS[step].route)
  }, [step, tourActive, navigate])

  // ESC closes the tour (WCAG 2.1.2)
  useEffect(() => {
    if (!tourActive) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null }
        endTour(false, stepRef.current)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [tourActive, endTour])

  // Countdown timer — auto-advances when elapsed reaches duration
  useEffect(() => {
    if (!tourActive) return
    setElapsed(0)
    clearTimer()
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const e = Date.now() - start
      if (e >= duration) {
        clearTimer()
        if (step === STEPS.length - 1) { endTour(true, step) }
        else { setStep(s => s + 1) }
      } else {
        setElapsed(e)
      }
    }, 50)
    return clearTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tourActive, duration])

  if (!tourActive) return null

  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1

  function handleNext() {
    clearTimer()
    if (isLast) { endTour(true, step) } else { setStep(s => s + 1) }
  }
  function handleBack() {
    if (!isFirst) { clearTimer(); setStep(s => s - 1) }
  }
  function handleSkip() {
    clearTimer()
    endTour(false, step)
  }

  return (
    <div
      data-tour-banner
      role="complementary"
      aria-label={`Guided tour step ${step + 1} of ${STEPS.length}`}
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 9999,
        background: '#0d3d2f',
        fontFamily: 'Satoshi, sans-serif',
      }}
    >
      {/* Reading-time progress bar */}
      <div style={{ height: '3px', background: 'rgba(78,205,164,0.20)' }}>
        {/* Scaled rather than width-animated: elapsed ticks on an interval, so
            this repaints ~20x a second and animating width would relayout on
            every tick. scaleX from the left edge is visually identical and runs
            on the compositor. */}
        <div style={{
          height: '100%',
          width: '100%',
          transformOrigin: 'left center',
          transform: `scaleX(${progress / 100})`,
          background: '#4ecda4',
          transition: 'transform 50ms linear',
        }} />
      </div>

      {/* Banner row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 32px', height: '72px', gap: '24px',
      }}>
        <span style={{
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          color: '#4ecda4', flexShrink: 0, minWidth: '84px',
        }}>
          Step {step + 1} of {STEPS.length}
        </span>

        <p style={{ flex: 1, margin: 0, fontSize: '14px', color: '#FFFFFF', lineHeight: '1.5' }}>
          {STEPS[step].text}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button
            onClick={handleSkip}
            aria-label="Skip tour"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: 'rgba(255,255,255,0.80)',
              fontFamily: 'Satoshi, sans-serif', padding: 0,
            }}
          >
            Skip tour
          </button>
          {!isFirst && (
            <button
              onClick={handleBack}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '9999px', padding: '6px 16px',
                fontSize: '13px', fontWeight: 500,
                color: '#FFFFFF', fontFamily: 'Satoshi, sans-serif', cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              background: '#FFFFFF', border: 'none',
              borderRadius: '9999px', padding: '6px 20px',
              fontSize: '13px', fontWeight: 600,
              color: '#0d3d2f', fontFamily: 'Satoshi, sans-serif', cursor: 'pointer',
            }}
          >
            {isLast ? 'Finish tour →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
