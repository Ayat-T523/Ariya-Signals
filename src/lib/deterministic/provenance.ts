/**
 * Provenance data contract — §4.7.
 *
 * `[LOCKED]` Every signal carries provenance that must exist in the data and
 * appear on every rendering of that signal: **source name, last-refresh date, and
 * attribution tier**. The persona does not trust intelligence they cannot trace,
 * so a signal missing provenance is a DATA DEFECT, not a display choice.
 *
 * All three are derived from columns that are 100% populated (data_source,
 * source_url, created_at) or from signal_type via the §4.1 inventory. Nothing
 * here is guessed: an unknown source or type yields null and the caller shows an
 * honest gap rather than a plausible label.
 */

/** Attribution tier, per the §4.1 signal inventory. */
export type AttributionTier = 'tier1' | 'tier3' | 'corporate'

/**
 * Tier by signal_type (§4.1).
 *
 *   Tier 1   — structured or known identity; the key is native to the source or
 *              persisted at ingest. Exact, no guessing.
 *   Tier 3   — identity derived by lexicon or linkage match. Guarded, with an
 *              honest competitor-level fallback.
 *   corporate — no asset by nature; lives in the Corporate bucket.
 */
const TIER_BY_TYPE: Record<string, AttributionTier> = {
  publication:         'tier1',
  hta_decision:        'tier1',
  congress_abstract:   'tier1',
  regulatory_catalyst: 'tier1',
  trial_update:        'tier1',
  exclusivity_listing: 'tier1',
  press_release:       'tier3',
  deal:                'tier3',
  patent_grant:        'tier3',
  ip_litigation:       'tier3',
  exec_change:         'corporate',
}

/** Tier for a signal_type, or null when the type is unknown (never guessed). */
export function tierOf(signalType: string | null | undefined): AttributionTier | null {
  if (!signalType) return null
  return TIER_BY_TYPE[signalType] ?? null
}

/** Short label and plain-language meaning for a tier. Reader-facing, no jargon. */
export const TIER_LABEL: Record<AttributionTier, { short: string; meaning: string }> = {
  tier1: {
    short: 'Exact',
    meaning: 'Exact match — the drug identity came from the source itself',
  },
  tier3: {
    short: 'Name match',
    meaning: 'Matched by name — the drug was identified from the text of the announcement',
  },
  corporate: {
    short: 'Company',
    meaning: 'Company-level — this event names no drug',
  },
}

/**
 * Human source name by data_source. data_source is 100% populated and is the
 * authoritative record of which pipeline wrote the row, so it is preferred over
 * guessing from the URL.
 */
const SOURCE_NAME: Record<string, string> = {
  sec_edgar:          'SEC EDGAR',
  pubmed:             'PubMed',
  eu_hta_firecrawl:   'EMA / EU HTA',
  nice_hta:           'NICE',
  ir_rss:             'Company IR',
  ir_firecrawl:       'Company IR',
  takeda_firecrawl:   'Company newsroom',
  csl_firecrawl:      'Company newsroom',
  congress_firecrawl: 'Congress programme',
  congress_pdf:       'Congress abstract book',
  federal_register:   'Federal Register',
  fda_labels:         'FDA label',
}

/** Source name for a data_source value, or null when unmapped (never guessed). */
export function sourceNameOf(dataSource: string | null | undefined): string | null {
  if (!dataSource) return null
  return SOURCE_NAME[dataSource] ?? null
}

/** Minimum shape provenance needs. */
export interface ProvenanceBearing {
  signal_type?: string | null
  data_source?: string | null
  source_url?: string | null
  /** Row insert time — when this signal was last pulled from its source. */
  created_at?: string | null
  /** The event's own date. Distinct from lastRefreshed; both are shown. */
  date?: string | null
}

export interface Provenance {
  sourceName: string | null
  sourceUrl: string | null
  /** When the record was last taken from the source. */
  lastRefreshed: string | null
  /** When the event itself happened. */
  eventDate: string | null
  tier: AttributionTier | null
  /**
   * True when any required element is missing. §4.7 treats that as a data defect,
   * so the UI should surface the gap rather than quietly render a partial chip.
   */
  incomplete: boolean
  /** Which required elements are missing, for auditing. */
  missing: string[]
}

/**
 * Assemble the provenance contract for one signal.
 *
 * Note lastRefreshed and eventDate are deliberately separate. "Last refreshed" is
 * when we last took the record from its source; the event date is when the thing
 * happened. Conflating them would misrepresent freshness.
 */
export function provenanceOf(s: ProvenanceBearing): Provenance {
  const sourceName = sourceNameOf(s.data_source)
  const tier = tierOf(s.signal_type)
  const missing: string[] = []
  if (!sourceName) missing.push('source name')
  if (!s.created_at) missing.push('last-refresh date')
  if (!tier) missing.push('attribution tier')
  return {
    sourceName,
    sourceUrl: s.source_url ?? null,
    lastRefreshed: s.created_at ?? null,
    eventDate: s.date ?? null,
    tier,
    incomplete: missing.length > 0,
    missing,
  }
}
