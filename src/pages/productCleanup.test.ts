/**
 * productCleanup.test.ts — Product-surface cleanup checkpoint (2026-08-25):
 * Market Performance removal, Pricing & Access removal, legacy Inform
 * branding removal, src/components/inform/ -> src/components/signals/ rename.
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/pages/productCleanup.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Same source-text-proof convention src/lib/activeLandscape.test.ts and
 * src/pages/v1UiHardening.test.ts already established -- there is no DOM
 * testing library in this repo, so these contracts are proven by reading
 * the actual shipped source/filesystem, not by rendering.
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
const srcDir = path.join(__dirname, '..')
function read(relPath: string): string {
  return fs.readFileSync(path.join(srcDir, relPath), 'utf-8').replace(/\r\n/g, '\n')
}
function exists(relPath: string): boolean {
  return fs.existsSync(path.join(srcDir, relPath))
}

const appSource = read('App.tsx')
const sidebarSource = read('components/shell/AppSidebar.tsx')
const siteHeaderSource = read('components/shell/SiteHeader.tsx')
const warRoomSource = read('pages/WarRoom.tsx')
const askSource = read('pages/Ask.tsx')
const askModalSource = read('components/ui/AskModal.tsx')
const messagingTabSource = read('components/competitor/tabs/MessagingTab.tsx')

console.log('1. Market Performance is absent from navigation')
assertTrue('AppSidebar MONITOR no longer lists /market-performance', !sidebarSource.includes('/market-performance'))
assertTrue('AppSidebar MONITOR no longer lists the "Market Performance" title', !sidebarSource.includes('Market Performance'))
assertTrue('SiteHeader breadcrumb map no longer carries /market-performance', !siteHeaderSource.includes('/market-performance'))

console.log('2. Pricing & Access is absent from navigation')
assertTrue('AppSidebar MONITOR no longer lists /pricing', !sidebarSource.includes("'/pricing'"))
assertTrue('AppSidebar MONITOR no longer lists "Pricing and Access"', !sidebarSource.includes('Pricing and Access'))
assertTrue('SiteHeader breadcrumb map no longer carries /pricing', !siteHeaderSource.includes("'/pricing'"))

console.log('3. The old Market Performance route no longer renders its page')
assertTrue('App.tsx has no /market-performance <Route>', !appSource.includes('path="/market-performance"'))
assertTrue('App.tsx no longer imports MarketPerformance', !appSource.includes('MarketPerformance'))
assertTrue('MarketPerformance.tsx no longer exists on disk', !exists('pages/MarketPerformance.tsx'))

console.log('4. The old Pricing & Access route no longer renders its page')
assertTrue('App.tsx has no /pricing <Route>', !appSource.includes('path="/pricing"'))
assertTrue('App.tsx no longer imports PricingAndAccess', !appSource.includes('PricingAndAccess'))
assertTrue('PricingAndAccess.tsx no longer exists on disk', !exists('pages/PricingAndAccess.tsx'))

console.log('5. Orphaned Market Performance / Pricing & Access data is gone')
assertTrue('market-performance.json deleted', !exists('data/market-performance.json'))
assertTrue('pricing.json deleted', !exists('data/pricing.json'))
assertTrue('kalvista.ts no longer re-exports marketPerformanceData', !read('data/kalvista.ts').includes('marketPerformanceData'))
assertTrue('kalvista.ts no longer re-exports pricingData', !read('data/kalvista.ts').includes('pricingData'))

console.log('6. No user-facing "Ask InForm" remains on any active retained screen')
assertTrue('WarRoom.tsx header CTA reads "Ask Ariya"', warRoomSource.includes('Ask Ariya') && !warRoomSource.includes('Ask InForm'))
assertTrue('App.tsx /ask route title reads "Ask Ariya"', appSource.includes('title="Ask Ariya"') && !appSource.includes('"Ask InForm"'))
assertTrue('MessagingTab.tsx AI CTA reads "Ask Ariya to analyze this"', messagingTabSource.includes('Ask Ariya to analyze this') && !messagingTabSource.includes('Ask InForm'))

console.log('7. No user-facing legacy "InForm" branding remains')
assertTrue('AskModal.tsx dialog-title fallback reads "Ariya\'s analysis"', askModalSource.includes("Ariya's analysis") && !askModalSource.includes("InForm's analysis"))
assertTrue('AskModal.tsx system prompt self-identifies as Ariya Signals, not InForm', askModalSource.includes('inside Ariya Signals') && !askModalSource.includes('inside InForm'))
assertTrue('Ask.tsx source chip reads "Ariya", not "InForm"', askSource.includes('>\n              Ariya\n            <') || (askSource.includes('Ariya') && !/>\s*InForm\s*</.test(askSource)))
// Repo-wide legacy-name audit (report section 12) caught this one: the
// ONLY call site of KokonutLoader (App.tsx's PageLoader -- the Suspense
// fallback + auth-loading screen every user sees on every app load) never
// overrode `title`, so the component's own default of "Loading InForm..."
// was genuinely rendered on-screen.
const loaderSource = read('components/kokonutui/loader.tsx')
assertTrue('KokonutLoader\'s default title no longer reads "Loading InForm..."', loaderSource.includes('Loading Ariya Signals...') && !loaderSource.includes('Loading InForm...'))

console.log('8. src/components/inform/ has been renamed to src/components/signals/ -- active functionality preserved, not deleted')
assertTrue('the legacy components/inform/ directory no longer exists', !exists('components/inform'))
assertTrue('components/signals/MarketWeather.tsx exists at the new location', exists('components/signals/MarketWeather.tsx'))
assertTrue('components/signals/AlertDetail.tsx exists at the new location', exists('components/signals/AlertDetail.tsx'))
assertTrue('components/signals/primitives.tsx exists at the new location', exists('components/signals/primitives.tsx'))
assertTrue('components/signals/types.ts exists at the new location', exists('components/signals/types.ts'))
assertTrue('components/signals/FeedFilterBar.tsx exists at the new location', exists('components/signals/FeedFilterBar.tsx'))
assertTrue('the dev-only InformKit.tsx scratch page (not one of the 2 removed pages) still exists, untouched', exists('pages/InformKit.tsx'))

console.log('9. WarRoom.tsx imports its retained V1 widgets from the new components/signals/ path')
assertTrue('WarRoom.tsx imports AlertDetail from components/signals', warRoomSource.includes("from '../components/signals/AlertDetail'"))
assertTrue('WarRoom.tsx imports MarketWeather from components/signals', warRoomSource.includes("from '../components/signals/MarketWeather'"))
assertTrue('WarRoom.tsx imports primitives from components/signals', warRoomSource.includes("from '../components/signals/primitives'"))
assertTrue('WarRoom.tsx imports types from components/signals', warRoomSource.includes("from '../components/signals/types'"))
assertTrue('no remaining components/inform import anywhere in WarRoom.tsx', !warRoomSource.includes('components/inform'))

console.log('10. War Room / Intelligence Feed / Competitors routes still work (unchanged semantics)')
assertTrue('War Room ("/") route intact', appSource.includes('<Route path="/"                   element={<><RouteTitle title="War Room" /><WarRoom /></>} />'))
assertTrue('Intelligence Feed ("/intelligence") route intact', appSource.includes('<Route path="/intelligence"         element={<><RouteTitle title="Intelligence Feed" /><Portal /></>} />'))
assertTrue('Competitors ("/competitors") route intact, unchanged', appSource.includes('<Route path="/competitors"          element={<><RouteTitle title="Competitors" /><Competitors /></>} />'))

console.log('11. Fallback route still catches unmatched paths (old Market Performance/Pricing URLs land here, never a bespoke tombstone)')
assertTrue('the catch-all NotFoundState route is still the last route in the protected Layout', appSource.includes('<Route path="*"                     element={<NotFoundState />} />'))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
