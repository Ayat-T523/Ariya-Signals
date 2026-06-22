import { Building2, Handshake, Users, MessageSquareQuote, TrendingUp, AlertCircle, ExternalLink } from 'lucide-react'
import PaidGate from '../../ui/PaidGate'
import { formatDateAbs } from '../../../utils/formatDate'
import { DEMO } from '../../../config/demo-config'
import { useConfig } from '../../../context/AppContext'

// ── Phase steps (for pipeline summary) ───────────────────────────────────────
const PHASE_STEPS = ['Preclinical', 'Phase I', 'Phase II', 'Phase III', 'Filed', 'Approved']

function getPhaseKey(phase: string): string {
  const p = (phase || '').toLowerCase()
  if (p.includes('approved'))  return 'Approved'
  if (p.includes('filed'))     return 'Filed'
  if (p.includes('iii'))       return 'Phase III'
  if (p.includes('ii'))        return 'Phase II'
  if (p.includes('phase i'))   return 'Phase I'
  if (p.includes('preclinical')) return 'Preclinical'
  return 'Phase II'
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon?: any; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
      {Icon && <Icon size={14} color="rgba(5,10,68,0.45)" strokeWidth={1.8} />}
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

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      background: '#FFFFFF',
      border: '1px solid rgba(210,226,255,1)',
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: '6px',
    }}>
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>
        {label}
      </span>
      <span style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(5,10,68,0.90)', fontFamily: 'Satoshi, sans-serif', lineHeight: '1.2' }}>
        {value}
      </span>
      {delta && (
        <span style={{ fontSize: '12px', color: delta.startsWith('↑') ? '#059669' : delta.startsWith('↓') ? '#C01041' : 'rgba(5,10,68,0.45)' }}>
          {delta}
        </span>
      )}
    </div>
  )
}

// ── Source badge ───────────────────────────────────────────────────────────────
function SourceBadge({ live, label }: { live?: boolean; label?: string }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600,
      padding: '2px 7px', borderRadius: '9999px',
      background: live ? 'rgba(22,163,74,0.10)' : 'rgba(217,119,6,0.10)',
      color:      live ? '#15803d'               : '#b45309',
    }}>
      {label ?? (live ? 'Live · SEC EDGAR' : 'Illustrative')}
    </span>
  )
}

// ── Financials section ─────────────────────────────────────────────────────────
function FinancialsSection({ financials }: { financials: any }) {
  if (!financials) return null
  const isLive = financials._financialsSource === 'sec_edgar'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.45)' }}>
          Financials & R&D
        </p>
        <SourceBadge
          live={isLive}
          label={isLive
            ? `Live · SEC EDGAR · FY${financials._financialsFiscalYear}`
            : 'Illustrative · GlobalData required'}
        />
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <KpiCard label="Total Revenue (Last FY)" value={financials.totalRevenue} delta={financials.totalRevenueDelta} />
<KpiCard label="R&D Spending (Last FY)" value={financials.rdSpend} delta={financials.rdSpendDelta} />
        {!isLive && <KpiCard label="HAE R&D Allocation" value={financials.haeRdAllocation} />}
      </div>
      {isLive && financials._financialsCurrency && financials._financialsCurrency !== 'USD' && (
        <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'rgba(5,10,68,0.35)', fontStyle: 'italic' }}>
          Reported in {financials._financialsCurrency}; converted to USD at annual average exchange rate.
        </p>
      )}
    </div>
  )
}

