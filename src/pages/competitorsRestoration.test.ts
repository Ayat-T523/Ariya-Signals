/**
 * competitorsRestoration.test.ts — "RESTORE COMPETITORS PAGES TO THE
 * ORIGINAL ARIYA EXPERIENCE" checkpoint (2026-08-25, report section 27).
 *
 * Same source-text-proof convention every other .test.ts in this repo
 * already established (no DOM testing library) -- these contracts are
 * proven by reading the actual shipped source, not by rendering. See
 * v1UiHardening.test.ts section 10-11 for the companion assertions this
 * checkpoint updated (the legacy-id-matched split it previously asserted).
 *
 * Run:  npx tsx src/pages/competitorsRestoration.test.ts
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

const competitorsSource = read('pages/Competitors.tsx')
const profileSource = read('pages/CompetitorProfile.tsx')
const profileV1Source = read('pages/CompetitorProfileV1.tsx')
const pipelineV1Source = read('components/competitor/tabs/PipelineTabV1.tsx')
const companyV1Source = read('components/competitor/tabs/CompanyTabV1.tsx')
const messagingV1Source = read('components/competitor/tabs/MessagingTabV1.tsx')
const stageSource = read('lib/pipelineStage.ts')
const overviewLibSource = read('lib/competitorOverview.ts')
const evidenceClientSource = read('lib/api/landscapeEvidence.ts')
const appSource = read('App.tsx')

console.log('1. Overview: heading + subheading restored for a real active landscape, never for the legacy demo path')
assertTrue('heading reads "Tracked Competitors"', competitorsSource.includes('Tracked Competitors'))
assertTrue('subheading follows the "[N] competitors tracked · [Disease Area]" pattern', competitorsSource.includes('competitor{trackedCompetitors.length === 1') && competitorsSource.includes('tracked · {indication}'))
assertTrue('the heading block is gated on hasActiveLandscape, never shown for the legacy demo path', competitorsSource.includes('{hasActiveLandscape && (') )

console.log('2. Overview: every tracked competitor renders via the ONE unified V1CompetitorCard, scoped by canonical companyId')
assertTrue('V1CompetitorCard is defined', competitorsSource.includes('function V1CompetitorCard('))
assertTrue('V1CompetitorCard never imports/reads competitors.json fields (posture/marketedProducts/pipeline)', !/V1CompetitorCard[\s\S]{0,900}strategicPosture/.test(competitorsSource))
// Confirmed live (2026-08-25, Abbott Medical Devices/heart failure
// control): a real canonical companyId can contain a raw space
// ("abbott medical devices") -- an un-encoded template literal produces an
// href React Router silently fails to match, so the card was unclickable.
assertTrue('cards route to canonical companyId, URL-encoded so ids containing spaces/special characters still navigate', competitorsSource.includes('to={`/competitors/${encodeURIComponent(competitor.companyId)}`}'))
assertTrue('no dead reference to the old legacy-id-matched split remains', !competitorsSource.includes('function TrackedCompetitorCard(') && !competitorsSource.includes('unmatchedTrackedCompetitors'))

console.log('3. Overview: Direct/Indirect is the user\'s own setup classification, never inferred')
assertTrue('V1CompetitorCard renders competitor.userRelationship via the existing RELATIONSHIP_LABEL map', /V1CompetitorCard[\s\S]{0,2000}RELATIONSHIP_LABEL\[competitor\.userRelationship\]/.test(competitorsSource))

console.log('4. Overview: Pipeline asset count / Last signal / Activity are real, derived from the same already-scoped Signal fetch -- never a new fetch, never fabricated')
assertTrue('computeCompanyOverviewStats derives assetCount from a Set of real signal.assetId values (canonical asset count in the active disease area)', overviewLibSource.includes('new Set(signals.map((s) => s.assetId)') )
assertTrue('lastSignalAt is the real max signal.occurredAt, never fabricated', overviewLibSource.includes('s.occurredAt > lastSignalAt'))
assertTrue('the overview card summary is a compact deterministic template, never AI-generated prose', overviewLibSource.includes('buildCompactCompanySummary'))
assertTrue('Competitors.tsx never imports the Recent-Evidence-only fetch for the overview (no new fetch was added for card stats)', !competitorsSource.includes('fetchLandscapeEvidence'))

console.log('5. Legacy demo path (no active landscape) is completely untouched')
assertTrue('the legacy CompetitorCard component still exists, unchanged in shape', competitorsSource.includes('function CompetitorCard('))
assertTrue('the legacy sort/posture-filter chrome bar is gated to the demo-only path', competitorsSource.includes('{!hasActiveLandscape && (') && competitorsSource.includes('<div className="feed-filter-bar"'))
assertTrue('the legacy grid (sorted.map) still renders CompetitorCard for the demo-only path', competitorsSource.includes('{sorted.map(c =>') && /sorted\.map\(c =>[\s\S]{0,300}<CompetitorCard/.test(competitorsSource))

console.log('6. Profile routing: a real tracked V1 company (by canonical companyId) renders CompetitorProfileV1; every other case is untouched')
assertTrue('CompetitorProfile.tsx imports CompetitorProfileV1', profileSource.includes("import CompetitorProfileV1 from './CompetitorProfileV1'"))
assertTrue('CompetitorProfile.tsx branches on hasActiveLandscape before falling through to the original legacy body', profileSource.includes('if (hasActiveLandscape) {'))
assertTrue('the V1 branch looks up by real companyId, never a legacy id', profileSource.includes('trackedCompetitors.find((tc) => tc.companyId === id)'))
assertTrue('a missing V1 company still renders the honest NotFoundState, never a blank/fake profile', /if \(!trackedCompetitor\) \{[\s\S]{0,200}<NotFoundState/.test(profileSource))
assertTrue('the original legacy stubCompetitor lookup/PipelineTab/CompanyTab/KeyEventsTab/MessagingTab body is still present, untouched', profileSource.includes('const stubCompetitor = competitors.find((c) => c.id === id)') && profileSource.includes('<PipelineTab competitor={competitor} />') && profileSource.includes('<KeyEventsTab competitor={competitor} />'))

console.log('7. Profile header (V1): Direct/Indirect badge + Watching state restored, no dead "Summarize for me" button')
assertTrue('the V1 header renders the Direct/Indirect badge', profileV1Source.includes('RELATIONSHIP_LABEL[competitor.userRelationship]'))
assertTrue('the V1 header shows a Watching indicator (being tracked IS the watch state -- no fake toggle)', profileV1Source.includes('Watching'))
assertTrue('no "Summarize for me" / AIButton dead action on the V1 profile (no real endpoint backs one)', !profileV1Source.includes('Summarise for me') && !profileV1Source.includes('AIButton'))
assertTrue('breadcrumb still reads "Back to" Competitors via a real Link', profileV1Source.includes('to="/competitors"') && profileV1Source.includes('Competitors'))

console.log('8. Summary panel (V1): deterministic factual template, never a new AI synthesis pipeline')
assertTrue('buildFactualCompanySummary composes companyName + real asset/signal counts + real latest date', overviewLibSource.includes('function buildFactualCompanySummary'))
assertTrue('zero-Signal case is an honest sentence, never a fabricated non-zero claim', overviewLibSource.includes('no source-backed Signals recorded yet'))
assertTrue('the V1 profile renders the summary panel above the tab content, using the pale-blue token surface', profileV1Source.includes('buildFactualCompanySummary') && profileV1Source.includes("background: 'var(--indigo-050)'"))

console.log('9. Tabs (V1): exactly Pipeline / Company / Messaging -- no Key Events tab restored for the V1 path')
assertTrue('V1 TABS lists exactly 3 tabs', (profileV1Source.match(/label: '(Pipeline|Company|Messaging)'/g) ?? []).length === 3)
assertTrue('no Key Events tab in the V1 profile', !profileV1Source.includes("label: 'Key Events'"))
assertTrue('V1 renders PipelineTabV1/CompanyTabV1/MessagingTabV1, never the legacy illustrative tab components', profileV1Source.includes('<PipelineTabV1') && profileV1Source.includes('<CompanyTabV1') && profileV1Source.includes('<MessagingTabV1') && !profileV1Source.includes("from '../components/competitor/tabs/PipelineTab'"))

console.log('10. Pipeline tab (V1): conservative stage mapping -- never guesses, never infers Filed from ambiguous regulatory chatter')
assertTrue('inferPipelineStage never treats REGULATORY_DECISION as Filed', !/hasFiled[\s\S]{0,120}REGULATORY_DECISION/.test(stageSource))
assertTrue('Filed requires REGULATORY_SUBMISSION or REGULATORY_ACCEPTANCE specifically', stageSource.includes("s.signalType === 'REGULATORY_SUBMISSION' || s.signalType === 'REGULATORY_ACCEPTANCE'"))
assertTrue('Approved requires a real FDA/EMA approval date or an explicit approval/launch Signal, never inferred from trial phase alone', stageSource.includes('original_approval_date') && stageSource.includes('marketing_authorisation_date') && stageSource.includes("'REGULATORY_APPROVAL' || s.signalType === 'COMMERCIAL_LAUNCH'"))
assertTrue('an asset with no real evidence returns the honest "Unknown / Not established", never a default phase', stageSource.includes("return 'Unknown / Not established'"))
assertTrue('the 6-stage lifecycle band matches the task\'s own PRECLINICAL/PHASE I/II/III/FILED/APPROVED order', (() => {
  const stages = ['Preclinical', 'Phase I', 'Phase II', 'Phase III', 'Filed', 'Approved']
  const idxs = stages.map((s) => stageSource.indexOf(`'${s}'`))
  return idxs.every((idx) => idx !== -1) && idxs.every((idx, i) => i === 0 || idx > idxs[i - 1])
})())

console.log('11. Pipeline tab (V1): no fake NCT ids, real Trial ID extraction only')
assertTrue('extractNctId matches a real NCT pattern from a source locator, never generates one', pipelineV1Source.includes('/NCT\\d{8}/i'))
// Excludes the file's own top-of-file docstring, which legitimately names
// the placeholder pattern to explain why it's deliberately never generated.
const pipelineV1Body = pipelineV1Source.slice(pipelineV1Source.indexOf('*/') + 2)
assertTrue('a missing Trial ID falls back to an honest placeholder, never a fake NCT0XXXXXXX', pipelineV1Body.includes('group.nctId ??') && !pipelineV1Body.includes('NCT0XXXXXXX'))
assertTrue('"Next expected" comes from the real fetchUpcomingCtgovMilestones client, never a predicted/generated date', pipelineV1Source.includes('CtgovUpcomingMilestone') && pipelineV1Source.includes('ESTIMATED'))
assertTrue('the Trial design disclosure renders an honest unavailable state when no structured payload exists, never invented trial-design prose', pipelineV1Source.includes('No structured trial design details are available yet for this asset.'))
assertTrue('an asset with zero real assets renders an honest empty state, not a blank tab', pipelineV1Source.includes('No canonical pipeline assets recorded yet'))
// Confirmed live (2026-08-25, AstraZeneca/heart failure control): seeding
// asset groups from evidence.assetId too pulled in ~20 raw CT.gov trial
// arms/interventions ("Placebo to match saxagliptin", "Blood samples") that
// never became a real Signal, diverging from the overview card's own
// Signal-only asset count. Assets must come from Signals only.
assertTrue('pipeline asset groups are seeded from Signals only, never from evidence.assetId (which includes noisy raw CT.gov arms that never qualified as a Signal)', !/const ids = new Set<string>\(\)\s*\n\s*signals\.forEach\(\(s\) => \{ if \(s\.assetId\) ids\.add\(s\.assetId\) \}\)\s*\n\s*evidence\.forEach/.test(pipelineV1Body))

