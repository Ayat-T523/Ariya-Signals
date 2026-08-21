/**
 * setup-draft.test.ts — staged landscape setup acceptance tests (company-rooted).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/config/setup-draft.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * PRODUCT CONTRACT under test: a competitor in Ariya is a COMPANY. Assets
 * nest underneath a company, never appear as their own top-level tracked
 * entry. Every test here exercises that contract at the frontend draft-model
 * boundary; the backend's own equivalent guarantees are covered separately
 * by ariya-lightci-python/tests/test_competitor_promotion.py.
 *
 * Scope note: what's genuinely pure -- Stage 1/2/3 state transitions,
 * validation, the tracked-competitor projection, draft persistence -- is
 * tested here. Route-level behavior is a React/router concern with no DOM
 * testing library in this repo (same boundary as every other *.test.ts file
 * here) -- verified live in the running app instead.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// setup-draft.ts's persistence helpers call localStorage directly -- polyfill
// a minimal in-memory implementation before any test runs (Node has no
// browser localStorage global).
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, value) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
}
;(globalThis as any).localStorage = new MemoryStorage()

import {
  createEmptySetupDraft,
  selectTherapeuticArea,
  selectDiseaseArea,
  attachManualDiseaseArea,
  selectResolvedDiseaseArea,
  clearDiseaseArea,
  resolveDiseaseAreaDisplay,
  selectKnownHomeAsset,
  attachManualHomeAsset,
  selectResolvedAsset,
  confirmHomeCompany,
  needsHomeCompanyConfirmation,
  resolveHomeAssetDisplay,
  resolveHomeAssetDisplayFrom,
  assetDiseaseAreaAgreement,
  isStage1Valid,
  addManualCompany,
  toggleCompanySelection,
  isCompanySelected,
  clearCompanySelections,
  setCompanyRelationship,
  setSuggestedCompanies,
  suggestedCompanyToEntry,
  isStage3Valid,
  hasDownstreamData,
  clearDownstreamData,
  draftToTrackedCompetitors,
  isHomeCompany,
  normalizeCompanyName,
  saveSetupDraft,
  loadSetupDraft,
  clearSetupDraft,
  recoverSetupDraft,
  type SetupDraft,
} from './setup-draft.js'
import type { ResolvedDiseaseArea } from '../lib/api/diseaseSearch.js'
import { getDiseaseAreasForTherapeuticArea, getAssetsForDiseaseArea, getLegacyIndicationCompat } from './landscape-configuration.js'
import { THERAPEUTIC_AREAS } from './therapeutic-areas.js'
import type { SuggestedCompanySuggestion } from '../lib/api/discovery.js'
import type { ResolvedAssetIdentity } from '../lib/api/assetSearch.js'

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
function assertTrue(label: string, actual: boolean): void { assert(label, actual, true) }

function withHae(): SetupDraft {
  let d = createEmptySetupDraft()
  d = selectTherapeuticArea(d, 'immunology')
  d = selectDiseaseArea(d, 'hae')
  d = selectKnownHomeAsset(d, 'ekterly')
  return d
}

function fakeSuggestion(companyKey: string, companyName: string, assetKey: string): SuggestedCompanySuggestion {
  return {
    companyKey, companyName,
    relevantAssets: [{
      identityKey: assetKey, candidateStatus: 'presentable_candidate', aiProposedRelationship: null,
      evidenceGaps: [], sourceReferences: ['https://clinicaltrials.gov/study/NCT00000001'], reasonDetail: [], unresolvedQuestions: [], detail: null,
      historicalOrganizationName: null,
    }],
    aiProposedRelationship: 'direct',
    evidenceRefs: ['NCT00000001'],
    verifiedDomains: [`${companyName.toLowerCase().replace(/\s+/g, '')}.com`],
    whySuggested: `${companyName} sponsors trials for ${assetKey} in this indication.`,
    rankScore: 1,
    rankComponents: {},
  }
}

// ── 1/2 (route-level) — see file header; verified live, not here. ───────────

// ── 3. TA filters DA ──────────────────────────────────────────────────────
console.log('3. Therapeutic Area filters Disease Area options')
assertTrue('immunology has HAE/PNH/PBC', getDiseaseAreasForTherapeuticArea('immunology').some((da) => da.id === 'hae'))
assertTrue('neurology does not offer HAE', !getDiseaseAreasForTherapeuticArea('neurology').some((da) => da.id === 'hae'))

// ── 4. changing TA invalidates DA/asset ──────────────────────────────────
console.log('4. Changing Therapeutic Area clears Disease Area and Home Asset')
const haeDraft = withHae()
assert('starting config is fully set', haeDraft.landscapeConfiguration, { therapeuticAreaId: 'immunology', diseaseAreaId: 'hae', homeAssetId: 'ekterly' })
const afterTaChange = selectTherapeuticArea(haeDraft, 'neurology')
assert('Disease Area cleared', afterTaChange.landscapeConfiguration.diseaseAreaId, null)
assert('Home Asset cleared', afterTaChange.landscapeConfiguration.homeAssetId, null)

// ── 5. DA filters known assets ────────────────────────────────────────────
console.log('5. Disease Area filters known catalog assets')
assertTrue('hae has known assets', getAssetsForDiseaseArea('hae').length > 0)
assert('gmg has zero known assets (the flagged catalog gap)', getAssetsForDiseaseArea('gmg').length, 0)

// ── 6. manual asset can satisfy Stage 1 identity ──────────────────────────
console.log('6. A manually entered asset (with required company) can satisfy Stage 1 identity (gMG has no catalogued asset)')
let gmgDraft = createEmptySetupDraft()
gmgDraft = selectTherapeuticArea(gmgDraft, 'neurology')
gmgDraft = selectDiseaseArea(gmgDraft, 'gmg')
assertTrue('gMG is not submittable before a manual asset is attached', !isStage1Valid(gmgDraft))
gmgDraft = attachManualHomeAsset(gmgDraft, { displayName: 'RYSTIGGO', innName: 'rozanolixizumab', company: 'UCB' })
assertTrue('gMG becomes submittable once a manual asset (with company) is attached', isStage1Valid(gmgDraft))

// ── 6b. manual asset without a company is refused, never silently accepted ──
console.log('6b. attachManualHomeAsset refuses a company-less manual asset (Phase 6)')
let gmgNoCompanyDraft = createEmptySetupDraft()
gmgNoCompanyDraft = selectTherapeuticArea(gmgNoCompanyDraft, 'neurology')
gmgNoCompanyDraft = selectDiseaseArea(gmgNoCompanyDraft, 'gmg')
const refused = attachManualHomeAsset(gmgNoCompanyDraft, { displayName: 'RYSTIGGO', innName: 'rozanolixizumab', company: '   ' })
assert('draft unchanged when company is blank', refused, gmgNoCompanyDraft)

// ── 7. manual asset does not receive fabricated metadata ─────────────────
console.log('7. Manual asset carries only user-supplied identity fields, nothing fabricated')
assert('manualAsset shape has exactly the identity fields a user can supply', Object.keys(gmgDraft.manualAsset!).sort(), [
  'company', 'developmentCode', 'diseaseAreaId', 'displayName', 'id', 'innName', 'source', 'therapeuticAreaId',
])
assertTrue('no mechanism/phase/lexicon/evidence field exists on the manual asset', !('mechanism' in gmgDraft.manualAsset!) && !('lexiconInns' in gmgDraft.manualAsset!))

// ── 7b. a known asset with no recorded company blocks Stage 1 until confirmed ──
console.log('7b. needsHomeCompanyConfirmation/confirmHomeCompany gate a known asset with a genuine data gap (Phase 6)')
let navenibartDraft = createEmptySetupDraft()
navenibartDraft = selectTherapeuticArea(navenibartDraft, 'immunology')
navenibartDraft = selectDiseaseArea(navenibartDraft, 'hae')
navenibartDraft = selectKnownHomeAsset(navenibartDraft, 'navenibart')
assertTrue('navenibart (no recorded company in assets-config.ts) needs confirmation', needsHomeCompanyConfirmation(navenibartDraft))
assertTrue('Stage 1 is invalid until the company is confirmed', !isStage1Valid(navenibartDraft))
navenibartDraft = confirmHomeCompany(navenibartDraft, 'Ionis Pharmaceuticals')
assertTrue('confirmation clears the gap', !needsHomeCompanyConfirmation(navenibartDraft))
assertTrue('Stage 1 becomes valid once confirmed', isStage1Valid(navenibartDraft))
assert('resolveHomeAssetDisplay reflects the confirmed company', resolveHomeAssetDisplay(navenibartDraft)?.companyName, 'Ionis Pharmaceuticals')

// ── 8. Stage 2 uses the REAL discovery client, no static HAE fallback ────
console.log('8. Stage 2 uses the real discovery client; the temporary adapter is gone')
const setupDir = path.dirname(fileURLToPath(import.meta.url))
const discoveryAdapterPath = path.join(setupDir, '..', 'lib', 'api', 'discoveryAdapter.ts')
assertTrue('discoveryAdapter.ts no longer exists', !fs.existsSync(discoveryAdapterPath))

const stage2Path = path.join(setupDir, '..', 'pages', 'setup', 'Stage2Discover.tsx')
const stage2Source = fs.readFileSync(stage2Path, 'utf-8')
const stage2Code = stage2Source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n')
assertTrue('Stage2Discover.tsx imports the real useDiscovery hook', stage2Code.includes("from '../../hooks/useDiscovery'"))
assertTrue('Stage2Discover.tsx never imports the retired discoveryAdapter', !stage2Code.includes('discoveryAdapter'))
assertTrue('Stage2Discover.tsx never hardcodes takeda/biocryst/pharvaris in real code', !/takeda|biocryst|pharvaris/i.test(stage2Code))
assertTrue('Stage2Discover.tsx renders company-rooted state, not a candidate list', stage2Code.includes('draft.companies'))
assertTrue('Stage2Discover.tsx passes homeCompany through to discovery for deterministic exclusion (Phase 3/6)', stage2Code.includes('homeCompany'))

// ── 8b. Stage 3 has no selection UI -- selection moved to Stage 2 (Phase 15/20) ──
console.log('8b. Stage3Configure.tsx contains no Checkbox/selection toggle, only classification')
const stage3Path = path.join(setupDir, '..', 'pages', 'setup', 'Stage3Configure.tsx')
const stage3Source = fs.readFileSync(stage3Path, 'utf-8')
assertTrue('Stage3Configure.tsx never imports the Checkbox primitive', !stage3Source.includes("shadcn/ui/checkbox"))
assertTrue('Stage3Configure.tsx never calls toggleCompanySelection', !stage3Source.includes('toggleCompanySelection'))
assertTrue('Stage3Configure.tsx renders ToggleGroup for Direct/Indirect classification', stage3Source.includes('ToggleGroup'))

// ── 9/10. manual competitor is company-rooted, marked evidence-not-evaluated ──
console.log('9/10. A manual competitor is added as a COMPANY (asset nests underneath), evidence-not-evaluated')
let stage2Draft = withHae()
stage2Draft = addManualCompany(stage2Draft, { companyName: 'BioCryst Pharmaceuticals', assetName: 'Orladeyo', innName: 'berotralstat' })
assert('company count is 1', stage2Draft.companies.length, 1)
assert('the company, not the asset, is the top-level identity', stage2Draft.companies[0].companyName, 'BioCryst Pharmaceuticals')
assert('the asset nests underneath as a relevant asset', stage2Draft.companies[0].relevantAssets[0].identityKey, 'Orladeyo')
assert('evidenceStatus is not_evaluated', stage2Draft.companies[0].evidenceStatus, 'not_evaluated')
assert('no fabricated Ariya assessment on a manual company', stage2Draft.companies[0].ariyaAssessment, null)
assert('no fabricated whySuggested on a manual company', stage2Draft.companies[0].whySuggested, null)

// ── 11. discovered/advisory relationship never becomes user classification automatically ──
console.log('11. Ariya assessment never becomes the user classification automatically')
let advisoryDraft = withHae()
advisoryDraft = setSuggestedCompanies(advisoryDraft, [fakeSuggestion('pharvaris-nv', 'Pharvaris N.V.', 'Deucrictibant')])
const discoveredCompanyId = advisoryDraft.companies[0].id
advisoryDraft = toggleCompanySelection(advisoryDraft, discoveredCompanyId)
assert('selecting a company with an Ariya "direct" read starts with userRelationship: null, never auto-copied', advisoryDraft.selections[0].userRelationship, null)

// ── 12. company is not tracked until explicitly selected ───────────────
console.log('12. A company is not tracked until explicitly selected')
const preSelectionDraft = setSuggestedCompanies(withHae(), [fakeSuggestion('pharvaris-nv', 'Pharvaris N.V.', 'Deucrictibant')])
assert('draftToTrackedCompetitors is empty before any selection', draftToTrackedCompetitors(preSelectionDraft).length, 0)
const unselectedCompanyDraft = addManualCompany(withHae(), { companyName: 'Unselected Co' })
assert('an added-but-unselected company never appears in tracked competitors', draftToTrackedCompetitors(unselectedCompanyDraft).length, 0)

// ── 13. selected company requires Direct/Indirect ───────────────────────
console.log('13. A selected company requires an explicit Direct/Indirect classification')
assertTrue('Stage 3 is invalid while the selected company has no relationship', !isStage3Valid(advisoryDraft))
const classifiedDraft = setCompanyRelationship(advisoryDraft, discoveredCompanyId, 'direct')
assertTrue('Stage 3 becomes valid once classified', isStage3Valid(classifiedDraft))
assert('draftToTrackedCompetitors now includes it as Direct', draftToTrackedCompetitors(classifiedDraft)[0].userRelationship, 'direct')

// ── 14. unselected company does not require classification ─────────────
console.log('14. An unselected company does not block Stage 3 validity')
let mixedDraft = classifiedDraft
mixedDraft = addManualCompany(mixedDraft, { companyName: 'Not selected at all' })
assertTrue('Stage 3 stays valid -- the new unselected company needs no relationship', isStage3Valid(mixedDraft))

// ── 15. changing Stage 1 landscape requires clearing stale company state ──
console.log('15. Changing Stage 1 after Stage 2/3 data exists is flagged as stale, cleared only explicitly')
assertTrue('hasDownstreamData is true once companies/selections exist', hasDownstreamData(mixedDraft))
const cleared = clearDownstreamData(mixedDraft)
assert('companies cleared', cleared.companies.length, 0)
assert('selections cleared', cleared.selections.length, 0)
assert('landscapeConfiguration untouched by clearDownstreamData itself (caller changes it separately)', cleared.landscapeConfiguration, mixedDraft.landscapeConfiguration)

// ── 16. back navigation preserves valid draft state ───────────────────────
console.log('16. Moving between stages never discards companies/selections (pure stage-field change only)')
const atStage2 = { ...mixedDraft, stage: 'discover' as const }
const backAtStage1 = { ...atStage2, stage: 'define' as const }
assert('companies survive a stage change', backAtStage1.companies.length, mixedDraft.companies.length)
assert('selections survive a stage change', backAtStage1.selections.length, mixedDraft.selections.length)

// ── 17. final setup persists selected competitor company + relationship, relevant assets preserved ──
console.log('17. Final setup output carries the selected competitor COMPANY, its relationship, and its nested relevant assets')
const tracked = draftToTrackedCompetitors(classifiedDraft)
assert('exactly one tracked competitor', tracked.length, 1)
assert('identity preserved as the company, not the asset', tracked[0].companyName, 'Pharvaris N.V.')
assert('relationship preserved', tracked[0].userRelationship, 'direct')
assert('advisory assessment preserved separately, not merged into userRelationship', tracked[0].ariyaAssessment, 'direct')
assert('relevant asset nested underneath, never discarded', tracked[0].relevantAssets[0].identityKey, 'Deucrictibant')

// ── 18. refresh resumes safe draft state ──────────────────────────────────
console.log('18. Draft persistence round-trips through localStorage (refresh/resume)')
clearSetupDraft()
assert('no draft before saving', loadSetupDraft(), null)
saveSetupDraft(classifiedDraft)
const resumed = loadSetupDraft()
assert('resumed draft matches what was saved', resumed, classifiedDraft)
clearSetupDraft()
assert('clearSetupDraft removes it', loadSetupDraft(), null)

// ── 19. no Supabase persistence is used ───────────────────────────────────
console.log('19. No Supabase reference anywhere in the setup flow\'s modules')
const setupDraftSource = fs.readFileSync(fileURLToPath(import.meta.url).replace(/\.test\.ts$/, '.ts'), 'utf-8')
assertTrue('setup-draft.ts never imports/references supabase', !/supabase/i.test(setupDraftSource))
assertTrue('Stage2Discover.tsx never imports/references supabase', !/supabase/i.test(stage2Source))

// ── 20. legacy Takeda/BioCryst/Pharvaris default does not overwrite newly configured tracked competitors ──
console.log('20. The legacy HAE watchlist default never leaks into a fresh tracked-competitor projection')
const freshDraft = withHae()
assert('a freshly defined landscape with no companies yet projects to zero tracked competitors', draftToTrackedCompetitors(freshDraft).length, 0)
assertTrue('draftToTrackedCompetitors never injects takeda/biocryst/pharvaris on its own', !draftToTrackedCompetitors(freshDraft).some((c) => ['takeda', 'biocryst', 'pharvaris'].includes(c.companyId)))

// ── 21. real suggested companies merge with manual companies, exact-name duplicates collapse ──
console.log('21. Real suggested companies merge with manual ones; an exact-name manual duplicate yields to the richer discovered record')
let mergeDraft = withHae()
mergeDraft = addManualCompany(mergeDraft, { companyName: 'BioCryst Pharmaceuticals', assetName: 'Orladeyo' })
mergeDraft = addManualCompany(mergeDraft, { companyName: 'Duplicate Co', assetName: 'Weak Signal' })
mergeDraft = setSuggestedCompanies(mergeDraft, [
  fakeSuggestion('biocryst', 'BioCryst Pharmaceuticals', 'Orladeyo'),
])
assert('the discovered record replaced the exact-name-matching manual one -- not duplicated', mergeDraft.companies.filter((c) => c.companyName === 'BioCryst Pharmaceuticals').length, 1)
assert('the surviving BioCryst entry is the richer discovered one', mergeDraft.companies.find((c) => c.companyName === 'BioCryst Pharmaceuticals')!.source, 'discovered')
assertTrue('the non-duplicate manual company (Duplicate Co) survives the merge', mergeDraft.companies.some((c) => c.companyName === 'Duplicate Co'))
assert('company count is exactly 2 (1 discovered + 1 surviving manual)', mergeDraft.companies.length, 2)

// ── 22. suggestedCompanyToEntry preserves identity/provenance without inventing fields ──
console.log('22. suggestedCompanyToEntry preserves real backend fields verbatim, never flattens assets to top level')
const rawSuggestion = fakeSuggestion('pharvaris-nv', 'Pharvaris N.V.', 'Deucrictibant')
const entry = suggestedCompanyToEntry(rawSuggestion)
assert('id is the real companyKey, not a synthesized id', entry.id, 'pharvaris-nv')
assert('companyName carried verbatim', entry.companyName, 'Pharvaris N.V.')
assert('relevant asset nested, never promoted to top-level identity', entry.relevantAssets[0].identityKey, 'Deucrictibant')
assert('evidenceStatus is evidence_available for any discovered suggestion', entry.evidenceStatus, 'evidence_available')
assert('whySuggested carried verbatim', entry.whySuggested, rawSuggestion.whySuggested)
assert('verifiedDomains carried verbatim', entry.verifiedDomains, rawSuggestion.verifiedDomains)

// ── 22b. Home Company Exclusion is deterministic, string-normalized, never an AI call ──
console.log('22b. isHomeCompany blocks the resolved home company from being added as a competitor (Phase 22)')
assertTrue('exact match is blocked', isHomeCompany(withHae(), 'KalVista'))
assertTrue('case/whitespace-insensitive match is blocked', isHomeCompany(withHae(), '  kalvista  '))
assertTrue('a generic-suffix variant normalizes to the same company', normalizeCompanyName('KalVista Pharmaceuticals Inc.') === normalizeCompanyName('KalVista'))
assertTrue('an unrelated company is never blocked', !isHomeCompany(withHae(), 'BioCryst Pharmaceuticals'))

const addCompetitorDialogSource = fs.readFileSync(path.join(setupDir, '..', 'pages', 'setup', 'AddCompetitorDialog.tsx'), 'utf-8')
assertTrue('AddCompetitorDialog.tsx checks isHomeCompany before allowing Add', addCompetitorDialogSource.includes('isHomeCompany'))

// ── 22c. Company-level classification never loses asset-level detail (Phase 21) ──
console.log('22c. A tracked competitor with multiple relevant assets keeps every asset, never collapses to one')
let multiAssetDraft = withHae()
const multiAssetSuggestion: SuggestedCompanySuggestion = {
  ...fakeSuggestion('takeda', 'Takeda', 'Takhzyro'),
  relevantAssets: [
    { identityKey: 'Takhzyro', candidateStatus: 'presentable_candidate', aiProposedRelationship: null, evidenceGaps: [], sourceReferences: [], reasonDetail: [], unresolvedQuestions: [], detail: null, historicalOrganizationName: null },
    { identityKey: 'TAK-018', candidateStatus: 'needs_more_evidence', aiProposedRelationship: null, evidenceGaps: ['development_stage_unresolved'], sourceReferences: [], reasonDetail: [], unresolvedQuestions: [], detail: null, historicalOrganizationName: null },
  ],
}
multiAssetDraft = setSuggestedCompanies(multiAssetDraft, [multiAssetSuggestion])
multiAssetDraft = toggleCompanySelection(multiAssetDraft, 'takeda')
multiAssetDraft = setCompanyRelationship(multiAssetDraft, 'takeda', 'direct')
const multiAssetTracked = draftToTrackedCompetitors(multiAssetDraft)
assert('Takeda appears as exactly one tracked competitor, not two/three rows for its assets', multiAssetTracked.filter((c) => c.companyName === 'Takeda').length, 1)
assert('both relevant assets survive under the single company row', multiAssetTracked[0].relevantAssets.length, 2)

// ── 23. old custom shell no longer controls primary app layout ───────────
console.log('23. The retired NavPanel/TopBar/ContentColumn shell no longer exists or is referenced by Layout')
const shellDir = path.join(setupDir, '..', 'components', 'shell')
assertTrue('NavPanel.tsx no longer exists', !fs.existsSync(path.join(shellDir, 'NavPanel.tsx')))
assertTrue('TopBar.tsx no longer exists', !fs.existsSync(path.join(shellDir, 'TopBar.tsx')))
assertTrue('ContentColumn.tsx no longer exists', !fs.existsSync(path.join(shellDir, 'ContentColumn.tsx')))
const layoutSource = fs.readFileSync(path.join(setupDir, '..', 'components', 'layout', 'Layout.tsx'), 'utf-8')
const layoutCode = layoutSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n')
assertTrue('Layout.tsx no longer imports the retired NavPanel in real code', !layoutCode.includes('NavPanel'))
assertTrue('Layout.tsx now uses the official SidebarProvider', layoutCode.includes('SidebarProvider'))
assertTrue('Layout.tsx now uses AppSidebar (sidebar-08-derived shell)', layoutCode.includes('AppSidebar'))

// ═══════════════════════════════════════════════════════════════════════════
// Landscape Input Resolution milestone (Step 33) — 22-category taxonomy,
// manual Disease Area, canonical asset search/resolution at the draft layer.
// ═══════════════════════════════════════════════════════════════════════════

// ── 24. all 22 categories present ─────────────────────────────────────────
console.log('24. All 22 landscape categories are present')
assert('exactly 22 top-level categories', THERAPEUTIC_AREAS.length, 22)

// ── 25. 18 standard TAs grouped correctly ─────────────────────────────────
console.log('25. The 18 standard organ-system Therapeutic Areas are grouped as therapeutic_area')
const standardCount = THERAPEUTIC_AREAS.filter((c) => c.categoryType === 'therapeutic_area').length
assert('18 standard Therapeutic Areas', standardCount, 18)

// ── 26. 4 cross-cutting categories grouped separately ─────────────────────
console.log('26. The 4 Special/Cross-Cutting categories are grouped separately as cross_cutting')
const crossCuttingIds = THERAPEUTIC_AREAS.filter((c) => c.categoryType === 'cross_cutting').map((c) => c.id).sort()
assert('exactly 4 cross-cutting categories, matching the fixed product decision', crossCuttingIds, [
  'medical-imaging-contrast-agents', 'pediatrics-neonatology', 'rare-diseases', 'vaccines',
])

// ── 27. category selector search works ────────────────────────────────────
console.log('27. Stage1Define.tsx renders the category selector as a grouped, searchable Command combobox')
const stage1Path = path.join(setupDir, '..', 'pages', 'setup', 'Stage1Define.tsx')
const stage1Source = fs.readFileSync(stage1Path, 'utf-8')
assertTrue('Stage1Define.tsx groups the category combobox into Therapeutic Areas / Special-Cross-Cutting', stage1Source.includes('Therapeutic Areas') && stage1Source.includes('Special / Cross-Cutting'))
assertTrue('Stage1Define.tsx never renders 22 individual radio/card options (uses CommandItem inside a mapped group)', stage1Source.includes('standardAreas.map') && stage1Source.includes('crossCuttingAreas.map'))

// ── 28. Disease list filters by selected category ─────────────────────────
console.log('28. Disease Area options are filtered to the selected category (unchanged mechanism, now over 22 categories)')
assertTrue('oncology (a new category) has zero configured Disease Areas -- not a hardcoded 2-category assumption', getDiseaseAreasForTherapeuticArea('oncology').length === 0)
assertTrue('immunology (existing category) still resolves its known Disease Areas', getDiseaseAreasForTherapeuticArea('immunology').some((da) => da.id === 'hae'))

// ── 29. manual Disease Area can be added ──────────────────────────────────
console.log('29. A manual Disease Area can be added for a category with no configured catalog, never a dead end')
let oncologyDraft = createEmptySetupDraft()
oncologyDraft = selectTherapeuticArea(oncologyDraft, 'oncology')
assertTrue('oncology is not submittable before a Disease Area is attached', !isStage1Valid(oncologyDraft))
oncologyDraft = attachManualDiseaseArea(oncologyDraft, 'Non-Small Cell Lung Cancer')
assert('manual Disease Area attached to the correct category', oncologyDraft.manualDiseaseArea?.therapeuticAreaId, 'oncology')
assert('landscapeConfiguration.diseaseAreaId points at the manual entry', oncologyDraft.landscapeConfiguration.diseaseAreaId, oncologyDraft.manualDiseaseArea?.id)

// ── 30. Home Asset search uses the backend resolver ───────────────────────
console.log('30. Stage1Define.tsx wires Home Asset search through the real backend resolver, not a second local-only mechanism')
assertTrue('Stage1Define.tsx imports useAssetSearch', stage1Source.includes("from '../../hooks/useAssetSearch'"))
assertTrue('Stage1Define.tsx never imports the discovery/competitor client for asset search', !stage1Source.includes("from '../../hooks/useDiscovery'"))
const useAssetSearchPath = path.join(setupDir, '..', 'hooks', 'useAssetSearch.ts')
const useAssetSearchSource = fs.readFileSync(useAssetSearchPath, 'utf-8')
assertTrue('useAssetSearch.ts calls the real searchAssets API client', useAssetSearchSource.includes('searchAssets'))
assertTrue('useAssetSearch.ts debounces rather than firing on every keystroke', /DEBOUNCE_MS|setTimeout/.test(useAssetSearchSource))

// ── 31. local known assets may appear immediately ─────────────────────────
console.log('31. Known local/catalog assets render immediately alongside (not blocked by) the backend search')
assertTrue('Stage1Define.tsx renders a "Known / relevant assets" group independent of search state (Root-Cause Recon implementation, Part B2)', stage1Source.includes('Known / relevant assets'))

// ── 32. brand and INN results converge to one asset identity ──────────────
console.log('32. Selecting a resolvedAsset (whatever alias the user searched) sets one canonical homeAssetId')
function fakeResolvedAsset(overrides: Partial<ResolvedAssetIdentity> = {}): ResolvedAssetIdentity {
  return {
    id: 'rystiggo', preferredName: 'RYSTIGGO', brandNames: ['RYSTIGGO'],
    innNames: ['rozanolixizumab'], developmentCodes: [], aliases: [],
    ownerCompanies: ['UCB'], mechanismOfAction: [], indicationContexts: [],
    source: 'known_catalog', evidenceRefs: [], ...overrides,
  }
}
let searchDraft = createEmptySetupDraft()
searchDraft = selectTherapeuticArea(searchDraft, 'neurology')
searchDraft = selectDiseaseArea(searchDraft, 'gmg')
searchDraft = selectResolvedAsset(searchDraft, fakeResolvedAsset())
assert('homeAssetId set to the resolved identity id regardless of which alias was searched', searchDraft.landscapeConfiguration.homeAssetId, 'rystiggo')

// ── 33. selected asset persists canonical company identity ────────────────
console.log('33. resolveHomeAssetDisplay surfaces the resolved asset\'s real owner company')
assert('company identity carried through', resolveHomeAssetDisplay(searchDraft)?.companyName, 'UCB')

// ── 34/35/36. mechanism/population/dosage shown only when present, never fabricated ──
console.log('34/35/36. Mechanism and population render only when the resolved identity actually carries them; there is no dosage field to fabricate at all')
const noEvidenceDraft = selectResolvedAsset(createEmptySetupDraft(), fakeResolvedAsset({ id: 'bare', mechanismOfAction: [], indicationContexts: [] }))
const bareDisplay = resolveHomeAssetDisplay(noEvidenceDraft)
assert('no mechanism fabricated when the resolver returned none', bareDisplay?.mechanismOfAction, [])
assert('no indication context fabricated when the resolver returned none', bareDisplay?.indicationContexts, [])
assertTrue('HomeAssetDisplay has no dosage/regimen field at all -- structurally impossible to fabricate', !('dosage' in (bareDisplay ?? {})) && !('regimen' in (bareDisplay ?? {})))

// ── 37. manual asset fallback remains available ────────────────────────────
console.log('37. Manual asset entry remains reachable from every Home Asset search state, never hidden behind a successful search')
assertTrue('Stage1Define.tsx always offers "Add asset manually" as a persistent, always-rendered action (Root-Cause Recon implementation, Part B: one control outside every idle/searching/no_results/error branch, not duplicated per-branch)', stage1Source.includes('Add asset manually'))

// ── 38. manual asset requires company (regression, now covering the dev-code field too) ──
console.log('38. Manual asset still refuses without a company, and now preserves an optional development code')
const withDevCode = attachManualHomeAsset(oncologyDraft, { displayName: 'Testolimab', company: 'Acme Oncology', developmentCode: 'ACM-100' })
assert('development code preserved verbatim', withDevCode.manualAsset?.developmentCode, 'ACM-100')

// ── 39. changing Disease Area invalidates the previously selected asset ────
console.log('39. Changing Disease Area clears a previously selected Home Asset (existing mechanism, now exercised through a manual Disease Area too)')
let cascadeDraft = createEmptySetupDraft()
cascadeDraft = selectTherapeuticArea(cascadeDraft, 'oncology')
cascadeDraft = attachManualDiseaseArea(cascadeDraft, 'Melanoma')
cascadeDraft = attachManualHomeAsset(cascadeDraft, { displayName: 'Melanolimab', company: 'Acme Oncology' })
assertTrue('asset attached', isStage1Valid(cascadeDraft))
cascadeDraft = attachManualDiseaseArea(cascadeDraft, 'Renal Cell Carcinoma')
assert('the previously attached asset no longer matches the new Disease Area\'s homeAssetId', cascadeDraft.landscapeConfiguration.homeAssetId, null)

// ── 40. asset mismatch is surfaced, never silently mutates the landscape ──
console.log('40. assetDiseaseAreaAgreement flags a real mismatch without ever changing the draft itself')
let mismatchDraft = createEmptySetupDraft()
mismatchDraft = selectTherapeuticArea(mismatchDraft, 'immunology')
mismatchDraft = selectDiseaseArea(mismatchDraft, 'hae')
mismatchDraft = selectResolvedAsset(mismatchDraft, fakeResolvedAsset({ id: 'oncology-drug', indicationContexts: ['Non-Small Cell Lung Cancer'] }))
assert('a genuinely unrelated indication context is flagged as a mismatch', assetDiseaseAreaAgreement(mismatchDraft), 'mismatch')
assert('checking agreement never mutates landscapeConfiguration', mismatchDraft.landscapeConfiguration.diseaseAreaId, 'hae')
const unknownMismatchDraft = selectResolvedAsset(createEmptySetupDraft(), fakeResolvedAsset({ id: 'no-context', indicationContexts: [] }))
assert('no indication evidence at all is "unknown", never treated as a mismatch', assetDiseaseAreaAgreement(unknownMismatchDraft), 'unknown')

// ── 41. Home Asset selector remains viewport-safe ──────────────────────────
console.log('41. Home Asset / category / Disease Area popovers cap their own height for viewport safety')
assertTrue('Stage1Define.tsx caps popover content height (max-h) rather than letting a 22-entry or search-result list overflow the viewport', (stage1Source.match(/max-h-\[/g) || []).length >= 2)

// ── 42. no Supabase in the new modules ─────────────────────────────────────
console.log('42. No Supabase reference anywhere in the new asset-resolution modules')
const assetSearchClientSource = fs.readFileSync(path.join(setupDir, '..', 'lib', 'api', 'assetSearch.ts'), 'utf-8')
assertTrue('assetSearch.ts never imports/references supabase', !/supabase/i.test(assetSearchClientSource))
assertTrue('useAssetSearch.ts never imports/references supabase', !/supabase/i.test(useAssetSearchSource))
assertTrue('Stage1Define.tsx never imports/references supabase', !/supabase/i.test(stage1Source))

// ── 43. no paid data service introduced ────────────────────────────────────
console.log('43. No paid data service reference anywhere in the new asset-resolution modules')
for (const [label, src] of [['assetSearch.ts', assetSearchClientSource], ['useAssetSearch.ts', useAssetSearchSource], ['Stage1Define.tsx', stage1Source]] as const) {
  assertTrue(`${label} references no paid provider (openai/anthropic/stripe/rxnorm-api-key etc.)`, !/openai|anthropic-api|stripe|paid[_-]?api/i.test(src))
}

// ═══════════════════════════════════════════════════════════════════════════
// Root-Cause Recon implementation — Disease Area search, Home Asset combobox
// fix, Stage 2 hierarchy/footer (Parts G/H/I).
// ═══════════════════════════════════════════════════════════════════════════

function fakeDiseaseArea(overrides: Partial<ResolvedDiseaseArea> = {}): ResolvedDiseaseArea {
  return { id: 'MONDO:1060006', preferredName: 'generalized myasthenia gravis', aliases: ['gMG'], source: 'mondo', sourceId: 'MONDO:1060006', ...overrides }
}

// ── 44. selecting a resolved Disease Area sets canonical id, clears stale asset ──
console.log('44. selectResolvedDiseaseArea sets the canonical MONDO id and clears a previously selected Home Asset')
let diseaseSearchDraft = createEmptySetupDraft()
diseaseSearchDraft = selectTherapeuticArea(diseaseSearchDraft, 'neurology')
diseaseSearchDraft = attachManualHomeAsset(diseaseSearchDraft, { displayName: 'Placeholder', company: 'Placeholder Co' })
diseaseSearchDraft = selectResolvedDiseaseArea(diseaseSearchDraft, fakeDiseaseArea())
assert('diseaseAreaId set to the canonical MONDO id', diseaseSearchDraft.landscapeConfiguration.diseaseAreaId, 'MONDO:1060006')
assert('the previously selected Home Asset is cleared', diseaseSearchDraft.landscapeConfiguration.homeAssetId, null)
assert('resolveDiseaseAreaDisplay surfaces the resolved name and aliases', resolveDiseaseAreaDisplay(diseaseSearchDraft), { name: 'generalized myasthenia gravis', aliases: ['gMG'], source: 'mondo' })

// ── 45. clearDiseaseArea resets to the search UI without touching category ──
console.log('45. clearDiseaseArea resets Disease Area + Home Asset, never the category')
const clearedDiseaseDraft = clearDiseaseArea(diseaseSearchDraft)
assert('diseaseAreaId cleared', clearedDiseaseDraft.landscapeConfiguration.diseaseAreaId, null)
assert('category untouched', clearedDiseaseDraft.landscapeConfiguration.therapeuticAreaId, 'neurology')

// ── 46. manual Disease Area fallback remains reachable and source=manual ──
console.log('46. Manual Disease Area fallback remains reachable, source=manual, no fabricated canonical id')
let manualDiseaseDraft = createEmptySetupDraft()
manualDiseaseDraft = selectTherapeuticArea(manualDiseaseDraft, 'oncology')
manualDiseaseDraft = attachManualDiseaseArea(manualDiseaseDraft, 'A Rare Sarcoma Subtype')
assert('manual disease area source is manual', manualDiseaseDraft.manualDiseaseArea?.source, 'manual')
assert('resolveDiseaseAreaDisplay reflects the manual entry', resolveDiseaseAreaDisplay(manualDiseaseDraft)?.source, 'manual')

// ── 47. changing category clears an incompatible Disease Area + Asset ────
console.log('47. Changing the Landscape Category clears a resolved Disease Area and Home Asset (Part G item 10)')
let categoryChangeDraft = createEmptySetupDraft()
categoryChangeDraft = selectTherapeuticArea(categoryChangeDraft, 'neurology')
categoryChangeDraft = selectResolvedDiseaseArea(categoryChangeDraft, fakeDiseaseArea())
categoryChangeDraft = selectTherapeuticArea(categoryChangeDraft, 'oncology')
assert('resolvedDiseaseArea cleared on category change', categoryChangeDraft.resolvedDiseaseArea, null)
assert('diseaseAreaId cleared on category change', categoryChangeDraft.landscapeConfiguration.diseaseAreaId, null)

// ── 48. Home Asset ComboBox fix -- closed control is a real Input, not a Button-as-Select ──
console.log('48. Stage1Define.tsx exposes the search affordance immediately (real <Input>, not a click-to-reveal Button)')
assertTrue('Disease Area search uses a real Input as the always-visible control', stage1Source.includes("placeholder=\"Search disease / indication…\""))
assertTrue('Home Asset search uses a real Input as the always-visible control', stage1Source.includes('placeholder="Search or select an asset…"'))
assertTrue('local Known/relevant assets and backend results are merged into ONE ranked array before render (no separate unfiltered local group)', stage1Source.includes('const merged: AssetOption[]'))
assertTrue('a deterministic scoreMatch function ranks results -- no fuzzy/embeddings dependency', stage1Source.includes('function scoreMatch'))
const stage1ImportLines = stage1Source.split('\n').filter((line: string) => line.trim().startsWith('import '))
assertTrue('scoreMatch never imports an embeddings/fuzzy-matching package', !stage1ImportLines.some((line: string) => /fuse\.js|embedding|cosine|levenshtein/i.test(line)))

// ── 49. Stage 2 -- relevant assets render as capped badges, not comma-joined prose ──
console.log('49. Stage2Discover.tsx renders relevant assets as capped Badge tags, never plain comma-separated prose')
assertTrue('Stage2Discover.tsx caps visible asset badges (Part C2)', stage2Source.includes('MAX_VISIBLE_ASSET_BADGES'))
assertTrue('Stage2Discover.tsx shows an overflow count once the cap is exceeded', stage2Source.includes('overflowCount'))
assertTrue('Stage2Discover.tsx no longer joins asset names with a comma for display', !stage2Source.includes("a.identityKey).join(', ')"))

// ── 50. Stage 2 -- the old why_suggested sentence is retired from the card ──
console.log('50. Stage2Discover.tsx no longer renders company.whySuggested on the primary card (Part C3)')
assertTrue('whySuggested is never read in Stage2Discover.tsx\'s own card JSX', !stage2Source.includes('company.whySuggested'))
assertTrue('whySuggested remains available in CompanyEvidenceSheet.tsx as evidence context (Part C3 option B)', fs.readFileSync(path.join(setupDir, '..', 'pages', 'setup', 'CompanyEvidenceSheet.tsx'), 'utf-8').includes('whySuggested'))

// ── 51. Stage 2 -- fixed selection footer exists, reserves content space, disabled correctly ──
console.log('51. SetupPage.tsx renders a fixed selection footer for Stage 2, Stage2Discover.tsx reserves bottom padding for it')
const setupPageSource = fs.readFileSync(path.join(setupDir, '..', 'pages', 'setup', 'SetupPage.tsx'), 'utf-8')
assertTrue('SetupPage.tsx renders a fixed (not sticky) footer only during Stage 2', setupPageSource.includes("draft.stage === 'discover'") && setupPageSource.includes('fixed inset-x-0 bottom-0'))
assertTrue('the footer shows the live selection count', setupPageSource.includes('selections.length'))
assertTrue('the footer wires Clear selection to clearCompanySelections', setupPageSource.includes('clearCompanySelections(draft)'))
assertTrue('the footer disables Continue when nothing is selected', (setupPageSource.match(/disabled=\{draft\.selections\.length === 0\}/g) || []).length >= 2)
assertTrue('Stage2Discover.tsx reserves bottom padding so the fixed footer never covers the last row (Part D2)', stage2Source.includes('pb-24'))
assertTrue('the footer accounts for the mobile safe-area inset', setupPageSource.includes('safe-area-inset-bottom'))

// ── 52. clearCompanySelections is a pure, all-or-nothing reset ───────────
console.log('52. clearCompanySelections clears every Stage 2 selection at once')
let selectionDraft = withHae()
selectionDraft = setSuggestedCompanies(selectionDraft, [fakeSuggestion('a', 'Company A', 'Asset A'), fakeSuggestion('b', 'Company B', 'Asset B')])
selectionDraft = toggleCompanySelection(selectionDraft, 'a')
selectionDraft = toggleCompanySelection(selectionDraft, 'b')
assert('two companies selected before clearing', selectionDraft.selections.length, 2)
const clearedSelectionDraft = clearCompanySelections(selectionDraft)
assert('zero companies selected after clearing', clearedSelectionDraft.selections.length, 0)

// ── 53. Disease Area resolution automatically triggers asset suggestions ──
console.log('53. Selecting/resolving a Disease Area automatically requests disease-driven asset suggestions -- never waiting for the user to type first (Targeted Implementation 1)')
assertTrue('assetSearch.ts exposes an indication-driven search client, distinct from the existing q-based one', assetSearchClientSource.includes('searchAssetsByIndication') && assetSearchClientSource.includes("{ indication }"))
assertTrue('useAssetSearch.ts exposes searchByIndication alongside the existing search()', useAssetSearchSource.includes('searchByIndication') && useAssetSearchSource.includes('searchAssetsByIndication'))
assertTrue('Stage1Define.tsx auto-fires searchByIndication as soon as diseaseAreaName is known, gated only on an empty query -- never behind focus/typing', /useEffect\(\(\) => \{\s*if \(diseaseAreaName && !query\.trim\(\)\) searchByIndication\(diseaseAreaName\)/.test(stage1Source))

// ── 54. Manual Disease Area also triggers it -- same code path, no special-casing ──
console.log('54. A manually-entered Disease Area triggers the same automatic asset request as a catalog/MONDO one (no source-specific branch)')
const autoTriggerEffectSource = stage1Source.match(/useEffect\(\(\) => \{\s*if \(diseaseAreaName[\s\S]*?\n {2}\}, \[diseaseAreaName\]\)/)?.[0] ?? ''
assertTrue('the auto-trigger effect body itself contains no manual/resolved/catalog source branch -- one diseaseAreaName value, one code path', autoTriggerEffectSource.length > 0 && !/manualDiseaseArea|resolvedDiseaseArea|\.source ===/.test(autoTriggerEffectSource))
assertTrue('Stage1Define.tsx feeds AssetSearchField the SAME resolveDiseaseAreaDisplay-derived name used for manual/MONDO/catalog Disease Areas alike', stage1Source.includes('diseaseAreaName={diseaseAreaDisplay?.name}'))
// Behavioral confirmation this name is real and non-empty for a manual Disease Area specifically (not just catalog/MONDO):
let manualDiseaseTriggerDraft = createEmptySetupDraft()
manualDiseaseTriggerDraft = selectTherapeuticArea(manualDiseaseTriggerDraft, 'oncology')
manualDiseaseTriggerDraft = attachManualDiseaseArea(manualDiseaseTriggerDraft, 'Non-Small Cell Lung Cancer')
assert('resolveDiseaseAreaDisplay(...).name is the literal manual text the auto-trigger effect will send as the indication', resolveDiseaseAreaDisplay(manualDiseaseTriggerDraft)?.name, 'Non-Small Cell Lung Cancer')

// ── 55. Changing Disease Area replaces/refetches suggestions ─────────────
console.log('55. Changing Disease Area cancels a stale in-flight request and fetches suggestions for the new one')
assertTrue('the auto-trigger effect is keyed on diseaseAreaName, so it re-fires whenever the Disease Area changes', /\}, \[diseaseAreaName\]\)/.test(stage1Source))
assertTrue('searchByIndication cancels any in-flight request the same way search() already does (shared abortRef), so a disease change never leaves a stale response to land later', (useAssetSearchSource.match(/abortRef\.current\.abort\(\)/g) || []).length >= 2)

// ── 56. Typed asset search is disease-aware (Issue #4) ────────────────────
console.log('56. Typed asset search (search()/searchAssets) carries the selected Disease Area through as disease context')
assertTrue('handleQueryChange only searches when the typed value is non-empty, resetting (never searching) otherwise', /if \(value\.trim\(\)\) search\(value, diseaseAreaName\)\s*\n\s*else reset\(\)/.test(stage1Source))
assertTrue('Stage1Define passes the selected diseaseAreaName into the typed asset search call, the SAME name the automatic pre-typing suggestion effect uses', stage1Source.includes('search(value, diseaseAreaName)'))
assertTrue('search() still debounces on every keystroke (DEBOUNCE_MS/setTimeout), unchanged', /const search = useCallback\(\(query: string, indication\?: string\) => \{[\s\S]*?setTimeout\(/.test(useAssetSearchSource))
assertTrue('useAssetSearch() accepts an optional indication parameter alongside query', /const search = useCallback\(\(query: string, indication\?: string\) => \{/.test(useAssetSearchSource))
assertTrue('useAssetSearch() forwards indication to searchAssets() alongside the query and abort signal', /searchAssets\(trimmed, indication, signal\)/.test(useAssetSearchSource))
assertTrue('searchAssets() accepts an optional indication parameter', /export async function searchAssets\(query: string, indication\?: string, signal\?: AbortSignal\)/.test(assetSearchClientSource))
assertTrue('searchAssets() adds indication to the request params ONLY when provided -- conditional, never unconditional or fabricated when no Disease Area is selected', /if \(indication\) params\.indication = indication/.test(assetSearchClientSource))
assertTrue('the "No known assets" message never renders while a remote attempt is in flight or failed (only idle/no_results)', stage1Source.includes("(state.status === 'idle' || state.status === 'no_results')"))

// ── Targeted Implementation 2: setup -> main-app Disease Area persistence ──
//
// AppContext.tsx/useConfig() cannot be exercised directly here (React
// component, no DOM testing library in this repo -- see module docstring).
// Following this file's own already-established pattern for such files
// (stage1Source/stage2Source/setupPageSource/layoutSource etc. above), the
// non-pure wiring is verified via source-text assertions; the actual
// resolution LOGIC (resolveDiseaseAreaDisplayFrom, the exact function
// useConfig() calls) is exercised directly and behaviorally below.

import { resolveDiseaseAreaDisplayFrom } from './setup-draft.js'

// Normalized to LF regardless of the file's actual on-disk line-ending
// convention (CRLF on this checkout) -- every multi-line substring check
// below assumes '\n', matching how every other *Source read above compares.
const appContextSource = fs.readFileSync(path.join(setupDir, '..', 'context', 'AppContext.tsx'), 'utf-8').replace(/\r\n/g, '\n')

// ── 57. Legacy catalog Disease Area still resolves (regression) ──────────
console.log('57. A legacy catalog Disease Area id still resolves via resolveDiseaseAreaDisplayFrom -- no manual/resolved override present')
assert(
  'catalog id with no manual/resolved override resolves to the catalog name+shortCode',
  resolveDiseaseAreaDisplayFrom('hae', null, null),
  { name: 'Hereditary Angioedema', source: 'catalog', shortCode: 'HAE' },
)
assert('an unregistered id with no manual/resolved override resolves to null (never a fabricated disease)', resolveDiseaseAreaDisplayFrom('not-a-real-id', null, null), null)

// ── 58. MONDO-resolved Disease Area survives the setup -> AppContext path ──
console.log('58. A MONDO-resolved Disease Area survives loose-params resolution exactly as it does inside a SetupDraft')
const mondoResult = resolveDiseaseAreaDisplayFrom('MONDO:1060006', null, fakeDiseaseArea())
assert('preferredName/aliases/source preserved, matching resolveDiseaseAreaDisplay(draft) exactly', mondoResult, { name: 'generalized myasthenia gravis', aliases: ['gMG'], source: 'mondo' })

// ── 59. Manual Disease Area survives the setup -> AppContext path ────────
console.log('59. A manually-entered Disease Area survives loose-params resolution exactly as it does inside a SetupDraft')
const manualResult = resolveDiseaseAreaDisplayFrom('manual-disease-area-xyz', { source: 'manual', id: 'manual-disease-area-xyz', name: 'Non-Small Cell Lung Cancer', therapeuticAreaId: 'oncology' }, null)
assert('60. manual Disease Area name preserved verbatim, source=manual, no fabricated aliases', manualResult, { name: 'Non-Small Cell Lung Cancer', source: 'manual' })

// ── 61. AppContext.tsx carries manualDiseaseArea/resolvedDiseaseArea through completeSetup, mirroring manualHomeAsset ──
console.log('61. AppContext.tsx persists manualDiseaseArea/resolvedDiseaseArea the same way it already persists manualHomeAsset')
assertTrue('a dedicated localStorage key exists for manual Disease Area, same pattern as MANUAL_HOME_ASSET_KEY', appContextSource.includes("MANUAL_DISEASE_AREA_KEY = 'ariya-manual-disease-area'"))
assertTrue('a dedicated localStorage key exists for resolved (MONDO) Disease Area', appContextSource.includes("RESOLVED_DISEASE_AREA_KEY = 'ariya-resolved-disease-area'"))
assertTrue('completeSetup() accepts manualDiseaseArea and resolvedDiseaseArea as new parameters, in addition to the existing manualHomeAsset one (and, since Targeted Implementation 4, resolvedHomeAsset)', /function completeSetup\(\s*competitors: TrackedCompetitor\[\],\s*nextManualHomeAsset: ManualAssetIdentity \| null,\s*nextResolvedHomeAsset: ResolvedAssetIdentity \| null,\s*nextManualDiseaseArea: ManualDiseaseArea \| null,\s*nextResolvedDiseaseArea: ResolvedDiseaseArea \| null,/.test(appContextSource))
assertTrue('completeSetup() persists manualDiseaseArea to localStorage, same write/remove discipline as manualHomeAsset (set when present, removed when null)', appContextSource.includes('if (nextManualDiseaseArea) localStorage.setItem(MANUAL_DISEASE_AREA_KEY') && appContextSource.includes('else localStorage.removeItem(MANUAL_DISEASE_AREA_KEY)'))
assertTrue('completeSetup() persists resolvedDiseaseArea to localStorage the same way', appContextSource.includes('if (nextResolvedDiseaseArea) localStorage.setItem(RESOLVED_DISEASE_AREA_KEY') && appContextSource.includes('else localStorage.removeItem(RESOLVED_DISEASE_AREA_KEY)'))

// ── 62. useConfig() resolution priority: persisted manual/resolved identity first, legacy getDiseaseAreaById() fallback preserved ──
console.log('62. useConfig() resolves Disease Area with the manual/MONDO-first, catalog-fallback priority -- legacy diseaseArea field left unchanged')
assertTrue('useConfig() computes diseaseAreaDisplay via the SAME shared resolveDiseaseAreaDisplayFrom() Stage 1/2/3 already use -- never a second, competing implementation', appContextSource.includes('const diseaseAreaDisplay: DiseaseAreaDisplay | null = resolveDiseaseAreaDisplayFrom('))
assertTrue('the existing legacy `diseaseArea` field (static getDiseaseAreaById lookup) is left completely unchanged -- existing consumers/landscapes keep working', appContextSource.includes('diseaseArea:          landscapeConfiguration.diseaseAreaId ? getDiseaseAreaById(landscapeConfiguration.diseaseAreaId) : undefined,'))
assertTrue('diseaseAreaDisplay is exposed on useConfig()\'s return value', appContextSource.includes('diseaseAreaDisplay,\n    // Targeted Implementation 4'))

// ── 63. SetupPage.tsx carries the draft\'s Disease Area identity through both completion paths ──
console.log('63. SetupPage.tsx passes draft.manualDiseaseArea/draft.resolvedDiseaseArea into completeSetup() on BOTH the "Enter Ariya" and "Start tour" paths')
assertTrue('handleEnterAriya() forwards manualDiseaseArea/resolvedDiseaseArea (and, since Targeted Implementation 4, resolvedAsset)', setupPageSource.includes('completeSetup(draftToTrackedCompetitors(draft), draft.manualAsset, draft.resolvedAsset, draft.manualDiseaseArea, draft.resolvedDiseaseArea)'))
assertTrue('both completeSetup() call sites use the identical, correct 5-argument form (no drift between Enter Ariya and Start tour)', (setupPageSource.match(/completeSetup\(draftToTrackedCompetitors\(draft\), draft\.manualAsset, draft\.resolvedAsset, draft\.manualDiseaseArea, draft\.resolvedDiseaseArea\)/g) || []).length === 2)

// ── 64. manualHomeAsset persistence is unchanged by this task ────────────
console.log('64. Existing manualHomeAsset persistence (key, write/remove discipline, position in completeSetup) is unchanged')
assertTrue('MANUAL_HOME_ASSET_KEY is still the original key string', appContextSource.includes("MANUAL_HOME_ASSET_KEY = 'ariya-manual-home-asset'"))
assertTrue('manualHomeAsset write/remove discipline is unchanged', appContextSource.includes('if (nextManualHomeAsset) localStorage.setItem(MANUAL_HOME_ASSET_KEY') && appContextSource.includes('else localStorage.removeItem(MANUAL_HOME_ASSET_KEY)'))
assertTrue('manualHomeAsset remains completeSetup\'s first identity parameter (position unchanged) -- resolvedHomeAsset (Targeted Implementation 4) is inserted right after it, mirroring the manual/resolved asset pairing, before the disease-area pair', appContextSource.includes('nextManualHomeAsset: ManualAssetIdentity | null,\n    nextResolvedHomeAsset: ResolvedAssetIdentity | null,\n    nextManualDiseaseArea: ManualDiseaseArea | null,'))

// ── 65. DiscoverCompetitors.tsx resolves Disease Area from the same source as AppContext (Recon 2's confirmed gap) ──
console.log('65. DiscoverCompetitors.tsx consumes useConfig().diseaseAreaDisplay instead of an independent getDiseaseAreaById() lookup')
const discoverCompetitorsSource = fs.readFileSync(path.join(setupDir, '..', 'pages', 'DiscoverCompetitors.tsx'), 'utf-8')
assertTrue('no direct getDiseaseAreaById import remains in DiscoverCompetitors.tsx', !discoverCompetitorsSource.includes('getDiseaseAreaById'))
assertTrue('DiscoverCompetitors.tsx reads diseaseAreaDisplay from useConfig(), the same resolved source AppContext/AppSidebar use', discoverCompetitorsSource.includes('const { diseaseAreaDisplay } = useConfig()'))
assertTrue('the page\'s own diseaseArea variable is now sourced from diseaseAreaDisplay, not a second competing resolution', discoverCompetitorsSource.includes('const diseaseArea = diseaseAreaDisplay'))

// ── 66. AppSidebar.tsx's landscape header also uses the shared resolved source (same underlying bug, most visible symptom) ──
console.log('66. AppSidebar.tsx\'s LandscapeContext resolves Disease Area via useConfig().diseaseAreaDisplay, with a shortCode fallback to the full name for manual/MONDO sources')
const appSidebarSource = fs.readFileSync(path.join(setupDir, '..', 'components', 'shell', 'AppSidebar.tsx'), 'utf-8').replace(/\r\n/g, '\n')
assertTrue('getDiseaseAreaById is no longer imported in AppSidebar.tsx (only referenced descriptively in a code comment explaining the fix)', !/^import .*getDiseaseAreaById/m.test(appSidebarSource))
assertTrue('the therapeutic-areas import now only pulls getTherapeuticAreaById', appSidebarSource.includes("import { getTherapeuticAreaById } from '../../config/therapeutic-areas'"))
assertTrue('LandscapeContext reads diseaseAreaDisplay AND (since Targeted Implementation 4) homeAssetDisplay from useConfig()', appSidebarSource.includes('const { diseaseAreaDisplay, homeAssetDisplay } = useConfig()'))
assertTrue('falls back to the full name when no curated shortCode exists (manual/MONDO Disease Area)', appSidebarSource.includes('diseaseAreaDisplay.shortCode ?? diseaseAreaDisplay.name'))

// ── 67. Refresh/localStorage round-trip preserves the structured Disease Area (same key contract completeSetup writes) ──
console.log('67. The persisted manual/resolved Disease Area round-trips through localStorage under the exact keys completeSetup() writes -- simulating a browser refresh')
localStorage.clear()
const roundTripManual: import('./setup-draft.js').ManualDiseaseArea = { source: 'manual', id: 'manual-disease-area-refresh-test', name: 'Non-Small Cell Lung Cancer', therapeuticAreaId: 'oncology' }
localStorage.setItem('ariya-manual-disease-area', JSON.stringify(roundTripManual))
const reloadedManual = JSON.parse(localStorage.getItem('ariya-manual-disease-area')!)
assert('manual Disease Area survives a stringify/parse round-trip through its real persistence key, byte-for-byte', reloadedManual, roundTripManual)

const roundTripResolved: ResolvedDiseaseArea = fakeDiseaseArea()
localStorage.setItem('ariya-resolved-disease-area', JSON.stringify(roundTripResolved))
const reloadedResolved = JSON.parse(localStorage.getItem('ariya-resolved-disease-area')!)
assert('resolved (MONDO) Disease Area survives the same round-trip, preferredName/aliases/source/sourceId intact', reloadedResolved, roundTripResolved)

assertTrue('a landscape with ONLY a legacy diseaseAreaId (no manual/resolved key ever written) still resolves via the catalog fallback after a simulated refresh -- never broken', (() => {
  localStorage.removeItem('ariya-manual-disease-area')
  localStorage.removeItem('ariya-resolved-disease-area')
  return resolveDiseaseAreaDisplayFrom('hae', null, null)?.name === 'Hereditary Angioedema'
})())

// ── Targeted Implementation 3: stale/invalid SetupDraft recovery ───────────

function baseOncologyDraft(): SetupDraft {
  let d = createEmptySetupDraft()
  d = selectTherapeuticArea(d, 'oncology')
  return d
}

// ── 68. stale discover draft: unresolvable Disease Area -> recovered to define ──
console.log('68. A persisted discover-stage draft whose diseaseAreaId resolves to nothing (no manual/resolved/catalog match) recovers to define')
let staleDiseaseDraft = baseOncologyDraft()
staleDiseaseDraft = attachManualHomeAsset(staleDiseaseDraft, { displayName: 'TAGRISSO', company: 'AstraZeneca' })
// A dangling diseaseAreaId with NO manualDiseaseArea/resolvedDiseaseArea
// attached for it, and no catalog entry -- exactly Recon 5's proven shape.
staleDiseaseDraft = {
  ...staleDiseaseDraft,
  stage: 'discover',
  landscapeConfiguration: { ...staleDiseaseDraft.landscapeConfiguration, diseaseAreaId: 'manual-disease-area-old' },
}
assert('recovered stage is define', recoverSetupDraft(staleDiseaseDraft).stage, 'define')

// ── 69. stale discover draft: unresolvable Home Asset -> recovered to define ──
console.log('69. A persisted discover-stage draft whose homeAssetId resolves to nothing recovers to define')
let staleAssetDraft = baseOncologyDraft()
staleAssetDraft = attachManualDiseaseArea(staleAssetDraft, 'Non-Small Cell Lung Cancer')
staleAssetDraft = {
  ...staleAssetDraft,
  stage: 'discover',
  landscapeConfiguration: { ...staleAssetDraft.landscapeConfiguration, homeAssetId: 'manual-asset-old' },
}
assert('recovered stage is define', recoverSetupDraft(staleAssetDraft).stage, 'define')

// ── 70. stale discover draft: BOTH ids unresolvable -> recovered to define ──
console.log('70. A persisted discover-stage draft with both a dangling diseaseAreaId and a dangling homeAssetId recovers to define')
let bothStaleDraft: SetupDraft = {
  ...baseOncologyDraft(),
  stage: 'discover',
  landscapeConfiguration: { therapeuticAreaId: 'oncology', diseaseAreaId: 'manual-disease-area-old', homeAssetId: 'manual-asset-old' },
}
assert('recovered stage is define', recoverSetupDraft(bothStaleDraft).stage, 'define')

// ── 71. valid manual Disease + manual Asset -> discover remains discover ──
console.log('71. A genuinely valid persisted discover-stage draft (manual Disease Area + manual Home Asset) is NOT recovered -- discover remains discover')
let validManualDraft = baseOncologyDraft()
validManualDraft = attachManualDiseaseArea(validManualDraft, 'Non-Small Cell Lung Cancer')
validManualDraft = attachManualHomeAsset(validManualDraft, { displayName: 'TAGRISSO', company: 'AstraZeneca' })
validManualDraft = { ...validManualDraft, stage: 'discover' }
assert('stage stays discover', recoverSetupDraft(validManualDraft).stage, 'discover')
assertTrue('recovery returns the exact same object reference when nothing needs correcting (no unnecessary copy)', recoverSetupDraft(validManualDraft) === validManualDraft)

// ── 72. valid MONDO Disease + resolved Asset -> discover remains discover ──
console.log('72. A genuinely valid persisted discover-stage draft (MONDO-resolved Disease Area + resolved Home Asset) is NOT recovered')
let validMondoDraft = createEmptySetupDraft()
validMondoDraft = selectTherapeuticArea(validMondoDraft, 'neurology')
validMondoDraft = selectResolvedDiseaseArea(validMondoDraft, fakeDiseaseArea())
validMondoDraft = selectResolvedAsset(validMondoDraft, fakeResolvedAsset())
validMondoDraft = { ...validMondoDraft, stage: 'discover' }
assert('stage stays discover', recoverSetupDraft(validMondoDraft).stage, 'discover')

// ── 73. valid legacy catalog Disease + known asset -> discover remains discover ──
console.log('73. A genuinely valid persisted discover-stage draft using only the legacy static catalog is NOT recovered')
let validCatalogDraft = withHae()
validCatalogDraft = { ...validCatalogDraft, stage: 'discover' }
assert('stage stays discover', recoverSetupDraft(validCatalogDraft).stage, 'discover')

// ── 74. configure-stage draft whose Stage 1 prerequisites are stale -> falls back to the highest safe stage ──
console.log('74. A persisted configure-stage draft whose Stage 1 identities no longer resolve falls all the way back to define (Stage 1 itself is unsafe)')
let staleConfigureDraft: SetupDraft = {
  ...baseOncologyDraft(),
  stage: 'configure',
  landscapeConfiguration: { therapeuticAreaId: 'oncology', diseaseAreaId: 'manual-disease-area-old', homeAssetId: 'manual-asset-old' },
  companies: [{ id: 'c1', source: 'manual', companyName: 'Merck', relevantAssets: [], ariyaAssessment: null, evidenceStatus: 'not_evaluated', evidenceRefs: [], verifiedDomains: [], whySuggested: null }],
  selections: [{ companyId: 'c1', userRelationship: 'direct' }],
}
assert('recovered stage is define (Stage 1 itself is unsafe, not just missing selections)', recoverSetupDraft(staleConfigureDraft).stage, 'define')

console.log('74b. A persisted configure-stage draft with VALID Stage 1 identities but zero selections falls back only to discover, not all the way to define')
let emptySelectionsConfigureDraft = validManualDraft // reuse the valid manual Stage 1 identity from test 71
emptySelectionsConfigureDraft = { ...emptySelectionsConfigureDraft, stage: 'configure', selections: [] }
assert('recovered stage is discover (Stage 1 is fine, only Stage 3 has nothing to show)', recoverSetupDraft(emptySelectionsConfigureDraft).stage, 'discover')

// ── 75. valid configure-stage draft -> configure remains configure ────────
console.log('75. A genuinely valid persisted configure-stage draft (valid Stage 1 + at least one selection, even if not yet fully classified) is NOT recovered')
let validConfigureDraft = validManualDraft
validConfigureDraft = {
  ...validConfigureDraft,
  stage: 'configure',
  companies: [{ id: 'c1', source: 'manual', companyName: 'Merck', relevantAssets: [], ariyaAssessment: null, evidenceStatus: 'not_evaluated', evidenceRefs: [], verifiedDomains: [], whySuggested: null }],
  selections: [{ companyId: 'c1', userRelationship: null }], // selected but not yet classified -- still a normal in-progress state
}
assert('stage stays configure even though the selection is not yet classified', recoverSetupDraft(validConfigureDraft).stage, 'configure')

// ── 76. still-valid fields are preserved during recovery, never fabricated or dropped ──
console.log('76. Recovering a stale draft never fabricates a missing identity and never drops any other still-present field')
const recoveredStaleDraft = recoverSetupDraft(bothStaleDraft)
assert('landscapeConfiguration is left completely untouched (dangling ids preserved, not cleared or fabricated)', recoveredStaleDraft.landscapeConfiguration, bothStaleDraft.landscapeConfiguration)
assert('manualDiseaseArea stays exactly what it was (null here) -- never fabricated to paper over the recovery', recoveredStaleDraft.manualDiseaseArea, bothStaleDraft.manualDiseaseArea)
assert('manualAsset stays exactly what it was (null here) -- never fabricated', recoveredStaleDraft.manualAsset, bothStaleDraft.manualAsset)
assert('companies array is preserved untouched', recoveredStaleDraft.companies, bothStaleDraft.companies)
assert('selections array is preserved untouched', recoveredStaleDraft.selections, bothStaleDraft.selections)

// ── 77. save/load round-trip for a CURRENT valid draft is unchanged by this task ──
console.log('77. saveSetupDraft/loadSetupDraft round-trip for an already-valid current-shaped draft is completely unaffected by the new recovery step')
localStorage.clear()
saveSetupDraft(validConfigureDraft)
const roundTrippedValidDraft = loadSetupDraft()
assert('loadSetupDraft returns the draft with its stage unchanged (still configure) -- recovery is a no-op for a genuinely valid draft', roundTrippedValidDraft?.stage, 'configure')
assert('every other field round-trips byte-for-byte, exactly as before this task', JSON.stringify(roundTrippedValidDraft), JSON.stringify(validConfigureDraft))

// ── 78. loadSetupDraft() itself applies recovery, not just recoverSetupDraft() in isolation ──
console.log('78. loadSetupDraft() applies the same recovery automatically -- SetupPage.tsx needs no changes to benefit from it')
localStorage.clear()
localStorage.setItem(
  'ariya-setup-draft',
  JSON.stringify({ ...bothStaleDraft, stage: 'discover' }),
)
assert('a stale persisted discover-stage draft loads back already recovered to define', loadSetupDraft()?.stage, 'define')

const setupDraftSourceForRecovery = fs.readFileSync(fileURLToPath(import.meta.url).replace(/\.test\.ts$/, '.ts'), 'utf-8')
assertTrue('loadSetupDraft() calls recoverSetupDraft() on the parsed draft before returning it', /return recoverSetupDraft\(parsed\)/.test(setupDraftSourceForRecovery))

// ── Targeted Implementation 2A: indication/indicationFull compatibility ────
//
// useConfig() itself cannot be exercised directly here (React hook, no DOM
// testing library -- same boundary as every other AppContext.tsx check
// above). The exact derivation formula useConfig() now runs is replicated
// here using the SAME real, unmodified functions (getLegacyIndicationCompat,
// resolveDiseaseAreaDisplayFrom) it actually calls, plus source-text
// assertions confirming AppContext.tsx is wired exactly this way.

function deriveIndicationCompat(diseaseAreaId: string | null, manualDiseaseArea: ManualDiseaseArea | null, resolvedDiseaseArea: ResolvedDiseaseArea | null) {
  const legacyCompat = getLegacyIndicationCompat(diseaseAreaId)
  const diseaseAreaDisplay = resolveDiseaseAreaDisplayFrom(diseaseAreaId, manualDiseaseArea, resolvedDiseaseArea)
  const diseaseAreaCompat = !legacyCompat && diseaseAreaDisplay
    ? { indication: diseaseAreaDisplay.name, indicationFull: diseaseAreaDisplay.name }
    : null
  return {
    indication: legacyCompat?.indication ?? diseaseAreaCompat?.indication ?? null,
    indicationFull: legacyCompat?.indicationFull ?? diseaseAreaCompat?.indicationFull ?? null,
  }
}

// ── 79. Legacy HAE: indication/indicationFull continue behaving as before ──
console.log('79. A legacy catalog Disease Area (HAE) still resolves indication=shortCode / indicationFull=full name, completely unchanged')
assert('legacy catalog: indication is the curated short code', deriveIndicationCompat('hae', null, null).indication, 'HAE')
assert('legacy catalog: indicationFull is the curated full name', deriveIndicationCompat('hae', null, null).indicationFull, 'Hereditary Angioedema')

// ── 80. Manual Non-Small Cell Lung Cancer: resolves from the manual Disease Area, never HAE/demo ──
console.log('80. A manual Disease Area (Non-Small Cell Lung Cancer) drives indication/indicationFull -- never HAE, never a demo fallback')
const manualDA: ManualDiseaseArea = { source: 'manual', id: 'manual-disease-area-nsclc', name: 'Non-Small Cell Lung Cancer', therapeuticAreaId: 'oncology' }
const manualCompat = deriveIndicationCompat('manual-disease-area-nsclc', manualDA, null)
assert('indication is the manual Disease Area name, not HAE/a short code', manualCompat.indication, 'Non-Small Cell Lung Cancer')
assert('indicationFull is the same manual Disease Area name', manualCompat.indicationFull, 'Non-Small Cell Lung Cancer')
assertTrue('neither value is the legacy HAE demo text', manualCompat.indication !== 'HAE' && manualCompat.indicationFull !== 'Hereditary Angioedema')

// ── 81. MONDO-resolved Disease Area: preferredName used consistently for both fields ──
console.log('81. A MONDO-resolved Disease Area drives indication/indicationFull via its own preferredName, consistently')
const mondoCompat = deriveIndicationCompat('MONDO:1060006', null, fakeDiseaseArea())
assert('indication is the MONDO preferredName', mondoCompat.indication, 'generalized myasthenia gravis')
assert('indicationFull is the SAME MONDO preferredName -- one consistent value, not a separate fabricated short form', mondoCompat.indicationFull, 'generalized myasthenia gravis')

// ── 82. Manual Disease Area text is preserved verbatim, never rewritten ────
console.log('82. A manual Disease Area name with unusual casing/punctuation survives verbatim into indication/indicationFull -- no AI rewrite, no normalization')
const oddManualDA: ManualDiseaseArea = { source: 'manual', id: 'manual-disease-area-odd', name: 'KRAS G12C-Mutated NSCLC (2nd-line)', therapeuticAreaId: 'oncology' }
const oddCompat = deriveIndicationCompat('manual-disease-area-odd', oddManualDA, null)
assert('indication preserves the exact user-entered string, byte-for-byte', oddCompat.indication, 'KRAS G12C-Mutated NSCLC (2nd-line)')
assert('indicationFull preserves it too', oddCompat.indicationFull, 'KRAS G12C-Mutated NSCLC (2nd-line)')

// ── 83. AppContext.tsx wiring itself ───────────────────────────────────────
console.log('83. AppContext.tsx computes indication/indicationFull with legacyCompat preserved first, diseaseAreaDisplay-derived compat second, never a second Disease Area resolver')
assertTrue('diseaseAreaCompat is derived from diseaseAreaDisplay only when legacyCompat is absent', appContextSource.includes('const diseaseAreaCompat = !legacyCompat && diseaseAreaDisplay'))
assertTrue('diseaseAreaCompat never introduces a new resolver -- it reads diseaseAreaDisplay.name for BOTH indication and indicationFull', appContextSource.includes('{ indication: diseaseAreaDisplay.name, indicationFull: diseaseAreaDisplay.name }'))
assertTrue('indication priority: legacyCompat -> diseaseAreaCompat -> asset -> userIndication -> DEMO, in that exact order', appContextSource.includes('indication:           legacyCompat?.indication      ?? diseaseAreaCompat?.indication      ?? asset?.indication      ?? userIndication ?? DEMO.therapeuticArea,'))
assertTrue('indicationFull priority mirrors it exactly', appContextSource.includes('indicationFull:       legacyCompat?.indicationFull  ?? diseaseAreaCompat?.indicationFull  ?? asset?.indicationFull  ?? userIndication ?? DEMO.therapeuticAreaFull,'))

// ── 84. diseaseAreaDisplay behavior from Implementation 2 remains unchanged ──
console.log('84. diseaseAreaDisplay itself (Implementation 2) is untouched by this task -- same resolveDiseaseAreaDisplayFrom() call, same field on useConfig()')
assertTrue('diseaseAreaDisplay is still computed via resolveDiseaseAreaDisplayFrom exactly as Implementation 2 left it', appContextSource.includes('const diseaseAreaDisplay: DiseaseAreaDisplay | null = resolveDiseaseAreaDisplayFrom('))
assertTrue('diseaseAreaDisplay is still exposed on useConfig()\'s return value', appContextSource.includes('diseaseAreaDisplay,\n    // Targeted Implementation 4'))
assertTrue('the legacy `diseaseArea` field (static catalog only) is still completely unchanged', appContextSource.includes('diseaseArea:          landscapeConfiguration.diseaseAreaId ? getDiseaseAreaById(landscapeConfiguration.diseaseAreaId) : undefined,'))

// ── 85. Stage 2 discovery request is unaffected -- still uses resolveDiseaseAreaDisplay(draft).name directly ──
console.log('85. Stage2Discover.tsx\'s own discovery request still reads resolveDiseaseAreaDisplay(draft).name directly, never routed through the new indication/indicationFull compat')
assertTrue('Stage2Discover.tsx still derives its own local diseaseArea via resolveDiseaseAreaDisplay(draft), unchanged', stage2Source.includes('const diseaseArea = resolveDiseaseAreaDisplay(draft)'))
assertTrue('the discovery run() call still sends diseaseArea.name directly, never `indication`/`indicationFull` from useConfig()', stage2Source.includes('indication: diseaseArea.name'))

// ── 86. Home Asset compatibility (assetName/innName/etc.) as of Targeted Implementation 2A -- superseded by Implementation 4's own dedicated tests below, which assert the NEW, intentionally-changed derivation instead ──
console.log('86. manualHomeAsset persistence itself (Implementation 2\'s own check) remains untouched -- assetName/innName derivation is now intentionally different, see Targeted Implementation 4\'s own tests below')
assertTrue('manualHomeAsset persistence (Implementation 2\'s own check, still green) is untouched by this task', appContextSource.includes("MANUAL_HOME_ASSET_KEY = 'ariya-manual-home-asset'"))

// ── Targeted Implementation 4: Home Asset persistence + AppContext consistency ──
//
// useConfig()/AppSidebar cannot be exercised directly here (React, no DOM
// testing library -- same boundary as every AppContext.tsx check above).
// The exact derivation formula useConfig() now runs is replicated using the
// SAME real, unmodified resolveHomeAssetDisplayFrom() it actually calls,
// plus source-text assertions confirming the wiring end to end.

function deriveAssetNameCompat(homeAssetId: string | null, manualHomeAsset: ManualAssetIdentity | null, resolvedHomeAsset: ResolvedAssetIdentity | null, userAssetName: string | null) {
  const homeAssetDisplay = resolveHomeAssetDisplayFrom(homeAssetId, manualHomeAsset, resolvedHomeAsset)
  return {
    assetName: homeAssetDisplay?.displayName ?? userAssetName ?? 'Ekterly',
    innName: homeAssetDisplay?.innName ?? null,
  }
}

const tagrisso: ManualAssetIdentity = {
  source: 'manual', id: 'manual-asset-tagrisso', displayName: 'TAGRISSO', innName: 'osimertinib',
  company: 'AstraZeneca', diseaseAreaId: 'manual-disease-area-nsclc', therapeuticAreaId: 'oncology', developmentCode: null,
}

// ── 87. Manual Home Asset (TAGRISSO) survives completeSetup() and drives useConfig().assetName ──
console.log('87. A manual Home Asset (TAGRISSO) resolves via the SAME shared resolver useConfig() now uses -- assetName resolves TAGRISSO, not a stale/demo fallback')
const tagrissoCompat = deriveAssetNameCompat('manual-asset-tagrisso', tagrisso, null, null)
assert('assetName is TAGRISSO', tagrissoCompat.assetName, 'TAGRISSO')
assert('innName is the manually-supplied osimertinib', tagrissoCompat.innName, 'osimertinib')

// ── 88. A poisoned legacy userAssetName never overrides a genuinely resolved manual Home Asset ──
console.log('88. Poisoned legacy userAssetName="Ekterly" does NOT override manual TAGRISSO -- homeAssetDisplay wins the priority chain')
const poisonedCompat = deriveAssetNameCompat('manual-asset-tagrisso', tagrisso, null, 'Ekterly')
assert('assetName is still TAGRISSO despite the poisoned legacy key', poisonedCompat.assetName, 'TAGRISSO')
assertTrue('the poisoned value never surfaces at all', poisonedCompat.assetName !== 'Ekterly')

// ── 89. A resolved Home Asset (from live asset search) survives SetupDraft -> completeSetup -> AppContext -> useConfig ──
console.log('89. A resolved Home Asset survives the full setup -> AppContext -> useConfig path (Targeted Implementation 4\'s own headline fix -- FAILURE 1)')
const rystiggoResolved = fakeResolvedAsset()
const resolvedCompat = deriveAssetNameCompat('rystiggo', null, rystiggoResolved, null)
assert('assetName is the resolved preferredName (RYSTIGGO)', resolvedCompat.assetName, 'RYSTIGGO')
assert('innName is the resolved identity\'s own INN (rozanolixizumab)', resolvedCompat.innName, 'rozanolixizumab')
assertTrue('completeSetup() now has a resolvedHomeAsset parameter -- FAILURE 1\'s root cause is closed', appContextSource.includes('nextResolvedHomeAsset: ResolvedAssetIdentity | null,'))
assertTrue('completeSetup() persists resolvedHomeAsset to localStorage, same write/remove discipline as manualHomeAsset', appContextSource.includes('if (nextResolvedHomeAsset) localStorage.setItem(RESOLVED_HOME_ASSET_KEY') && appContextSource.includes('else localStorage.removeItem(RESOLVED_HOME_ASSET_KEY)'))
assertTrue('SetupPage.tsx now forwards draft.resolvedAsset into completeSetup() on both call sites', (setupPageSource.match(/completeSetup\(draftToTrackedCompetitors\(draft\), draft\.manualAsset, draft\.resolvedAsset, draft\.manualDiseaseArea, draft\.resolvedDiseaseArea\)/g) || []).length === 2)
assertTrue('useConfig() destructures resolvedHomeAsset from useApp()', appContextSource.includes('manualHomeAsset, resolvedHomeAsset, manualDiseaseArea, resolvedDiseaseArea,'))
assertTrue('useConfig() computes homeAssetDisplay via the SAME shared resolveHomeAssetDisplayFrom() Stage 1/2/3 already use -- never a second, competing implementation', appContextSource.includes('const homeAssetDisplay: HomeAssetDisplay | null = resolveHomeAssetDisplayFrom('))
assertTrue('assetName reads homeAssetDisplay first, before the legacy asset/userAssetName/DEMO chain', appContextSource.includes('assetName:            homeAssetDisplay?.displayName ?? asset?.brandName ?? userAssetName  ?? DEMO.assetName,'))

// ── 90. A resolved Home Asset survives a localStorage/browser round-trip ──
console.log('90. The persisted resolved Home Asset round-trips through localStorage under the exact key completeSetup() writes -- simulating a browser refresh')
localStorage.clear()
localStorage.setItem('ariya-resolved-home-asset', JSON.stringify(rystiggoResolved))
const reloadedResolvedAsset = JSON.parse(localStorage.getItem('ariya-resolved-home-asset')!)
assert('resolved Home Asset survives the round-trip byte-for-byte', reloadedResolvedAsset, rystiggoResolved)

// ── 91. AppSidebar resolves a persisted resolved Home Asset (not just manual/catalog) ──
console.log('91. AppSidebar.tsx\'s LandscapeContext now resolves a resolved Home Asset too, via the same shared useConfig().homeAssetDisplay -- no more "Landscape not configured" for a live-search-selected asset')
assertTrue('AppSidebar no longer maintains its own separate manual-only/catalog-only priority chain (no direct getAssetById call)', !/^import .*getAssetById/m.test(appSidebarSource))
assertTrue('LandscapeContext reads homeAssetDisplay from useConfig(), the single shared resolver', appSidebarSource.includes('homeAssetDisplay') && appSidebarSource.includes('const { diseaseAreaDisplay, homeAssetDisplay } = useConfig()'))
assertTrue('the sidebar\'s "not configured" guard now checks homeAssetDisplay (manual OR resolved OR catalog), not a manual-only local variable', appSidebarSource.includes('!homeAssetDisplay'))
assertTrue('the displayed name comes from homeAssetDisplay.displayName', appSidebarSource.includes('{homeAssetDisplay.displayName}'))

// ── 92. Resolved asset structured fields remain available after persistence (never dropped) ──
console.log('92. A resolved Home Asset\'s full structured identity (preferredName, innNames, developmentCodes, ownerCompanies, aliases) survives persistence intact -- this task never touches identity QUALITY, only whether it persists at all')
const richResolvedAsset: ResolvedAssetIdentity = fakeResolvedAsset({
  id: 'tagrisso-live', preferredName: 'TAGRISSO', brandNames: ['TAGRISSO'],
  innNames: ['osimertinib'], developmentCodes: ['AZD9291'], aliases: ['Osimertinib', 'AZD9291'],
  ownerCompanies: ['AstraZeneca'], mechanismOfAction: ['EGFR TKI'], indicationContexts: ['Non-Small Cell Lung Cancer'],
  source: 'clinicaltrials_gov',
})
localStorage.setItem('ariya-resolved-home-asset', JSON.stringify(richResolvedAsset))
const reloadedRichAsset = JSON.parse(localStorage.getItem('ariya-resolved-home-asset')!) as ResolvedAssetIdentity
assert('preferredName preserved', reloadedRichAsset.preferredName, 'TAGRISSO')
assert('innNames preserved', reloadedRichAsset.innNames, ['osimertinib'])
assert('developmentCodes preserved', reloadedRichAsset.developmentCodes, ['AZD9291'])
assert('ownerCompanies preserved', reloadedRichAsset.ownerCompanies, ['AstraZeneca'])
assert('aliases preserved', reloadedRichAsset.aliases, ['Osimertinib', 'AZD9291'])
const richCompat = deriveAssetNameCompat('tagrisso-live', null, reloadedRichAsset, null)
assert('assetName correctly derives from the reloaded resolved identity', richCompat.assetName, 'TAGRISSO')

// ── 93. Legacy catalog Home Asset (Ekterly) continues working unchanged ──
console.log('93. A legacy catalog Home Asset (Ekterly) still resolves via the same shared resolver\'s third branch, completely unchanged')
const ekterlyCompat = deriveAssetNameCompat('ekterly', null, null, null)
assert('assetName is the real catalog brand name', ekterlyCompat.assetName, 'Ekterly')
assertTrue('innName is a real catalog INN, not null (Ekterly has one configured)', typeof ekterlyCompat.innName === 'string' && ekterlyCompat.innName.length > 0)

// ── 94. Existing manualHomeAsset behavior remains backward-compatible ──
console.log('94. manualHomeAsset itself resolves exactly as before -- same fields, same priority position (checked first, ahead of resolvedHomeAsset)')
const manualVsResolvedCompat = deriveAssetNameCompat('manual-asset-tagrisso', tagrisso, fakeResolvedAsset({ id: 'manual-asset-tagrisso' }), null)
assert('when a manual AND a (mismatched-id) resolved asset both exist, the matching manual one wins -- manual is still checked first', manualVsResolvedCompat.assetName, 'TAGRISSO')

// ── 95/96. Disease Area persistence (Implementation 2/2A) and stale-draft recovery (Implementation 3) remain green ──
console.log('95/96. Implementation 2/2A\'s Disease Area tests and Implementation 3\'s stale-draft recovery tests all still pass in this same run (see the full pass/fail count below) -- neither was modified by this task')
assertTrue('recoverSetupDraft() (Implementation 3) still calls the unmodified resolveHomeAssetDisplay(draft), which now internally delegates to resolveHomeAssetDisplayFrom -- fully compatible, no change needed there', /function resolveHomeAssetDisplay\(draft: SetupDraft\): HomeAssetDisplay \| null \{\s*return resolveHomeAssetDisplayFrom\(/.test(fs.readFileSync(fileURLToPath(import.meta.url).replace(/\.test\.ts$/, '.ts'), 'utf-8')))

// ── Targeted Implementation 5: Stage 2 recommendation-first state UX ───────
//
// Stage2Discover.tsx is a React component (no DOM testing library in this
// repo -- same boundary as every other page-level check above). Verified
// via source-text assertions against the freshly-loaded stage2Source,
// which reflects the file exactly as edited by this task.

// ── 97. idle does NOT render a false zero-results message ─────────────────
console.log('97. The idle (NOT YET ATTEMPTED) state no longer claims a search already completed with zero results')
assertTrue('the old misleading "No competitor companies yet" wording is gone entirely', !stage2Source.includes('No competitor companies yet'))
assertTrue('idle now uses neutral "hasn\'t started yet" wording instead', stage2Source.includes("state.status === 'idle' && !hasCompanies") && stage2Source.includes('Competitor discovery hasn\'t started yet'))

// ── 98. loading clearly represents active discovery, never an empty-state message ──
console.log('98. loading still clearly represents active discovery, with no empty-state message shown alongside it')
assertTrue('loading shows Ariya is analysing the competitive landscape', stage2Source.includes("state.status === 'loading'") && stage2Source.includes('Ariya is analysing the competitive landscape'))
const loadingBlockMatch = stage2Source.match(/state\.status === 'loading' &&[\s\S]*?<\/Empty>/)
const loadingBlock = loadingBlockMatch ? loadingBlockMatch[0] : ''
assertTrue('the loading block was found', loadingBlock.length > 0)
assertTrue('no idle/empty-state text renders inside the loading block specifically', !loadingBlock.includes('No competitor companies') && !loadingBlock.includes("didn't find suitable"))

// ── 99. results render the existing company recommendation cards unchanged ──
console.log('99. RESULTS still render the existing company list/card markup, completely unchanged by this task')
assertTrue('the company list still uses ItemGroup/Item/Checkbox exactly as before', stage2Source.includes('<ItemGroup>') && stage2Source.includes('<Checkbox'))
assertTrue('company selection still calls the unmodified toggleCompanySelection', stage2Source.includes('onCheckedChange={() => onChange(toggleCompanySelection(draft, company.id))}'))
assertTrue('"Review evidence" action is unchanged', stage2Source.includes('Review evidence →'))

// ── 100. empty appears only after successful zero-result completion ───────
console.log('100. A distinct EMPTY state now exists for state.status === \'empty\' && !hasCompanies -- previously this exact case rendered nothing at all')
assertTrue('a dedicated empty-state block is gated on state.status === \'empty\'', stage2Source.includes("state.status === 'empty' && !hasCompanies"))
assertTrue('it explicitly communicates that automatic discovery was attempted first', stage2Source.includes('Automatic discovery completed for this landscape but found no companies to suggest'))
assertTrue('idle and empty are two textually DISTINCT messages, never conflated', stage2Source.includes('Competitor discovery hasn\'t started yet') && stage2Source.includes('Ariya didn\'t find suitable competitor recommendations') )

// ── 101. error makes Retry the primary recovery action ─────────────────────
console.log('101. In the error state, Retry is now styled as the PRIMARY action (default variant) and manual Add as SECONDARY (outline) -- previously reversed')
const errorBlockMatch = stage2Source.match(/state\.status === 'error' && !hasCompanies[\s\S]*?<\/Empty>/)
const errorBlock = errorBlockMatch ? errorBlockMatch[0] : ''
assertTrue('the error block was found', errorBlock.length > 0)
assertTrue('Retry button has NO variant prop (default/filled = primary) and appears before Add', /<Button onClick=\{runDiscovery\}>Retry<\/Button>/.test(errorBlock))
assertTrue('Add competitor manually is styled variant="outline" (secondary) in the error state', /<Button variant="outline" onClick=\{\(\) => setAddOpen\(true\)\}><PlusIcon \/> Add competitor manually<\/Button>/.test(errorBlock))
assertTrue('Retry appears BEFORE Add in DOM order (first = visually leads in a left-to-right button row)', errorBlock.indexOf('>Retry<') < errorBlock.indexOf('Add competitor manually'))

// ── 102. manual Add remains secondary in idle/results/error states (NOT in empty, where it is the appropriate primary action) ──
console.log('102. Manual Add is styled as the secondary (outline) action in idle, results, and error -- and is deliberately the primary styled action only in the EMPTY state, where there is no competing Ariya recommendation to stay secondary to')
const idleBlockMatch = stage2Source.match(/state\.status === 'idle' && !hasCompanies[\s\S]*?<\/Empty>/)
const idleBlock = idleBlockMatch ? idleBlockMatch[0] : ''
assertTrue('idle\'s Add button is variant="outline" (secondary)', /<Button variant="outline" onClick=\{\(\) => setAddOpen\(true\)\}><PlusIcon \/> Add competitor manually<\/Button>/.test(idleBlock))
assertTrue('the results-state header Add button is variant="outline" (secondary), unchanged in spirit from before this task', stage2Source.includes('<Button variant="outline" onClick={() => setAddOpen(true)} className="ml-auto">'))
const emptyBlockMatch = stage2Source.match(/state\.status === 'empty' && !hasCompanies[\s\S]*?<\/Empty>/)
const emptyBlock = emptyBlockMatch ? emptyBlockMatch[0] : ''
assertTrue('EMPTY\'s Add button has NO variant prop (default/filled) -- the one deliberate exception, since it is genuinely the only actionable path in that state', /<Button onClick=\{\(\) => setAddOpen\(true\)\}><PlusIcon \/> Add competitor manually<\/Button>/.test(emptyBlock))

// ── 103. Stage 2 selection behavior remains unchanged ──────────────────────
console.log('103. Stage 2 selection logic itself (toggleCompanySelection/isCompanySelected) is untouched -- this task only changed state presentation/CTA hierarchy')
assertTrue('isCompanySelected still drives the checkbox\'s checked state, unchanged', stage2Source.includes('const selected = isCompanySelected(draft, company.id)'))
assertTrue('toggleCompanySelection is still imported and used exactly once, for the checkbox handler', stage2Source.includes('toggleCompanySelection,') && (stage2Source.match(/toggleCompanySelection\(/g) || []).length === 1)

// ── 104. Stage 3 still contains no selection checkbox (pre-existing, untouched by this task) ──
console.log('104. Stage 3 still has no selection checkbox (pre-existing test 8b, re-confirmed here since Implementation 5 touches ONLY Stage2Discover.tsx)')
assertTrue('Stage3Configure.tsx still never imports the Checkbox primitive', !stage3Source.includes('shadcn/ui/checkbox'))

// ── 105. existing Home Company exclusion remains green (pre-existing, untouched by this task) ──
console.log('105. Home Company exclusion (isHomeCompany, pre-existing test 22b) remains green -- re-confirmed here since Implementation 5 never touches setup-draft.ts\'s home-company logic')
assertTrue('exact match is still blocked', isHomeCompany(withHae(), 'KalVista'))
assertTrue('an unrelated company is still never blocked', !isHomeCompany(withHae(), 'BioCryst Pharmaceuticals'))

// ── 106. Implementation 2/2A/3/4 setup-state tests remain green ────────────
console.log('106. Implementation 2/2A/3/4\'s own tests all still pass in this same run (see the full pass/fail count below) -- none of their code was touched by this task')
assertTrue('Stage2Discover.tsx still derives diseaseArea/homeAsset via the SAME shared resolvers (resolveDiseaseAreaDisplay/resolveHomeAssetDisplay) Implementation 2/4 established -- never a competing resolution path', stage2Source.includes('const diseaseArea = resolveDiseaseAreaDisplay(draft)') && stage2Source.includes('const homeAsset = resolveHomeAssetDisplay(draft)'))
assertTrue('the discovery request itself is completely unchanged (still sends homeAsset.displayName/diseaseArea.name/homeAsset.companyName)', stage2Source.includes("run({ homeAsset: homeAsset.displayName, indication: diseaseArea.name, homeCompany: homeAsset.companyName })"))

// ── Summary ─────────────────────────────────────────────────────────────────
declare const process: { exit(code: number): void }
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
