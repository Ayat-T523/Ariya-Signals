import {
  Handshake, Users, MessageSquareQuote, TrendingUp, AlertCircle,
  DollarSign, FlaskConical, Target, Building2,
} from 'lucide-react'
import EmptyState from '../../ui/EmptyState'
import ConfidenceIndicator from '../../ui/ConfidenceIndicator'
import { formatDateAbs } from '../../../utils/formatDate'

// Static confidence profiles per section type
const CONFIDENCE = {
  deal:     { sourceCoverage: 'high',   dataFreshness: 'high',   inferenceDepth: 'low'  },
  hiring:   { sourceCoverage: 'medium', dataFreshness: 'high',   inferenceDepth: 'low'  },
  quote:    { sourceCoverage: 'high',   dataFreshness: 'high',   inferenceDepth: 'low'  },
  shift:    { sourceCoverage: 'medium', dataFreshness: 'medium', inferenceDepth: 'high' },
}

// ── Shared mini components ───────────────────────────────────────────────────
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

function Caption({ children }) {
  return (
    <p style={{
      margin: '10px 0 0', fontSize: '11px',
      color: 'rgba(5,10,68,0.40)', fontStyle: 'italic',
    }}>
      {children}
    </p>
  )
}

// ── Sub 1: Financials & R&D ──────────────────────────────────────────────────
function KpiCard({ label, value, delta }) {
  return (
    <div style={{
      background: '#FAFBFE',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.06)',
      padding: '14px 16px',
    }}>
      <p style={{
        margin: '0 0 4px', fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.40)',
      }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontSize: '20px', fontWeight: 700,
        color: 'rgba(5,10,68,0.92)', fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
      }}>
        {value}
      </p>
      {delta && (
        <p style={{
          margin: '4px 0 0', fontSize: '11px',
          color: 'rgba(5,10,68,0.45)',
        }}>
          {delta}
        </p>
      )}
    </div>
  )
}

function FinancialsSection({ financials }) {
  if (!financials) return null
  return (
    <div>
      <SectionHeader icon={DollarSign} label="Financials & R&D" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '10px',
      }}>
        <KpiCard label="Total revenue (last FY)"  value={financials.totalRevenue}  delta={financials.totalRevenueDelta} />
        <KpiCard label="HAE franchise revenue"    value={financials.haeRevenue}    delta={financials.haeRevenueDelta} />
        <KpiCard label="R&D spend (last FY)"      value={financials.rdSpend}       delta={financials.rdSpendDelta} />
        <KpiCard label="HAE R&D allocation"       value={financials.haeRdAllocation} />
      </div>
    </div>
  )
}

// ── Sub 2: HAE pipeline count ────────────────────────────────────────────────
const PIPELINE_PHASES = ['Preclinical', 'Phase I', 'Phase II', 'Phase III', 'Filed', 'Approved']

function bucketPhase(phase) {
  const p = (phase || '').toLowerCase()
  if (p.includes('approved'))      return 'Approved'
  if (p.includes('filed'))         return 'Filed'
  if (p.includes('iii'))           return 'Phase III'
  if (p.includes('ii') && !p.includes('iii')) return 'Phase II'
  if (p.includes('phase i') || p === 'phase i') return 'Phase I'
  if (p.includes('preclinical'))   return 'Preclinical'
  return null
}

