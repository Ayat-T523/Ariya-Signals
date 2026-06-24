/**
 * scripts/lib/signal-gate.mjs — shared ingest utilities.
 *
 * Extracted from ingest-congress-abstract.mjs so all Firecrawl ingest scripts
 * share one copy of: lexicon load, competitor resolution, severity, dedup,
 * and ingest_runs write.
 *
 * Exports:
 *   createSupabaseClient()
 *   sha256(text)
 *   loadLexicon(supabase)                      → Map<term, competitor_id|null>
 *   resolveCompetitor(textLower, map, sentinel) → {matched, competitorId}
 *   classifySeverity(text)                     → 'HIGH'|'MEDIUM'
 *   isDuplicate(supabase, sourceHash)           → boolean
 *   writeIngestRun(supabase, opts)
 */

import { createClient } from '@supabase/supabase-js'
import { createHash }   from 'node:crypto'

const GENERIC_HAE_TERMS = [
  'hereditary angioedema', 'hae', 'c1 inhibitor', 'kallikrein', 'bradykinin', 'angioedema',
]
const UNATTRIBUTED = 'congress'   // NOT NULL sentinel for unresolved competitor_id

// ── Supabase ─────────────────────────────────────────────────────────────────

export function createSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    console.error('   Run with: node --env-file=.env.local scripts/<script>.mjs ...')
    process.exit(1)
  }
  return createClient(url, key)
}

// ── Hash ─────────────────────────────────────────────────────────────────────

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

// ── Lexicon ───────────────────────────────────────────────────────────────────

/**
 * Load all drugs from asset_lexicon and build a lowercase term → competitor_id map.
 * Adds generic HAE terms (no competitor_id) for broad relevance matching.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Map<string, string|null>>}
 */
export async function loadLexicon(supabase) {
  const { data, error } = await supabase
    .from('asset_lexicon')
    .select('inn, synonyms, competitor_id')

  if (error) throw new Error(`asset_lexicon load failed: ${error.message}`)
  if (!data?.length) throw new Error('asset_lexicon is empty — Source 1 must complete first.')

  const map = new Map()
  for (const row of data) {
    const terms = [row.inn, ...(row.synonyms ?? [])].filter(Boolean)
    for (const t of terms) {
      const k = t.toLowerCase()
      // prefer a non-null competitor_id if any row provides one for this term
      if (!map.has(k) || (map.get(k) == null && row.competitor_id != null)) {
        map.set(k, row.competitor_id ?? null)
      }
    }
  }
  for (const t of GENERIC_HAE_TERMS) {
    if (!map.has(t)) map.set(t, null)
  }
  return map
}

// ── Competitor resolution ─────────────────────────────────────────────────────

/**
 * Check textLower against the lexicon map.
 * Returns the best-matched competitor_id, or `sentinel` if only generic HAE terms matched.
 *
 * @param {string}               textLower      Already lowercased full text
 * @param {Map<string,string|null>} termToCompetitor
 * @param {string}               [sentinel]     Fallback when no specific competitor found
 * @returns {{ matched: boolean, competitorId: string|null }}
 */
export function resolveCompetitor(textLower, termToCompetitor, sentinel = UNATTRIBUTED) {
  let matched  = false
  let resolved = null
  for (const [term, competitorId] of termToCompetitor) {
    if (textLower.includes(term)) {
      matched = true
      if (competitorId != null) { resolved = competitorId; break }
    }
  }
  if (!matched) return { matched: false, competitorId: null }
  return { matched: true, competitorId: resolved ?? sentinel }
}

// ── Severity ─────────────────────────────────────────────────────────────────

/**
 * HIGH if the text mentions Phase 3 AND a positive primary outcome word; else MEDIUM.
 */
export function classifySeverity(text) {
  const b = text.toLowerCase()
  const isPhase3    = /phase\s*(3|iii)/.test(b)
  const hasOutcome  = /(primary endpoint|significant reduction|met|achieved)/.test(b)
  return isPhase3 && hasOutcome ? 'HIGH' : 'MEDIUM'
}

// ── Dedup ─────────────────────────────────────────────────────────────────────

/**
 * Returns true if a row with this source_hash already exists in company_signals.
 * Uses a count check (no UNIQUE constraint on source_hash — matches ingest-hta pattern).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} sourceHash
 * @returns {Promise<boolean>}
 */
export async function isDuplicate(supabase, sourceHash) {
  const { count } = await supabase
    .from('company_signals')
    .select('id', { count: 'exact', head: true })
    .eq('source_hash', sourceHash)
  return (count ?? 0) > 0
}

// ── ingest_runs ───────────────────────────────────────────────────────────────

/**
 * Write a completion row to ingest_runs.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ source: string, newSignals: number, skipped: number, notes: string, errors?: number }} opts
 */
export async function writeIngestRun(supabase, { source, newSignals, skipped, notes, errors = 0 }) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('ingest_runs').insert({
    source,
    status:      errors > 0 ? 'partial' : 'success',
    new_signals: newSignals,
    skipped,
    errors,
    notes,
    started_at:  now,
    finished_at: now,
  })
  if (error) console.error(`  ⚠️  ingest_runs write failed: ${error.message}`)
}
