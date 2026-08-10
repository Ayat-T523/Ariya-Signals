/**
 * purge-ai-columns.mjs — clear legacy AI-track content from company_signals.
 *
 * The Ariya Light build excludes AI enrichment entirely, on data-governance
 * grounds: pharma signals were not to be sent through non-enterprise model data
 * handling. The frontend no longer reads any of it (§4-1), but the generated text
 * is still sitting in the production table, which is the governance problem the
 * exclusion existed to avoid.
 *
 * Clears the LLM-generated content and its metadata:
 *   why_it_matters, suggested_action, ai_validation_status, ai_validation_reason,
 *   ai_generated_at, ai_model, ai_severity, ai_severity_reason,
 *   ai_severity_prompt_version, ai_theme, ai_theme_confidence,
 *   ai_theme_prompt_version, enrichment_prompt_version
 *
 * DELIBERATELY KEPT:
 *   - `severity` is written by the DETERMINISTIC classifySeverity in
 *     signal-gate.mjs, not by a model. It is not AI output.
 *   - `needs_body_refetch` is an operational ingest flag, not generated content.
 *
 * SAFETY:
 *   - DRY-RUN by default. --apply writes.
 *   - Snapshots every affected value to scripts/snapshots/ BEFORE clearing, so the
 *     change is reversible. The text is otherwise unrecoverable.
 *   - Only nulls the listed columns. No row is created or deleted, and no other
 *     column is touched.
 *   - Columns are left in place; dropping them is a separate schema decision.
 *
 * Usage:
 *   node --env-file=.env.local scripts/purge-ai-columns.mjs           # dry-run
 *   node --env-file=.env.local scripts/purge-ai-columns.mjs --apply
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { createSupabaseClient } from './lib/signal-gate.mjs'

const APPLY = process.argv.includes('--apply')

const AI_COLUMNS = [
  'why_it_matters',
  'suggested_action',
  'ai_validation_status',
  'ai_validation_reason',
  'ai_generated_at',
  'ai_model',
  'ai_severity',
  'ai_severity_reason',
  'ai_severity_prompt_version',
  'ai_theme',
  'ai_theme_confidence',
  'ai_theme_prompt_version',
  'enrichment_prompt_version',
]

async function main() {
  console.log(`\n── Purge legacy AI content (${APPLY ? 'APPLY — WILL WRITE' : 'DRY-RUN — no writes'}) ──\n`)
  const supabase = createSupabaseClient()

  const { data: rows, error } = await supabase
    .from('company_signals')
    .select(['id', ...AI_COLUMNS].join(','))
  if (error) { console.error(error.message); process.exit(1) }

  // Per-column population, so the scale of the change is visible before it happens.
  const populated = {}
  const affected = new Set()
  for (const r of rows) {
    for (const c of AI_COLUMNS) {
      if (r[c] !== null && r[c] !== undefined) {
        populated[c] = (populated[c] ?? 0) + 1
        affected.add(r.id)
      }
    }
  }

  console.log(`rows: ${rows.length} | rows carrying any AI content: ${affected.size}`)
  console.log('\nper column:')
  for (const c of AI_COLUMNS) {
    const n = populated[c] ?? 0
    console.log(`  ${c.padEnd(28)} ${String(n).padStart(4)}${n === 0 ? '  (already clear)' : ''}`)
  }

  console.log('\nsample of what will be cleared:')
  for (const r of rows.filter(r => r.why_it_matters).slice(0, 3)) {
    console.log(`  why_it_matters: ${String(r.why_it_matters).replace(/\s+/g, ' ').slice(0, 96)}`)
    if (r.suggested_action) console.log(`  suggested_action: ${String(r.suggested_action).replace(/\s+/g, ' ').slice(0, 96)}`)
  }

  if (!APPLY) {
    console.log('\n── DRY-RUN complete. No writes. Re-run with --apply. ──\n')
    return
  }

  // Snapshot first — this content cannot be regenerated in the deterministic build.
  mkdirSync('scripts/snapshots', { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const path = `scripts/snapshots/ai-columns-before-purge-${stamp}.json`
  writeFileSync(path, JSON.stringify(rows.filter(r => affected.has(r.id)), null, 1))
  console.log(`\nsnapshot written: ${path} (${affected.size} rows)`)

  const blank = Object.fromEntries(AI_COLUMNS.map(c => [c, null]))
  const ids = [...affected]
  let cleared = 0
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { error: e } = await supabase.from('company_signals').update(blank).in('id', chunk)
    if (e) console.error(`  ❌  ${e.message}`)
    else { cleared += chunk.length; console.log(`  ✅  cleared ${chunk.length}`) }
  }
  console.log(`\n── Applied: AI content cleared on ${cleared} rows. Columns left in place. ──\n`)
}
main().catch(e => { console.error(e); process.exit(1) })
