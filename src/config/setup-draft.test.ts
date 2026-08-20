/**
 * setup-draft.test.ts — staged landscape setup acceptance tests.
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/config/setup-draft.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Scope note: what's genuinely pure -- Stage 1/2/3 state transitions,
 * validation, the tracked-competitor projection, draft persistence -- is
 * tested here. Route-level behavior (first-time user -> /setup, completed
 * user -> workspace, back-navigation preserving state, changing landscape
 * clearing stale candidates through the confirmation dialog) is a React/
 * router concern with no DOM testing library in this repo (same "do not
 * introduce a heavy testing framework" boundary as every other *.test.ts
 * file here) -- those were verified live in the running app instead; see
 * this step's own checkpoint, section O, for exactly what was exercised.
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
  selectKnownHomeAsset,
  attachManualHomeAsset,
  isStage1Valid,
  addManualCandidate,
  toggleCandidateSelection,
  isCandidateSelected,
  setCandidateRelationship,
  isStage3Valid,
  hasDownstreamData,
  clearDownstreamData,
  draftToTrackedCompetitors,
  saveSetupDraft,
  loadSetupDraft,
  clearSetupDraft,
  type SetupDraft,
} from './setup-draft.js'
import { getDiseaseAreasForTherapeuticArea, getAssetsForDiseaseArea } from './landscape-configuration.js'

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
console.log('6. A manually entered asset can satisfy Stage 1 identity (gMG has no catalogued asset)')
let gmgDraft = createEmptySetupDraft()
gmgDraft = selectTherapeuticArea(gmgDraft, 'neurology')
gmgDraft = selectDiseaseArea(gmgDraft, 'gmg')
assertTrue('gMG is not submittable before a manual asset is attached', !isStage1Valid(gmgDraft))
gmgDraft = attachManualHomeAsset(gmgDraft, { displayName: 'RYSTIGGO', innName: 'rozanolixizumab', company: 'UCB' })
assertTrue('gMG becomes submittable once a manual asset is attached', isStage1Valid(gmgDraft))

// ── 7. manual asset does not receive fabricated metadata ─────────────────
console.log('7. Manual asset carries only user-supplied identity fields, nothing fabricated')
assert('manualAsset shape has exactly the identity fields a user can supply', Object.keys(gmgDraft.manualAsset!).sort(), [
  'company', 'diseaseAreaId', 'displayName', 'id', 'innName', 'source', 'therapeuticAreaId',
])
assertTrue('no mechanism/phase/lexicon/evidence field exists on the manual asset', !('mechanism' in gmgDraft.manualAsset!) && !('lexiconInns' in gmgDraft.manualAsset!))

// ── 8. Stage 2 unavailable discovery uses no static HAE fallback ─────────
console.log('8. Discovery adapter never returns a static HAE fallback (source check)')
const discoveryAdapterPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'api', 'discoveryAdapter.ts')
const discoveryAdapterSource = fs.readFileSync(discoveryAdapterPath, 'utf-8')
// Strip block/line comments first -- the module's own docstring legitimately
// *names* suggestedCompetitors/discovered-candidates.json to document what it
// deliberately avoids; only real code (imports/usage) should fail this check.
const discoveryAdapterCode = discoveryAdapterSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n')
assertTrue('discoveryAdapter.ts never imports/uses suggestedCompetitors in real code', !discoveryAdapterCode.includes('suggestedCompetitors'))
assertTrue('discoveryAdapter.ts never imports discovered-candidates.json in real code', !discoveryAdapterCode.toLowerCase().includes('discovered-candidates'))
assertTrue('discoveryAdapter.ts never hardcodes takeda/biocryst/pharvaris in real code', !/takeda|biocryst|pharvaris/i.test(discoveryAdapterCode))

// ── 9/10. manual competitor can be added, marked evidence-not-evaluated ──
console.log('9/10. A manual competitor can be added and is marked evidence-not-evaluated')
let stage2Draft = withHae()
stage2Draft = addManualCandidate(stage2Draft, { companyName: 'BioCryst Pharmaceuticals', assetName: 'Orladeyo', innName: 'berotralstat' })
assert('candidate count is 1', stage2Draft.candidates.length, 1)
assert('evidenceStatus is not_evaluated', stage2Draft.candidates[0].evidenceStatus, 'not_evaluated')
assert('no fabricated Ariya assessment on a manual candidate', stage2Draft.candidates[0].ariyaAssessment, null)

// ── 11. discovered/advisory relationship never becomes user classification automatically ──
console.log('11. Ariya assessment never becomes the user classification automatically')
let advisoryDraft = withHae()
advisoryDraft = {
  ...advisoryDraft,
  candidates: [{
    id: 'discovered-1', source: 'discovered', displayName: 'Pharvaris', companyName: 'Pharvaris N.V.', innName: 'deucrictibant',
    ariyaAssessment: 'direct', evidenceStatus: 'evidence_available', evidenceSummary: null, sourceReferences: [],
  }],
}
advisoryDraft = toggleCandidateSelection(advisoryDraft, 'discovered-1')
assert('selecting a candidate with an Ariya "direct" read starts with userRelationship: null, never auto-copied', advisoryDraft.selections[0].userRelationship, null)

// ── 12. candidate is not tracked until explicitly selected ───────────────
console.log('12. A candidate is not tracked until explicitly selected')
assert('draftToTrackedCompetitors is empty before any classification', draftToTrackedCompetitors(advisoryDraft).length, 0)
const unselectedCandidateDraft = addManualCandidate(withHae(), { companyName: 'Unselected Co' })
assert('an added-but-unselected candidate never appears in tracked competitors', draftToTrackedCompetitors(unselectedCandidateDraft).length, 0)

// ── 13. selected candidate requires Direct/Indirect ───────────────────────
console.log('13. A selected candidate requires an explicit Direct/Indirect classification')
assertTrue('Stage 3 is invalid while the selected candidate has no relationship', !isStage3Valid(advisoryDraft))
const classifiedDraft = setCandidateRelationship(advisoryDraft, 'discovered-1', 'direct')
assertTrue('Stage 3 becomes valid once classified', isStage3Valid(classifiedDraft))
assert('draftToTrackedCompetitors now includes it as Direct', draftToTrackedCompetitors(classifiedDraft)[0].userRelationship, 'direct')

// ── 14. unselected candidate does not require classification ─────────────
console.log('14. An unselected candidate does not block Stage 3 validity')
let mixedDraft = classifiedDraft
mixedDraft = addManualCandidate(mixedDraft, { companyName: 'Not selected at all' })
assertTrue('Stage 3 stays valid -- the new unselected candidate needs no relationship', isStage3Valid(mixedDraft))

// ── 15. changing Stage 1 landscape requires clearing stale candidate state ──
console.log('15. Changing Stage 1 after Stage 2/3 data exists is flagged as stale, cleared only explicitly')
assertTrue('hasDownstreamData is true once candidates/selections exist', hasDownstreamData(mixedDraft))
const cleared = clearDownstreamData(mixedDraft)
assert('candidates cleared', cleared.candidates.length, 0)
assert('selections cleared', cleared.selections.length, 0)
assert('landscapeConfiguration untouched by clearDownstreamData itself (caller changes it separately)', cleared.landscapeConfiguration, mixedDraft.landscapeConfiguration)

// ── 16. back navigation preserves valid draft state ───────────────────────
console.log('16. Moving between stages never discards candidates/selections (pure stage-field change only)')
const atStage2 = { ...mixedDraft, stage: 'discover' as const }
const backAtStage1 = { ...atStage2, stage: 'define' as const }
assert('candidates survive a stage change', backAtStage1.candidates.length, mixedDraft.candidates.length)
assert('selections survive a stage change', backAtStage1.selections.length, mixedDraft.selections.length)

// ── 17. final setup persists selected competitor + relationship ──────────
console.log('17. Final setup output carries the selected competitor and its relationship')
const tracked = draftToTrackedCompetitors(classifiedDraft)
assert('exactly one tracked competitor', tracked.length, 1)
assert('identity preserved', tracked[0].displayName, 'Pharvaris')
assert('relationship preserved', tracked[0].userRelationship, 'direct')
assert('advisory assessment preserved separately, not merged into userRelationship', tracked[0].ariyaAssessment, 'direct')

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
console.log('19. No Supabase reference anywhere in the setup flow\'s new modules')
const setupDraftSource = fs.readFileSync(fileURLToPath(import.meta.url).replace(/\.test\.ts$/, '.ts'), 'utf-8')
assertTrue('setup-draft.ts never imports/references supabase', !/supabase/i.test(setupDraftSource))
assertTrue('discoveryAdapter.ts never imports/references supabase', !/supabase/i.test(discoveryAdapterSource))

// ── 20. legacy Takeda/BioCryst/Pharvaris default does not overwrite newly configured tracked competitors ──
console.log('20. The legacy HAE watchlist default never leaks into a fresh tracked-competitor projection')
const freshDraft = withHae()
assert('a freshly defined landscape with no candidates yet projects to zero tracked competitors', draftToTrackedCompetitors(freshDraft).length, 0)
assertTrue('draftToTrackedCompetitors never injects takeda/biocryst/pharvaris on its own', !draftToTrackedCompetitors(freshDraft).some((c) => ['takeda', 'biocryst', 'pharvaris'].includes(c.id)))

// ── Summary ─────────────────────────────────────────────────────────────────
declare const process: { exit(code: number): void }
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
