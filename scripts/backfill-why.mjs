/**
 * Name: backfill-why
 * Description: One-time backfill — populates why_it_matters for all existing
 *   company_signals rows where the column is NULL.
 *   Deterministic only — no external API calls, no cost.
 *
 *   Run AFTER adding the why_it_matters column to Supabase:
 *     ALTER TABLE company_signals ADD COLUMN IF NOT EXISTS why_it_matters TEXT;
 *
 *   Then run:
 *     node --env-file=.env.local scripts/backfill-why.mjs
 *
 *   Safe to re-run: only processes rows WHERE why_it_matters IS NULL.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildWhyItMatters } from './lib/extractWhy.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Load competitor name map ──────────────────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)
const nameById = Object.fromEntries(competitors.map(c => [c.id, c.name]))

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🔄  Backfilling why_it_matters (deterministic — no external API)...\n`)

const { data: rows, error: fetchErr } = await supabase
  .from('company_signals')
  .select('id, competitor_id, signal_type, headline, body_excerpt')
  .is('why_it_matters', null)
  .order('date', { ascending: false })

if (fetchErr) { console.error('❌  Fetch failed:', fetchErr.message); process.exit(1) }
if (!rows?.length) { console.log('✅  No rows to backfill — all why_it_matters already populated.'); process.exit(0) }

console.log(`  ${rows.length} rows to process...\n`)

let updated = 0
let skipped = 0
const errors = []

for (const row of rows) {
  const competitorName = nameById[row.competitor_id] ?? row.competitor_id
  process.stdout.write(`  ${competitorName.padEnd(28)} [${row.signal_type}]  `)

  try {
    const why = buildWhyItMatters(
      { headline: row.headline, body_excerpt: row.body_excerpt, signal_type: row.signal_type },
      competitorName,
    )

    const { error: updateErr } = await supabase
      .from('company_signals')
      .update({ why_it_matters: why })
      .eq('id', row.id)

    if (updateErr) throw new Error(updateErr.message)
    updated++
    console.log(`✅`)
  } catch (e) {
    errors.push(`${row.id}: ${e.message}`)
    console.log(`❌  ${e.message}`)
    skipped++
  }

}

console.log(`
─────────────────────────────────────────
  Updated: ${updated} / ${rows.length}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
