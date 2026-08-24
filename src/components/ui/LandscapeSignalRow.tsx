import CompetitorBadge from './CompetitorBadge'
import { SeverityDot, severityLabel, severityText } from '../inform/primitives'
import { toSeverity } from '../../lib/signalRanking'
import { SIGNAL_TYPE_LABELS, type LandscapeSignal } from '../../lib/api/landscapeSignals'

function relTimeShort(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const diffH = Math.round(diffMs / 3_600_000)
  if (diffH < 1) return 'now'
  if (diffH < 24) return `${diffH}h`
  return `${Math.round(diffH / 24)}d`
}

/**
 * LandscapeSignalRow — the ONE shared V1 Signal display row (2026-08-24),
 * used by both War Room's "What needs your attention" and Intelligence
 * Feed's chronological Signal list. Deliberately does NOT reuse WarRoom's
 * own WorklistRow/MappedAlert pipeline (legacy Signal shape, keyed to a
 * Supabase `company_signals` row and its own accordion/triage/handling-
 * state machinery) -- this renders a LandscapeSignal directly, so
 * companyName/assetName/importance/sourceLocator are always the REAL
 * canonical fields, never adapted through a shape built for different data.
 *
 * Factual only: title/description are exactly what signals.py generated
 * from real evidence (see that module's own module docstring) -- this
 * component adds no interpretation, no "why it matters", no suggested
 * action.
 */
export default function LandscapeSignalRow({ signal }: { signal: LandscapeSignal }) {
  const severity = toSeverity(signal.importance)
  const displayName = signal.companyName ?? signal.companyId
  return (
    <div className="worklist-row">
      <div className="worklist-row-top">
        <span className="worklist-row-sev" style={{ color: severityText(severity) }}>
          <SeverityDot sev={severity} /> {severityLabel(severity)}
        </span>
        <div className="worklist-row-competitor" title={displayName}>
          <CompetitorBadge name={displayName} id={signal.companyId} size={18} />
          <span className="name">{displayName}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--t-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
          {SIGNAL_TYPE_LABELS[signal.signalType]}
        </span>
        <span className="worklist-row-time">{relTimeShort(signal.occurredAt)}</span>
      </div>
      <p className="worklist-row-headline">
        {signal.title}
        {signal.assetName && <span style={{ color: 'var(--neutral-600)', fontWeight: 400 }}> · {signal.assetName}</span>}
      </p>
      <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--neutral-600)' }}>
        {signal.description}{' '}
        <a href={signal.sourceLocator} target="_blank" rel="noreferrer" style={{ color: 'var(--indigo-600)', textDecoration: 'none' }}>
          Source
        </a>
      </p>
    </div>
  )
}
