import CompetitorBadge from './CompetitorBadge'
import { SeverityTag, severityColor } from '../signals/primitives'
import { toSeverity } from '../../lib/signalRanking'
import { informationCategoryLabel, sourceTypeLabel, type LandscapeSignal } from '../../lib/api/landscapeSignals'
import { formatDateAbs } from '../../utils/formatDate'
import type { SignalEnrichmentResult } from '../../lib/api/signalEnrichment'

/**
 * LandscapeSignalRow — the ONE shared V1 Signal display row (2026-08-24),
 * used by both War Room's "What needs your attention" and Intelligence
 * Feed's chronological Events list. Deliberately does NOT reuse WarRoom's
 * own WorklistRow/MappedAlert pipeline (legacy Signal shape, keyed to a
 * Supabase `company_signals` row and its own accordion/triage/handling-
 * state machinery) -- this renders a LandscapeSignal directly, so
 * companyName/assetName/importance/sourceLocator are always the REAL
 * canonical fields, never adapted through a shape built for different data.
 *
 * TRIAGE CARD CONTRACT (2026-08-26 checkpoint, report section 2; restyled
 * 2026-08-26 to match the "Top signals to triage" reference screenshot):
 * every card shows company (never truncated -- report section 1, 2026-08-27
 * third pass: a real company name like "Immunovant, Inc." was previously
 * clipped by a 140px CSS max-width, removed), information category,
 * priority, source, absolute date, headline, and a summary -- all derived
 * from real Signal data (informationCategoryLabel()/sourceTypeLabel() are
 * deterministic presentation mappings, never fabricated content).
 *
 * AI ENRICHMENT (Intelligence Feed repair, 2026-08-27 third pass, report
 * section 1): `enrichment` is optional, server-computed (Groq -> Gemini,
 * see intelligence_signal_enrichment.py), and never generated in this
 * component or anywhere else in React. When `enrichment?.status === 'ok'`,
 * the AI headline replaces the deterministic `signal.title` and an "AI
 * Summary"/"Why this is related" pair renders below it -- both grounded in,
 * and validated server-side against, this exact Signal's own factual
 * fields (see that module's validate_enrichment()). When enrichment is
 * absent (not yet fetched) or `status === 'unavailable'`, the factual
 * `signal.title`/`signal.description` render exactly as before -- the
 * Signal itself is NEVER hidden or blocked on enrichment succeeding.
 */
export default function LandscapeSignalRow({
  signal, enrichment, dateStatus,
}: {
  signal: LandscapeSignal
  /** Server-computed AI enrichment for this exact Signal, keyed by the
   *  caller to signal.evidenceId. Optional -- omit while enrichment is
   *  still loading, or for a caller that hasn't wired enrichment at all. */
  enrichment?: SignalEnrichmentResult
  /** Intelligence Feed repair (report section 3, "stop splitting past vs
   *  future"): an explicit "Actual"/"Estimated" marker for a unified
   *  Events list that mixes real historical Signals (always "Actual" --
   *  a Signal is by definition an already-occurred fact) with real future
   *  estimated milestones. Omitted by callers (e.g. Market Developments)
   *  that don't mix temporal kinds and don't need the marker. */
  dateStatus?: 'actual' | 'estimated'
}) {
  const severity = toSeverity(signal.importance)
  const displayName = signal.companyName ?? signal.companyId
  const category = informationCategoryLabel(signal.signalType)
  const source = sourceTypeLabel(signal.sourceType)
  const enriched = enrichment?.status === 'ok'
  const headline = enriched && enrichment.headline ? enrichment.headline : signal.title
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
        {dateStatus && (
          <span className={`worklist-row-datestatus worklist-row-datestatus-${dateStatus}`}>
            {dateStatus === 'actual' ? 'Actual' : 'Estimated'}
          </span>
        )}
        <SeverityTag sev={severity} />
        <span className="worklist-row-time" title={formatDateAbs(signal.occurredAt)}>{formatDateAbs(signal.occurredAt)}</span>
      </div>
      <p className="worklist-row-headline">
        {headline}
        {signal.assetName && <span style={{ color: 'var(--neutral-600)', fontWeight: 400 }}> · {signal.assetName}</span>}
      </p>
      {enriched ? (
        <>
          {enrichment.summary && (
            <div className="worklist-row-ai-block">
              <p className="worklist-row-ai-label">AI Summary</p>
              <p className="worklist-row-ai-text">{enrichment.summary}</p>
            </div>
          )}
          {enrichment.why_related && (
            <div className="worklist-row-ai-block">
              <p className="worklist-row-ai-label">Why this is related</p>
              <p className="worklist-row-ai-text">{enrichment.why_related}</p>
            </div>
          )}
        </>
      ) : (
        <>
          {signal.description && <p className="worklist-row-summary">{signal.description}</p>}
          {enrichment?.status === 'unavailable' && (
            <p className="worklist-row-ai-unavailable">AI insight unavailable for this signal</p>
          )}
        </>
      )}
      <div className="worklist-row-meta">
        <a href={signal.sourceLocator} target="_blank" rel="noreferrer" className="worklist-row-source-link" title={source}>
          {source}
        </a>
      </div>
    </div>
  )
}
