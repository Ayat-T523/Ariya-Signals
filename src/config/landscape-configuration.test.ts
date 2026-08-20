/**
 * landscape-configuration.test.ts — Frontend Step 2 acceptance tests.
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/config/landscape-configuration.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */

import { ASSETS_CONFIG, getAssetById } from './assets-config.js'
import {
  THERAPEUTIC_AREAS,
  DISEASE_AREAS,
  getDiseaseAreaById,
  getTherapeuticAreaById,
  getTherapeuticAreaForDiseaseArea,
} from './therapeutic-areas.js'
import {
  deriveLandscapeConfigurationFromAsset,
  migrateLegacyToLandscapeConfiguration,
  getLegacyIndicationCompat,
  isLandscapeConfigurationConsistent,
  EMPTY_LANDSCAPE_CONFIGURATION,
  type LandscapeConfiguration,
} from './landscape-configuration.js'

// ── Minimal harness (matches src/lib/signalText.test.ts) ──────────────────────

let passed = 0
let failed = 0

/** Order-independent deep equality — object key order must never affect a test result. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const aKeys = Object.keys(a as object).sort()
  const bKeys = Object.keys(b as object).sort()
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false
  return aKeys.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

function assert(label: string, actual: unknown, expected: unknown): void {
  const ok = deepEqual(actual, expected)
  if (ok) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     received: ${JSON.stringify(actual)}`)
    failed++
  }
}

function assertTrue(label: string, actual: boolean): void {
  assert(label, actual, true)
}

// ── 1. TA / DA / Asset remain distinct ─────────────────────────────────────────

console.log('1. TA / DA / Asset remain distinct')
assertTrue(
  'Therapeutic Area and Disease Area are different id spaces (no accidental overlap)',
  THERAPEUTIC_AREAS.every(ta => !DISEASE_AREAS.some(da => da.id === ta.id)),
)
assertTrue(
  'every AssetConfig has a diseaseAreaId distinct from its own id',
  ASSETS_CONFIG.every(a => a.diseaseAreaId !== a.id),
)
assert('Ekterly is an asset id, not a disease area id', getDiseaseAreaById('ekterly'), undefined)

// ── 2. Disease Area belongs to the expected Therapeutic Area ──────────────────

console.log('2. Disease Area belongs to the expected Therapeutic Area')
assert(
  'HAE -> Immunology',
  getTherapeuticAreaForDiseaseArea('hae')?.id,
  'immunology',
)
assert(
  'Generalized Myasthenia Gravis -> Neurology (product contract worked example)',
  getTherapeuticAreaForDiseaseArea('gmg')?.id,
  'neurology',
)
assert('unknown disease area id resolves to no Therapeutic Area', getTherapeuticAreaForDiseaseArea('not-a-real-id'), undefined)

// ── 3. Home Asset resolves to the expected Disease Area ────────────────────────

console.log('3. Home Asset resolves to the expected Disease Area')
for (const asset of ASSETS_CONFIG) {
  assertTrue(`${asset.id} has a diseaseAreaId set (every curated catalog entry must)`, !!asset.diseaseAreaId)
  const da = asset.diseaseAreaId ? getDiseaseAreaById(asset.diseaseAreaId) : undefined
  assertTrue(`${asset.id} -> a real Disease Area`, !!da)
  assert(`${asset.id}'s Disease Area shortCode matches its own legacy indication`, da?.shortCode, asset.indication)
  assert(`${asset.id}'s Disease Area name matches its own legacy indicationFull`, da?.name, asset.indicationFull)
}
assert('deriveLandscapeConfigurationFromAsset(ekterly) -> hae/immunology', deriveLandscapeConfigurationFromAsset('ekterly'), {
  homeAssetId: 'ekterly',
  diseaseAreaId: 'hae',
  therapeuticAreaId: 'immunology',
})
assert('deriveLandscapeConfigurationFromAsset(zevaro) -> pnh/immunology', deriveLandscapeConfigurationFromAsset('zevaro'), {
  homeAssetId: 'zevaro',
  diseaseAreaId: 'pnh',
  therapeuticAreaId: 'immunology',
})

// ── 4. Legacy asset/indication state migrates when mapping is deterministic ────

console.log('4. Legacy state migrates when the mapping is deterministic')
assert(
  'a legacy user with only asset_id=ekterly migrates to the full canonical triple',
  migrateLegacyToLandscapeConfiguration(null, { assetId: 'ekterly', indication: 'HAE' }),
  { homeAssetId: 'ekterly', diseaseAreaId: 'hae', therapeuticAreaId: 'immunology' },
)
assertTrue(
  'an existing canonical configuration is never overwritten by legacy state',
  JSON.stringify(
    migrateLegacyToLandscapeConfiguration(
      { homeAssetId: 'zevaro', diseaseAreaId: 'pnh', therapeuticAreaId: 'immunology' },
      { assetId: 'ekterly', indication: 'HAE' },
    ),
  ) === JSON.stringify({ homeAssetId: 'zevaro', diseaseAreaId: 'pnh', therapeuticAreaId: 'immunology' }),
)

// ── 5. Unknown legacy configuration is NOT silently guessed ────────────────────

console.log('5. Unknown legacy configuration is not silently guessed')
assert(
  'an asset id absent from the catalog keeps the id but leaves TA/DA null (never guessed)',
  deriveLandscapeConfigurationFromAsset('some-synthetic-chembl-asset'),
  { homeAssetId: 'some-synthetic-chembl-asset', diseaseAreaId: null, therapeuticAreaId: null },
)
assert('no asset id at all -> the fully empty configuration', deriveLandscapeConfigurationFromAsset(null), EMPTY_LANDSCAPE_CONFIGURATION)
assert(
  'legacy indication text alone (no asset_id) is never used to infer a Disease Area',
  migrateLegacyToLandscapeConfiguration(null, { assetId: null, indication: 'some made-up disease name' }),
  EMPTY_LANDSCAPE_CONFIGURATION,
)

// ── 6. Compatibility `indication` derives from Disease Area correctly ─────────

console.log('6. Legacy indication/indicationFull derive from Disease Area')
assert('hae -> HAE / Hereditary Angioedema', getLegacyIndicationCompat('hae'), {
  indication: 'HAE',
  indicationFull: 'Hereditary Angioedema',
})
assert('gmg -> gMG / Generalized Myasthenia Gravis', getLegacyIndicationCompat('gmg'), {
  indication: 'gMG',
  indicationFull: 'Generalized Myasthenia Gravis',
})
assert('null diseaseAreaId -> no compat value (caller must fall back further)', getLegacyIndicationCompat(null), null)
assert('unknown diseaseAreaId -> no compat value', getLegacyIndicationCompat('not-a-real-id'), null)

// ── 7. Configuration roundtrip/persistence helpers preserve identity ───────────

console.log('7. Roundtrip / persistence-helper identity')
for (const asset of ASSETS_CONFIG) {
  const derived = deriveLandscapeConfigurationFromAsset(asset.id)
  assertTrue(`${asset.id}'s derived configuration is internally consistent`, isLandscapeConfigurationConsistent(derived))
  const roundTripped: LandscapeConfiguration = JSON.parse(JSON.stringify(derived))
  assert(`${asset.id} survives a JSON roundtrip (the localStorage persistence shape) unchanged`, roundTripped, derived)
}
assertTrue(
  'a configuration with a mismatched therapeuticAreaId is flagged inconsistent',
  !isLandscapeConfigurationConsistent({ homeAssetId: 'ekterly', diseaseAreaId: 'hae', therapeuticAreaId: 'neurology' }),
)
assertTrue('the empty configuration is trivially consistent', isLandscapeConfigurationConsistent(EMPTY_LANDSCAPE_CONFIGURATION))

// Sanity: getAssetById / getTherapeuticAreaById still resolve for every existing entry (no regression from the diseaseAreaId addition).
for (const asset of ASSETS_CONFIG) {
  assertTrue(`getAssetById(${asset.id}) still resolves`, !!getAssetById(asset.id))
}
for (const ta of THERAPEUTIC_AREAS) {
  assertTrue(`getTherapeuticAreaById(${ta.id}) still resolves`, !!getTherapeuticAreaById(ta.id))
}

// ── Summary ─────────────────────────────────────────────────────────────────

// @types/node isn't configured for tsconfig.app.json (this is a browser-app
// config) -- the exact same pre-existing gap already sits unaddressed in
// src/lib/signalText.test.ts's identical process.exit(1) call. Declared
// locally rather than widening the shared tsconfig for one test file.
declare const process: { exit(code: number): void }

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
