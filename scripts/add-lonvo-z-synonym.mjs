/**
 * add-lonvo-z-synonym.mjs — add the "lonvo-z" shorthand to lonvoguran
 * ziclumeran's asset_lexicon row.
 *
 * Re-verified 2026-08-10 against the live asset_lexicon table: icatibant,
 * mezagitamab, and bcx17725 already have complete alias coverage (INN, brand
 * where one exists, and dev-code variants). Only lonvoguran ziclumeran is
 * missing a real-world shorthand — "lonvo-z" appears in the actual ingested
 * corpus (company_signals headline/body_excerpt, 291 rows scanned) alongside
 * "lonvoguran", "ziclumeran", and "ntla-2002", but isn't itself a lexicon
 * synonym. A headline using "lonvo-z" alone, without the full INN or NTLA-2002
 * nearby, would fail to resolve today.
 *
 * A quick scan of the same corpus (plus cached PubMed abstracts) turned up no
 * other missing shorthand for any of the four drugs in scope — this is not a
 * full lexicon audit, just these four.
 *
 * SAFETY: dry-run by default — prints the current row and the exact synonyms
 * array it would write, changes nothing. Add --apply to write. Only ever
 * touches the synonyms array on this one row.
 *
 * Usage:
 *   node --env-file=.env.local scripts/add-lonvo-z-synonym.mjs            # dry-run
 *   node --env-file=.env.local scripts/add-lonvo-z-synonym.mjs --apply    # write
 */

import { createSupabaseClient } from './lib/signal-gate.mjs'

const APPLY = process.argv.includes('--apply')
const INN = 'lonvoguran ziclumeran'
const NEW_SYNONYM = 'lonvo-z'

async function main() {
  console.log(`\n── Add "${NEW_SYNONYM}" synonym to ${INN} (${APPLY ? 'APPLY — WILL WRITE' : 'DRY-RUN — no writes'}) ──\n`)

  const supabase = createSupabaseClient()
  const { data: row, error } = await supabase
    .from('asset_lexicon')
    .select('inn, brand_name, synonyms, competitor_id')
    .eq('inn', INN)
    .single()
  if (error) { console.error(`❌  load failed: ${error.message}`); process.exit(1) }

  console.log('Current row:')
  console.log(`  inn:           ${row.inn}`)
  console.log(`  brand_name:    ${row.brand_name}`)
  console.log(`  synonyms:      ${JSON.stringify(row.synonyms)}`)
  console.log(`  competitor_id: ${row.competitor_id}`)

  const current = row.synonyms ?? []
  if (current.some((s) => s.toLowerCase() === NEW_SYNONYM)) {
    console.log(`\n"${NEW_SYNONYM}" is already present. Nothing to do.`)
    return
  }
  const updated = [...current, NEW_SYNONYM]

  console.log('\nProposed change:')
  console.log(`  synonyms:      ${JSON.stringify(current)}`)
  console.log(`              →  ${JSON.stringify(updated)}`)

  if (!APPLY) {
    console.log('\n── DRY-RUN complete. No rows written. Re-run with --apply to write. ──\n')
    return
  }

  const { error: upErr } = await supabase
    .from('asset_lexicon')
    .update({ synonyms: updated })
    .eq('inn', INN)
  if (upErr) { console.error(`❌  update failed: ${upErr.message}`); process.exit(1) }
  console.log('\n── Applied. ──\n')
}

main().catch((e) => { console.error(`\n❌  ${e.message}\n`); process.exit(1) })
