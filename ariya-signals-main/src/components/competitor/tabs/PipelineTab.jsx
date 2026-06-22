import { useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import AIButton from '../../ui/AIButton'
import EmptyState from '../../ui/EmptyState'

// ── Phase definitions ─────────────────────────────────────────────────────────
const PHASES = [
  { key: 'Preclinical', label: 'Preclinical', prominent: false, flex: 1 },
  { key: 'Phase I',     label: 'Phase I',     prominent: false, flex: 1.1 },
  { key: 'Phase II',    label: 'Phase II',    prominent: false, flex: 1.2 },
  { key: 'Phase III',   label: 'Phase III',   prominent: true,  flex: 1.4 },
  { key: 'Filed',       label: 'Filed',       prominent: true,  flex: 1.2 },
  { key: 'Approved',    label: 'Approved',    prominent: false, flex: 1 },
]

function getPhaseIndex(phaseStr) {
  const p = (phaseStr || '').toLowerCase()
  if (p.includes('approved'))   return 5
  if (p.includes('filed'))      return 4
  if (p.includes('iii'))        return 3
  if (p.includes('ii'))         return 2
  if (p.includes('phase i') || p === 'phase i') return 1
  return 0
}

function indicationColor(subtype) {
  const s = (subtype || '').toLowerCase()
  if (s.includes('on-demand'))   return { bg: 'rgba(0,85,187,0.10)',  text: '#0055BB' }
  if (s.includes('prophylaxis')) return { bg: 'rgba(5,10,68,0.07)',   text: 'rgba(5,10,68,0.70)' }
  return { bg: 'rgba(5,10,68,0.06)', text: 'rgba(5,10,68,0.60)' }
}

// ── Phase chart ───────────────────────────────────────────────────────────────
function PhaseChart({ assets }) {
  if (!assets?.length) return null
  const totalFlex = PHASES.reduce((s, p) => s + p.flex, 0)

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Phase column headers */}
      <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(5,10,68,0.08)' }}>
        {PHASES.map((phase) => (
          <div
            key={phase.key}
            style={{
              flex: phase.flex,
              textAlign: 'center',
              padding: '8px 4px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: phase.prominent ? '#050A44' : '#F7F8FC',
              color: phase.prominent ? '#FFFFFF' : 'rgba(5,10,68,0.45)',
              borderRight: '1px solid rgba(5,10,68,0.08)',
            }}
          >
            {phase.label}
          </div>
        ))}
      </div>

      {/* Asset rows */}
      <div style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {assets.map((asset) => {
          const phaseIdx = getPhaseIndex(asset.phase)
          // Progress bar fills from left edge to current phase midpoint
          const progressPct = PHASES.slice(0, phaseIdx).reduce((s, p) => s + p.flex, 0) / totalFlex * 100
                            + (PHASES[phaseIdx].flex / totalFlex) * 50

          return (
            <div key={asset.assetId} style={{ display: 'flex', alignItems: 'center', position: 'relative', height: '36px' }}>
              {/* Background track */}
              <div style={{ position: 'absolute', left: 0, right: 0, height: '4px', background: 'rgba(5,10,68,0.06)', borderRadius: '2px' }} />
              {/* Progress fill */}
              <div style={{
                position: 'absolute', left: 0, width: `${progressPct}%`,
                height: '4px', background: '#0055BB', borderRadius: '2px',
                transition: 'width 400ms ease',
              }} />
              {/* Marker dot at current phase */}
              <div style={{
                position: 'absolute', left: `${progressPct}%`, transform: 'translateX(-50%)',
                width: '12px', height: '12px', borderRadius: '50%',
                background: PHASES[phaseIdx].prominent ? '#050A44' : '#0055BB',
                border: '2px solid #fff',
                boxShadow: '0 0 0 2px ' + (PHASES[phaseIdx].prominent ? '#050A44' : '#0055BB'),
                zIndex: 2,
              }} />
              {/* Asset name label — right side */}
              <span style={{
                marginLeft: 'auto', fontSize: '12px', fontWeight: 600,
                color: 'rgba(5,10,68,0.70)', background: '#F7F8FC',
                padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
              }}>
                {asset.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Expandable asset row ──────────────────────────────────────────────────────
function AssetRow({ asset, competitorId }) {
  const [expanded, setExpanded] = useState(false)
  const phaseIdx = getPhaseIndex(asset.phase)
  const { bg: indBg, text: indText } = indicationColor(asset.indicationSubtype)
  const isLateStage = phaseIdx >= 3

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      overflow: 'hidden',
      borderLeft: isLateStage ? '3px solid #050A44' : '3px solid rgba(5,10,68,0.12)',
    }}>
      {/* Main row */}
      <div
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '16px' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Phase badge */}
        <span style={{
          padding: isLateStage ? '4px 12px' : '3px 10px',
          background: isLateStage ? '#050A44' : 'rgba(5,10,68,0.07)',
          color: isLateStage ? '#FFFFFF' : 'rgba(5,10,68,0.65)',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          marginTop: '2px',
        }}>
          {asset.phase}
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.92)' }}>
              {asset.name}
            </p>
            <span style={{ padding: '2px 9px', background: indBg, color: indText, borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
              {asset.indicationSubtype}
            </span>
            {asset.roa && (
              <span style={{
                fontSize: '11px',
                color: 'rgba(5,10,68,0.50)',
                fontWeight: 500,
              }}>
                <span style={{ fontWeight: 700, color: 'rgba(5,10,68,0.40)' }}>RoA</span>
                {' · '}
                {asset.roa}
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.55)' }}>
            {asset.mechanism}
          </p>
          <div style={{ marginTop: '8px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>Latest</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.75)' }}>{asset.latestMilestone}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>Next expected</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.75)' }}>{asset.nextMilestone}</p>
            </div>
            {asset.trialIds?.length > 0 && (
              <div>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>Trial ID</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.55)', fontFamily: 'monospace' }}>
                  {asset.trialIds.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div style={{ color: 'rgba(5,10,68,0.35)', flexShrink: 0, marginTop: '2px' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '0 20px 20px',
          borderTop: '1px solid rgba(5,10,68,0.06)',
          paddingTop: '16px',
        }}>
          {asset.trialDesignSummary && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
                Trial design
              </p>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.65', color: 'rgba(5,10,68,0.70)' }}>
                {asset.trialDesignSummary}
              </p>
            </div>
          )}
          <AIButton source={`pipeline-compare-${competitorId}-${asset.assetId}`}>
            Compare to our asset
          </AIButton>
        </div>
      )}
    </div>
  )
}

// ── Expected timeline section (Task 3d) ───────────────────────────────────────
const TIMELINE_FIELDS = [
  { key: 'trialStart',          label: 'Trial start' },
  { key: 'recruitmentComplete', label: 'Recruitment completion' },
  { key: 'dataReadout',         label: 'Estimated data readout' },
  { key: 'estimatedFiling',     label: 'Estimated filing' },
  { key: 'expectedLaunch',      label: 'Expected launch (per region)' },
]

const TRIAL_DESIGN_FIELDS = [
  { key: 'primaryEndpoint',   label: 'Primary endpoint' },
  { key: 'comparator',        label: 'Comparator' },
  { key: 'patientPopulation', label: 'Patient population' },
  { key: 'sampleSize',        label: 'Sample size (est.)' },
]

function ExpectedTimelineSection({ competitorId, assetId }) {
  const storageKey = `ariya-timeline-${competitorId}-${assetId}`
  const [open, setOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [values, setValues] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const updateField = (key, value) => {
    const next = { ...values, [key]: value }
    setValues(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch { /* ignore quota / private-mode errors */ }
  }

  const handleUpdateClick = () => {
    // Values already persist on each keystroke — this is a confirm affordance
    try {
      localStorage.setItem(storageKey, JSON.stringify(values))
    } catch { /* noop */ }
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur()
    }
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1800)
  }

  const hasAnyValue = Object.values(values).some((v) => v && String(v).trim().length > 0)

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      marginTop: '8px',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          color: 'rgba(5,10,68,0.70)',
        }}
      >
        Expected timeline {open ? '∨' : '›'}
      </button>

      {open && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid rgba(5,10,68,0.06)' }}>
          <div style={{
            marginTop: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}>
            {TIMELINE_FIELDS.map((field) => (
              <div key={field.key}>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'rgba(5,10,68,0.55)',
                  marginBottom: '4px',
                }}>
                  {field.label}
                </label>
                <input
                  type="text"
                  value={values[field.key] ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder="e.g. Q1 2024"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '13px',
                    border: '1px solid rgba(5,10,68,0.15)',
                    borderRadius: '6px',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>

          {hasAnyValue && (
            <p style={{
              margin: '14px 0 0',
              fontSize: '12px',
              color: 'rgba(5,10,68,0.50)',
              fontStyle: 'italic',
            }}>
              Ariya is monitoring for signals that may shorten or extend this timeline.
            </p>
          )}

          {/* Update button + transient saved feedback */}
          <div style={{
            marginTop: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: '10px',
          }}>
            {justSaved && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '12px', color: '#065F46', fontWeight: 600,
              }}>
                <Check size={12} strokeWidth={2.5} /> Updated
              </span>
            )}
            <button
              type="button"
              onClick={handleUpdateClick}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px', fontWeight: 600,
                background: '#050A44', color: '#FFFFFF',
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(5,10,68,0.18)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trial design section (separate collapsible) ─────────────────────────────
function TrialDesignSection({ trialDesign }) {
  const [open, setOpen] = useState(false)
  if (!trialDesign) return null

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      marginTop: '8px',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          color: 'rgba(5,10,68,0.70)',
        }}
      >
        Trial design {open ? '∨' : '›'}
      </button>

      {open && (
        <div style={{ padding: '14px 20px 16px', borderTop: '1px solid rgba(5,10,68,0.06)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, max-content) 1fr',
            columnGap: '20px',
            rowGap: '10px',
            alignItems: 'baseline',
          }}>
            {TRIAL_DESIGN_FIELDS.map((field) => (
              <Fragment key={field.key}>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(5,10,68,0.50)',
                }}>
                  {field.label}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: 'rgba(5,10,68,0.78)',
                  lineHeight: '1.5',
                }}>
                  {trialDesign[field.key] ?? '—'}
                </p>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function PipelineTab({ competitor }) {
  const assets = competitor.pipeline || []

  if (!assets.length) {
    return <EmptyState message="No pipeline assets recorded in HAE." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PhaseChart assets={assets} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {assets.map((asset) => (
          <div key={asset.assetId}>
            <AssetRow asset={asset} competitorId={competitor.id} />
            <ExpectedTimelineSection competitorId={competitor.id} assetId={asset.assetId} />
            <TrialDesignSection trialDesign={asset.trialDesign} />
          </div>
        ))}
      </div>
    </div>
  )
}
