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

console.log('2. WarRoom.tsx: the horizon label uses the real selected Month/Quarter/Year day-count for a configured landscape, never the hardcoded legacy 90d')
assertTrue('signalVolumeWindowDays is conditional, TIME_HORIZON_DAYS[timeHorizon] on the true branch', warRoomSource.includes('const signalVolumeWindowDays = hasActiveLandscape ? TIME_HORIZON_DAYS[timeHorizon] : NARRATION_DAYS'))
assertTrue('the stat bar renders signalVolumeWindowDays, not the old hardcoded NARRATION_DAYS reference', warRoomSource.includes('signals · {signalVolumeWindowDays}d') && !warRoomSource.includes('signals · {NARRATION_DAYS}d'))

console.log('3. Portal.tsx: RecentSignalsStrip is its own section, fed by fetchLandscapeSignals, never folded into the Events/Market tabs')
assertTrue('landscapeSignals state is populated via fetchLandscapeSignals, the real API client, never getRecentSignals', portalSource.includes('fetchLandscapeSignals(discoveredCompanyIds, indication, canonicalIndicationId, TIME_HORIZON_DAYS[timeHorizon])'))
assertTrue('RecentSignalsStrip is rendered as its own top-level section, not inside EventsTab/MarketTab', portalSource.includes('<RecentSignalsStrip'))

console.log('4. Competitors.tsx: latest Signal(s) are grouped by EXACT canonical companyId, never a fuzzy name match')
assertTrue('grouping uses signal.companyId as the Map key directly, no normalization/fuzzy step', competitorsSource.includes('grouped.set(s.companyId, [...(grouped.get(s.companyId) ?? []), s])'))
assertTrue('the render call site looks up by the SAME tc.companyId, never a legacy id or a name', competitorsSource.includes('landscapeSignalsByCompany.get(tc.companyId)'))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
