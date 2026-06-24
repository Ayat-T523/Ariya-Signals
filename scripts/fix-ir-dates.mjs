/**
 * fix-ir-dates — re-extracts the true publication date from every ir_firecrawl
 * article page and compares to the stored date (which was written with a
 * timezone-buggy parseDate that shifts dates back one day in UTC+ timezones).
 *
 * Emits a named UPDATE SQL with the corrected, timezone-safe dates.
 *
 * Usage: node --env-file=.env.local scripts/fix-ir-dates.mjs
 */

import { createSupabaseClient } from './lib/signal-gate.mjs'
import { fcScrape } from './lib/firecrawl.mjs'

const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12,
}

// Timezone-safe: build YYYY-MM-DD from parts, never via Date.toISOString().
function safeIso(raw) {
  if (!raw) return null
  const m = raw.toLowerCase().match(/([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (m && MONTHS[m[1]]) {
    return `${m[3]}-${String(MONTHS[m[1]]).padStart(2,'0')}-${String(+m[2]).padStart(2,'0')}`
  }
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
}

const DATE_SCHEMA = {
  type: 'object',
  properties: {
    published_date: { type: 'string', description: 'Publication date of THIS press release, exactly as printed at the top of the article' },
  },
  required: ['published_date'],
}

const supabase = createSupabaseClient()
const { data: rows, error } = await supabase
  .from('company_signals')
  .select('id, competitor_id, date, headline, source_url')
  .eq('data_source', 'ir_firecrawl')
  .order('date', { ascending: false })

if (error) { console.error('❌', error.message); process.exit(1) }

const updates = []
for (const r of rows) {
  let live = null
  try {
    const res = await fcScrape(r.source_url, { schema: DATE_SCHEMA, prompt: 'Extract only the publication date of this single press release.' })
    live = res.extract?.published_date ?? null
  } catch (e) {
    console.log(`\n⚠️  fetch failed: ${r.source_url}\n   ${e.message}`)
    continue
  }
  const correct = safeIso(live)
  const status = !correct ? '❓ unparseable' : correct === r.date ? '✅ already correct' : '🔧 NEEDS FIX'
  console.log(`\n[${r.competitor_id}] ${r.headline.slice(0, 60)}`)
  console.log(`   stored:  ${r.date}`)
  console.log(`   live:    ${live}  → ${correct ?? '?'}`)
  console.log(`   ${status}`)
  if (correct && correct !== r.date) updates.push({ id: r.id, from: r.date, to: correct })
}

console.log(`\n\n── Corrections needed: ${updates.length}/${rows.length}\n`)
if (updates.length) {
  console.log('-- Name: fix_ir_firecrawl_dates')
  for (const u of updates) {
    console.log(`UPDATE company_signals SET date = '${u.to}' WHERE id = '${u.id}';  -- was ${u.from}`)
  }
  console.log()
}
