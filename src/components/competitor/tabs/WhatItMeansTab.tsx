import { HelpCircle, Zap } from 'lucide-react'
import AIButton from '../../ui/AIButton'
import EmptyState from '../../ui/EmptyState'

// ── Overlap relationship badge config ─────────────────────────────────────────
const RELATIONSHIP_CONFIG = {
  'Direct competitor':          { bg: 'rgba(225,29,72,0.10)',   text: '#C01041', border: 'rgba(225,29,72,0.20)'  },
  'Direct competitor (future)': { bg: 'rgba(225,29,72,0.08)',   text: '#C01041', border: 'rgba(225,29,72,0.15)'  },
  'Adjacent':                   { bg: 'rgba(245,158,11,0.10)',  text: '#92500A', border: 'rgba(245,158,11,0.20)'  },
  'No overlap':                 { bg: 'rgba(5,10,68,0.05)',     text: 'rgba(5,10,68,0.45)', border: 'rgba(5,10,68,0.10)' },
}
function getRelConfig(rel) {
  return RELATIONSHIP_CONFIG[rel] || RELATIONSHIP_CONFIG['No overlap']
}

// ── SWOT quadrant config ───────────────────────────────────────────────────────
const SWOT_CFG = {
  strengths:     { label: 'Strengths',     bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.18)', headerText: '#065F46',          bullet: '#065F46'          },
  weaknesses:    { label: 'Weaknesses',    bg: 'rgba(5,10,68,0.03)',    border: 'rgba(5,10,68,0.08)',    headerText: 'rgba(5,10,68,0.65)',bullet: 'rgba(5,10,68,0.45)' },
  opportunities: { label: 'Opportunities', bg: 'rgba(5,10,68,0.03)',    border: 'rgba(5,10,68,0.08)',    headerText: 'rgba(5,10,68,0.65)',bullet: 'rgba(5,10,68,0.45)' },
  threats:       { label: 'Threats',       bg: 'rgba(225,29,72,0.05)',  border: 'rgba(225,29,72,0.16)', headerText: '#C01041',          bullet: '#C01041'          },
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <p style={{
      margin: '0 0 12px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color: 'rgba(5,10,68,0.40)',
    }}>
      {label}
    </p>
  )
}

// ── Portfolio overlap ──────────────────────────────────────────────────────────
function OverlapMatrix({ overlap }) {
  if (!overlap?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {overlap.map((item, i) => {
        const cfg = getRelConfig(item.relationship)
        return (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '160px 160px auto 1fr',
            gap: '12px',
            alignItems: 'start',
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid rgba(5,10,68,0.08)',
            padding: '14px 16px',
          }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>Our asset</p>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0055BB' }}>{item.ourAsset}</span>
            </div>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>Their asset</p>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.75)' }}>{item.theirAsset}</span>
            </div>
            <div style={{ paddingTop: '18px' }}>
              <span style={{
                padding: '3px 10px', borderRadius: '9999px',
                fontSize: '11px', fontWeight: 700,
                background: cfg.bg, color: cfg.text,
                border: `1px solid ${cfg.border}`,
                whiteSpace: 'nowrap',
              }}>
                {item.relationship}
              </span>
            </div>
            {item.note && (
              <div style={{ paddingTop: '18px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.60)', lineHeight: '1.55' }}>{item.note}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Key strategic questions ───────────────────────────────────────────────────
function QuestionBlock({ question, competitorId, index }) {
  return (
    <div style={{
      background: '#E8EAF6',
      borderRadius: '16px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
        <HelpCircle size={16} color="#0055BB" strokeWidth={2} style={{ marginTop: '2px', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'rgba(5,10,68,0.88)', lineHeight: '1.4' }}>
          {question.question}
        </p>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'rgba(5,10,68,0.70)', lineHeight: '1.65', paddingLeft: '26px' }}>
        {question.answer}
      </p>
      <div style={{ paddingLeft: '26px' }}>
        <AIButton source={`what-it-means-question-${competitorId}-${index}`}>
          Ask for more detail
        </AIButton>
      </div>
    </div>
  )
}

// ── Suggested actions ─────────────────────────────────────────────────────────
function SuggestedActions({ actions, competitorId }) {
  return (
    <div style={{ background: '#E8EAF6', borderRadius: '16px', padding: '20px' }}>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {actions.map((action, i) => (
          <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#0055BB', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, marginTop: '1px',
            }}>
              <Zap size={11} color="#fff" fill="#fff" />
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.75)', lineHeight: '1.55' }}>{action}</p>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '16px' }}>
        <AIButton source={`what-it-means-actions-${competitorId}`}>Ask for more detail</AIButton>
      </div>
    </div>
  )
}

// ── SWOT ──────────────────────────────────────────────────────────────────────
function SwotSection({ swot }) {
  if (!swot) return null
  return (
    <div>
      <SectionHeader label="SWOT" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '10px',
      }}>
        {(['strengths', 'weaknesses', 'opportunities', 'threats']).map(key => {
          const cfg = SWOT_CFG[key]
          const items = swot[key] || []
          return (
            <div key={key} style={{
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: '12px',
              padding: '14px 16px',
            }}>
              <p style={{
                margin: '0 0 10px', fontSize: '11px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: cfg.headerText,
              }}>
                {cfg.label}
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{
                      marginTop: '6px', width: '4px', height: '4px',
                      borderRadius: '50%', background: cfg.bullet,
                      flexShrink: 0, opacity: 0.8,
                    }} />
                    <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Key personnel ─────────────────────────────────────────────────────────────
function PersonnelSection({ personnel }) {
  if (!personnel?.length) return null
  return (
    <div>
      <SectionHeader label="Key personnel" />
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(5,10,68,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '680px' }}>
            <thead>
              <tr style={{ background: 'rgba(5,10,68,0.03)' }}>
                {['Name', 'Title', 'Tenure', 'Notable background'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'rgba(5,10,68,0.40)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personnel.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(5,10,68,0.05)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)', whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={{ padding: '10px 14px', color: 'rgba(5,10,68,0.72)' }}>{p.title}</td>
                  <td style={{ padding: '10px 14px', color: 'rgba(5,10,68,0.55)', whiteSpace: 'nowrap' }}>{p.tenure}</td>
                  <td style={{ padding: '10px 14px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.5' }}>{p.background}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'rgba(5,10,68,0.38)', fontStyle: 'italic' }}>
        Illustrative · requires GlobalData / Crunchbase data
      </p>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function WhatItMeansTab({ competitor }) {
  const data = competitor.whatItMeansForUs
  if (!data) return <EmptyState message="No strategic analysis available." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Portfolio overlap */}
      {data.overlap?.length > 0 && (
        <div>
          <SectionHeader label="Portfolio overlap with Pharma Inc" />
          <OverlapMatrix overlap={data.overlap} />
        </div>
      )}

      {/* Key strategic questions */}
      {data.keyQuestions?.length > 0 && (
        <div>
          <SectionHeader label="Key strategic questions" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.keyQuestions.map((q, i) => (
              <QuestionBlock key={i} question={q} competitorId={competitor.id} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Suggested actions */}
      {data.suggestedActions?.length > 0 && (
        <div>
          <SectionHeader label="Suggested actions" />
          <SuggestedActions actions={data.suggestedActions} competitorId={competitor.id} />
        </div>
      )}

      {/* SWOT */}
      <SwotSection swot={competitor.swot} />

      {/* Key personnel */}
      <PersonnelSection personnel={competitor.keyPersonnel} />

    </div>
  )
}
