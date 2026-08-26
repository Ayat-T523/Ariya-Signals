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
 * TRIAGE CARD CONTRACT (2026-08-26 checkpoint, report section 2; restyled
 * 2026-08-26 to match the "Top signals to triage" reference screenshot):
 * every card shows company, information category, priority, source, date,
 * headline, and a 1-2 line summary -- the full required field set, all
 * derived from real Signal data (informationCategoryLabel()/
 * sourceTypeLabel() are deterministic presentation mappings, never
 * fabricated content; see landscapeSignals.ts's own docstrings for both).
 * Visual order, matching the reference: company + category + priority +
 * date (top line) -> headline -> summary (line-clamped to 2 lines via
 * .worklist-row-summary, never the headline) -> source (bottom line,
 * right-aligned, still a real working link to signal.sourceLocator -- the
 * reference shows plain source text, but this app never drops a source's
 * own provenance link merely to match a static mockup). Deliberately no
 * "WHY" reasoning line: real Signal data has no such field, and inventing
 * one client-side would violate this component's own "factual only, no
 * fabricated interpretation" rule (see this component's own docstring
 * above) -- confirmed with the requester rather than assumed. Ranking/
 * top-N/importance are unchanged -- this component only ever renders
 * whatever slice its caller already selected.
 */
export default function LandscapeSignalRow({ signal }: { signal: LandscapeSignal }) {
  const severity = toSeverity(signal.importance)
  const displayName = signal.companyName ?? signal.companyId
  const category = informationCategoryLabel(signal.signalType)
  const source = sourceTypeLabel(signal.sourceType)
  return (
    // Screenshot-authority pass (pre-freeze unit 2, 2026-08-26): the
    // reference product accents each row with a severity-colored left
    // border, reusing signals/primitives.tsx's own severityColor() -- the
    // SAME color source SeverityTag (in the top line below) itself reads
    // from.
    <div className="worklist-row" style={{ borderLeft: `3px solid ${severityColor(severity)}` }}>
      <div className="worklist-row-top">
        <div className="worklist-row-competitor" title={displayName}>
          <CompetitorBadge name={displayName} id={signal.companyId} size={18} />
          <span className="name">{displayName}</span>
        </div>
        <span className="worklist-row-category" title={category}>{category}</span>
        <SeverityTag sev={severity} />
        <span className="worklist-row-time" title={formatDateAbs(signal.occurredAt)}>{relTimeShort(signal.occurredAt)}</span>
      </div>
      <p className="worklist-row-headline">
        {signal.title}
        {signal.assetName && <span style={{ color: 'var(--neutral-600)', fontWeight: 400 }}> · {signal.assetName}</span>}
      </p>
      {signal.description && <p className="worklist-row-summary">{signal.description}</p>}
      <div className="worklist-row-meta">
        <a href={signal.sourceLocator} target="_blank" rel="noreferrer" className="worklist-row-source-link" title={source}>
          {source}
        </a>
      </div>
    </div>
  )
}
