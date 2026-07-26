import { useState } from 'react'
import { FileText, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import AIButton from '../../ui/AIButton'
import EmptyState from '../../ui/EmptyState'
import { REDUCED_MOTION } from '../../../lib/motion'
import { DEMO } from '../../../config/demo-config'
import { useConfig } from '../../../context/AppContext'
import { competitorsData } from '../../../data/kalvista'

// ── Mini Gantt column definitions ─────────────────────────────────────────────
// Compressed view: Q3 2025 → Q4 2029 quarterly
// isCurrent is computed at load time from the real date so the "today" highlight
// stays accurate as quarters roll over without a code change.
const _NOW = new Date()
const _NOW_YEAR = _NOW.getFullYear()
const _NOW_Q = Math.ceil((_NOW.getMonth() + 1) / 3)

const MINI_COLS = [
  { label: 'Q3 25', year: 2025, q: 3 },
  { label: 'Q4 25', year: 2025, q: 4 },
  { label: 'Q1 26', year: 2026, q: 1 },
  { label: 'Q2 26', year: 2026, q: 2 },
  { label: 'Q3 26', year: 2026, q: 3 },
  { label: 'Q4 26', year: 2026, q: 4 },
  { label: 'Q1 27', year: 2027, q: 1 },
  { label: 'Q2 27', year: 2027, q: 2 },
  { label: 'Q3 27', year: 2027, q: 3 },
  { label: 'Q4 27', year: 2027, q: 4 },
  { label: 'Q1 28', year: 2028, q: 1 },
  { label: 'Q2 28', year: 2028, q: 2 },
  { label: 'Q3 28', year: 2028, q: 3 },
  { label: 'Q4 28', year: 2028, q: 4 },
  { label: 'Q1 29', year: 2029, q: 1 },
  { label: 'Q2 29', year: 2029, q: 2 },
  { label: 'Q3 29', year: 2029, q: 3 },
  { label: 'Q4 29', year: 2029, q: 4 },
].map(col => ({ ...col, isCurrent: col.year === _NOW_YEAR && col.q === _NOW_Q }))

const MINI_COL_W    = 52   // px per column
const MINI_LABEL_W  = 118  // competitor + drug label column
const MINI_THREAT_W = 50   // threat badge column
const MINI_ROW_H    = 48   // data row height

// ── Phase bar colours (mini gantt) ────────────────────────────────────────────
const MINI_PHASE_CFG = {
  phase1: { bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.26)' },
  phase2: { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.26)' },
  phase3: { bg: 'rgba(42,118,244,0.14)', border: 'rgba(42,118,244,0.26)' },
  filed:  { bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.26)' },
  own:    { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.30)' },
}

// ── Threat badge colours ──────────────────────────────────────────────────────
const THREAT_CFG = {
  High:   { bg: 'rgba(225,29,72,0.10)',   text: '#C01041' },
  Medium: { bg: 'rgba(245,158,11,0.10)',  text: '#92500A' },
  Low:    { bg: 'rgba(5,10,68,0.06)',     text: 'rgba(5,10,68,0.50)' },
}

// ── Phase stepper ─────────────────────────────────────────────────────────────
const PHASE_STEPS = [
  'Preclinical', 'Phase I', 'Phase II', 'Phase III', 'Filed', 'Approved',
]

function getPhaseIndex(phase: string): number {
  const p = (phase || '').toLowerCase()
  if (p.includes('approved'))   return 5
  if (p.includes('filed'))      return 4
  if (p.includes('iii') || p.includes('phase 3')) return 3
  if (p.includes('ii')  || p.includes('phase 2')) return 2
  if (p.includes('phase i') || p.includes('phase 1') || p === 'phase i') return 1
  if (p.includes('preclinical')) return 0
  return 2
}

function PhaseStepper({ phase }: { phase: string }) {
  const currentIdx = getPhaseIndex(phase)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {PHASE_STEPS.map((label, i) => {
        const isActive  = i <= currentIdx
        const isCurrent = i === currentIdx
        const isLast    = i === PHASE_STEPS.length - 1
        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            flex: '1 0 0', alignItems: 'flex-start', minWidth: 0,
          }}>
            {/* Dot + connecting line */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', width: '100%' }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                background: isActive ? '#10224A' : 'rgba(112,128,144,0.3)',
                boxShadow: isCurrent ? '0 0 0 3px rgba(42,118,244,0.3)' : 'none',
              }} />
              {!isLast && (
                <div style={{
                  flex: 1, height: '1.5px', marginLeft: '4px',
                  background: isActive ? '#10224A' : 'rgba(112,128,144,0.3)',
                }} />
              )}
            </div>
            {/* Label */}
            <span style={{
              fontSize: 12, fontWeight: isActive ? 500 : 400,
              fontFamily: 'Satoshi, sans-serif',
              color: isActive ? '#10224A' : 'rgba(5,10,68,0.45)',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Indication type → section label ──────────────────────────────────────────
const INDICATION_SECTION_LABEL = {
  'on-demand':             'On-demand (acute treatment)',
  'prophylaxis':           'Prophylaxis (preventive)',
  'prophylaxis-pediatric': 'Prophylaxis – pediatric',
  'gene-therapy':          'Gene therapy (long-term)',
  'rna-based':             'RNA-based prophylaxis',
}

// ── Static competitive context rows by indication type ────────────────────────
// Each row represents one asset from any tracked competitor, shown in the
// mini Gantt for the matching indication type.
const COMP_ROWS_BY_TYPE = {
  'on-demand': [
    {
      competitorId: 'pharma-inc', name: DEMO.companyLabel, drugLabel: `${DEMO.assetName} (${DEMO.assetGenericName})`, _labelIsDefault: true,
      threat: null, isOwn: true,
      bars: [{ sy: 2025, sq: 4, ey: 2026, eq: 2, phase: 'own' }],
      milestones: [{ y: 2026, q: 3, type: 'approval', label: 'US' }],
    },
  ],
  // Competitor rows removed — only live ClinicalTrials.gov data (asset._ganttBars) is used
  'prophylaxis':          [],
  'prophylaxis-pediatric': [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIndicationType(indicationSubtype) {
  const s = (indicationSubtype || '').toLowerCase()
  if (s.includes('on-demand'))  return 'on-demand'
  if (s.includes('pediatric'))  return 'prophylaxis-pediatric'
  if (s.includes('prophylaxis')) return 'prophylaxis'
  if (s.includes('gene'))       return 'gene-therapy'
  if (s.includes('rna') || s.includes('antisense')) return 'rna-based'
  return 'prophylaxis'
}

function findColIdx(year, q) {
  if (year > 2029) return MINI_COLS.length - 1
  if (year < 2025 || (year === 2025 && q !== null && q < 3)) return 0
  const idx = MINI_COLS.findIndex(c => c.year === year && c.q === q)
  return idx < 0 ? 0 : idx
}

function barLeft(sy, sq) {
  return MINI_LABEL_W + MINI_THREAT_W + findColIdx(sy, sq) * MINI_COL_W
}

function barWidth(sy, sq, ey, eq) {
  const si = Math.max(0, findColIdx(sy, sq))
  const ei = Math.min(MINI_COLS.length - 1, findColIdx(ey, eq))
  return Math.max(4, (ei - si + 1) * MINI_COL_W - 4)
}

function milestoneLeft(year, q) {
  const idx = findColIdx(year, q)
  return MINI_LABEL_W + MINI_THREAT_W + idx * MINI_COL_W + MINI_COL_W / 2 - 8
}

// ── Milestone dot icon ────────────────────────────────────────────────────────
function MilestoneIcon({ type }) {
  if (type === 'readout')  return <span style={{ fontSize: 12, color: '#F59E0B', lineHeight: 1 }}>●</span>
  if (type === 'filing')   return <FileText size={12} color="#0055BB" />
  if (type === 'approval') return <Check size={12} color="#059669" strokeWidth={2.5} />
  return <span style={{ fontSize: 13, color: 'rgba(5,10,68,0.45)', lineHeight: 1 }}>○</span>
}

// ── Phase badge config for asset card header ──────────────────────────────────
function phaseBadgeCfg(phase) {
  const p = (phase || '').toLowerCase()
  if (p.includes('filed'))     return { bg: 'rgba(16,185,129,0.12)', text: '#065F46'  }
  if (p.includes('iii'))       return { bg: 'rgba(42,118,244,0.13)', text: '#0055BB'  }
  if (p.includes('ii'))        return { bg: 'rgba(245,158,11,0.12)', text: '#92500A'  }
  if (p.includes('phase i') || p === 'phase i') return { bg: 'rgba(139,92,246,0.12)', text: '#5B21B6' }
  if (p.includes('preclinical')) return { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.60)' }
  return { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.60)' }
}

function indicationTagCfg(indicationSubtype) {
  const s = (indicationSubtype || '').toLowerCase()
  if (s.includes('on-demand')) return { bg: 'rgba(0,85,187,0.10)', text: '#0055BB' }
  return { bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.65)' }
}

// ── Mini competitive Gantt ────────────────────────────────────────────────────
function MiniGantt({ asset, indicationSubtype, currentCompetitorId }) {
  const { assetName, assetGenericName } = useConfig()
  const type = getIndicationType(indicationSubtype)

  // Own-product row is always hardcoded (it represents the user's own demo asset)
  const rawOwnRow = (COMP_ROWS_BY_TYPE[type] || []).find((r: any) => r.isOwn)
  const ownRow = rawOwnRow ? { ...rawOwnRow, drugLabel: `${assetName} (${assetGenericName})` } : undefined

  // Competitor row: use live ClinicalTrials.gov data when available, else fall back to hardcoded
  const hasLiveBars = (asset?._ganttBars?.length ?? 0) > 0
  const competitorName = competitorsData.find((c: any) => c.id === currentCompetitorId)?.name ?? currentCompetitorId

  const liveCompetitorRow = hasLiveBars ? {
    competitorId: currentCompetitorId,
    name:         competitorName,
    drugLabel:    asset.name,
    threat:       null,
    bars:         asset._ganttBars,
    milestones:   asset._ganttMilestones ?? [],
  } : null

  const competitorRows = liveCompetitorRow ? [liveCompetitorRow] : []
  const rows = [...(ownRow ? [ownRow] : []), ...competitorRows]

  // Source badge: only shown when live ClinicalTrials.gov data is present
  const ganttSourceLabel = 'Live · ClinicalTrials.gov'
  const ganttSourceStyle = { bg: 'rgba(22,163,74,0.10)', text: '#15803d' }

  if (!rows?.length) return null

  const sectionLabel = INDICATION_SECTION_LABEL[type] || type
  const totalW = MINI_LABEL_W + MINI_THREAT_W + MINI_COLS.length * MINI_COL_W

  return (
    <div tabIndex={0} aria-label="Pipeline comparison chart — scroll horizontally to see all assets" style={{ overflowX: 'auto', outline: 'none' }}>
      <div style={{ minWidth: totalW }}>

        {/* Source badge — only when live data is present */}
        {hasLiveBars && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
              background: ganttSourceStyle.bg, color: ganttSourceStyle.text,
            }}>
              {ganttSourceLabel}
            </span>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 0 8px', flexWrap: 'wrap' }}>
          {[
            { marker: <span style={{ fontSize: 13, color: '#F59E0B' }}>●</span>,                                                                                 label: 'Data readout'      },
            { marker: <FileText size={13} color="#0055BB" />,                                                                                                     label: 'Filing'            },
            { marker: <Check size={13} color="#059669" strokeWidth={2.5} />,                                                                                      label: 'Approval'          },
            { marker: <span style={{ fontSize: 14, color: 'rgba(5,10,68,0.45)', lineHeight: 1 }}>○</span>,                                                        label: 'Phase start'       },
            { marker: <span style={{ display: 'inline-block', width: 18, height: 8, borderRadius: 2, background: MINI_PHASE_CFG.own.bg, border: `1px solid ${MINI_PHASE_CFG.own.border}` }} />, label: `${assetName} (own product)` },
            { marker: <span style={{ display: 'inline-block', width: 18, height: 8, borderRadius: 2, background: 'rgba(245,158,11,0.18)' }} />,                  label: 'Today'             },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {item.marker}
              <span style={{ fontSize: 13, color: 'rgba(5,10,68,0.65)' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Column header */}
        <div style={{
          display: 'flex',
          background: 'rgba(5,10,68,0.03)',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid rgba(5,10,68,0.10)',
        }}>
          <div style={{ width: MINI_LABEL_W, flexShrink: 0, padding: '6px 10px', borderRight: '1px solid rgba(5,10,68,0.08)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(5,10,68,0.55)' }}>Competitor</span>
          </div>
          <div style={{ width: MINI_THREAT_W, flexShrink: 0, padding: '6px 4px', borderRight: '1px solid rgba(5,10,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(5,10,68,0.55)' }}>Threat</span>
          </div>
          {MINI_COLS.map((col, i) => (
            <div key={i} style={{
              width: MINI_COL_W, flexShrink: 0,
              padding: '6px 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: col.isCurrent ? 'rgba(225,29,72,0.05)' : 'transparent',
              borderRight: '1px solid rgba(5,10,68,0.04)',
            }}>
              <span style={{ fontSize: 12, fontWeight: col.isCurrent ? 700 : 500, color: col.isCurrent ? '#C01041' : 'rgba(5,10,68,0.60)' }}>
                {col.label}
              </span>
            </div>
          ))}
        </div>

        {/* Indication section label */}
        <div style={{ padding: '5px 10px', background: 'rgba(5,10,68,0.02)', borderBottom: '1px solid rgba(5,10,68,0.06)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(5,10,68,0.60)' }}>
            {sectionLabel}
          </span>
        </div>

        {/* Data rows */}
        {rows.map((row, ri) => {
          const threatCfg = row.threat ? (THREAT_CFG[row.threat] || THREAT_CFG.Low) : null
          const isCurrentComp = row.competitorId === currentCompetitorId
          return (
            <div key={ri} style={{
              position: 'relative',
              height: MINI_ROW_H,
              borderBottom: ri < rows.length - 1 ? '1px solid rgba(5,10,68,0.05)' : 'none',
            }}>
              {/* Label col */}
              <div style={{
                position: 'absolute', left: 0, top: 0,
                width: MINI_LABEL_W, height: MINI_ROW_H,
                borderRight: '1px solid rgba(5,10,68,0.07)',
                background: isCurrentComp ? 'rgba(0,85,187,0.04)' : '#FFFFFF',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '0 8px', zIndex: 2,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(5,10,68,0.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(5,10,68,0.65)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.drugLabel}
                </span>
              </div>

              {/* Threat col */}
              <div style={{
                position: 'absolute', left: MINI_LABEL_W, top: 0,
                width: MINI_THREAT_W, height: MINI_ROW_H,
                borderRight: '1px solid rgba(5,10,68,0.07)',
                background: isCurrentComp ? 'rgba(0,85,187,0.04)' : '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
              }}>
                {row.isOwn ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 5px', borderRadius: '9999px', background: 'rgba(236,72,153,0.10)', color: '#BE185D' }}>Own</span>
                ) : threatCfg ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 5px', borderRadius: '9999px', background: threatCfg.bg, color: threatCfg.text }}>
                    {row.threat}
                  </span>
                ) : null}
              </div>

              {/* Quarter grid + today highlight */}
              {MINI_COLS.map((col, ci) => (
                <div key={ci} style={{
                  position: 'absolute',
                  left: MINI_LABEL_W + MINI_THREAT_W + ci * MINI_COL_W,
                  top: 0, width: MINI_COL_W, height: MINI_ROW_H,
                  background: col.isCurrent ? 'rgba(245,158,11,0.05)' : 'transparent',
                  borderRight: '1px solid rgba(5,10,68,0.03)',
                  pointerEvents: 'none',
                }} />
              ))}

              {/* Phase bars */}
              {row.bars.map((bar, bi) => {
                const cfg = MINI_PHASE_CFG[bar.phase] || MINI_PHASE_CFG.phase3
                const fullWidth = barWidth(bar.sy, bar.sq, bar.ey, bar.eq)
                if (REDUCED_MOTION) {
                  return (
                    <div key={bi} style={{
                      position: 'absolute',
                      left:   barLeft(bar.sy, bar.sq),
                      width:  fullWidth,
                      top:    (MINI_ROW_H - 20) / 2,
                      height: 20,
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: 4,
                      zIndex: 1,
                    }} />
                  )
                }
                return (
                  <motion.div
                    key={bi}
                    initial={{ width: 0 }}
                    whileInView={{ width: fullWidth }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: bi * 0.06, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      left:   barLeft(bar.sy, bar.sq),
                      top:    (MINI_ROW_H - 20) / 2,
                      height: 20,
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: 4,
                      zIndex: 1,
                    }}
                  />
                )
              })}

              {/* Milestone markers */}
              {row.milestones.map((m, mi) => (
                <div key={mi} style={{
                  position: 'absolute',
                  left:   milestoneLeft(m.y, m.q),
                  bottom: 3,
                  width:  16,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  zIndex: 3,
                }}>
                  <MilestoneIcon type={m.type} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(5,10,68,0.65)', whiteSpace: 'nowrap' }}>{m.label}</span>
                </div>
              ))}
            </div>
          )
        })}

        {/* Note when no live competitor trial data is available */}
        {!liveCompetitorRow && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(5,10,68,0.06)' }}>
            <span style={{ fontSize: 12, color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>
              No clinical trial data matched in ClinicalTrials.gov for this asset.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Expected timeline (form) ──────────────────────────────────────────────────
function ExpectedTimelineSection({ asset }) {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState({
    trialStart:            '',
    recruitmentCompletion: '',
    estimatedDataReadout:  asset.nextMilestone || '',
    estimatedFiling:       '',
    expectedLaunch:        '',
  })

  const FIELDS = [
    { key: 'trialStart',            label: 'Trial start'            },
    { key: 'recruitmentCompletion', label: 'Recruitment completion' },
    { key: 'estimatedDataReadout',  label: 'Estimated data readout' },
    { key: 'estimatedFiling',       label: 'Estimated filing'       },
    { key: 'expectedLaunch',        label: 'Expected launch'        },
  ]

  return (
    <div style={{ background: 'rgba(5,10,68,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.65)', fontFamily: 'inherit',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Expected timeline</span>
      </button>
      {open && (
        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid rgba(5,10,68,0.07)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            {FIELDS.map(f => {
              const fKey = f.key as keyof typeof vals
              return (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(5,10,68,0.45)', marginBottom: '4px', fontFamily: 'inherit' }}>
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={vals[fKey]}
                    onChange={e => setVals(prev => ({ ...prev, [fKey]: e.target.value }))}
                    placeholder="e.g. Q2 2026"
                    style={{ display: 'block', width: '100%', padding: '7px 10px', fontSize: '13px', color: 'rgba(5,10,68,0.85)', fontFamily: 'inherit', background: '#FFFFFF', border: '1px solid rgba(5,10,68,0.15)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )
            })}
            <button
              type="button"
              style={{ marginTop: '4px', padding: '8px 20px', background: '#10224A', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trial design summary + design grid (collapsible) ──────────────────────────
function TrialDesignSection({ asset }) {
  const [open, setOpen] = useState(false)
  const td = asset.trialDesign

  if (!td && !asset.trialDesignSummary) return null

  return (
    <div style={{ background: 'rgba(5,10,68,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.65)', fontFamily: 'inherit',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Trial design</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '10px', fontWeight: 600,
          padding: '2px 7px', borderRadius: '9999px',
          background: asset._trialSource === 'ctgov' ? 'rgba(22,163,74,0.10)' : 'rgba(217,119,6,0.10)',
          color:      asset._trialSource === 'ctgov' ? '#15803d'               : '#b45309',
        }}>
          {asset._trialSource === 'ctgov' ? 'Live · ClinicalTrials.gov' : 'Illustrative'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid rgba(5,10,68,0.07)' }}>
          {asset.trialDesignSummary && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ margin: '10px 0 6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-600)' }}>
                Trial design summary
              </p>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.65', color: 'rgba(5,10,68,0.70)' }}>
                {asset.trialDesignSummary}
              </p>
            </div>
          )}
          {td && (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '16px', rowGap: '8px', alignItems: 'baseline' }}>
              {[
                { label: 'Primary endpoint', val: td.primaryEndpoint },
                { label: 'Comparator',       val: td.comparator },
                { label: 'Population',       val: td.patientPopulation },
                { label: 'Sample size',      val: td.sampleSize },
              ].filter(f => f.val).map(f => [
                <p key={`l-${f.label}`} style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'rgba(5,10,68,0.45)', whiteSpace: 'nowrap' }}>{f.label}</p>,
                <p key={`v-${f.label}`} style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.75)', lineHeight: '1.5' }}>{f.val}</p>,
              ])}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Asset card ────────────────────────────────────────────────────────────────
function AssetCard({ asset, competitorId }) {
  const phaseCfg  = phaseBadgeCfg(asset.phase)
  const indCfg    = indicationTagCfg(asset.indicationSubtype)

  // Derive a short category label from the subtype (e.g. "Prophylaxis" / "On-demand")
  const categoryLabel = (() => {
    const s = (asset.indicationSubtype || '').toLowerCase()
    if (s.includes('on-demand'))  return 'On-demand'
    if (s.includes('pediatric'))  return 'Pediatric'
    if (s.includes('prophylaxis')) return 'Prophylaxis'
    return null
  })()

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(210,226,255,1)',
      padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      {/* Phase stepper */}
      <PhaseStepper phase={asset.phase} />

      {/* Card header: phase badge | name | indication tags */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{
          flexShrink: 0, marginTop: '2px',
          padding: '4px 12px', borderRadius: '9999px',
          fontSize: '11px', fontWeight: 700,
          background: phaseCfg.bg, color: phaseCfg.text,
        }}>
          {asset.phase}
        </span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.90)', flex: 1, lineHeight: '1.4' }}>
          {asset.name}
        </span>
        {/* Indication tags: full subtype + short category */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: indCfg.bg, color: indCfg.text }}>
            {asset.indicationSubtype}
          </span>
          {categoryLabel && (
            <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.55)' }}>
              {categoryLabel}
            </span>
          )}
        </div>
      </div>

      {/* Mechanism · RoA */}
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.4' }}>
        {asset.mechanism}
        {asset.roa && (
          <> · <span style={{ fontWeight: 600, color: 'var(--ink-600)' }}>RoA</span> {asset.roa}</>
        )}
      </p>

      {/* Mini competitive Gantt */}
      <MiniGantt asset={asset} indicationSubtype={asset.indicationSubtype} currentCompetitorId={competitorId} />

      {/* Expected timeline */}
      <ExpectedTimelineSection asset={asset} />

      {/* Trial design */}
      <TrialDesignSection asset={asset} />

      {/* Compare to our asset */}
      <div>
        <AIButton source={`pipeline-compare-${competitorId}-${asset.assetId}`}>
          Compare to our asset
        </AIButton>
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function PipelineTab({ competitor }) {
  const { indication } = useConfig()
  const assets = competitor.pipeline || []

  if (!assets.length) {
    return <EmptyState message={`No pipeline assets recorded in ${indication}.`} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {assets.map(asset => (
        <AssetCard key={asset.assetId} asset={asset} competitorId={competitor.id} />
      ))}
    </div>
  )
}
