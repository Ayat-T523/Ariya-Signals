/**
 * Name: backfill-indication-tags
 * Description: Populates assets.indication_tags from two sources already in Supabase:
 *
 *   1. CT.gov — trials.raw_json.protocolSection.conditionsModule.conditions
 *      A pre-structured array of condition strings per trial. All terms are stored
 *      as-is (permissive: broad parent terms like "Angioedema" are kept alongside
 *      specific terms like "Hereditary Angioedema").
 *
 *   2. DailyMed label — regulatory_events.details
 *      The indication text already stored in Supabase from the FDA label ingest.
 *      Two patterns are extracted:
 *        a. Condition name after "attacks of" (e.g. "hereditary angioedema")
 *        b. Parenthetical abbreviations (e.g. "HAE" from "(HAE)")
 *
 * Terms from both sources are merged, lowercased for deduplication, then stored
 * with original casing preserved (CT.gov casing kept; DailyMed terms lowercased).
 *
 * Prerequisites:
 *   Run supabase/phase2-4-indication-tags.sql in the Supabase SQL editor first.
 *
 * Usage: node --env-file=.env.local scripts/backfill-indication-tags.mjs
 */

import { createClient }  from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Term extraction ───────────────────────────────────────────────────────────

// Extract condition terms from a DailyMed indication text.
// Handles texts like:
//   "...indicated for the treatment of acute attacks of hereditary angioedema (HAE)..."
//   "...indicated for prophylaxis to prevent attacks of hereditary angioedema (HAE)..."
function extractFromLabel(details) {
  if (!details) return []
  const terms = new Set()

  // Pattern 1: condition name after "attacks of" — matches "hereditary angioedema"
  // Works for both "treatment of acute attacks of X" and "prevent attacks of X"
  for (const m of details.matchAll(/attacks of\s+([a-zA-Z][a-zA-Z\s-]+?)(?:\s*\(|[,\.])/g)) {
    const term = m[1].trim().toLowerCase()
    if (term.length > 3) terms.add(term)
  }

  // Pattern 2: parenthetical abbreviations — matches "HAE", "CAH", etc.
  // Constrain to 2–5 uppercase letters to avoid capturing "(FXIIa)", "(IV)", etc.
  for (const m of details.matchAll(/\(([A-Z]{2,5})\)/g)) {
    terms.add(m[1])
  }

  return [...terms]
}

// Merge two term arrays, deduplicating case-insensitively.
// Preserves the casing of the first occurrence seen.
function mergeTerms(...arrays) {
  const seen  = new Set()
  const result = []
  for (const term of arrays.flat()) {
    const key = term.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(term.trim())
  }
  return result
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n🔄  Phase 2.4 — Backfilling assets.indication_tags\n')

// Fetch all assets
const { data: assets, error: assetsErr } = await supabase
  .from('assets')
  .select('id, inn')

if (assetsErr) { console.error('❌', assetsErr.message); process.exit(1) }

// Fetch all trials with raw_json (need conditions array)
const { data: trials, error: trialsErr } = await supabase
  .from('trials')
  .select('asset_id, raw_json')
  .not('asset_id', 'is', null)

if (trialsErr) { console.error('❌', trialsErr.message); process.exit(1) }

// Fetch all regulatory_events with indication details
const { data: regEvents, error: regErr } = await supabase
  .from('regulatory_events')
  .select('asset_id, details')
  .eq('event_type', 'approval')

if (regErr) { console.error('❌', regErr.message); process.exit(1) }

// Pre-index: asset_id → all CT.gov conditions (collected across all trials)
const ctgovByAsset = {}
for (const t of trials ?? []) {
  if (!t.asset_id) continue
  const conditions = t.raw_json?.protocolSection?.conditionsModule?.conditions
  if (!conditions?.length) continue
  if (!ctgovByAsset[t.asset_id]) ctgovByAsset[t.asset_id] = new Set()
  for (const c of conditions) ctgovByAsset[t.asset_id].add(c)
}

// Pre-index: asset_id → all label-extracted terms (from all approval events)
const labelByAsset = {}
for (const r of regEvents ?? []) {
  if (!r.asset_id || !r.details) continue
  if (!labelByAsset[r.asset_id]) labelByAsset[r.asset_id] = new Set()
  for (const t of extractFromLabel(r.details)) labelByAsset[r.asset_id].add(t)
}

let updated    = 0
let alreadySet = 0
let noTerms    = 0
const errors   = []

for (const asset of assets ?? []) {
  const ctgov = [...(ctgovByAsset[asset.id] ?? [])]
  const label = [...(labelByAsset[asset.id] ?? [])]
  const tags  = mergeTerms(ctgov, label)

  if (!tags.length) {
    noTerms++
    console.log(`  ○  ${asset.inn.padEnd(28)} (no terms found)`)
    continue
  }

  const { error } = await supabase
    .from('assets')
    .update({ indication_tags: tags })
    .eq('id', asset.id)

  if (error) {
    errors.push(`${asset.inn}: ${error.message}`)
  } else {
    updated++
    console.log(`  ✅  ${asset.inn.padEnd(28)} ${JSON.stringify(tags)}`)
  }
}

console.log(`
─────────────────────────────────────────
  Phase 2.4 complete
  Updated:    ${updated}
  No terms:   ${noTerms}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────`)
