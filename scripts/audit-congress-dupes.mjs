/**
 * audit-congress-dupes — groups congress_firecrawl rows by (competitor, date,
 * normalized headline) to expose duplicate abstracts that slipped past the
 * abstract_number-based source_hash dedup.
 *
 * Prints each duplicate group with all row ids (oldest first), and emits a
 * ready-to-run cleanup SQL that keeps the oldest row per group.
 *
 * Usage: node --env-file=.env.local scripts/audit-congress-dupes.mjs
 */

import { createSupabaseClient } from './lib/signal-gate.mjs'

const supabase = createSupabaseClient()

const { data, error } = await supabase
  .from('company_signals')
  .select('id, competitor_id, date, headline, created_at')
  .eq('data_source', 'congress_firecrawl')
  .order('created_at', { ascending: true })

if (error) { console.error('❌', error.message); process.exit(1) }

const groups = new Map()
for (const r of data) {
  const key = `${r.competitor_id}|${r.date}|${r.headline.trim().toLowerCase()}`
  ;(groups.get(key) ?? groups.set(key, []).get(key)).push(r)
}

let uniqueCount = 0
let dupRows = 0
const idsToDelete = []

console.log(`\nTotal congress_firecrawl rows: ${data.length}`)
console.log(`Unique abstracts (competitor+date+title): ${groups.size}\n`)

for (const [key, rows] of groups) {
  uniqueCount++
  if (rows.length > 1) {
    const [keep, ...drop] = rows  // oldest kept
    dupRows += drop.length
    idsToDelete.push(...drop.map(r => r.id))
    console.log(`  ×${rows.length}  ${rows[0].headline.slice(0, 80)}`)
    console.log(`        keep id=${keep.id}  drop ids=[${drop.map(r => r.id).join(', ')}]`)
  }
}

console.log(`\n── Duplicate rows to remove: ${dupRows} (keeps ${groups.size} unique)\n`)

if (idsToDelete.length) {
  console.log('── Cleanup SQL ────────────────────────────────────────────')
  console.log('-- Name: dedup_congress_firecrawl_rows')
  console.log('DELETE FROM company_signals')
  console.log(`WHERE id IN (\n  ${idsToDelete.map(id => `'${id}'`).join(',\n  ')}\n);`)
  console.log('────────────────────────────────────────────────────────────\n')
}
