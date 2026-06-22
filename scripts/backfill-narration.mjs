/**
 * Name: backfill-narration
 * Description: One-time backfill — generates and stores competitor narration summaries
 *   for all competitors from existing company_signals data. No external API calls.
 *
 *   Run AFTER creating the company_summaries table:
 *     (run supabase/company_summaries.sql in the Supabase SQL editor first)
 *
 *   Then run:
 *     node --env-file=.env.local scripts/backfill-narration.mjs
 *
 *   Safe to re-run: upserts on competitor_id — idempotent.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildNarration, NARRATION_DAYS } from './lib/buildNarration.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Load competitor list ──────────────────────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🔄  Backfilling competitor narration summaries (last ${NARRATION_DAYS} days)...\n`)

const cutoff = new Date(Date.now() - NARRATION_DAYS * 86_400_000).toISOString().slice(0, 10)
let written = 0
const errors = []

for (const { id, name } of competitors) {
  process.stdout.write(`  ${name.padEnd(28)}`)

  const { data: signals } = await supabase
    .from('company_signals')
    .select('signal_type, why_it_matters, date')
    .eq('competitor_id', id)
    .gte('date', cutoff)
    .order('date', { ascending: false })

  const narration = buildNarration(signals ?? [], name)

  const { error } = await supabase
    .from('company_summaries')
    .upsert(
      {
        competitor_id:      id,
        competitor_summary: narration,
        summary_source:     'deterministic',
        summary_updated_at: new Date().toISOString(),
      },
      { onConflict: 'competitor_id', ignoreDuplicates: false }
    )

  if (error) {
    errors.push(`${name}: ${error.message}`)
    console.log(`❌  ${error.message}`)
  } else {
    written++
    console.log(narration ? `✅  "${narration.slice(0, 60)}…"` : `✅  (no signals → null)`)
  }
}

console.log(`
─────────────────────────────────────────
  Competitors processed: ${competitors.length}
  Summaries written:     ${written}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
