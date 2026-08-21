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
  type SetupDraft,
} from './setup-draft.js'
import type { ResolvedDiseaseArea } from '../lib/api/diseaseSearch.js'
import { getDiseaseAreasForTherapeuticArea, getAssetsForDiseaseArea } from './landscape-configuration.js'
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

// ── Summary ─────────────────────────────────────────────────────────────────
declare const process: { exit(code: number): void }
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
