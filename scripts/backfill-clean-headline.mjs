/**
 * Name: backfill-clean-headline
 * Description: One-time backfill — populates clean_headline for all existing
 *   company_signals rows where the column is NULL, via local Ollama (no
 *   hosted API, no per-call cost). See scripts/lib/buildCleanHeadline.mjs.
 *
 *   Requires Ollama running locally with OLLAMA_MODEL pulled
 *   (OLLAMA_HOST/OLLAMA_MODEL in .env.local).
 *
 *   Run:
 *     node --env-file=.env.local scripts/backfill-clean-headline.mjs
 *
 *   Safe to re-run: only processes rows WHERE clean_headline IS NULL. Rows
 *   the model judges to have no substantive content (pure filing
 *   boilerplate) are left NULL and will be re-attempted on the next run.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildCleanHeadline } from './lib/buildCleanHeadline.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/backfill-clean-headline.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Load competitor name map ──────────────────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)
const nameById = Object.fromEntries(competitors.map(c => [c.id, c.name]))

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🔄  Backfilling clean_headline via Ollama (${process.env.OLLAMA_MODEL ?? 'llama3.1'})...\n`)

const { data: rows, error: fetchErr } = await supabase
  .from('company_signals')
  .select('id, competitor_id, signal_type, headline, body_excerpt')
  .is('clean_headline', null)
  .order('date', { ascending: false })

if (fetchErr) { console.error('❌  Fetch failed:', fetchErr.message); process.exit(1) }
if (!rows?.length) { console.log('✅  No rows to backfill — all clean_headline already populated.'); process.exit(0) }

console.log(`  ${rows.length} rows to process (sequential, local model — this will take a while)...\n`)

let updated = 0
let noContent = 0
let failed = 0
const errors = []

for (const [i, row] of rows.entries()) {
  const competitorName = nameById[row.competitor_id] ?? row.competitor_id
  process.stdout.write(`  [${i + 1}/${rows.length}] ${competitorName.padEnd(24)} [${row.signal_type}]  `)

  try {
    const clean = await buildCleanHeadline(
      { headline: row.headline, body_excerpt: row.body_excerpt, signal_type: row.signal_type },
      competitorName,
    )

    if (!clean) {
      noContent++
      console.log('— no substantive content, left NULL')
      continue
    }

    const { error: updateErr } = await supabase
      .from('company_signals')
      .update({ clean_headline: clean })
      .eq('id', row.id)

    if (updateErr) throw new Error(updateErr.message)
    updated++
    console.log(`✅  ${clean}`)
  } catch (e) {
    errors.push(`${row.id}: ${e.message}`)
    failed++
    console.log(`❌  ${e.message}`)
  }
}

console.log(`
─────────────────────────────────────────
  Updated:          ${updated} / ${rows.length}
  No substantive content (left NULL): ${noContent}
  Failed:            ${failed}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : ''}
─────────────────────────────────────────
`)
