/**
 * v1UiHardening.test.ts — V1 release hardening: Decide sidebar removal +
 * Recent Evidence removal + HAE-specific Competitors filter removal
 * (2026-08-24).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/pages/v1UiHardening.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Same source-text-proof convention src/pages/signalIntegration.test.ts and
 * src/lib/activeLandscape.test.ts already established -- there is no DOM
 * testing library in this repo, so these contracts are proven by reading the
 * actual shipped source, not by rendering.
 *
 * SCOPE: this file proves three things only --
 *   (1) the sidebar's "Decide" section (Alerts/Ask Ariya/My Space) is gone,
 *       while the "Monitor" section and the unrelated top-right SiteHeader
 *       "Ask Ariya" button (a DIFFERENT implementation, deliberately
 *       untouched) survive;
 *   (2) the generic "Recent Evidence" section is gone from every page that
 *       used to render it, while the SEPARATE "Recent signals"/worklist
 *       Signal rendering (a different section, backed by landscapeSignals,
 *       never evidence) is untouched;
 *   (3) Competitors.tsx's hardcoded "HAE acute"/"HAE prophylaxis" filter
 *       pills are gone -- they only ever filtered the legacy static
 *       competitors.json dataset (disjoint from any real tracked landscape's
 *       own competitor ids), so they were dead weight for every real V1
 *       landscape -- while the unrelated, real, disease-neutral strategic-
 *       posture filter and both tracked-competitor rendering paths survive.
 * Signal-count/Signal-list correctness itself is already covered by
 * src/pages/signalIntegration.test.ts (unmodified by this pass, still green).
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
const pagesDir = __dirname
const readPage = (name: string) => fs.readFileSync(path.join(pagesDir, name), 'utf-8').replace(/\r\n/g, '\n')

const appSidebarSource = fs.readFileSync(
  path.join(pagesDir, '..', 'components', 'shell', 'AppSidebar.tsx'), 'utf-8',
).replace(/\r\n/g, '\n')
const siteHeaderSource = fs.readFileSync(
  path.join(pagesDir, '..', 'components', 'shell', 'SiteHeader.tsx'), 'utf-8',
).replace(/\r\n/g, '\n')
const warRoomSource = readPage('WarRoom.tsx')
const portalSource = readPage('Portal.tsx')

console.log('1. AppSidebar.tsx: the "Decide" NavMain section is gone entirely')
assertTrue('no <NavMain label="Decide" ...> render call remains', !appSidebarSource.includes('label="Decide"'))
assertTrue('no "decide" nav-item array is constructed', !/const\s+decide\s*:/.test(appSidebarSource))

console.log('2. AppSidebar.tsx: Alerts is no longer a sidebar nav entry')
assertTrue("no url: '/alerts' nav item in AppSidebar.tsx", !appSidebarSource.includes("url: '/alerts'"))
assertTrue('BellIcon (only ever used for the Alerts nav item) is no longer imported', !appSidebarSource.includes('BellIcon'))

console.log('3. AppSidebar.tsx: Ask Ariya is no longer a sidebar nav entry')
assertTrue("no url: '/ask' nav item in AppSidebar.tsx", !appSidebarSource.includes("url: '/ask'"))
assertTrue('SparklesIcon (only ever used for the sidebar Ask Ariya item) is no longer imported', !appSidebarSource.includes('SparklesIcon'))

console.log('4. AppSidebar.tsx: My Space is no longer a sidebar nav entry')
assertTrue("no url: '/myspace' nav item in AppSidebar.tsx", !appSidebarSource.includes("url: '/myspace'"))
assertTrue('UserIcon (only ever used for the My Space item) is no longer imported', !appSidebarSource.includes('UserIcon'))

console.log('5. AppSidebar.tsx: the "Monitor" section and unrelated shell pieces survive untouched')
assertTrue('the Monitor NavMain section is still rendered', appSidebarSource.includes('label="Monitor"'))
assertTrue('War Room is still a Monitor nav item', appSidebarSource.includes("title: 'War Room'"))
assertTrue('Intelligence Feed is still a Monitor nav item', appSidebarSource.includes("title: 'Intelligence Feed'"))
assertTrue('Competitors is still a Monitor nav item', appSidebarSource.includes("title: 'Competitors'"))
assertTrue('the Help/Admin secondary nav is still rendered', appSidebarSource.includes("title: 'Admin'"))

console.log('6. SiteHeader.tsx: the top-right "Ask Ariya" button is a SEPARATE implementation, deliberately untouched')
assertTrue('SiteHeader.tsx still renders its own top-right Ask Ariya button', siteHeaderSource.includes('Ask Ariya') && siteHeaderSource.includes("navigate('/ask')"))

console.log('7. WarRoom.tsx: the generic "Recent Evidence" section is gone')
assertTrue('no "Recent evidence" heading text remains', !warRoomSource.includes('Recent evidence'))
assertTrue('the RecentEvidenceCard component definition is gone', !warRoomSource.includes('RecentEvidenceCard'))
assertTrue('the now-unnecessary evidence-only fetch (fetchLandscapeEvidence) is gone', !warRoomSource.includes('fetchLandscapeEvidence'))
assertTrue('War Room still renders the stat bar / "What needs your attention" worklist', warRoomSource.includes('What needs your attention'))
assertTrue('War Room still renders Market Weather', warRoomSource.includes('<MarketWeather'))
assertTrue('War Room still renders the Next Up carousel', warRoomSource.includes('<NextUpCarousel'))

console.log('8. Portal.tsx (Intelligence Feed): the generic "Recent Evidence" section is gone, "Recent signals" is untouched')
assertTrue('no "Recent evidence" heading text remains', !portalSource.includes('Recent evidence'))
assertTrue('the RecentEvidenceStrip component definition is gone', !portalSource.includes('RecentEvidenceStrip'))
assertTrue('the now-unnecessary evidence-only fetch (fetchLandscapeEvidence) is gone', !portalSource.includes('fetchLandscapeEvidence'))
assertTrue('RecentSignalsStrip ("Recent signals") is still defined and rendered', portalSource.includes('function RecentSignalsStrip') && portalSource.includes('<RecentSignalsStrip'))
assertTrue('Recent signals still renders LandscapeSignalRow, never an evidence row', portalSource.includes('signalsList.map((s) => <LandscapeSignalRow key={s.id} signal={s} />)'))

console.log('9. No other active V1 screen under src/pages/ renders a generic "Recent evidence" section')
const OTHER_ACTIVE_PAGES = [
  'Competitors.tsx', 'CompetitorProfile.tsx', 'MarketPerformance.tsx', 'PricingAndAccess.tsx',
  'AdminPage.tsx', 'DiscoverCompetitors.tsx', 'SignIn.tsx',
]
for (const page of OTHER_ACTIVE_PAGES) {
  assertTrue(`${page} contains no "Recent evidence" section`, !readPage(page).includes('Recent evidence'))
}

console.log('10. Competitors.tsx: tracked-competitor cards / latest-Signal / company scoping are unaffected by the Evidence removal')
const competitorsSource = readPage('Competitors.tsx')
assertTrue('company grouping still keys signals by exact companyId', competitorsSource.includes('grouped.set(s.companyId, [...(grouped.get(s.companyId) ?? []), s])'))
assertTrue('the render call site still looks up the same tc.companyId', competitorsSource.includes('landscapeSignalsByCompany.get(tc.companyId)'))
assertTrue('Competitors.tsx never imported the Recent-Evidence-only fetch', !competitorsSource.includes('fetchLandscapeEvidence'))

console.log('11. Competitors.tsx: the hardcoded HAE-specific "HAE acute"/"HAE prophylaxis" filter pills are removed (2026-08-24)')
assertTrue('no "HAE acute" label text remains', !competitorsSource.includes('HAE acute'))
assertTrue('no "HAE prophylaxis" label text remains', !competitorsSource.includes('HAE prophylaxis'))
assertTrue('the hae-acute filter value is gone', !competitorsSource.includes("'hae-acute'"))
assertTrue('the hae-prophylaxis filter value is gone', !competitorsSource.includes("'hae-prophylaxis'"))
assertTrue('the now-dead isHaeAcute predicate is gone (it only ever matched the legacy static competitors.json dataset, disjoint from any real tracked landscape)', !competitorsSource.includes('function isHaeAcute'))
assertTrue('the now-dead isHaeProphylaxis predicate is gone', !competitorsSource.includes('function isHaeProphylaxis'))
assertTrue('no generic replacement labels were invented in its place', !competitorsSource.includes("label: 'Acute'") && !competitorsSource.includes("label: 'Prophylaxis'") && !competitorsSource.includes("label: 'Primary'") && !competitorsSource.includes("label: 'Core'"))
assertTrue('the unrelated strategic-posture filter (a real, disease-neutral feature) is untouched', competitorsSource.includes('const [postureFilter, setPostureFilter] = useState(new Set<string>())') && competitorsSource.includes('<FilterDropdown label="Posture"'))
assertTrue('tracked-competitor rendering (legacy-matched + unmatched honest-card paths) is untouched', competitorsSource.includes('{sorted.map(c =>') && competitorsSource.includes('{unmatchedTrackedCompetitors.map((tc) =>'))
assertTrue('the "N shown" count still sums both rendering paths', competitorsSource.includes('{sorted.length + unmatchedTrackedCompetitors.length} shown'))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
