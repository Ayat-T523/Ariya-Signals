import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { DEMO } from '../config/demo-config'

const ROLES = [
  { id: 'commercial', label: 'Commercial / Brand',               description: 'Brand positioning, share-of-voice, competitive launch dynamics' },
  { id: 'access',     label: 'Market Access',                    description: 'HTA decisions, payer dynamics, pricing and reimbursement' },
  { id: 'analytics',  label: 'Business Insights & Analytics',    description: 'Performance data, KPI tracking, market trends and forecasting' },
  { id: 'bd',         label: 'BD / Corporate Strategy',          description: 'Deal landscape, pipeline competition, partnership signals' },
  { id: 'executive',  label: 'Executive / Leadership',           description: 'Franchise-wide view, weekly digests, headline signals' },
]

const INDICATIONS = [
  { id: 'HAE',       label: 'Hereditary Angioedema (HAE)' },
  { id: 'Oncology',  label: 'Oncology' },
  { id: 'Immunology', label: 'Immunology' },
  { id: 'Neurology', label: 'Neurology' },
]

export default function OnboardingModal() {
  const {
    userRole, setUserRole,
    setUserIndication, setUserAssetName,
    completeOnboarding, closeOnboarding, startTour,
  } = useApp()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedRole, setSelectedRole] = useState(userRole || null)
  const [selectedIndication, setSelectedIndication] = useState<string | null>(null)
  const [assetNameInput, setAssetNameInput] = useState(DEMO.assetName)

  function resolvedIndication() {
    return selectedIndication || DEMO.therapeuticArea
  }

  function savePreferences() {
    if (selectedRole) setUserRole(selectedRole)
    setUserIndication(resolvedIndication())
    setUserAssetName(assetNameInput.trim() || DEMO.assetName)
  }

  function handleNext() {
    if (step === 1 && selectedRole) setStep(2)
    else if (step === 2) setStep(3)
  }

  function handleBack() {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  function handleStartTour() {
    savePreferences()
    startTour()
  }

  function handleSkip() {
    savePreferences()
    completeOnboarding([])
    closeOnboarding()
    navigate('/')
  }

  useEffect(() => { dialogRef.current?.focus() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedRole, selectedIndication, assetNameInput])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [])

  const stepTitles = [
    'Welcome to Ariya. What is your role?',
    'What therapeutic area are you tracking?',
    'What is your asset called?',
  ]
  const stepSubtitles = [
    'We\'ll tailor your War Room and summaries to match.',
    'Your War Room will filter signals to this area.',
    'Your product name will appear in signals and summaries.',
  ]

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(5,10,68,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        style={{
          background: '#FFFFFF', borderRadius: '20px',
          width: '100%', maxWidth: '560px',
          maxHeight: '90vh', overflowY: 'auto',
          padding: '40px',
          boxShadow: '0 24px 80px rgba(5,10,68,0.22)',
          outline: 'none',
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {([1, 2, 3] as const).map((s) => (
            <div key={s} style={{
              height: '3px', flex: 1, borderRadius: '2px',
              background: s <= step ? '#050A44' : 'rgba(5,10,68,0.12)',
              transition: 'background 200ms ease',
            }} />
          ))}
        </div>

        <h2
          id="onboarding-title"
          style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: 'rgba(5,10,68,0.92)', lineHeight: 1.25 }}
        >
          {stepTitles[step - 1]}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.55' }}>
          {stepSubtitles[step - 1]}
        </p>

        {/* ── Step 1: Role ── */}
        {step === 1 && (
          <div role="radiogroup" aria-labelledby="onboarding-title" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {ROLES.map((role) => {
              const isSelected = selectedRole === role.id
              return (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedRole(role.id)}
                  style={{
                    textAlign: 'left',
                    border: isSelected ? '2px solid #050A44' : '1.5px solid rgba(5,10,68,0.12)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    background: isSelected ? 'rgba(5,10,68,0.03)' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'border-color 150ms ease, background 150ms ease',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                >
                  <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
                    {role.label}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.65)' }}>
                    {role.description}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Step 2: Indication ── */}
        {step === 2 && (
          <div style={{ marginBottom: '24px' }}>
            <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {INDICATIONS.map((ind) => {
                const isSelected = selectedIndication === ind.id
                return (
                  <button
                    key={ind.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedIndication(ind.id)}
                    style={{
                      textAlign: 'left',
                      border: isSelected ? '2px solid #050A44' : '1.5px solid rgba(5,10,68,0.12)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      background: isSelected ? 'rgba(5,10,68,0.03)' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'border-color 150ms ease, background 150ms ease',
                      width: '100%',
                      fontFamily: 'inherit',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'rgba(5,10,68,0.92)' }}>
                      {ind.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Asset name ── */}
        {step === 3 && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.65)', marginBottom: '8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Asset / brand name
            </label>
            <input
              type="text"
              value={assetNameInput}
              onChange={(e) => setAssetNameInput(e.target.value)}
              placeholder={DEMO.assetName}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid rgba(5,10,68,0.20)', borderRadius: '10px',
                padding: '13px 14px', fontSize: '16px', fontFamily: 'inherit',
                outline: 'none', color: 'rgba(5,10,68,0.92)',
              }}
              autoFocus
            />
            <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.50)' }}>
              This will appear in your War Room and signal summaries.
            </p>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 && !selectedRole}
              style={{
                width: '100%',
                background: (step === 1 && !selectedRole) ? 'rgba(5,10,68,0.20)' : '#050A44',
                color: '#FFFFFF', border: 'none', borderRadius: '10px',
                padding: '14px', fontSize: '15px', fontWeight: 600,
                cursor: (step === 1 && !selectedRole) ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em', fontFamily: 'inherit',
                transition: 'background 150ms ease',
              }}
            >
              {step === 1
                ? (selectedRole ? 'Next →' : 'Select a role to continue')
                : 'Next →'}
            </button>
          ) : (
            <button
              onClick={handleStartTour}
              style={{
                width: '100%', background: '#050A44',
                color: '#FFFFFF', border: 'none', borderRadius: '10px',
                padding: '14px', fontSize: '15px', fontWeight: 600,
                cursor: 'pointer', letterSpacing: '-0.01em', fontFamily: 'inherit',
                transition: 'background 150ms ease',
              }}
            >
              Start tour →
            </button>
          )}

          {step > 1 && (
            <button
              onClick={handleBack}
              style={{
                width: '100%', background: 'none',
                border: '1.5px solid rgba(5,10,68,0.15)', borderRadius: '10px',
                padding: '13px', fontSize: '14px', fontWeight: 500,
                color: 'rgba(5,10,68,0.65)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ← Back
            </button>
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                fontSize: '13px', color: 'rgba(5,10,68,0.65)', fontFamily: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Skip and go straight to my War Room
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
