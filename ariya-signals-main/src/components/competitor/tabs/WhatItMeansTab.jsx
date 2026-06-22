import { GitCompare, HelpCircle, Zap } from 'lucide-react'
import AIButton from '../../ui/AIButton'
import EmptyState from '../../ui/EmptyState'

const RELATIONSHIP_CONFIG = {
  'Direct competitor':         { bg: 'rgba(225,29,72,0.10)',   text: '#C01041', border: 'rgba(225,29,72,0.20)'  },
  'Direct competitor (future)':{ bg: 'rgba(225,29,72,0.08)',   text: '#C01041', border: 'rgba(225,29,72,0.15)'  },
  'Adjacent':                  { bg: 'rgba(245,158,11,0.10)',  text: '#92500A', border: 'rgba(245,158,11,0.20)'  },
  'No overlap':                { bg: 'rgba(5,10,68,0.05)',     text: 'rgba(5,10,68,0.45)', border: 'rgba(5,10,68,0.10)' },
}

function getRelConfig(rel) {
  return RELATIONSHIP_CONFIG[rel] || RELATIONSHIP_CONFIG['No overlap']
}

// ── Overlap matrix ────────────────────────────────────────────────────────────
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
            {/* Our asset */}
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
                Our asset
              </p>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0055BB' }}>
                {item.ourAsset}
              </span>
            </div>

            {/* Their asset */}
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
                Their asset
              </p>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.75)' }}>
                {item.theirAsset}
              </span>
            </div>

            {/* Relationship badge */}
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

            {/* Note */}
            {item.note && (
              <div style={{ paddingTop: '18px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.60)', lineHeight: '1.55' }}>
                  {item.note}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Key questions ─────────────────────────────────────────────────────────────
function QuestionBlock({ question, answer, competitorId, index }) {
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
    <div style={{
      background: '#E8EAF6',
      borderRadius: '16px',
      padding: '20px',
    }}>
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
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.75)', lineHeight: '1.55' }}>
              {action}
            </p>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '16px' }}>
        <AIButton source={`what-it-means-actions-${competitorId}`}>
          Ask for more detail
        </AIButton>
      </div>
    </div>
  )
}

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

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function WhatItMeansTab({ competitor }) {
  const data = competitor.whatItMeansForUs
  if (!data) return <EmptyState message="No strategic analysis available." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Overlap matrix */}
      {data.overlap?.length > 0 && (
        <div>
          <SectionHeader label="Portfolio overlap with Pharma Inc" />
          <OverlapMatrix overlap={data.overlap} />
        </div>
      )}

      {/* Key questions */}
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

    </div>
  )
}
