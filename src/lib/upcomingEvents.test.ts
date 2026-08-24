/**
 * upcomingEvents.test.ts — Upcoming Events V1 semantic-integrity
 * extraction (War Room checkpoint, 2026-08-25).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/upcomingEvents.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { buildUpcomingEvents, isRelevantEMAEvent } from './upcomingEvents.js'
import type { DbRegulatoryCalendarEvent } from './db.js'

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

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
