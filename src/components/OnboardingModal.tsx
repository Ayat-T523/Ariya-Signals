import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ASSETS_CONFIG, getAssetById } from '../config/assets-config'
import { competitorsData } from '../data/kalvista'

const ROLES = [
  { id: 'commercial', label: 'Commercial / Brand',               description: 'Brand positioning, share-of-voice, competitive launch dynamics' },
  { id: 'access',     label: 'Market Access',                    description: 'HTA decisions, payer dynamics, pricing and reimbursement' },
  { id: 'analytics',  label: 'Business Insights & Analytics',    description: 'Performance data, KPI tracking, market trends and forecasting' },
  { id: 'bd',         label: 'BD / Corporate Strategy',          description: 'Deal landscape, pipeline competition, partnership signals' },
  { id: 'executive',  label: 'Executive / Leadership',           description: 'Franchise-wide view, weekly digests, headline signals' },
]

// Acquired assets have no live signals; exclude from the watchlist selector.
const selectableCompetitors = (competitorsData as Array<{ id: string; name: string; status?: string }>)
  .filter(c => c.status !== 'acquired')

export default function OnboardingModal() {
  const {
    userRole, setUserRole,
    setUserIndication, setUserAssetName, setUserAssetId,
    resetWatchedCompetitors,
    completeOnboarding, closeOnboarding, startTour,
  } = useApp()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedRole, setSelectedRole] = useState(userRole || null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [assetSearch, setAssetSearch] = useState('')
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>([])

  const filteredAssets = ASSETS_CONFIG.filter(a =>
    assetSearch === '' ||
    a.brandName.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.innName.toLowerCase().includes(assetSearch.toLowerCase())
  )

  const selectedAsset = selectedAssetId ? getAssetById(selectedAssetId) : undefined

  function savePreferences() {
    if (selectedRole) setUserRole(selectedRole)

    if (selectedAsset) {
      setUserIndication(selectedAsset.indication)
      setUserAssetName(selectedAsset.brandName)
      setUserAssetId(selectedAsset.id)
      // If the user completed Step 3 use their explicit selection; otherwise
      // fall back to the asset's suggested defaults so the War Room is never empty.
      const toWrite = selectedCompetitorIds.length > 0
        ? selectedCompetitorIds
        : selectedAsset.suggestedCompetitors
      resetWatchedCompetitors(toWrite)
    }
  }

  function handleNext() {
    if (step === 1 && selectedRole) {
      setStep(2)
    } else if (step === 2 && selectedAssetId) {
      // Pre-populate competitor chips from the chosen asset's suggestions.
      setSelectedCompetitorIds(selectedAsset?.suggestedCompetitors ?? ['takeda', 'biocryst', 'pharvaris'])
      setStep(3)
    }
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

  function toggleCompetitor(id: string) {
    setSelectedCompetitorIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  useEffect(() => { dialogRef.current?.focus() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedRole, selectedAssetId, selectedCompetitorIds])

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
    'Which asset are you tracking?',
    'Confirm your competitor watchlist.',
  ]
  const stepSubtitles = [
    "We'll tailor your War Room and summaries to match.",
    "We'll pre-configure your signals feed and relevance filter.",
    'These are pre-selected based on your asset. Deselect or add others — you can change this any time.',
  ]

  const nextDisabled =
    (step === 1 && !selectedRole) ||
    (step === 2 && !selectedAssetId)

  const nextLabel =
    step === 1 && !selectedRole ? 'Select a role to continue' :
    step === 2 && !selectedAssetId ? 'Select an asset to continue' :
    'Next →'

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

        {/* ── Step 1: Role (unchanged) ── */}
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

        {/* ── Step 2: Asset selection ── */}
        {step === 2 && (
          <div style={{ marginBottom: '24px' }}>
            <input
              type="search"
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              placeholder="Search by brand name or INN…"
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid rgba(5,10,68,0.20)', borderRadius: '10px',
                padding: '11px 14px', fontSize: '14px', fontFamily: 'inherit',
                outline: 'none', color: 'rgba(5,10,68,0.92)',
                marginBottom: '12px',
              }}
              autoFocus
            />
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontFamily: 'inherit' }}>
              {assetSearch === ''
                ? `${filteredAssets.length} product${filteredAssets.length !== 1 ? 's' : ''} available`
                : filteredAssets.length === 0
                  ? 'No products match your search'
                  : `${filteredAssets.length} of ${ASSETS_CONFIG.length} match`}
            </p>
            <div role="radiogroup" aria-label="Asset" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredAssets.length === 0 && (
                <p style={{ fontSize: '14px', color: 'rgba(5,10,68,0.45)', textAlign: 'center', padding: '20px 0', margin: 0 }}>
                  No assets match your search.
                </p>
              )}
              {filteredAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id
                return (
                  <button
                    key={asset.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedAssetId(asset.id)}
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
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
                        {asset.brandName}
                      </p>
                      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.50)', fontStyle: 'italic' }}>
                        {asset.innName}
                      </p>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.55)' }}>
                      {asset.indicationFull}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Indication confirmation — collapses the old TA step */}
            {selectedAsset && (
              <div style={{
                marginTop: '14px',
                padding: '10px 14px',
                background: 'rgba(5,10,68,0.04)',
                borderRadius: '8px',
                border: '1px solid rgba(5,10,68,0.08)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.50)' }}>Indication</span>
                <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.80)', fontWeight: 600 }}>
                  {selectedAsset.indicationFull}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Competitor confirmation ── */}
        {step === 3 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectableCompetitors.map((competitor) => {
                const isSelected = selectedCompetitorIds.includes(competitor.id)
                return (
                  <button
                    key={competitor.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleCompetitor(competitor.id)}
                    style={{
                      border: isSelected ? '2px solid #050A44' : '1.5px solid rgba(5,10,68,0.15)',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      background: isSelected ? '#050A44' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : 'rgba(5,10,68,0.70)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: isSelected ? 600 : 400,
                      fontFamily: 'inherit',
                      transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {competitor.name}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.50)', minHeight: '18px' }}>
              {selectedCompetitorIds.length === 0
                ? 'Select at least one competitor to populate your War Room.'
                : `${selectedCompetitorIds.length} competitor${selectedCompetitorIds.length !== 1 ? 's' : ''} selected — you can adjust these any time.`}
            </p>
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={nextDisabled}
              style={{
                width: '100%',
                background: nextDisabled ? 'rgba(5,10,68,0.20)' : '#050A44',
                color: '#FFFFFF', border: 'none', borderRadius: '10px',
                padding: '14px', fontSize: '15px', fontWeight: 600,
                cursor: nextDisabled ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em', fontFamily: 'inherit',
                transition: 'background 150ms ease',
              }}
            >
              {nextLabel}
            </button>
          ) : (
            <button
              onClick={handleStartTour}
              disabled={selectedCompetitorIds.length === 0}
              style={{
                width: '100%',
                background: selectedCompetitorIds.length === 0 ? 'rgba(5,10,68,0.20)' : '#050A44',
                color: '#FFFFFF', border: 'none', borderRadius: '10px',
                padding: '14px', fontSize: '15px', fontWeight: 600,
                cursor: selectedCompetitorIds.length === 0 ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em', fontFamily: 'inherit',
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
