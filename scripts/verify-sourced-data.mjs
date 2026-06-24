/**
 * verify-sourced-data — dumps all Firecrawl-ingested rows for an accuracy audit.
 *
 * Pulls every row written by the Firecrawl pipeline (congress_firecrawl,
 * ir_firecrawl, csl_firecrawl, takeda_firecrawl) and prints the fields that
 * matter for accuracy: competitor, date, headline, source_url, source_hash.
 *
 * Flags internal red flags:
 *   - missing / malformed date
 *   - missing / non-http source_url
 *   - duplicate source_hash (dedup integrity)
 *   - generic / suspiciously short headline
 *
 * Usage: node --env-file=.env.local scripts/verify-sourced-data.mjs
 */

import { createSupabaseClient } from './lib/signal-gate.mjs'

const SOURCES = ['congress_firecrawl', 'ir_firecrawl', 'csl_firecrawl', 'takeda_firecrawl']

const supabase = createSupabaseClient()

const { data, error } = await supabase
  .from('company_signals')
  .select('id, competitor_id, signal_type, date, headline, body_excerpt, source_url, source_hash, data_source, created_at')
  .in('data_source', SOURCES)
  .order('data_source', { ascending: true })
  .order('competitor_id', { ascending: true })
  .order('date', { ascending: false })

if (error) {
  console.error('❌ query failed:', error.message)
  process.exit(1)
}

console.log(`\nTotal Firecrawl-sourced rows: ${data.length}\n`)

// Group by data_source
const bySource = {}
for (const r of data) (bySource[r.data_source] ??= []).push(r)

const hashSeen = new Map()
const flags = []

for (const [source, rows] of Object.entries(bySource)) {
  console.log(`\n══ ${source} (${rows.length} rows) ${'═'.repeat(40)}`)
  for (const r of rows) {
    const issues = []
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) issues.push('BAD_DATE')
    if (!r.source_url || !/^https?:\/\//.test(r.source_url)) issues.push('BAD_URL')
    if (!r.headline || r.headline.trim().length < 12) issues.push('SHORT_HEADLINE')
    if (hashSeen.has(r.source_hash)) issues.push(`DUP_HASH(${hashSeen.get(r.source_hash)})`)
    else hashSeen.set(r.source_hash, r.id)

    const tag = issues.length ? `  ⚠️  ${issues.join(', ')}` : ''
    console.log(`\n  [${r.competitor_id}] ${r.date ?? 'no-date'} · ${r.signal_type}${tag}`)
    console.log(`    H: ${r.headline}`)
    console.log(`    U: ${r.source_url}`)
    if (issues.length) flags.push({ id: r.id, source, competitor: r.competitor_id, headline: r.headline, issues })
  }
}

console.log(`\n\n══ FLAG SUMMARY ${'═'.repeat(50)}`)
if (flags.length === 0) {
  console.log('  ✅ No internal red flags (dates, URLs, headlines, hashes all clean).')
} else {
  for (const f of flags) console.log(`  ⚠️  [${f.competitor}] ${f.issues.join(', ')} — ${f.headline.slice(0, 60)}`)
}
console.log()
