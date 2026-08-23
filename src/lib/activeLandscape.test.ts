/**
 * activeLandscape.test.ts — landscape-scoping acceptance tests
 * (Bug sweep 2026-08-24 independent review).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/activeLandscape.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Covers the two pure, exported matching functions this module carries
 * (matchTrackedCompetitorsToLegacyIds/activeLandscapeSignalScope, both
 * pre-existing, and partyMatchesLegacyScope, the new addition under
 * review) plus source-text proofs for the embedded WarRoom.tsx/Portal.tsx
 * filter predicates that consume them, matching this repo's own
 * established convention (setup-draft.test.ts's own page-logic checks)
 * since there is no DOM testing library here to render those pages.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  activeLandscapeSignalScope,
  partyMatchesLegacyScope,
  type LegacyCompetitorRef,
} from './activeLandscape.js'
import type { TrackedCompetitor } from '../config/setup-draft.js'

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

function assertTrue(label: string, actual: boolean): void {
  assert(label, actual, true)
}

const LEGACY: LegacyCompetitorRef[] = [
  { id: 'takeda', name: 'Takeda' },
  { id: 'biocryst', name: 'BioCryst' },
  { id: 'pharvaris', name: 'Pharvaris' },
  { id: 'argenx', name: 'argenx' },
  { id: 'alexion', name: 'Alexion Pharmaceuticals' },
]

function fakeTracked(companyId: string, companyName: string): TrackedCompetitor {
  return {
    companyId, companyName, source: 'discovered', userRelationship: 'direct', ariyaAssessment: 'direct',
    relevantAssets: [], evidenceRefs: [], evidenceStatus: 'evidence_available',
  }
}

// ── 1. activeLandscapeSignalScope: baseline contract (pre-existing, re-confirmed) ──
console.log('1. hasActiveLandscape is exactly trackedCompetitors.length > 0 -- no other condition')
assert('zero tracked competitors -> hasActiveLandscape false', activeLandscapeSignalScope([], LEGACY).hasActiveLandscape, false)
assert('one tracked competitor -> hasActiveLandscape true, regardless of whether it maps to a legacy id', activeLandscapeSignalScope([fakeTracked('unmapped-co', 'Totally Unmapped Co')], LEGACY).hasActiveLandscape, true)

// ── 2. partyMatchesLegacyScope: exact mapped competitor matches ──────────────
console.log('2. partyMatchesLegacyScope: exact mapped competitor matches (by name, and by raw id)')
assertTrue('party name "BioCryst" matches when biocryst is in the active scope', partyMatchesLegacyScope(['BioCryst'], LEGACY, new Set(['biocryst'])))
assertTrue('party name "Alexion Pharmaceuticals" matches alexion in scope', partyMatchesLegacyScope(['Alexion Pharmaceuticals'], LEGACY, new Set(['alexion'])))
assertTrue('party string that is literally the raw legacy id ("argenx") also matches', partyMatchesLegacyScope(['argenx'], LEGACY, new Set(['argenx'])))
assertTrue('at least one matching party among several is sufficient', partyMatchesLegacyScope(['Neopharmed Gentili', 'BioCryst'], LEGACY, new Set(['biocryst'])))

// ── 3. Unrelated company does not match ──────────────────────────────────────
console.log('3. partyMatchesLegacyScope: an unrelated/unmapped company never matches')
assertTrue('a party naming a real legacy competitor NOT in the active scope does not match', !partyMatchesLegacyScope(['Takeda'], LEGACY, new Set(['biocryst'])))
assertTrue('a party naming a company with no legacy entry at all does not match', !partyMatchesLegacyScope(['Ionis Pharmaceuticals'], LEGACY, new Set(['biocryst', 'takeda', 'pharvaris', 'argenx', 'alexion'])))

// ── 4. Zero mappings stays empty ──────────────────────────────────────────────
console.log('4. partyMatchesLegacyScope: an empty active scope matches nothing, even a real legacy company name')
assertTrue('empty effectiveCompetitorIds -> no party can ever match', !partyMatchesLegacyScope(['BioCryst', 'Takeda', 'argenx'], LEGACY, new Set()))

// ── 5. Normalization does not over-merge ──────────────────────────────────────
console.log('5. Normalization (shared normalizeCompanyName) merges only genuine legal/generic-suffix variants, never unrelated companies')
assertTrue('"BioCryst Pharmaceuticals, Inc." still matches biocryst (legal + generic suffix stripping only)', partyMatchesLegacyScope(['BioCryst Pharmaceuticals, Inc.'], LEGACY, new Set(['biocryst'])))
assertTrue('a genuinely different company sharing no root token does not accidentally match', !partyMatchesLegacyScope(['Astria Therapeutics'], LEGACY, new Set(['biocryst', 'takeda', 'pharvaris', 'argenx', 'alexion'])))
assertTrue('no substring/fuzzy matching -- "Pharvarisco" (contains "Pharvaris" as a substring) does not match', !partyMatchesLegacyScope(['Pharvarisco'], LEGACY, new Set(['pharvaris'])))

// ── 6. Cross-company safety: a scoped id absent from the legacy roster never causes a false match ──
console.log('6. An id present in effectiveCompetitorIds but absent from the legacy roster cannot cause an unrelated party to match')
assertTrue('scope contains an id with no LegacyCompetitorRef entry at all -- no party matches it', !partyMatchesLegacyScope(['Some Company'], LEGACY, new Set(['not-a-real-legacy-id'])))

// ── 7. Legacy-default fallback (trackedCompetitors.length === 0) still resolves real names ──
console.log('7. matchTrackedCompetitorsToLegacyIds (pre-existing): a real onboarding company name still resolves to its legacy id')
const scope = activeLandscapeSignalScope([fakeTracked('argenx', 'argenx'), fakeTracked('alexion', 'Alexion')], LEGACY)
assertTrue('argenx and alexion both resolve to their real legacy ids', scope.legacyIds.has('argenx') && scope.legacyIds.has('alexion'))
assertTrue('a tracked competitor with no legacy match contributes no id (honest gap, never fabricated)', activeLandscapeSignalScope([fakeTracked('novel-co', 'Totally Novel Co')], LEGACY).legacyIds.size === 0)

// ── 8. Source-text proof: WarRoom.tsx's Next Up landscape-scoping predicate ──
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const warRoomSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'WarRoom.tsx'), 'utf-8').replace(/\r\n/g, '\n')
const portalSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Portal.tsx'), 'utf-8').replace(/\r\n/g, '\n')

console.log('8. WarRoom.tsx: staticEventItems applies the SAME company-scope-then-hasActiveLandscape-fallback rule proven above, not a competing inline reimplementation')
assertTrue('attendingCompetitors-present branch requires a match in effectiveCompetitorIds', warRoomSource.includes('if (comps.length > 0) return comps.some((id) => effectiveCompetitorIds.has(id))'))
assertTrue('attendingCompetitors-absent branch falls back to !hasActiveLandscape, never an unconditional "always show"', warRoomSource.includes('return !hasActiveLandscape\n    })\n    .map((e) => ({ id: e.id, date: e.date, title: e.title, sourceUrl: e.sourceUrl }))'))

// ── 9. Source-text proof: Portal.tsx EventsTab distinguishes live vs static company-less entries ──
console.log('9. Portal.tsx EventsTab: a company-less entry only always-shows when it is genuinely live (_isLive), never merely because it names no company')
assertTrue('landscapeScopedEvents checks comps.length first, mirroring WarRoom', portalSource.includes('if (comps.length > 0) return comps.some((id: string) => effectiveCompetitorIds.has(id))'))
assertTrue('company-less entries require _isLive === true OR !hasActiveLandscape -- never an unconditional always-show', portalSource.includes('return e._isLive === true || !hasActiveLandscape'))

// ── 10. Source-text proof: Portal.tsx MarketTab mirrors the same rule for parties ──
console.log('10. Portal.tsx MarketTab: company-less market items use the same conservative fallback, not a permissive always-show')
assertTrue('parties-present branch requires partyMatchesLegacyScope, never a bare truthiness check', portalSource.includes('if (parties.length > 0) return partyMatchesLegacyScope(parties, competitorsData, effectiveCompetitorIds)'))
assertTrue('parties-absent branch falls back to !hasActiveLandscape', portalSource.includes('const scoped = [...(marketData as any[]), ...liveDealItems].filter((m: any) => {\n    const parties = (m.parties as string[] | undefined) ?? []\n    if (parties.length > 0) return partyMatchesLegacyScope(parties, competitorsData, effectiveCompetitorIds)\n    return !hasActiveLandscape\n  })'))

// ── 11. Tab count contract: the badge reports the SAME array's length that is actually rendered, never a separately-recomputed number ──
console.log('11. Tab badge counts are wired to the identical filtered array length that feeds rendering -- landscapeScopedEvents.length / scoped.length, never eventsData.length/marketData.length')
assertTrue('EventsTab reports landscapeScopedEvents.length via onCountChange, not allEvents.length or a raw dataset length', portalSource.includes('useEffect(() => { onCountChange?.(landscapeScopedEvents.length) }, [landscapeScopedEvents.length])'))
assertTrue('MarketTab reports scoped.length via onCountChange, not a raw dataset length', portalSource.includes('useEffect(() => { onCountChange?.(scoped.length) }, [scoped.length])'))
assertTrue('TabBar renders from the counts prop, never the removed static TAB_COUNTS constant', portalSource.includes('{String(counts[i]).padStart(2, \'0\')}') && !portalSource.includes('TAB_COUNTS[i]'))
assertTrue('the old static TAB_COUNTS export/binding no longer exists as the live source of truth (renamed _FALLBACK, used only as pre-effect placeholder)', !/(?<!_)TAB_COUNTS\s*=/.test(portalSource) && portalSource.includes('TAB_COUNTS_FALLBACK'))

// ── 12. formatMonthYear dead-code removal: confirm it is genuinely gone and was genuinely unused ──
console.log('12. formatMonthYear is removed from Portal.tsx and was never referenced anywhere else in the file')
assertTrue('formatMonthYear no longer defined in Portal.tsx', !portalSource.includes('function formatMonthYear'))
assertTrue('formatMonthYear is not called anywhere in Portal.tsx either', !portalSource.includes('formatMonthYear('))

// ── Summary ─────────────────────────────────────────────────────────────────
declare const process: { exit(code: number): void }
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