function PipelineSection({ pipeline }) {
  const assets = pipeline || []
  const counts = PIPELINE_PHASES.reduce((acc, p) => { acc[p] = 0; return acc }, {})
  for (const asset of assets) {
    const b = bucketPhase(asset.phase)
    if (b) counts[b]++
  }

  return (
    <div>
      <SectionHeader icon={FlaskConical} label="HAE pipeline" />
      <p style={{
        margin: '0 0 10px', fontSize: '14px',
        color: 'rgba(5,10,68,0.85)', fontWeight: 600,
      }}>
        {assets.length} {assets.length === 1 ? 'asset' : 'assets'} in active HAE development
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {PIPELINE_PHASES.map((p) => (
          <span
            key={p}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '9999px',
              background: counts[p] > 0 ? 'rgba(0,85,187,0.08)' : 'rgba(5,10,68,0.04)',
              color: counts[p] > 0 ? '#0055BB' : 'rgba(5,10,68,0.40)',
              border: counts[p] > 0 ? '1px solid rgba(0,85,187,0.18)' : '1px solid transparent',
              fontSize: '12px', fontWeight: counts[p] > 0 ? 600 : 500,
            }}
          >
            <span>{p}</span>
            <span style={{
              fontVariantNumeric: 'tabular-nums', fontWeight: 700,
              opacity: counts[p] > 0 ? 1 : 0.5,
            }}>
              {counts[p]}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Sub 3: Key personnel ─────────────────────────────────────────────────────
function PersonnelSection({ personnel }) {
  if (!personnel?.length) return null
  return (
    <div>
      <SectionHeader icon={Users} label="Key personnel" />
      <div style={{
        background: '#FAFBFE',
        borderRadius: '12px',
        border: '1px solid rgba(5,10,68,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '720px' }}>
            <thead>
              <tr style={{ background: 'rgba(5,10,68,0.04)' }}>
                {['Name', 'Title', 'Tenure', 'Notable background'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'rgba(5,10,68,0.45)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personnel.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(5,10,68,0.05)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(5,10,68,0.72)' }}>
                    {p.title}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(5,10,68,0.55)', whiteSpace: 'nowrap' }}>
                    {p.tenure}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.5' }}>
                    {p.background}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Caption>Illustrative · requires GlobalData Companies data</Caption>
    </div>
  )
}

// ── Sub 4: SWOT ──────────────────────────────────────────────────────────────
function SwotQuadrant({ label, items, tone }) {
  // tone: 'positive' (green) | 'caution' (amber)
  const palette = tone === 'positive'
    ? { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)', label: '#065F46' }
    : { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.22)', label: '#92500A' }

  return (
    <div style={{
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: '12px',
      padding: '14px 16px',
    }}>
      <p style={{
        margin: '0 0 8px', fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: palette.label,
      }}>
        {label}
      </p>
      <ul style={{
        margin: 0, padding: 0, listStyle: 'none',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {(items || []).map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{
              marginTop: '7px', width: '4px', height: '4px',
              borderRadius: '50%', background: palette.label,
              flexShrink: 0, opacity: 0.7,
            }} />
            <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SwotSection({ swot }) {
  if (!swot) return null
  return (
    <div>
      <SectionHeader icon={Target} label="SWOT" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '10px',
      }}>
        <SwotQuadrant label="Strengths"     items={swot.strengths}     tone="positive" />
        <SwotQuadrant label="Weaknesses"    items={swot.weaknesses}    tone="caution"  />
        <SwotQuadrant label="Opportunities" items={swot.opportunities} tone="positive" />
        <SwotQuadrant label="Threats"       items={swot.threats}       tone="caution"  />
      </div>
      <Caption>Illustrative · analyst-reviewed quarterly</Caption>
    </div>
  )
}

// ── Company snapshot wrapper ─────────────────────────────────────────────────
function CompanySnapshot({ competitor }) {
  return (
    <section style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      border: '1px solid rgba(5,10,68,0.08)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
      padding: '24px 28px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <Building2 size={18} color="rgba(5,10,68,0.65)" strokeWidth={1.8} />
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Company snapshot
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <FinancialsSection financials={competitor.financials} />
        <PipelineSection   pipeline={competitor.pipeline} />
        <PersonnelSection  personnel={competitor.keyPersonnel} />
        <SwotSection       swot={competitor.swot} />
      </div>
    </section>
  )
}

// ── Signal cards (unchanged) ─────────────────────────────────────────────────
function SignalCard({ date, headline, whyItMatters, note, warning, confidence }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', align: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
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

      {/* Illustrative data note (§7.9) */}
      {note && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertCircle size={11} color="rgba(5,10,68,0.30)" />
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.35)', fontStyle: 'italic' }}>
            {note}
          </span>
        </div>
      )}
    </div>
  )
}

function QuoteCard({ date, source, quote, whyItMatters, confidence }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(5,10,68,0.08)',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
        <p style={{
          margin: 0, fontSize: '14px', fontStyle: 'italic', lineHeight: '1.55',
          color: 'rgba(5,10,68,0.80)', flex: 1, borderLeft: '3px solid #E8EAF6', paddingLeft: '12px',
        }}>
          &ldquo;{quote}&rdquo;
        </p>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: whyItMatters ? '10px' : '0' }}>
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

// ── Main tab ─────────────────────────────────────────────────────────────────
export default function StrategicSignalsTab({ competitor }) {
  const signals = competitor.strategicSignals || {}
  const { deals = [], hiring = [], publicStatements = [], strategyShifts = [] } = signals
  const hasAnySignals = deals.length + hiring.length + publicStatements.length + strategyShifts.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Company snapshot — above existing signals */}
      <CompanySnapshot competitor={competitor} />

      {/* Visual divider */}
      <div style={{
        height: '1px',
        background: 'rgba(5,10,68,0.08)',
        margin: '0 4px',
      }} />

      {/* Recent signals section header */}
      <div>
        <h2 style={{
          margin: '0 0 20px',
          fontSize: '17px', fontWeight: 700,
          color: 'rgba(5,10,68,0.92)',
        }}>
          Recent signals
        </h2>

        {!hasAnySignals ? (
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic' }}>
            No recent signals recorded for this competitor.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

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

          </div>
        )}
      </div>

    </div>
  )
}
