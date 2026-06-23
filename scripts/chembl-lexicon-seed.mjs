/**
 * ChEMBL lexicon seed — populates asset_lexicon from the ChEMBL REST API.
 * Usage: node --env-file=.env.local scripts/chembl-lexicon-seed.mjs
 *
 * For each target INN:
 *   1. Search ChEMBL by preferred name (exact, case-insensitive)
 *   2. Fallback: search by synonym
 *   3. Fetch mechanism of action
 *   4. Upsert into asset_lexicon
 */

import { createClient } from '@supabase/supabase-js'

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/chembl-lexicon-seed.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Target drugs ──────────────────────────────────────────────────────────────

const TARGETS = [
  { inn: 'sebetralstat',   brandName: 'Ekterly' },
  { inn: 'lanadelumab',    brandName: 'Takhzyro' },
  { inn: 'berotralstat',   brandName: 'Orladeyo' },
  { inn: 'deucrictibant',  brandName: null },
  { inn: 'navenibart',     brandName: null },
  { inn: 'garadacimab',    brandName: null },
  { inn: 'donidalorsen',   brandName: null },
]

const CHEMBL_BASE = 'https://www.ebi.ac.uk/chembl/api/data'
const SLEEP_MS    = 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json()
}

async function searchMolecule(inn) {
  // Attempt 1: preferred name exact match
  const url1 = `${CHEMBL_BASE}/molecule.json?pref_name__iexact=${encodeURIComponent(inn)}&format=json&limit=1`
  const data1 = await fetchJson(url1)
  if (data1.molecules?.length > 0) return data1.molecules[0]

  // Attempt 2: synonym match
  const url2 = `${CHEMBL_BASE}/molecule.json?molecule_synonyms__molecule_synonym__iexact=${encodeURIComponent(inn)}&format=json&limit=1`
  const data2 = await fetchJson(url2)
  if (data2.molecules?.length > 0) return data2.molecules[0]

  return null
}

async function fetchMechanism(chemblId) {
  const url = `${CHEMBL_BASE}/mechanism.json?molecule_chembl_id=${chemblId}&format=json`
  const data = await fetchJson(url)
  return data.mechanisms?.[0]?.mechanism_of_action ?? null
}

function extractSynonyms(molecule) {
  const raw = molecule.molecule_synonyms ?? []
  const names = raw.map(s => s.molecule_synonym).filter(Boolean)
  // Add pref_name if not already present
  if (molecule.pref_name && !names.includes(molecule.pref_name)) {
    names.unshift(molecule.pref_name)
  }
  // Deduplicate, lowercased comparison but preserve original casing
  const seen = new Set()
  return names.filter(n => {
    const key = n.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

const results = []

for (const { inn, brandName } of TARGETS) {
  console.log(`\n── ${inn} ─────────────────────────────`)

  let chemblId     = null
  let synonyms     = [inn]
  let maxPhase     = null
  let firstApproval = null
  let mechanism    = null
  let prefName     = null

  try {
    const molecule = await searchMolecule(inn)

    if (!molecule) {
      console.warn(`  ⚠️  WARNING: No ChEMBL record found for "${inn}" — writing fallback row`)
    } else {
      chemblId      = molecule.molecule_chembl_id ?? null
      prefName      = molecule.pref_name ?? null
      maxPhase      = molecule.max_phase ?? null
      firstApproval = molecule.molecule_properties?.first_approval ?? null
      synonyms      = extractSynonyms(molecule)

      console.log(`  chembl_id:  ${chemblId}`)
      console.log(`  pref_name:  ${prefName}`)
      console.log(`  max_phase:  ${maxPhase}`)
      console.log(`  synonyms:   ${synonyms.length} entries`)

      if (chemblId) {
        mechanism = await fetchMechanism(chemblId)
        console.log(`  mechanism:  ${mechanism ?? '(none)'}`)
      }
    }
  } catch (err) {
    console.error(`  ❌  Error fetching ${inn}: ${err.message}`)
    console.warn(`  ⚠️  Writing fallback row with synonyms = [inn]`)
    synonyms = [inn]
  }

  // Upsert
  const row = {
    inn,
    brand_name:     brandName ?? null,
    chembl_id:      chemblId,
    synonyms,
    max_phase:      maxPhase,
    first_approval: firstApproval,
    mechanism,
    fetched_at:     new Date().toISOString(),
  }

  const { error } = await supabase
    .from('asset_lexicon')
    .upsert(row, { onConflict: 'inn' })

  if (error) {
    console.error(`  ❌  Supabase upsert failed for ${inn}: ${error.message}`)
    results.push({ inn, chemblId: '—', synonymCount: synonyms.length, status: '❌ upsert failed' })
  } else {
    console.log(`  ✅  Upserted`)
    results.push({ inn, chemblId: chemblId ?? '(not found)', synonymCount: synonyms.length, status: '✅' })
  }

  await sleep(SLEEP_MS)
}

// ── Summary table ─────────────────────────────────────────────────────────────

console.log('\n\n── Summary ──────────────────────────────────────────────────────')
console.log(`${'INN'.padEnd(20)} ${'ChEMBL ID'.padEnd(20)} ${'Synonyms'.padEnd(10)} Status`)
console.log('─'.repeat(65))
for (const r of results) {
  console.log(
    `${r.inn.padEnd(20)} ${String(r.chemblId).padEnd(20)} ${String(r.synonymCount).padEnd(10)} ${r.status}`
  )
}
console.log('─'.repeat(65))
console.log(`Done. ${results.filter(r => r.status.startsWith('✅')).length}/${results.length} rows upserted.\n`)