// ── Pipeline summary ───────────────────────────────────────────────────────────
function PipelineSummary({ pipeline }: { pipeline: any[] }) {
  const { indication } = useConfig()
  if (!pipeline?.length) return null

  // Count assets per phase step
  const counts: Record<string, number> = {}
  PHASE_STEPS.forEach(s => { counts[s] = 0 })
  pipeline.forEach(a => {
    const key = getPhaseKey(a.phase)
    counts[key] = (counts[key] || 0) + 1
  })
  const total = pipeline.length

  return (
    <div>
      <SectionHeader label={`${indication} Pipeline`} />
      <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.70)' }}>
        {total} asset{total !== 1 ? 's' : ''} in active {indication} development
      </p>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '0',
      }}>
        {PHASE_STEPS.map((step, i) => {
          const count = counts[step] || 0
          const isActive = count > 0
          const isLast = i === PHASE_STEPS.length - 1
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: '1 1 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isActive ? '#10224A' : 'rgba(5,10,68,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isActive ? '0 0 0 3px rgba(42,118,244,0.20)' : 'none',
                }}>
                  {isActive && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{count}</span>
                  )}
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#10224A' : 'rgba(5,10,68,0.40)',
                  textAlign: 'center', whiteSpace: 'nowrap',
                }}>
                  {step}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: isActive ? '#10224A' : 'rgba(5,10,68,0.35)' }}>
                  {count}
                </span>
              </div>
              {!isLast && (
                <div style={{ flex: '0 0 24px', height: '1.5px', background: 'rgba(5,10,68,0.15)', marginBottom: '24px' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Key personnel table ────────────────────────────────────────────────────────
function PersonnelTable({ personnel, recentChanges }: { personnel: any[]; recentChanges?: any[] }) {
  const hasRoster  = personnel?.length > 0
  const hasChanges = recentChanges?.length > 0
  if (!hasRoster && !hasChanges) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {hasRoster && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.45)' }}>
              Key Personnel
            </p>
            <SourceBadge label="Illustrative · manual curation" />
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(210,226,255,1)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 1fr', padding: '8px 16px', background: 'rgba(5,10,68,0.03)', borderBottom: '1px solid rgba(5,10,68,0.08)' }}>
              {['Name', 'Title', 'Tenure', 'Notable Background'].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)' }}>{h}</span>
              ))}
            </div>
            {personnel.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 1fr', gap: '8px', alignItems: 'center', padding: '12px 16px', borderBottom: i < personnel.length - 1 ? '1px solid rgba(5,10,68,0.05)' : 'none' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)', fontFamily: 'Satoshi, sans-serif' }}>{p.name}</span>
                <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.65)' }}>{p.title}</span>
                <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.50)' }}>{p.tenure}</span>
                <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.55)', fontStyle: 'italic' }}>{p.background}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasChanges && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.45)' }}>
              Recent Leadership Changes
            </p>
            <SourceBadge live label="Live · SEC EDGAR" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentChanges!.map((c, i) => (
              <div key={i} style={{ background: '#FFFFFF', border: '1px solid rgba(210,226,255,1)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.80)', lineHeight: '1.4', flex: 1 }}>{c.headline}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {c.date && <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>{formatDateAbs(c.date)}</span>}
                  {c.sourceUrl && (
                    <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'rgba(5,10,68,0.35)' }}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SWOT ───────────────────────────────────────────────────────────────────────
const SWOT_CFG = {
  strengths:     { label: 'Strengths',     bg: 'rgba(42,118,244,0.15)',  labelColor: '#2A76F4',  bullet: '#2A76F4'  },
  weaknesses:    { label: 'Weaknesses',    bg: 'rgba(251,101,20,0.15)',  labelColor: '#FB6514',  bullet: '#FB6514'  },
  opportunities: { label: 'Opportunities', bg: 'rgba(67,76,91,0.16)',    labelColor: '#434C5B',  bullet: '#434C5B'  },
  threats:       { label: 'Threats',       bg: 'rgba(183,63,84,0.15)',   labelColor: '#B73F54',  bullet: '#B73F54'  },
}

function SwotGrid({ swot }: { swot: any }) {
  if (!swot) return null
  const quadrants = ['strengths', 'weaknesses', 'opportunities', 'threats'] as const
  return (
    <div>
      <SectionHeader label="SWOT" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {quadrants.map(key => {
          const cfg = SWOT_CFG[key]
          const items: string[] = swot[key] || []
          return (
            <div key={key} style={{ background: cfg.bg, borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: cfg.labelColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {cfg.label}
              </p>
              <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ marginTop: '8px', width: '4px', height: '4px', borderRadius: '50%', background: cfg.bullet, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#434c5b', lineHeight: '1.55', fontFamily: 'Satoshi, sans-serif' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <SourceBadge label="Analyst-reviewed · Quarterly update" />
      </div>
    </div>
  )
}

// ── Signal card (recent signals) ───────────────────────────────────────────────
function SignalCard({ date, headline, whyItMatters, note, _live, sourceUrl }: any) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(210,226,255,1)',
      padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)', lineHeight: '1.4' }}>{headline}</p>
          {_live && <SourceBadge live label="Live · SEC EDGAR" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {date && <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)', whiteSpace: 'nowrap', marginTop: '2px' }}>{formatDateAbs(date)}</span>}
          {_live && sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'rgba(5,10,68,0.35)', marginTop: '2px' }}>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
      {whyItMatters && (
        <div style={{ background: 'rgba(42,118,244,0.08)', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#434c5b', lineHeight: '1.55' }}>
            <strong style={{ fontWeight: 600 }}>Why it matters — </strong>{whyItMatters}
          </p>
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

function QuoteCard({ date, source, quote, whyItMatters }: any) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(210,226,255,1)', padding: '16px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '14px', fontStyle: 'italic', lineHeight: '1.55', color: 'rgba(5,10,68,0.80)', borderLeft: '3px solid rgba(210,226,255,1)', paddingLeft: '12px' }}>
        &ldquo;{quote}&rdquo;
      </p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: whyItMatters ? '10px' : 0 }}>
        {source && <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>{source}</span>}
        {date && <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.35)' }}>· {formatDateAbs(date)}</span>}
      </div>
      {whyItMatters && (
        <div style={{ background: 'rgba(42,118,244,0.08)', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#434c5b', lineHeight: '1.55' }}>
            <strong style={{ fontWeight: 600 }}>Why it matters — </strong>{whyItMatters}
          </p>
        </div>
      )}
    </div>
  )
}

function SignalSection({ icon: Icon, label, children, empty }: any) {
  return (
    <div>
      <SectionHeader icon={Icon} label={label} />
      {empty
        ? <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'rgba(5,10,68,0.35)', fontStyle: 'italic' }}>No {label.toLowerCase()} recorded.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
      }
    </div>
  )
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function CompanyTab({ competitor }: { competitor: any }) {
  const signals = (competitor.strategicSignals || {}) as any
  const { deals = [], hiring = [], publicStatements = [], strategyShifts = [] } = signals

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── Company snapshot card ─────────────────────────────────────────── */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex', flexDirection: 'column', gap: '28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={16} color="rgba(5,10,68,0.55)" strokeWidth={1.8} />
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.80)', fontFamily: 'Satoshi, sans-serif' }}>
            Company snapshot
          </h2>
        </div>

        <FinancialsSection financials={(competitor as any).financials} />
        <PipelineSummary pipeline={competitor.pipeline || []} />
        <PersonnelTable personnel={competitor.keyPersonnel || []} recentChanges={(competitor as any).recentPersonnelChanges} />
        <PaidGate label="SWOT Analysis" />
      </div>

      {/* ── Recent signals ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Recent signals
        </h2>

        <SignalSection icon={Handshake} label="Deals & Partnerships" empty={!deals.length}>
          {deals.map((d: any, i: number) => (
            <SignalCard key={i} date={d.date} headline={d.headline} whyItMatters={d.whyItMatters} _live={d._live} sourceUrl={d.sourceUrl} />
          ))}
        </SignalSection>

        <SignalSection icon={Users} label="Executive Changes" empty={!hiring.length}>
          {hiring.map((h: any, i: number) => (
            <SignalCard key={i} date={h.date} headline={h.headline} whyItMatters={h.whyItMatters} note={h.dataSourceNote} />
          ))}
        </SignalSection>

        <SignalSection icon={MessageSquareQuote} label="Public Statements" empty={!publicStatements.length}>
          {publicStatements.map((q: any, i: number) => (
            <QuoteCard key={i} date={q.date} source={q.source} quote={q.quote} whyItMatters={q.whyItMatters} />
          ))}
        </SignalSection>

        <SignalSection icon={TrendingUp} label="Observed Strategy Shifts" empty={!strategyShifts.length}>
          {strategyShifts.map((s: any, i: number) => (
            <SignalCard key={i} date={s.date} headline={s.headline ?? s.observation} whyItMatters={s.whyItMatters} _live={s._live} sourceUrl={s.sourceUrl} />
          ))}
        </SignalSection>
      </div>

    </div>
  )
}
