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
 * factual sources (ClinicalTrials.gov/FDA/EMA only). The only live source
 * available today is `regulatory_calendar` (EMA calendar entries) --
 * `isRelevantEMAEvent()` is the SAME existing deterministic
 * disease/indication relation (lexicon inns/ta_terms match) already used
 * before this checkpoint; this module does not invent a new one.
 *
 * Legacy (`hasActiveLandscape=false`) behavior is preserved byte-for-byte
 * (same merge, same per-entry landscape-gating rule for static events).
 */
import type { DbRegulatoryCalendarEvent } from './db'

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

export interface BuildUpcomingEventsInput {
  hasActiveLandscape: boolean
  calendarEvents: DbRegulatoryCalendarEvent[]
  staticEvents: StaticEventFixture[]
  lexicon: Lexicon
  effectiveCompetitorIds: Set<string>
  nowStr: string
  maxItems?: number
}

export function buildUpcomingEvents({
  hasActiveLandscape, calendarEvents, staticEvents, lexicon, effectiveCompetitorIds, nowStr, maxItems = 8,
}: BuildUpcomingEventsInput): NextUpEvent[] {
  const liveEventItems = buildLiveEventItems(calendarEvents, lexicon, nowStr)

  if (hasActiveLandscape) {
    // V1: live EMA only. The static eventsData fixture (Company PR/SEC/
    // congress/illustrative) is NEVER read at all for an active landscape
    // -- not filtered down to zero, never even merged in the first place.
    return [...liveEventItems].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, maxItems)
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
