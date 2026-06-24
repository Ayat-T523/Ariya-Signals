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
    headline:     s.headline ?? s.accession_number,
    whatHappened: s.body_excerpt ?? null,
    whyItMatters: s.why_it_matters ?? null,
    source:       SIGNAL_SOURCE_MAP[s.signal_type] ?? null,
    labelDiff:    hasDiff ? { previous: null, current: s.body_excerpt! } : null,
  }
}

export function mapSignals(signals: DbRecentSignal[]): MappedAlert[] {
  return signals.map(mapSignal)
}
