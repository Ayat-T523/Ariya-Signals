/**
 * competitorOverview.ts — pure, deterministic factual-summary + overview-stat
 * helpers for the restored Competitors overview/profile (2026-08-25,
 * "RESTORE COMPETITORS PAGES" checkpoint, report sections 4/7).
 *
 * Every string here is a fixed template over real counts/dates already
 * fetched via fetchLandscapeSignals() -- never AI-generated prose, never a
 * new synthesis pipeline. See that checkpoint's report section 7 for the
 * exact acceptable-fallback wording this mirrors.
 */
import type { LandscapeSignal } from './api/landscapeSignals'
import { formatDateAbs } from '../utils/formatDate'

export interface CompanyOverviewStats {
  assetCount: number
  signalCount: number
  lastSignalAt: string | null
}

/**
 * `canonicalAssetCount`, when supplied (pre-freeze unit 1, 2026-08-25), is
 * the real canonical company+disease Pipeline asset count
 * (fetchLandscapeCanonicalAssets() -- see that client's own docstring for
 * why this is NOT the same thing as distinct assetIds appearing in
 * Signals: a canonical asset can legitimately have zero qualifying
 * Signals and must still count). When omitted, falls back to the prior
 * Signal-derived count -- ONLY for callers that have no canonical fetch of
 * their own (e.g. sort-key comparisons that only need lastSignalAt), never
 * as the source of truth for a rendered "Pipeline assets" count.
 */
export function computeCompanyOverviewStats(
  signals: LandscapeSignal[],
  canonicalAssetCount?: number,
): CompanyOverviewStats {
  const assetCount = canonicalAssetCount ?? new Set(
    signals.map((s) => s.assetId).filter((id): id is string => Boolean(id)),
  ).size
  let lastSignalAt: string | null = null
  for (const s of signals) {
    if (!lastSignalAt || s.occurredAt > lastSignalAt) lastSignalAt = s.occurredAt
  }
  return { assetCount, signalCount: signals.length, lastSignalAt }
}

/** Compact card-descriptor form: "4 tracked assets · 12 Signals · latest activity Aug 11, 2026" */
export function buildCompactCompanySummary(stats: CompanyOverviewStats): string {
  const { assetCount, signalCount, lastSignalAt } = stats
  const parts = [
    `${assetCount} tracked asset${assetCount === 1 ? '' : 's'}`,
    `${signalCount} Signal${signalCount === 1 ? '' : 's'}`,
  ]
  if (lastSignalAt) parts.push(`latest activity ${formatDateAbs(lastSignalAt)}`)
  return parts.join(' · ')
}

/** Full-sentence profile-summary-panel form. */
export function buildFactualCompanySummary(
  companyName: string,
  stats: CompanyOverviewStats,
  diseaseAreaLabel: string,
): string {
  const { assetCount, signalCount, lastSignalAt } = stats
  const assetPhrase = `${assetCount} tracked asset${assetCount === 1 ? '' : 's'}`
  if (signalCount === 0) {
    return `${companyName} has ${assetPhrase} and no source-backed Signals recorded yet in ${diseaseAreaLabel}.`
  }
  const signalPhrase = `${signalCount} qualifying Signal${signalCount === 1 ? '' : 's'}`
  const datePhrase = lastSignalAt ? ` Its latest activity was recorded on ${formatDateAbs(lastSignalAt)}.` : ''
  return `${companyName} has ${assetPhrase} and ${signalPhrase} in ${diseaseAreaLabel}.${datePhrase}`
}
