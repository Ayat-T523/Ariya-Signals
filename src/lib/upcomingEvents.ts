/**
 * upcomingEvents.ts — Upcoming Events V1 semantic-integrity extraction
 * (War Room checkpoint, 2026-08-25).
 *
 * Extracted from WarRoom.tsx's own previously-inline computation so the
 * V1/legacy branch can be independently unit-tested (this repo's own
 * convention: pure lib/ functions + a dedicated .test.ts, no DOM testing
 * library -- see signalRanking.ts/.test.ts).
 *
 * PRODUCT BOUNDARY (do not violate): for `hasActiveLandscape=true`, this
 * module NEVER merges the static `eventsData` fixture at all -- that
 * fixture depends on Company PR ("company-ir"/"company-ir-aggregate"),
 * SEC ("sec-edgar"), congress ("official-congress"), and one explicitly
 * fictional ("illustrative") sourceType, none of which are real V1
 * factual sources (ClinicalTrials.gov/FDA/EMA only). Live sources are
 * `regulatory_calendar` (EMA calendar entries -- `isRelevantEMAEvent()` is
 * the SAME existing deterministic disease/indication relation (lexicon
 * inns/ta_terms match) already used before this checkpoint) and, as of
 * report section 7-9, real future ESTIMATED CT.gov Primary/Study
 * Completion milestones (already scoped server-side to the tracked
 * companies + disease by query_upcoming_ctgov_milestones() -- this module
 * does not re-filter them, only maps + merges + sorts + caps).
 *
 * Legacy (`hasActiveLandscape=false`) behavior is preserved byte-for-byte
 * (same merge, same per-entry landscape-gating rule for static events).
 */
import type { DbRegulatoryCalendarEvent } from './db'
import type { CtgovUpcomingMilestone } from './api/upcomingMilestones'

export interface Lexicon {
  inns: string[]
  ta_terms: string[]
}

export interface NextUpEvent {
  id: string
  date: string
  title: string
  sourceUrl?: string | null
  /** Visible provenance label (e.g. "EMA") -- restores the source-
   *  transparency principle the earlier implementation had and the
   *  current carousel card had silently dropped (recon finding). Absent
   *  for legacy static entries, matching prior behavior. */
  sourceLabel?: string
}

export interface StaticEventFixture {
  id: string
  date: string
  title: string
  sourceUrl?: string | null
  attendingCompetitors?: string[]
}

const ALLOWED_EMA_EVENT_TYPES = new Set(['CHMP', 'PRAC', 'OTHER'])

/** Unchanged from the pre-checkpoint implementation -- the one existing
 *  deterministic relation available for an EMA calendar row (no
 *  company/asset foreign key exists on `regulatory_calendar` at all; see
 *  this checkpoint's own recon). CHMP/PRAC plenary sessions always pass
 *  (their titles never name individual drugs); an OTHER event must name
 *  a tracked INN or therapeutic-area term. */
export function isRelevantEMAEvent(e: DbRegulatoryCalendarEvent, lexicon: Lexicon): boolean {
  if (!ALLOWED_EMA_EVENT_TYPES.has(e.event_type)) return false
  if (e.event_type === 'CHMP' || e.event_type === 'PRAC') return true
  const title = (e.title ?? '').toLowerCase()
  return (
    lexicon.inns.some((t) => title.includes(t.toLowerCase())) ||
    lexicon.ta_terms.some((t) => title.includes(t.toLowerCase()))
  )
}

function buildLiveEventItems(calendarEvents: DbRegulatoryCalendarEvent[], lexicon: Lexicon, nowStr: string): NextUpEvent[] {
  return calendarEvents
    .filter((e) => e.start_date !== null && (e.start_date as string) >= nowStr)
    .filter((e) => isRelevantEMAEvent(e, lexicon))
    // A bare "HH:MM" string is a real, observed EMA title-extraction
    // artifact (a page-layout miss), never a real event title -- unchanged
    // guard from the pre-checkpoint implementation.
    .filter((e) => !/^\d{1,2}:\d{2}$/.test(e.title ?? ''))
    .map((e) => ({
      id: e.id, date: e.start_date ?? '', title: e.title ?? `${e.event_type} Meeting`,
      sourceUrl: e.source_url, sourceLabel: 'EMA',
    }))
}

