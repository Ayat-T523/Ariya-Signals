import {
  Megaphone, TrendingUp, Globe, Mic, DollarSign, FileText, AlertTriangle,
} from 'lucide-react'
import AIButton from '../../ui/AIButton'
import EmptyState from '../../ui/EmptyState'
import ConfidenceIndicator from '../../ui/ConfidenceIndicator'

// ── Source type config ────────────────────────────────────────────────────────
const SOURCE_TYPE_CONFIG = {
  'Congress presentation': { icon: Mic,         bg: 'rgba(0,85,187,0.09)',    text: '#0055BB' },
  'Press release':         { icon: Megaphone,   bg: 'rgba(5,10,68,0.07)',     text: 'rgba(5,10,68,0.55)' },
  'Investor call':         { icon: DollarSign,  bg: 'rgba(139,92,246,0.10)',  text: '#5B21B6' },
  'Website copy':          { icon: Globe,       bg: 'rgba(5,10,68,0.07)',     text: 'rgba(5,10,68,0.55)' },
  'Publication':           { icon: FileText,    bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
}

function getSourceCfg(sourceType) {
  return SOURCE_TYPE_CONFIG[sourceType] || { icon: FileText, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
}

// ── Shared section header ─────────────────────────────────────────────────────
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

// ── Current core message card ─────────────────────────────────────────────────
function CurrentMessageCard({ data }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(5,10,68,0.08)',
      borderLeft: '4px solid #0055BB',
      padding: '20px 24px',
    }}>
      {/* Label */}
      <p style={{
        margin: '0 0 8px', fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.40)',
      }}>
        Current core message
      </p>

      {/* The message */}
      <p style={{
        margin: '0 0 14px', fontSize: '17px', fontWeight: 600,
        color: 'rgba(5,10,68,0.90)', lineHeight: '1.45',
      }}>
        &ldquo;{data.currentCoreMessage}&rdquo;
      </p>

      {/* Pillars */}
      {data.messagePillars?.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {data.messagePillars.map((pillar, i) => (
            <span key={i} style={{
              padding: '4px 12px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 600,
              background: i === 0 ? '#050A44' : i === 1 ? 'rgba(0,85,187,0.10)' : 'rgba(5,10,68,0.07)',
              color: i === 0 ? '#FFFFFF' : i === 1 ? '#0055BB' : 'rgba(5,10,68,0.60)',
            }}>
              {pillar}
            </span>
          ))}
        </div>
      )}

      {/* Source */}
      {data.currentMessageSource && (
        <p style={{
          margin: 0, fontSize: '11px', color: 'rgba(5,10,68,0.38)',
          fontStyle: 'italic', textAlign: 'right',
        }}>
          Source: {data.currentMessageSource}
        </p>
      )}
    </div>
  )
}

