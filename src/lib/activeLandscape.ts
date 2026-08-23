/**
 * activeLandscape.ts — SETUP PROPAGATION seam.
 *
 * Bridges the new, company-rooted, backend-driven `trackedCompetitors`
 * (AppContext.tsx, written by completeSetup()) to the legacy competitor-id
 * namespace ('takeda', 'biocryst', ...) that War Room / Competitors /
 * Intelligence Feed's existing Supabase-backed signal/event/deal data is
 * still keyed by (see src/lib/db/index.ts's competitor_id columns).
 *
 * Deterministic, exact-normalized-name match only (reuses setup-draft.ts's
 * own normalizeCompanyName -- the same helper Home Asset company exclusion
 * already uses) -- never fuzzy/AI matching. A tracked competitor with no
 * legacy match simply has no live signal data available yet; that is an
 * honest reflection of the current dataset's HAE-only scope, not a gap this
 * module papers over.
 *
 * Deliberately does not touch AppContext's own watchedCompetitors state --
 * AlertsPage, AskModal, and PricingAndAccess still legitimately read it
 * directly and are out of scope for this task.
 */
import { normalizeCompanyName, type TrackedCompetitor } from '../config/setup-draft'

export interface LegacyCompetitorRef {
  id: string
  name: string
}

export interface ActiveLandscapeMatch {
  competitor: TrackedCompetitor
  /** The legacy static/live-data id this tracked competitor corresponds to, or null when no such profile exists. */
  legacyId: string | null
}

export function matchTrackedCompetitorsToLegacyIds(
  trackedCompetitors: TrackedCompetitor[],
  legacyCompetitors: LegacyCompetitorRef[],
): ActiveLandscapeMatch[] {
  return trackedCompetitors.map((competitor) => {
    const normalized = normalizeCompanyName(competitor.companyName)
    const found = legacyCompetitors.find(
      (c) => normalizeCompanyName(c.name) === normalized || normalizeCompanyName(c.id) === normalized,
    )
    return { competitor, legacyId: found ? found.id : null }
  })
}

/**
 * The effective competitor-id scope for War Room/Competitors/Intelligence
 * Feed's existing legacy signal/event/deal data.
 *
 * `trackedCompetitors.length === 0` means setup was never completed with the
 * new company-rooted flow -- callers should keep using watchedCompetitors
 * (the pre-existing behavior) rather than an empty active landscape. Once a
 * real landscape exists, it is authoritative: the legacy default
 * (['takeda','biocryst','pharvaris']) must never resurface just because
 * watchedCompetitors still holds it.
 */
export function activeLandscapeSignalScope(
  trackedCompetitors: TrackedCompetitor[],
  legacyCompetitors: LegacyCompetitorRef[],
): { hasActiveLandscape: boolean; legacyIds: Set<string>; matches: ActiveLandscapeMatch[] } {
  const hasActiveLandscape = trackedCompetitors.length > 0
  const matches = hasActiveLandscape ? matchTrackedCompetitorsToLegacyIds(trackedCompetitors, legacyCompetitors) : []
  const legacyIds = new Set(
    matches.map((m) => m.legacyId).filter((id): id is string => id !== null),
  )
  return { hasActiveLandscape, legacyIds, matches }
}

/**
 * Whether a legacy static item's free-text `parties` (e.g. market-
 * developments.json's `["BioCryst", "Astria Therapeutics"]`, display names,
 * NOT ids) names anyone currently in the active landscape scope. Same
 * deterministic, exact-normalized-name discipline as
 * matchTrackedCompetitorsToLegacyIds() above -- never fuzzy -- just applied
 * in the other direction: a raw display string normalized and compared
 * against each legacy competitor's own name/id, same as this module's own
 * matching already does.
 *
 * Mirrors events.json's `attendingCompetitors` (already legacy ids, so
 * checked directly against `effectiveCompetitorIds` at the call site with
 * no helper needed) -- `parties` is looser (display text, not always
 * present), which is exactly why this needs its own normalized lookup
 * rather than a plain Set.has().
 */
export function partyMatchesLegacyScope(
  parties: string[],
  legacyCompetitors: LegacyCompetitorRef[],
  effectiveCompetitorIds: Set<string>,
): boolean {
  return parties.some((party) => {
    const normalized = normalizeCompanyName(party)
    return legacyCompetitors.some(
      (c) => effectiveCompetitorIds.has(c.id)
        && (normalizeCompanyName(c.name) === normalized || normalizeCompanyName(c.id) === normalized),
    )
  })
}
