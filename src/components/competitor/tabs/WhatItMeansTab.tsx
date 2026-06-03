import { HelpCircle, Zap } from 'lucide-react'
import AIButton from '../../ui/AIButton'
import EmptyState from '../../ui/EmptyState'
import PipelineTab from './PipelineTab'

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
  strengths:     { label: 'Strength',     outerBg: 'rgba(42,118,244,0.15)',  labelColor: '#2A76F4',  bullet: '#2A76F4'  },
  threats:       { label: 'Threat',       outerBg: 'rgba(183,63,84,0.15)',   labelColor: '#B73F54',  bullet: '#B73F54'  },
  weaknesses:    { label: 'Weakness',     outerBg: 'rgba(251,101,20,0.15)',  labelColor: '#FB6514',  bullet: '#FB6514'  },
  opportunities: { label: 'Opportunity',  outerBg: 'rgba(67,76,91,0.16)',    labelColor: '#434C5B',  bullet: '#434C5B'  },
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
            border: '1px solid rgba(210,226,255,1)',
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
      background: 'rgba(42,118,244,0.15)',
      borderRadius: '16px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
        <HelpCircle size={16} color="#2A76F4" strokeWidth={2} style={{ marginTop: '2px', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#434c5b', lineHeight: '1.4' }}>
          {question.question}
        </p>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#434c5b', lineHeight: '1.65', paddingLeft: '26px' }}>
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
    <div style={{ background: 'rgba(42,118,244,0.15)', borderRadius: '16px', padding: '20px' }}>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {actions.map((action, i) => (
          <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#2A76F4', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, marginTop: '1px',
            }}>
              <Zap size={11} color="#fff" fill="#fff" />
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#434c5b', lineHeight: '1.55' }}>{action}</p>
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
  // Order: strengths, threats (top row), weaknesses, opportunities (bottom row)
  const quadrants: Array<keyof typeof SWOT_CFG> = ['strengths', 'threats', 'weaknesses', 'opportunities']
  return (
    <div>
      <SectionHeader label="SWOT" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
      }}>
        {quadrants.map(key => {
          const cfg = SWOT_CFG[key]
          const items: string[] = (swot as Record<string, string[]>)[key] || []
          return (
            <div key={key} style={{
              background: cfg.outerBg,
              borderRadius: '16px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <p style={{
                margin: 0,
                fontSize: '14px', fontWeight: 500,
                fontFamily: 'Inter, sans-serif',
                color: cfg.labelColor,
              }}>
                {cfg.label}
              </p>
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{
                      marginTop: '8px', width: '4px', height: '4px',
                      borderRadius: '50%', background: cfg.bullet,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: '14px', fontWeight: 400,
                      fontFamily: 'Satoshi, sans-serif',
                      color: '#434c5b', lineHeight: '21px',
                    }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
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
        border: '1px solid rgba(210,226,255,1)',
        overflow: 'hidden',
      }}>
        {personnel.map((p, i) => {
          const initial = (p.name || '').charAt(0).toUpperCase()
          const isLast = i === personnel.length - 1
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 160px 1fr auto',
                gap: '12px',
                alignItems: 'center',
                minHeight: '56px',
                padding: '8px 16px',
                borderBottom: isLast ? 'none' : '1px solid rgba(5,10,68,0.06)',
              }}
            >
              {/* Column 1 — Avatar 24px */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'rgba(42,118,244,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#2A76F4' }}>{initial}</span>
              </div>

              {/* Column 2 — Stacked: title (12px/500) above name (14px/400) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                  fontSize: '12px', fontWeight: 500,
                  fontFamily: 'Satoshi, sans-serif',
                  color: '#434c5b', lineHeight: '18px',
                }}>
                  {p.title}
                </span>
                <span style={{
                  fontSize: '14px', fontWeight: 400,
                  fontFamily: 'Satoshi, sans-serif',
                  color: '#434c5b', lineHeight: '21px',
                }}>
                  {p.name}
                </span>
              </div>

              {/* Column 3 — Background/notable info */}
              <div style={{ padding: '4px 0', overflow: 'hidden' }}>
                {p.background && (
                  <span style={{
                    fontSize: '12px', fontWeight: 500,
                    fontFamily: 'Inter, sans-serif',
                    color: '#708090',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.background}
                  </span>
                )}
              </div>

              {/* Column 4 — Tenure badge */}
              {p.tenure ? (
                <div style={{
                  background: 'rgba(5,10,68,0.06)',
                  borderRadius: '6px',
                  padding: '4px 12px',
                }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 500,
                    fontFamily: 'Inter, sans-serif',
                    color: '#434c5b',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.tenure}
                  </span>
                </div>
              ) : <div />}
            </div>
          )
        })}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'rgba(5,10,68,0.38)', fontStyle: 'italic' }}>
        Illustrative
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

      {/* Pipeline (full chart, moved from Pipeline tab) */}
      {competitor.pipeline?.length > 0 && (
        <div>
          <SectionHeader label="Pipeline" />
          <PipelineTab competitor={competitor} />
        </div>
      )}

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
