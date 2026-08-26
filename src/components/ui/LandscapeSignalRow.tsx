import CompetitorBadge from './CompetitorBadge'
import { SeverityTag, severityColor } from '../signals/primitives'
import { toSeverity } from '../../lib/signalRanking'
import { informationCategoryLabel, sourceTypeLabel, type LandscapeSignal } from '../../lib/api/landscapeSignals'
import { formatDateAbs } from '../../utils/formatDate'

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
 *
 * TRIAGE CARD CONTRACT (2026-08-26 checkpoint, report section 2): every
 * card shows company, information category, priority, source, date,
 * headline, and a 1-2 line summary -- the full required field set, all
 * derived from real Signal data (informationCategoryLabel()/
 * sourceTypeLabel() are deterministic presentation mappings, never
 * fabricated content; see landscapeSignals.ts's own docstrings for both).
 * Visual order: company + category (top line) -> headline -> summary
 * (line-clamped to 2 lines via .worklist-row-summary, never the headline)
 * -> priority/source/date metadata (bottom line). Ranking/top-N/importance
 * are unchanged -- this component only ever renders whatever slice its
 * caller already selected.
 */
export default function LandscapeSignalRow({ signal }: { signal: LandscapeSignal }) {
  const severity = toSeverity(signal.importance)
  const displayName = signal.companyName ?? signal.companyId
  const category = informationCategoryLabel(signal.signalType)
  const source = sourceTypeLabel(signal.sourceType)
  return (
    // Screenshot-authority pass (pre-freeze unit 2, 2026-08-26): the
    // reference product accents each row with a severity-colored left
    // border. SeverityTag (below, in the metadata line) supplies its own
    // dot+label+tint; this border reuses signals/primitives.tsx's own
    // severityColor(), the SAME color source SeverityTag itself reads from.
    <div className="worklist-row" style={{ borderLeft: `3px solid ${severityColor(severity)}` }}>
      <div className="worklist-row-top">
        <div className="worklist-row-competitor" title={displayName}>
          <CompetitorBadge name={displayName} id={signal.companyId} size={18} />
          <span className="name">{displayName}</span>
        </div>
        <span className="worklist-row-category" title={category}>{category}</span>
      </div>
      <p className="worklist-row-headline">
        {signal.title}
        {signal.assetName && <span style={{ color: 'var(--neutral-600)', fontWeight: 400 }}> · {signal.assetName}</span>}
      </p>
      {signal.description && <p className="worklist-row-summary">{signal.description}</p>}
      <div className="worklist-row-meta">
        <SeverityTag sev={severity} />
        <span className="worklist-row-source" title={source}>{source}</span>
        <span className="worklist-row-time" title={formatDateAbs(signal.occurredAt)}>{relTimeShort(signal.occurredAt)}</span>
        <a href={signal.sourceLocator} target="_blank" rel="noreferrer" className="worklist-row-source-link">
          Source
        </a>
      </div>
    </div>
  )
}
