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
 *
 * MULTI-SOURCE CONTRACT (War Room checkpoint, 2026-08-26): the product
 * intent behind "Upcoming Events" is broader than CT.gov + EMA alone --
 * future evidence-backed competitive catalysts from ClinicalTrials.gov,
 * EMA, Company IR, SEC EDGAR, and official congress sources. This pass
 * adds the normalized cross-source `eventType`/`datePrecision`/
 * `companyId`/`companyName` fields to the contract (all optional, so the
 * legacy branch and any future source can populate only what it honestly
 * knows) and maps the two currently-live sources onto them. It does NOT
 * add Company IR, SEC, or official-congress sources themselves --
 * recon this pass found none of the three has infrastructure that can
 * honestly produce a source-backed FUTURE event today:
 *   - Company IR / SEC: both flow through the shared Groq schema in
 *     company_pr_interpretation.py, whose prompt explicitly instructs the
 *     model to answer NOT_MATERIAL_EVENT/UNCLEAR (never persisted) for
 *     any forward-looking/planned statement -- there is no extraction
 *     path or storage for a future catalyst today.
 *   - Official congress: adapters/congress.py is a page-attribution
 *     adapter over exactly one seeded, already-PAST conference document
 *     (MGFA 2025), producing unpersisted candidate evidence keyed to the
 *     legacy CANONICAL_ENTITIES model -- not a live schedule/calendar of
 *     future presentations, and not referenced anywhere in api_server.py's
 *     hydration pipeline.
 * Building real support for any of the three requires new backend
 * extraction/persistence, not wiring -- out of scope for this pass per
 * this checkpoint's own "do not fake support, report absent" instruction.
 */
import type { DbRegulatoryCalendarEvent } from './db'
import type { CtgovUpcomingMilestone } from './api/upcomingMilestones'

export interface Lexicon {
  inns: string[]
  ta_terms: string[]
}

/** Normalized cross-source event taxonomy (checkpoint section 9) -- kept
 *  deliberately small and source-agnostic so a future source (Company IR,
 *  SEC, congress) can slot into an existing bucket rather than a codebase
 *  growing a new source-specific type per source. Only TRIAL_MILESTONE and
 *  REGULATORY_MEETING are populated today (the two live sources); the
 *  remaining members exist so the contract doesn't need to change shape
 *  again when a new source family is actually implemented. */
export type UpcomingEventType =
  | 'TRIAL_MILESTONE'
  | 'CLINICAL_READOUT'
  | 'REGULATORY_SUBMISSION'
  | 'REGULATORY_DECISION'
  | 'REGULATORY_MEETING'
  | 'CONGRESS_PRESENTATION'
  | 'COMMERCIAL_LAUNCH'
  | 'PARTNERSHIP_OR_TRANSACTION_MILESTONE'
  | 'PROGRAM_MILESTONE'

export const UPCOMING_EVENT_TYPE_LABELS: Record<UpcomingEventType, string> = {
  TRIAL_MILESTONE: 'Trial milestone',
  CLINICAL_READOUT: 'Clinical readout',
  REGULATORY_SUBMISSION: 'Regulatory submission',
  REGULATORY_DECISION: 'Regulatory decision',
  REGULATORY_MEETING: 'Regulatory meeting',
  CONGRESS_PRESENTATION: 'Congress presentation',
  COMMERCIAL_LAUNCH: 'Commercial launch',
  PARTNERSHIP_OR_TRANSACTION_MILESTONE: 'Partnership / transaction',
  PROGRAM_MILESTONE: 'Program milestone',
}

/** Source-stated date precision (checkpoint section 8) -- DAY for both
 *  live sources today (CT.gov gives an exact estimated date, the EMA
 *  calendar gives an exact scheduled date). Exists now so a future
 *  coarser-precision source (e.g. a Company IR "Q4 2026" catalyst) can be
 *  added without a contract change; `date` always stays a real ISO day
 *  string (a sort surrogate), never fabricated down from a coarser
 *  source-stated precision. */
export type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'HALF_YEAR'

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
  /** Normalized taxonomy bucket (see UpcomingEventType above). Absent for
   *  legacy static entries -- those predate this contract and are never
   *  reclassified retroactively. */
  eventType?: UpcomingEventType
  /** Source-stated precision of `date` (see DatePrecision above). */
  datePrecision?: DatePrecision
  /** Real company id/name when the source honestly carries one. EMA
   *  calendar rows have no company/asset foreign key (recon, unchanged
   *  finding) and so never populate these -- left undefined rather than
   *  guessed from title-matching. */
  companyId?: string
  companyName?: string
  /** Intelligence Feed repair (2026-08-27, report section 3): the most
   *  specific real, source-backed label for this event's own subtype --
   *  e.g. "Primary completion (estimated)"/"Study completion (estimated)"
   *  for a CT.gov milestone, "CHMP meeting"/"PRAC meeting" for an EMA
   *  committee session. Always at least as specific as
   *  UPCOMING_EVENT_TYPE_LABELS[eventType] -- never a fabricated subtype
   *  the source doesn't actually distinguish. Falls back to that coarser
   *  label when absent (e.g. a future source with no finer distinction).
   *  Bug fix: this distinction previously existed only inside the `title`
   *  string -- every UI consumer keyed off `eventType` instead (a single
   *  TRIAL_MILESTONE bucket for ALL CT.gov milestone subtypes), so Primary
   *  completion and Study completion both rendered as the generic
   *  "Milestone" badge despite the title text itself staying specific. */
  label?: string
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
      // CHMP/PRAC are literally regulatory-committee meetings; OTHER is an
      // undifferentiated EMA calendar catch-all with no finer sub-type
      // available in the row itself -- REGULATORY_MEETING is the honest,
      // conservative bucket for all three rather than guessing at
      // REGULATORY_DECISION without evidence.
      eventType: 'REGULATORY_MEETING' as const,
      // `event_type` (CHMP/PRAC/OTHER) is real source data already on the
      // row -- surfacing it as `label` costs nothing and is more specific
      // than the coarse eventType bucket, without inventing anything OTHER
      // doesn't actually have.
      label: e.event_type === 'CHMP' ? 'CHMP meeting' : e.event_type === 'PRAC' ? 'PRAC meeting' : 'Regulatory meeting',
      datePrecision: 'DAY' as const,
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
    eventType: 'TRIAL_MILESTONE' as const,
    // Bug fix (report section 3): this is the ONE place PRIMARY_COMPLETION/
    // STUDY_COMPLETION/PRIMARY_AND_STUDY_COMPLETION are actually
    // distinguished -- `eventType` alone collapses all three into a single
    // TRIAL_MILESTONE bucket, which is what produced the generic
    // "Milestone" label for every CT.gov row regardless of subtype.
    label: `${CTGOV_MILESTONE_LABEL[m.milestoneType]} (estimated)`,
    datePrecision: 'DAY' as const,
    companyId: m.companyId,
    companyName: m.companyName,
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