const CTGOV_MILESTONE_LABEL: Record<CtgovUpcomingMilestone['milestoneType'], string> = {
  PRIMARY_COMPLETION: 'Primary completion',
  STUDY_COMPLETION: 'Study completion',
  PRIMARY_AND_STUDY_COMPLETION: 'Trial completion',
}

/** query_upcoming_ctgov_milestones() has ALREADY scoped these to the real
 *  tracked companies + disease server-side (report section 7-9) -- this is
 *  a pure shape mapping, not a second filter. `nowStr`/future-only and
 *  ESTIMATED-only are backend guarantees, not re-checked here. The
 *  '(estimated)' qualifier is never dropped: unlike an EMA calendar entry
 *  (a fixed date), this is a sponsor's own projection. */
function buildCtgovMilestoneItems(milestones: CtgovUpcomingMilestone[]): NextUpEvent[] {
  return milestones.map((m) => ({
    // FIX (Intelligence Feed checkpoint, 2026-08-25 recon): a single NCT
    // trial can enroll multiple distinct assets/arms (live-observed:
    // NCT07465653 -> both "HJB647 high dose" and "HJB647 low dose"), each
    // producing its own milestone row -- `nctId` alone collided into a
    // duplicate React key. `assetId` is always distinct per row even when
    // `nctId` is shared.
    id: `ctgov-${m.nctId ?? m.assetId}-${m.assetId}-${m.milestoneType}`,
    date: m.date,
    title: `${m.assetName} — ${CTGOV_MILESTONE_LABEL[m.milestoneType]} (estimated)`,
    sourceUrl: m.sourceUrl,
    sourceLabel: 'ClinicalTrials.gov',
  }))
}

export interface BuildUpcomingEventsInput {
  hasActiveLandscape: boolean
  calendarEvents: DbRegulatoryCalendarEvent[]
  staticEvents: StaticEventFixture[]
  lexicon: Lexicon
  effectiveCompetitorIds: Set<string>
  nowStr: string
  maxItems?: number
  /** Real future ESTIMATED CT.gov milestones (report section 7-9) --
   *  omitted/empty for the legacy path, which never reads this source. */
  ctgovMilestones?: CtgovUpcomingMilestone[]
}

export function buildUpcomingEvents({
  hasActiveLandscape, calendarEvents, staticEvents, lexicon, effectiveCompetitorIds, nowStr, maxItems = 8, ctgovMilestones = [],
}: BuildUpcomingEventsInput): NextUpEvent[] {
  const liveEventItems = buildLiveEventItems(calendarEvents, lexicon, nowStr)

  if (hasActiveLandscape) {
    // V1: live EMA + live CT.gov milestones only. The static eventsData
    // fixture (Company PR/SEC/congress/illustrative) is NEVER read at all
    // for an active landscape -- not filtered down to zero, never even
    // merged in the first place.
    const milestoneItems = buildCtgovMilestoneItems(ctgovMilestones)
    return [...liveEventItems, ...milestoneItems].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, maxItems)
  }

  // Legacy path -- byte-for-byte the pre-checkpoint merge behavior.
  const liveTitles = new Set(liveEventItems.map((e) => e.title.toLowerCase()))
  const staticEventItems: NextUpEvent[] = staticEvents
    .filter((e) => new Date(e.date) >= new Date(nowStr))
    .filter((e) => !liveTitles.has((e.title ?? '').toLowerCase()))
    .filter((e) => {
      const comps = e.attendingCompetitors ?? []
      if (comps.length > 0) return comps.some((id) => effectiveCompetitorIds.has(id))
      return true // Legacy path only reaches here -- a companyless entry always shows, same as before this extraction.
    })
    .map((e) => ({ id: e.id, date: e.date, title: e.title, sourceUrl: e.sourceUrl }))

  return [...liveEventItems, ...staticEventItems]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, maxItems)
}
