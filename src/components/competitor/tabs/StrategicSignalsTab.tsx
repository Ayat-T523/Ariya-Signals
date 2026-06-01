import {
  Handshake, Users, MessageSquareQuote, TrendingUp, AlertCircle,
} from 'lucide-react'
import EmptyState from '../../ui/EmptyState'
import ConfidenceIndicator from '../../ui/ConfidenceIndicator'
import { formatDateAbs } from '../../../utils/formatDate'

// ── Static confidence profiles per section type ───────────────────────────────
const CONFIDENCE = {
  deal:   { sourceCoverage: 'high',   dataFreshness: 'high',   inferenceDepth: 'low'  },
  hiring: { sourceCoverage: 'medium', dataFreshness: 'high',   inferenceDepth: 'low'  },
  quote:  { sourceCoverage: 'high',   dataFreshness: 'high',   inferenceDepth: 'low'  },
  shift:  { sourceCoverage: 'medium', dataFreshness: 'medium', inferenceDepth: 'high' },
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <Icon size={15} color="rgba(5,10,68,0.50)" strokeWidth={1.8} />
      <p style={{
        margin: 0, fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.45)',
      }}>
        {label}
      </p>
    </div>
  )
}

// ── Signal card ───────────────────────────────────────────────────────────────
function SignalCard({ date, headline, whyItMatters, note, confidence }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)', lineHeight: '1.4', flex: 1 }}>
          {headline}
        </p>
        {date && (
          <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)', whiteSpace: 'nowrap', marginTop: '2px' }}>
            {formatDateAbs(date)}
          </span>
        )}
      </div>
      {whyItMatters && (
        <div style={{ background: '#E8EAF6', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
            <strong style={{ color: 'rgba(5,10,68,0.55)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Why it matters —{' '}
            </strong>
            {whyItMatters}
          </p>
          {confidence && (
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <ConfidenceIndicator {...confidence} />
            </div>
          )}
        </div>
      )}
      {note && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertCircle size={11} color="rgba(5,10,68,0.30)" />
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.35)', fontStyle: 'italic' }}>{note}</span>
        </div>
      )}
    </div>
  )
}

// ── Quote card ────────────────────────────────────────────────────────────────
function QuoteCard({ date, source, quote, whyItMatters, confidence }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      padding: '16px',
    }}>
      <p style={{
        margin: '0 0 8px', fontSize: '14px', fontStyle: 'italic', lineHeight: '1.55',
        color: 'rgba(5,10,68,0.80)', borderLeft: '3px solid #E8EAF6', paddingLeft: '12px',
      }}>
        &ldquo;{quote}&rdquo;
      </p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: whyItMatters ? '10px' : 0 }}>
        {source && <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>{source}</span>}
        {date && <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.35)' }}>· {formatDateAbs(date)}</span>}
      </div>
      {whyItMatters && (
        <div style={{ background: '#E8EAF6', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
            <strong style={{ color: 'rgba(5,10,68,0.55)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Why it matters —{' '}
            </strong>
            {whyItMatters}
          </p>
          {confidence && (
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <ConfidenceIndicator {...confidence} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, label, children, empty }) {
  return (
    <div>
      <SectionHeader icon={icon} label={label} />
      {empty ? (
        <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'rgba(5,10,68,0.35)', fontStyle: 'italic' }}>
          No {label.toLowerCase()} recorded.
        </p>
      ) : children}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function StrategicSignalsTab({ competitor }) {
  const signals = competitor.strategicSignals || {}
  const { deals = [], hiring = [], publicStatements = [], strategyShifts = [] } = signals
  const hasAnySignals = deals.length + hiring.length + publicStatements.length + strategyShifts.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
        Recent signals
      </h2>

      {!hasAnySignals ? (
        <EmptyState message="No recent signals recorded for this competitor." />
      ) : (
        <>
          <Section icon={Handshake} label="Deals & Partnerships" empty={!deals.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {deals.map((d, i) => (
                <SignalCard key={i} date={d.date} headline={d.headline} whyItMatters={d.whyItMatters} confidence={CONFIDENCE.deal} />
              ))}
            </div>
          </Section>

          <Section icon={Users} label="Hiring Signals" empty={!hiring.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hiring.map((h, i) => (
                <SignalCard key={i} date={h.date} headline={h.headline} whyItMatters={h.whyItMatters} note={h.dataSourceNote} confidence={CONFIDENCE.hiring} />
              ))}
            </div>
          </Section>

          <Section icon={MessageSquareQuote} label="Public Statements" empty={!publicStatements.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {publicStatements.map((s, i) => (
                <QuoteCard key={i} date={s.date} source={s.source} quote={s.quote} whyItMatters={s.whyItMatters} confidence={CONFIDENCE.quote} />
              ))}
            </div>
          </Section>

          <Section icon={TrendingUp} label="Observed Strategy Shifts" empty={!strategyShifts.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {strategyShifts.map((s, i) => (
                <SignalCard key={i} date={s.date} headline={s.observation} whyItMatters={s.whyItMatters} confidence={CONFIDENCE.shift} />
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
