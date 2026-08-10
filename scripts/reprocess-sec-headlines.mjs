/**
 * reprocess-sec-headlines.mjs — §2.4 data-quality gate, existing-row cleanup.
 *
 * Targets sec_edgar company_signals rows whose headline FAILS the deterministic
 * qualityGate (synthetic composeTitle stubs, boilerplate, truncated). For each,
 * re-derives the REAL disclosure via the shared sec-extract.recoverDisclosure
 * (8-K body + EX-99.1 exhibit; never synthesizes). Then:
 *   - real disclosure found → KEEP, update to the real text
 *   - none found            → REJECT (row carries nothing useful)
 *
 * SAFETY:
 *   - DRY-RUN by default (writes nothing). --apply updates kept + deletes rejected.
 *   - Scoped to data_source='sec_edgar' only. PubMed/congress/HTA untouched.
 *   - Only headline + body_excerpt updated on kept rows. ai_* untouched.
 *   - Rejected rows logged to ingest_errors before deletion (audit trail).
 *
 * Usage:
 *   node --env-file=.env.local scripts/reprocess-sec-headlines.mjs           # dry-run
 *   node --env-file=.env.local scripts/reprocess-sec-headlines.mjs --apply
 */

import { createSupabaseClient, qualityGate } from './lib/signal-gate.mjs'
import { recoverDisclosure } from './lib/sec-extract.mjs'

const APPLY = process.argv.includes('--apply')
const trunc = (s, n) => (s ?? '').replace(/\s+/g, ' ').slice(0, n)

async function main() {
  console.log(`\n── Re-process SEC headlines (${APPLY ? 'APPLY — WILL WRITE + DELETE' : 'DRY-RUN — no writes'}) ──\n`)
  const supabase = createSupabaseClient()

  const { data: rows, error } = await supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, headline, body_excerpt, source_url, items, accession_number')
    .eq('data_source', 'sec_edgar')
  if (error) { console.error(error.message); process.exit(1) }

  const targets = rows.filter(r => !qualityGate(r.headline).ok)
  console.log(`sec_edgar rows: ${rows.length} | failing gate: ${targets.length}\n`)

  const kept = [], rejected = []
  let i = 0
  for (const row of targets) {
    process.stdout.write(`\r  re-fetching ${++i}/${targets.length}   `)
    const recovered = await recoverDisclosure(row.source_url, row.items, row.signal_type)
    if (recovered) kept.push({ ...row, newHeadline: recovered.headline, newBody: recovered.body })
    else           rejected.push({ ...row, reason: 'no_prose_disclosure' })
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r')

  console.log(`KEEP (recovered real disclosure): ${kept.length}`)
  console.log(`REJECT (no real disclosure):      ${rejected.length}\n`)
  const byType = {}
  for (const r of rejected) byType[r.signal_type] = (byType[r.signal_type] ?? 0) + 1
  console.log('Rejected by signal_type:', JSON.stringify(byType))

  console.log('\n── sample KEEP (old → recovered real headline) ──')
  for (const k of kept.slice(0, 12)) {
    console.log(`  (${k.competitor_id}/${k.signal_type})`)
    console.log(`    old: ${trunc(k.headline, 60)}`)
    console.log(`    new: ${trunc(k.newHeadline, 90)}`)
  }
  console.log('\n── sample REJECT ──')
  for (const r of rejected.slice(0, 10)) console.log(`  [${r.reason}] (${r.competitor_id}/${r.signal_type}) ${trunc(r.headline, 46)}`)

  if (!APPLY) { console.log('\n── DRY-RUN complete. No writes. Re-run with --apply. ──\n'); return }

  console.log('\n── Applying ──')
  let updated = 0, deleted = 0
  for (const k of kept) {
    const { error: e } = await supabase.from('company_signals')
      .update({ headline: k.newHeadline, body_excerpt: k.newBody }).eq('id', k.id)
    if (e) console.error(`  ❌ update ${k.id}: ${e.message}`); else updated++
  }
  for (const r of rejected) {
    await supabase.from('ingest_errors').insert({
      source: 'sec_edgar', competitor_id: r.competitor_id,
      error_message: `quality-gate reject (${r.reason}): ${trunc(r.headline, 120)}`,
    })
    const { error: e } = await supabase.from('company_signals').delete().eq('id', r.id)
    if (e) console.error(`  ❌ delete ${r.id}: ${e.message}`); else deleted++
  }
  console.log(`\n── Applied: ${updated} headlines recovered, ${deleted} stub rows rejected. ──\n`)
}
main().catch(e => { console.error(e); process.exit(1) })
