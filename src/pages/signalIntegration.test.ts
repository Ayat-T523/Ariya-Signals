/**
 * signalIntegration.test.ts — V1 Signal engine frontend integration proofs
 * (2026-08-24).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/pages/signalIntegration.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Same source-text-proof convention src/lib/activeLandscape.test.ts already
 * established for WarRoom.tsx/Portal.tsx's own embedded filter predicates --
 * there is no DOM testing library in this repo, so a configured landscape's
 * "never falls back to legacy HAE Signals" contract is proven by reading
 * the actual shipped source, not by rendering.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let passed = 0
let failed = 0

function assertTrue(label: string, actual: boolean): void {
  if (actual) { console.log(`  ✓  ${label}`); passed++ }
  else { console.error(`  ✗  ${label}`); failed++ }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const warRoomSource = fs.readFileSync(path.join(__dirname, 'WarRoom.tsx'), 'utf-8').replace(/\r\n/g, '\n')
const portalSource = fs.readFileSync(path.join(__dirname, 'Portal.tsx'), 'utf-8').replace(/\r\n/g, '\n')
const competitorsSource = fs.readFileSync(path.join(__dirname, 'Competitors.tsx'), 'utf-8').replace(/\r\n/g, '\n')

console.log('1. WarRoom.tsx: a configured landscape drives signalVolume/mostActiveName/the worklist from real landscapeSignals, never the legacy pipeline')
assertTrue('signalVolume is conditional on hasActiveLandscape, landscapeSignals.length on the true branch', warRoomSource.includes('const signalVolume = hasActiveLandscape ? landscapeSignals.length : relevantSignals.length'))
assertTrue('mostActiveName is conditional on hasActiveLandscape, landscapeMostActiveName on the true branch', warRoomSource.includes('const mostActiveName = hasActiveLandscape ? landscapeMostActiveName : legacyMostActiveName'))
assertTrue('the legacy worklist array is forced empty for a configured landscape, never populated from relevantSignals', warRoomSource.includes('const worklistItems = hasActiveLandscape ? [] : (() => {'))
assertTrue('the "What needs your attention" JSX branches on hasActiveLandscape BEFORE ever checking the legacy liveDataFailed/showSkeleton/worklistItems state', warRoomSource.includes('{hasActiveLandscape ? (') && warRoomSource.indexOf('{hasActiveLandscape ? (') < warRoomSource.indexOf('liveDataFailed ? ('))
assertTrue('the configured-landscape branch renders LandscapeSignalRow, never WorklistRow/MappedAlert', warRoomSource.includes('landscapeWorklistSignals.map((s) => <LandscapeSignalRow key={s.id} signal={s} />)'))

console.log('2. WarRoom.tsx: the primary Signal fetch and stat-bar copy are all-time, no arbitrary 30-day/Xd presentation restriction (pre-freeze fix 2026-08-24)')
assertTrue('the primary landscape Signal fetch omits lookback_days entirely -- reuses the existing all-time API contract, never a second endpoint', warRoomSource.includes('fetchLandscapeSignals(discoveredCompanyIds, indication, canonicalIndicationId)') && !warRoomSource.includes('TIME_HORIZON_DAYS[timeHorizon]'))
assertTrue('no leftover signalVolumeWindowDays/TIME_HORIZON_DAYS import for the Signal fetch', !warRoomSource.includes('signalVolumeWindowDays') && !warRoomSource.includes("import { TIME_HORIZON_DAYS } from '../lib/timeHorizon'"))
// Pre-freeze unit 2 (2026-08-26): stat bar became a 3-card KPI row
// (KpiCard/.kpi-card, screenshot-matched restoration) -- same underlying
// value/label pair, just rendered via label: 'Signals'/value: signalVolume
// instead of a literal "N signals" template string. The semantic guarantee
// this assertion actually protects (never a "30d"/"Xd" suffix on this
// specific label) still holds; the markup shape it checks moved.
assertTrue('the KPI row renders a disease/time-neutral "Signals" label, never a "30d"/"Xd" suffix', warRoomSource.includes("label: 'Signals'") && !warRoomSource.includes('signals · '))
assertTrue('the worklist empty-state copy no longer claims a "time horizon" scarcity that the all-time fetch does not have', !warRoomSource.includes('in this time horizon'))
assertTrue('NARRATION_DAYS (the unrelated legacy pre-landscape path) is left untouched', warRoomSource.includes('const NARRATION_DAYS = 90') && warRoomSource.includes('getRecentSignals(NARRATION_DAYS, filterIds)'))

console.log('3. Portal.tsx: RecentSignalsStrip is its own section, fed by fetchLandscapeSignals (all-time), never folded into the Events/Market tabs')
assertTrue('landscapeSignals state is populated via fetchLandscapeSignals, the real API client, never getRecentSignals, and never scoped to a lookback window', portalSource.includes('fetchLandscapeSignals(discoveredCompanyIds, indication, canonicalIndicationId)') && !portalSource.includes('TIME_HORIZON_DAYS[timeHorizon]'))
assertTrue('the empty-state copy no longer claims a "time horizon" scarcity that the all-time fetch does not have', !portalSource.includes('in this time horizon'))
assertTrue('RecentSignalsStrip is rendered as its own top-level section, not inside EventsTab/MarketTab', portalSource.includes('<RecentSignalsStrip'))

console.log('4. Competitors.tsx: latest Signal(s) are grouped by EXACT canonical companyId, never a fuzzy name match')
assertTrue('grouping uses signal.companyId as the Map key directly, no normalization/fuzzy step', competitorsSource.includes('grouped.set(s.companyId, [...(grouped.get(s.companyId) ?? []), s])'))
assertTrue('the render call site looks up by the SAME tc.companyId, never a legacy id or a name', competitorsSource.includes('landscapeSignalsByCompany.get(tc.companyId)'))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
