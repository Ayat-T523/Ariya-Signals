/**
 * CompanyTabV1.tsx — restored Competitors Company tab for a REAL tracked V1
 * company (2026-08-25, "RESTORE COMPETITORS PAGES" checkpoint, report
 * sections 14-15). Company snapshot KPIs + Recent activity grouped by the
 * SAME normalized Signal taxonomy intelligenceFeedViews.ts already uses for
 * Intelligence Feed -- never a second categorization scheme.
 *
 * Deliberately omits Financials/R&D, Key Personnel, SWOT, hiring, and
 * partnership-prose sections the historical reference showed: no current V1
 * evidence genuinely supports any of them for a real tracked company (see
 * report section 15's own "do not fabricate company data" instruction).
 */
import { Building2 } from 'lucide-react'
import EmptyState from '../../ui/EmptyState'
import { SIGNAL_TYPE_LABELS, type LandscapeSignal, type LandscapeSignalType } from '../../../lib/api/landscapeSignals'
import { computeCompanyOverviewStats } from '../../../lib/competitorOverview'
import { formatDateAbs } from '../../../utils/formatDate'

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0, background: 'var(--white)', border: '1px solid var(--indigo-100)',
      borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-600)' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-900)' }}>
        {value}
      </span>
    </div>
  )
}

function SignalRow({ signal }: { signal: LandscapeSignal }) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--indigo-100)', borderRadius: 'var(--r-md)',
      padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>{signal.title}</p>
        {signal.assetName && <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-600)' }}>{signal.assetName}</p>}
      </div>
      <span style={{ flexShrink: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-600)', whiteSpace: 'nowrap' }}>
        {formatDateAbs(signal.occurredAt)}
      </span>
    </div>
  )
}

function SignalGroupSection({ label, signals }: { label: string; signals: LandscapeSignal[] }) {
  if (signals.length === 0) return null
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--ink-500)' }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {signals.map((s) => <SignalRow key={s.id} signal={s} />)}
      </div>
    </div>
  )
}

// Mirrors intelligenceFeedViews.ts's own EVENT/MARKET_DEVELOPMENT taxonomy --
// never a new, competing categorization scheme for the same Signal universe.
const GROUPS: { label: string; types: Set<LandscapeSignalType> }[] = [
  { label: 'Deals & partnerships', types: new Set(['PARTNERSHIP_OR_LICENSE', 'ACQUISITION_OR_MERGER']) },
  { label: 'Regulatory activity', types: new Set(['REGULATORY_SUBMISSION', 'REGULATORY_ACCEPTANCE', 'REGULATORY_DECISION', 'REGULATORY_APPROVAL']) },
  { label: 'Clinical trial activity', types: new Set(['TRIAL_FIRST_POSTED', 'RESULTS_FIRST_POSTED', 'PRIMARY_COMPLETION_REACHED', 'TRIAL_COMPLETED', 'CLINICAL_TRIAL_STATUS_CHANGE', 'CLINICAL_TRIAL_PHASE_CHANGE', 'CLINICAL_TRIAL_COMPLETION_OR_TERMINATION', 'CLINICAL_RESULTS', 'CLINICAL_MILESTONE']) },
  { label: 'Corporate strategy', types: new Set(['CORPORATE_STRATEGY_CHANGE', 'PROGRAM_DISCONTINUATION', 'COMMERCIAL_LAUNCH']) },
]

export default function CompanyTabV1({ companyName, signals, diseaseAreaLabel }: {
  companyName: string
  signals: LandscapeSignal[]
  diseaseAreaLabel: string
}) {
  const stats = computeCompanyOverviewStats(signals)
  const sourceTypes = Array.from(new Set(signals.map((s) => s.sourceType).filter(Boolean)))
  const grouped = GROUPS.map((g) => ({ ...g, signals: signals.filter((s) => g.types.has(s.signalType)) }))
  const groupedTypes = new Set(GROUPS.flatMap((g) => Array.from(g.types)))
  const otherSignals = signals.filter((s) => !groupedTypes.has(s.signalType))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ background: 'var(--white)', border: '1px solid var(--indigo-100)', borderRadius: 'var(--r-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={16} color="var(--ink-600)" strokeWidth={1.8} />
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink-800)' }}>
            Company snapshot
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label={`Tracked assets in ${diseaseAreaLabel}`} value={String(stats.assetCount)} />
          <KpiCard label="Signals" value={String(stats.signalCount)} />
          <KpiCard label="Latest signal" value={stats.lastSignalAt ? formatDateAbs(stats.lastSignalAt) : '—'} />
          <KpiCard label="Source coverage" value={sourceTypes.length > 0 ? String(sourceTypes.length) : '—'} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--ink-900)' }}>
          Recent activity
        </h2>
        {signals.length === 0 ? (
          <EmptyState message={`No source-backed Signals recorded yet for ${companyName}.`} />
        ) : (
          <>
            {grouped.map((g) => <SignalGroupSection key={g.label} label={g.label} signals={g.signals} />)}
            <SignalGroupSection label="Other" signals={otherSignals} />
          </>
        )}
      </div>
    </div>
  )
}