console.log('12. Company tab (V1): only real, currently-supported aggregates -- financials/personnel/SWOT/hiring are NOT fabricated')
assertTrue('Company tab renders a Company snapshot with real tracked-asset/Signal/latest-Signal counts', companyV1Source.includes('Company snapshot') && companyV1Source.includes('computeCompanyOverviewStats'))
// Excludes the file's own top-of-file docstring, which legitimately names
// these concepts to explain why they're deliberately absent from the UI.
const companyV1Body = companyV1Source.slice(companyV1Source.indexOf('*/') + 2)
assertTrue('no Financials & R&D / Key Personnel / SWOT section exists in the V1 Company tab UI', !companyV1Body.includes('Financials') && !companyV1Body.includes('Key Personnel') && !companyV1Body.includes('SWOT'))
assertTrue('Recent activity groups the real Signal universe by the same taxonomy intelligenceFeedViews.ts uses, never a new invented scheme', companyV1Source.includes('PARTNERSHIP_OR_LICENSE') && companyV1Source.includes('REGULATORY_SUBMISSION'))
assertTrue('a company with zero Signals renders an honest empty state, never a fabricated non-zero activity list', companyV1Source.includes('No source-backed Signals recorded yet for'))

console.log('13. Messaging tab (V1): honest zero state, never illustrative positioning/quotes, never every Company Disclosure Signal reclassified as messaging')
assertTrue('the exact required zero-state copy is present', messagingV1Source.includes('No source-backed messaging intelligence is available yet for'))
assertTrue('no illustrative current-positioning/timeline/comparison content is fabricated', !messagingV1Source.includes('currentCoreMessage') && !messagingV1Source.includes('messagePillars') && !messagingV1Source.includes('vsPharmaInc'))

console.log('14. Backend read-path: evidence payload widened on the frontend client only, no new backend endpoint')
assertTrue('LandscapeEvidenceItem now exposes the already-returned backend payload', evidenceClientSource.includes('payload: Record<string, unknown> | null'))
assertTrue('the mapper passes raw.payload straight through, never re-shapes/re-derives it', evidenceClientSource.includes('payload: raw.payload ?? null'))

console.log('15. Regression: War Room / Intelligence Feed / Competitors routes and the 3-item Monitor nav are unaffected')
assertTrue('War Room ("/") route intact', appSource.includes('<Route path="/"                   element={<><RouteTitle title="War Room" /><WarRoom /></>} />'))
assertTrue('Intelligence Feed ("/intelligence") route intact', appSource.includes('<Route path="/intelligence"         element={<><RouteTitle title="Intelligence Feed" /><Portal /></>} />'))
assertTrue('Competitors ("/competitors") route intact, unchanged', appSource.includes('<Route path="/competitors"          element={<><RouteTitle title="Competitors" /><Competitors /></>} />'))
assertTrue('the CompetitorProfileV1 file exists on disk', exists('pages/CompetitorProfileV1.tsx'))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