// ── Timeline entry card ───────────────────────────────────────────────────────
function TimelineCard({ entry }) {
  const srcCfg = getSourceCfg(entry.sourceType)
  const Icon = srcCfg.icon

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Top row: date + source chip + shift badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '12px', fontWeight: 700, color: 'rgba(5,10,68,0.55)',
          whiteSpace: 'nowrap',
        }}>
          {entry.date}
        </span>

        {/* Source type chip */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 9px', borderRadius: '9999px',
          fontSize: '11px', fontWeight: 700,
          background: srcCfg.bg, color: srcCfg.text,
        }}>
          <Icon size={10} />
          {entry.sourceType}
        </span>

        {/* Shift badge */}
        <span style={{
          marginLeft: 'auto',
          padding: '2px 9px', borderRadius: '9999px',
          fontSize: '11px', fontWeight: 700,
          background: entry.shiftDetected ? 'rgba(245,158,11,0.12)' : 'rgba(5,10,68,0.06)',
          color: entry.shiftDetected ? '#92500A' : 'rgba(5,10,68,0.40)',
          whiteSpace: 'nowrap',
        }}>
          {entry.shiftDetected ? '⚡ Shift detected' : 'Consistent with prior messaging'}
        </span>
      </div>

      {/* Headline */}
      <p style={{
        margin: 0, fontSize: '14px', fontWeight: 700,
        color: 'rgba(5,10,68,0.88)', lineHeight: '1.4',
      }}>
        {entry.headline}
      </p>

      {/* Detail */}
      <p style={{
        margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.65)',
        lineHeight: '1.60',
      }}>
        {entry.detail}
      </p>

      {/* Why it matters */}
      {entry.whyItMatters && (
        <div style={{ background: '#E8EAF6', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
            <strong style={{
              color: 'rgba(5,10,68,0.55)', fontWeight: 600,
              fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Why it matters —{' '}
            </strong>
            {entry.whyItMatters}
          </p>
          {/* Confidence — higher inference depth when a shift is detected (AI judgement) */}
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <ConfidenceIndicator
              sourceCoverage="medium"
              dataFreshness="high"
              inferenceDepth={entry.shiftDetected ? 'high' : 'medium'}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── vs Pharma Inc comparison table ──────────────────────────────────────────────
function ComparisonTable({ rows, competitorName, competitorId }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(5,10,68,0.08)',
      overflow: 'hidden',
    }}>
      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: 'rgba(5,10,68,0.03)',
        borderBottom: '1px solid rgba(5,10,68,0.08)',
      }}>
        <div style={{ padding: '12px 16px', borderRight: '1px solid rgba(5,10,68,0.08)' }}>
          <p style={{
            margin: 0, fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            color: 'rgba(5,10,68,0.45)',
          }}>
            {competitorName}'s message
          </p>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <p style={{
            margin: 0, fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            color: '#0055BB',
          }}>
            Pharma Inc's position
          </p>
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(5,10,68,0.06)' : 'none',
          }}
        >
          {/* Competitor claim */}
          <div style={{
            padding: '14px 16px',
            borderRight: '1px solid rgba(5,10,68,0.06)',
            background: i % 2 === 0 ? 'transparent' : 'rgba(5,10,68,0.01)',
          }}>
            <p style={{
              margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.70)',
              lineHeight: '1.55', fontStyle: 'italic',
            }}>
              &ldquo;{row.competitorClaim}&rdquo;
            </p>
          </div>

          {/* Pharma Inc position */}
          <div style={{
            padding: '14px 16px',
            background: i % 2 === 0 ? 'rgba(0,85,187,0.02)' : 'rgba(0,85,187,0.03)',
          }}>
            <p style={{
              margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.75)',
              lineHeight: '1.55',
            }}>
              {row.pharmaIncPosition}
            </p>
          </div>
        </div>
      ))}

      {/* AI CTA */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid rgba(5,10,68,0.08)',
        display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(5,10,68,0.02)',
      }}>
        <AIButton source={`messaging-comparison-${competitorId}`}>
          Ask Ariya to analyze this
        </AIButton>
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function MessagingTab({ competitor }) {
  const data = competitor.messaging
  if (!data) {
    return (
      <EmptyState message="No messaging data tracked yet. Add sources to begin monitoring this competitor's positioning." />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Current core message */}
      <div>
        <SectionHeader label="Current positioning" />
        <CurrentMessageCard data={data} />
      </div>

      {/* Messaging timeline */}
      {data.timeline?.length > 0 && (
        <div>
          <SectionHeader label="Messaging timeline" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.timeline.map((entry, i) => (
              <TimelineCard key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* vs Pharma Inc comparison */}
      {data.vsPharmaInc?.length > 0 && (
        <div>
          <SectionHeader label={`${competitor.name} vs Pharma Inc — claim by claim`} />
          <ComparisonTable
            rows={data.vsPharmaInc}
            competitorName={competitor.name}
            competitorId={competitor.id}
          />
        </div>
      )}

    </div>
  )
}
