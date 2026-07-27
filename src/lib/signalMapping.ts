import type { DbRecentSignal } from './db'

// ── UI alert shape consumed by AlertCard ──────────────────────────────────────

export interface MappedAlert {
  id: string
  timestamp: string
  competitorId: string
  type: string
  severity: 'high' | 'medium' | 'low'
  headline: string
  whatHappened: string | null
  whyItMatters: string | null
  suggestedAction: string | null
  source: string | null
  labelDiff: { previous: string | null; current: string } | null
}

// ── Vocab tables ──────────────────────────────────────────────────────────────

// DB signal_type → hyphenated UI key used by TYPE_CONFIG in AlertsPage
const SIGNAL_TYPE_MAP: Record<string, string> = {
  trial_update:        'trial-update',
  trial_status_change: 'trial-update',
  label_update:        'label-change',
  exec_change:         'exec-move',
  deal:                'deal',
  press_release:       'publication',
  publication:         'publication',
  hta_decision:        'regulatory',
  earnings:            'earnings',
  ir_rss:              'publication',
  messaging_shift:     'strategic-shift',   // Phase 5: product-page messaging drift
}

// Severity derived from signal_type — company_signals has no severity column.
// 'critical' intentionally omitted: it exists in SEVERITY_RANK for future use
// (manual escalation or a dedicated column) but no current signal_type maps to it.
const SIGNAL_SEVERITY_MAP: Record<string, 'high' | 'medium' | 'low'> = {
  exec_change:         'high',
  label_update:        'high',
  deal:                'medium',
  hta_decision:        'medium',
  trial_update:        'medium',
  trial_status_change: 'medium',
  press_release:       'low',
  publication:         'low',
  ir_rss:              'low',
  earnings:            'low',
  messaging_shift:     'high',
}

// Human-readable source label shown in the alert footer
const SIGNAL_SOURCE_MAP: Record<string, string> = {
  trial_update:        'ClinicalTrials.gov',
  trial_status_change: 'ClinicalTrials.gov',
  label_update:        'openFDA',
  exec_change:         'SEC',
  deal:                'SEC',
  press_release:       'SEC',
  earnings:            'SEC EDGAR',
  publication:         'PubMed',
  hta_decision:        'HTA',
  ir_rss:              'Investor Relations',
  messaging_shift:     'Product website',
}

// ── Mapping function ──────────────────────────────────────────────────────────

export function mapSignal(s: DbRecentSignal): MappedAlert {
  // labelDiff is populated for signals that carry a body_excerpt describing
  // a change. previous is null because snapshots only store the content hash,
  // not the prior field values — the panel renders single-column in that case.
  const hasDiff =
    (s.signal_type === 'label_update' || s.signal_type === 'trial_update' || s.signal_type === 'trial_status_change') &&
    !!s.body_excerpt

  return {
    id:           s.id,
    timestamp:    s.date ? `${s.date}T00:00:00Z` : new Date().toISOString(),
    competitorId: s.competitor_id,
    type:         SIGNAL_TYPE_MAP[s.signal_type] ?? s.signal_type,
    severity:     SIGNAL_SEVERITY_MAP[s.signal_type] ?? 'low',
    // clean_headline is the synthesized title (never a filename); s.headline is the
    // deterministically-normalized fallback from ingestion. accession_number is a raw
    // filing ID and must never render as a headline.
    headline:     s.clean_headline ?? s.headline ?? 'Untitled signal',
    // what_changed is the synthesized neutral summary. body_excerpt is raw source text —
    // it stays out of the primary summary and is only surfaced via labelDiff below,
    // which the UI already treats as an opt-in "inspect the change" affordance.
    whatHappened: s.what_changed ?? null,
    whyItMatters: s.why_it_matters ?? null,
    // AI-synthesized, asset-aware, cached at ingestion (war-room-redesign-spec.md
    // §4) — never derived client-side, never a generic fallback when absent.
    suggestedAction: s.suggested_action ?? null,
    source:       SIGNAL_SOURCE_MAP[s.signal_type] ?? null,
    labelDiff:    hasDiff ? { previous: null, current: s.body_excerpt! } : null,
  }
}

export function mapSignals(signals: DbRecentSignal[]): MappedAlert[] {
  return signals.map(mapSignal)
}
