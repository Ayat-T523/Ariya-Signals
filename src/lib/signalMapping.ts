import type { DbRecentSignal } from './db'
import { importanceBand, bandToLegacyTier } from './deterministic/importance'

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

// Severity is the D11 importance tier (§4.2) — company_signals has no severity
// column, and the previous hand-assigned signal_type→severity map disagreed with
// the score (it rated exec_change 'high' and deal 'medium'; the arc weighting
// ranks personnel lowest and deal in the top band). One source of truth now.

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
    severity:     bandToLegacyTier(importanceBand(s, { today: new Date() })),
    headline:     s.headline ?? s.accession_number,
    whatHappened: s.body_excerpt ?? null,
    whyItMatters: null, // §4-1: no auto-generated interpretation in the free tier
    source:       SIGNAL_SOURCE_MAP[s.signal_type] ?? null,
    labelDiff:    hasDiff ? { previous: null, current: s.body_excerpt! } : null,
  }
}

export function mapSignals(signals: DbRecentSignal[]): MappedAlert[] {
  return signals.map(mapSignal)
}
