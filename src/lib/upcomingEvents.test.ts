/**
 * upcomingEvents.test.ts — Upcoming Events V1 semantic-integrity
 * extraction (War Room checkpoint, 2026-08-25); tests 21-24 added for the
 * Intelligence Feed repair (2026-08-27, report section 3).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/upcomingEvents.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { buildUpcomingEvents, isRelevantEMAEvent } from './upcomingEvents.js'
import type { DbRegulatoryCalendarEvent } from './db.js'
import type { CtgovUpcomingMilestone } from './api/upcomingMilestones.js'

let passed = 0
let failed = 0

function assert(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { console.log(`  ✓  ${label}`); passed++ }
  else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     received: ${JSON.stringify(actual)}`)
    failed++
  }
}

const LEXICON = { inns: ['efgartigimod'], ta_terms: ['myasthenia gravis'] }
const NOW = '2026-08-25'

function calEvent(overrides: Partial<DbRegulatoryCalendarEvent>): DbRegulatoryCalendarEvent {
  return {
    id: 'cal-1', event_type: 'CHMP', title: 'CHMP plenary', start_date: '2026-09-01', end_date: null,
    source_url: 'https://ema.europa.eu/x',
    ...overrides,
  } as DbRegulatoryCalendarEvent
}

const STATIC_ILLUSTRATIVE = { id: 'static-illustrative', date: '2026-09-10', title: 'Illustrative Investor Day', sourceUrl: null, attendingCompetitors: [] }
const STATIC_COMPANY_IR = { id: 'static-ir', date: '2026-09-15', title: 'Company IR Day', sourceUrl: null, attendingCompetitors: ['argenx'] }

console.log('1. Active V1 landscape never renders eventsData static fixtures at all')
const v1Result = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'live-1', start_date: '2026-09-01' })],
  staticEvents: [STATIC_ILLUSTRATIVE, STATIC_COMPANY_IR],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(['argenx']), nowStr: NOW,
})
assert('only the live event is present', v1Result.map((e) => e.id), ['live-1'])
assert('the illustrative fixture never appears', v1Result.some((e) => e.id === 'static-illustrative'), false)
assert('the Company IR fixture never appears', v1Result.some((e) => e.id === 'static-ir'), false)

console.log('2. Active V1: past live events are excluded')
const pastExcluded = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'past', start_date: '2026-01-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('past event excluded', pastExcluded, [])

console.log('3. Active V1: a live EMA event without proven landscape relevance is excluded')
const irrelevant = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'unrelated', event_type: 'OTHER', title: 'Unrelated oncology review', start_date: '2026-09-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('irrelevant OTHER event excluded', irrelevant, [])

console.log('4. Active V1: a live EMA event WITH proven landscape relevance (lexicon match) is included')
const relevant = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'relevant', event_type: 'OTHER', title: 'Efgartigimod review', start_date: '2026-09-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('relevant OTHER event included', relevant.map((e) => e.id), ['relevant'])

console.log('5. Active V1: rendered event carries provenance (sourceLabel)')
assert('sourceLabel is EMA', v1Result[0]?.sourceLabel, 'EMA')

console.log('6. isRelevantEMAEvent: CHMP/PRAC always pass regardless of title content')
assert('CHMP passes', isRelevantEMAEvent(calEvent({ event_type: 'CHMP', title: 'Anything at all' }), LEXICON), true)
assert('PRAC passes', isRelevantEMAEvent(calEvent({ event_type: 'PRAC', title: 'Anything at all' }), LEXICON), true)
assert('a disallowed event_type never passes', isRelevantEMAEvent(calEvent({ event_type: 'COMP', title: 'efgartigimod' }), LEXICON), false)

console.log('7. Legacy (hasActiveLandscape=false): static fixtures still merge in, unchanged')
const legacyResult = buildUpcomingEvents({
  hasActiveLandscape: false,
  calendarEvents: [calEvent({ id: 'live-1', start_date: '2026-09-01' })],
  staticEvents: [STATIC_COMPANY_IR],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(['argenx']), nowStr: NOW,
})
assert('legacy merges live + static', legacyResult.map((e) => e.id).sort(), ['live-1', 'static-ir'])

console.log('8. Legacy: a static event naming competitors only shows when one is in the effective landscape')
const legacyFiltered = buildUpcomingEvents({
  hasActiveLandscape: false,
  calendarEvents: [], staticEvents: [STATIC_COMPANY_IR],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(['someone-else']), nowStr: NOW,
})
assert('excluded when no attending competitor is tracked', legacyFiltered, [])

console.log('9. Legacy: a companyless static event always shows (matches pre-checkpoint behavior)')
const legacyCompanyless = buildUpcomingEvents({
  hasActiveLandscape: false,
  calendarEvents: [], staticEvents: [{ id: 'no-comp', date: '2026-09-10', title: 'General FDA Advisory', sourceUrl: null }],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('companyless legacy event shown', legacyCompanyless.map((e) => e.id), ['no-comp'])

console.log('10. Both paths still exclude past static events (date >= today)')
const pastStatic = buildUpcomingEvents({
  hasActiveLandscape: false,
  calendarEvents: [], staticEvents: [{ id: 'old-static', date: '2020-01-01', title: 'Old', sourceUrl: null }],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('past static excluded', pastStatic, [])

function milestone(overrides: Partial<CtgovUpcomingMilestone>): CtgovUpcomingMilestone {
  return {
    nctId: 'NCT00000001', assetId: 'lokelma', assetName: 'Lokelma', companyId: 'astrazeneca', companyName: 'AstraZeneca',
    milestoneType: 'PRIMARY_COMPLETION', date: '2026-09-24', dateType: 'ESTIMATED',
    sourceUrl: 'https://clinicaltrials.gov/study/NCT00000001',
    ...overrides,
  }
}

console.log('11. Active V1: a future ESTIMATED Primary Completion milestone is included')
const primaryIncluded = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({ milestoneType: 'PRIMARY_COMPLETION' })],
})
assert('primary completion milestone included', primaryIncluded.length, 1)
assert('title names the asset and milestone type', primaryIncluded[0].title, 'Lokelma — Primary completion (estimated)')
assert('provenance is preserved (sourceLabel)', primaryIncluded[0].sourceLabel, 'ClinicalTrials.gov')
assert('source URL (carries the NCT ID) is preserved', primaryIncluded[0].sourceUrl, 'https://clinicaltrials.gov/study/NCT00000001')

console.log('12. Active V1: a future ESTIMATED Study Completion milestone is included')
const studyIncluded = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({ milestoneType: 'STUDY_COMPLETION', nctId: 'NCT00000002' })],
})
assert('study completion milestone included', studyIncluded[0].title, 'Lokelma — Study completion (estimated)')

console.log('13. Active V1: a combined Primary+Study Completion milestone (same date) renders as one item')
const combined = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({ milestoneType: 'PRIMARY_AND_STUDY_COMPLETION' })],
})
assert('one item, not two', combined.length, 1)
assert('title reflects trial completion', combined[0].title, 'Lokelma — Trial completion (estimated)')

console.log('14. Active V1: EMA events and CT.gov milestones merge into one date-sorted, capped list')
const merged = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'ema-later', start_date: '2026-10-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({ date: '2026-09-01', nctId: 'NCT00000003' })],
  maxItems: 8,
})
assert('nearest-first ordering across both sources', merged.map((e) => e.id), ['ctgov-NCT00000003-lokelma-PRIMARY_COMPLETION', 'ema-later'])

console.log('14b. Active V1: two distinct assets on the SAME NCT trial never collide onto one React key')
const twoAssetsSameTrial = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [
    milestone({ nctId: 'NCT07465653', assetId: 'hjb647 high dose', assetName: 'HJB647 high dose' }),
    milestone({ nctId: 'NCT07465653', assetId: 'hjb647 low dose', assetName: 'HJB647 low dose' }),
  ],
})
assert('both items present', twoAssetsSameTrial.length, 2)
assert('ids are distinct', new Set(twoAssetsSameTrial.map((e) => e.id)).size, 2)

console.log('15. Active V1: static eventsData still never merges even when ctgovMilestones are present')
const stillNoStatic = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [STATIC_ILLUSTRATIVE],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({})],
})
assert('no static fixture id present', stillNoStatic.some((e) => e.id === 'static-illustrative'), false)

console.log('16. Legacy (hasActiveLandscape=false): ctgovMilestones are never read, even if supplied')
const legacyIgnoresMilestones = buildUpcomingEvents({
  hasActiveLandscape: false, calendarEvents: [], staticEvents: [],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({})],
})
assert('legacy path renders no CT.gov milestone items', legacyIgnoresMilestones, [])

console.log('17. Multi-source contract (2026-08-26): CT.gov milestone carries normalized eventType/datePrecision/company')
const ctgovTyped = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({})],
})
assert('eventType is TRIAL_MILESTONE', ctgovTyped[0].eventType, 'TRIAL_MILESTONE')
assert('datePrecision is DAY', ctgovTyped[0].datePrecision, 'DAY')
assert('companyId carried through', ctgovTyped[0].companyId, 'astrazeneca')
assert('companyName carried through', ctgovTyped[0].companyName, 'AstraZeneca')

console.log('18. Multi-source contract: EMA event carries normalized eventType/datePrecision, no fabricated company')
const emaTyped = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'ema-typed', event_type: 'CHMP', start_date: '2026-09-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('eventType is REGULATORY_MEETING', emaTyped[0].eventType, 'REGULATORY_MEETING')
assert('datePrecision is DAY', emaTyped[0].datePrecision, 'DAY')
assert('no company is fabricated for an EMA row (no FK exists)', emaTyped[0].companyId, undefined)
assert('no company is fabricated for an EMA row (no FK exists)', emaTyped[0].companyName, undefined)

console.log('19. Multi-source contract: legacy static events carry no eventType/datePrecision/company (predate this contract)')
const legacyTyped = buildUpcomingEvents({
  hasActiveLandscape: false, calendarEvents: [], staticEvents: [STATIC_COMPANY_IR],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(['argenx']), nowStr: NOW,
})
assert('legacy item has no eventType', legacyTyped[0].eventType, undefined)
assert('legacy item has no companyId', legacyTyped[0].companyId, undefined)

console.log('20. Legacy-fixture isolation re-proof: an active V1 landscape never renders a Company IR/SEC/congress sourceType fixture, even when ctgovMilestones + calendarEvents are both present')
const isolationProof = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'live-iso', start_date: '2026-09-01' })],
  staticEvents: [
    { id: 'fixture-company-ir', date: '2026-09-05', title: 'Fixture Company IR Day', sourceUrl: null, attendingCompetitors: ['argenx'] },
    { id: 'fixture-sec', date: '2026-09-06', title: 'Fixture SEC filing event', sourceUrl: null, attendingCompetitors: ['argenx'] },
    { id: 'fixture-congress', date: '2026-09-07', title: 'Fixture congress presentation', sourceUrl: null, attendingCompetitors: ['argenx'] },
  ],
  lexicon: LEXICON, effectiveCompetitorIds: new Set(['argenx']), nowStr: NOW,
  ctgovMilestones: [milestone({})],
})
assert('only real live sources present, zero fixtures', isolationProof.map((e) => e.id).sort(), ['ctgov-NCT00000001-lokelma-PRIMARY_COMPLETION', 'live-iso'])

// ─────────────────────────────────────────────────────────────────────────
// Intelligence Feed repair (2026-08-27, report section 3): Primary
// completion and Study completion CT.gov milestones must carry distinct
// `label` values and never both collapse to a generic "Milestone" bucket --
// the previous UI implementation keyed the visible badge off `eventType`
// alone (a single TRIAL_MILESTONE value shared by every CT.gov milestone
// subtype), losing the distinction this file's own test 12 already proved
// exists in the `title` string.
// ─────────────────────────────────────────────────────────────────────────

console.log('21. Primary completion and Study completion carry distinct labels (never both "Milestone")')
const primaryLabeled = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON,
  effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({ milestoneType: 'PRIMARY_COMPLETION', assetId: 'asset-a', nctId: 'NCT00000010' })],
})
const studyLabeled = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON,
  effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({ milestoneType: 'STUDY_COMPLETION', assetId: 'asset-b', nctId: 'NCT00000011' })],
})
assert('Primary completion label is specific', primaryLabeled[0]?.label, 'Primary completion (estimated)')
assert('Study completion label is specific', studyLabeled[0]?.label, 'Study completion (estimated)')
assert('the two labels are not the same generic bucket', primaryLabeled[0]?.label !== studyLabeled[0]?.label, true)
assert('neither label is the generic fallback "Milestone"', [primaryLabeled[0]?.label, studyLabeled[0]?.label].includes('Milestone'), false)
assert('both still share the same coarse eventType (by design -- label is the finer field)', primaryLabeled[0]?.eventType, studyLabeled[0]?.eventType)

console.log('22. Trial completion (combined) also gets its own distinct label')
const combinedLabeled = buildUpcomingEvents({
  hasActiveLandscape: true, calendarEvents: [], staticEvents: [], lexicon: LEXICON,
  effectiveCompetitorIds: new Set(), nowStr: NOW,
  ctgovMilestones: [milestone({ milestoneType: 'PRIMARY_AND_STUDY_COMPLETION', assetId: 'asset-c' })],
})
assert('Trial completion label is specific', combinedLabeled[0]?.label, 'Trial completion (estimated)')

console.log('23. EMA CHMP/PRAC meetings carry their real committee label, not a generic catch-all')
const chmpLabeled = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'chmp-row', event_type: 'CHMP', start_date: '2026-09-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
const pracLabeled = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'prac-row', event_type: 'PRAC', start_date: '2026-09-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('CHMP row labeled distinctly', chmpLabeled[0]?.label, 'CHMP meeting')
assert('PRAC row labeled distinctly', pracLabeled[0]?.label, 'PRAC meeting')

console.log('24. An undifferentiated OTHER EMA row falls back to the honest "Regulatory meeting" label (no fabricated committee)')
const otherLabeled = buildUpcomingEvents({
  hasActiveLandscape: true,
  calendarEvents: [calEvent({ id: 'other-row', event_type: 'OTHER', title: 'efgartigimod review', start_date: '2026-09-01' })],
  staticEvents: [], lexicon: LEXICON, effectiveCompetitorIds: new Set(), nowStr: NOW,
})
assert('OTHER row falls back to Regulatory meeting', otherLabeled[0]?.label, 'Regulatory meeting')

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
