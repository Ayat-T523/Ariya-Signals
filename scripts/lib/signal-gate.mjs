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
// Generic container for signals with no tracked competitor (§2.3). Congress is a
// SOURCE (recorded in data_source), never a competitor, so unresolved rows land
// here rather than in a fake 'congress' competitor. NOT NULL forces a value;
// this is an honest placeholder whose final treatment is a later-iteration call.
const UNATTRIBUTED = 'unattributed'

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

// ── Date parsing ───────────────────────────────────────────────────────────────

const MONTHS = {
  // English
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12,
  // Italian
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12,
  // French
  janvier:1, 'février':2, mars:3, avril:4, mai:5, juin:6,
  juillet:7, 'août':8, septembre:9, octobre:10, novembre:11, 'décembre':12,
  // German
  januar:1, februar:2, 'märz':3, april:4, juni:6, juli:7,
  oktober:10, dezember:12,
}

/**
 * Parse a free-text publication date into a YYYY-MM-DD string.
 *
 * Timezone-safe: builds the ISO string from the parsed Y/M/D parts directly and
 * NEVER routes through `new Date(...).toISOString()`. The naive approach
 * (`new Date("April 27, 2026").toISOString().slice(0,10)`) interprets the string
 * as local midnight, then shifts to UTC — in any UTC+ timezone (e.g. Asia/Calcutta,
 * UTC+5:30) that rolls the calendar date BACK one day. This caused every
 * IR/CSL/Takeda ingest date to be stored one day too early.
 *
 * Handles "April 27, 2026", "Apr 27 2026", "27 April 2026", and ISO "2026-04-27".
 *
 * @param {string|null|undefined} raw
 * @returns {string|null} YYYY-MM-DD or null if unparseable
 */
export function parseSignalDate(raw) {
  if (!raw) return null
  const s = String(raw).trim().toLowerCase()

  // ISO first: 2026-04-27
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // European DD/MM/YYYY or DD.MM.YYYY (AIFA, HAS, G-BA use this format)
  const dmy = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/)
  if (dmy) {
    const [, d, mo, y] = dmy
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // "Month D, YYYY"  /  "Month D YYYY"
  let m = s.match(/([a-zàâäéèêëîïôùûüÿæœ]+)\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (m && MONTHS[m[1]]) {
    return `${m[3]}-${String(MONTHS[m[1]]).padStart(2,'0')}-${String(+m[2]).padStart(2,'0')}`
  }

  // "D Month YYYY" (e.g. "31 gennaio 2026", "21 juin 2025")
  m = s.match(/(\d{1,2})\s+([a-zàâäéèêëîïôùûüÿæœ]+)\.?,?\s+(\d{4})/)
  if (m && MONTHS[m[2]]) {
    return `${m[3]}-${String(MONTHS[m[2]]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`
  }

  // "YYYY Month D" — PubMed esummary format (e.g. "2023 Apr 15")
  m = s.match(/(\d{4})\s+([a-zàâäéèêëîïôùûüÿæœ]+)\.?\s+(\d{1,2})/)
  if (m && MONTHS[m[2]]) {
    return `${m[1]}-${String(MONTHS[m[2]]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`
  }

  // "YYYY Month" — PubMed without day (e.g. "2023 Apr")
  m = s.match(/(\d{4})\s+([a-zàâäéèêëîïôùûüÿæœ]+)/)
  if (m && MONTHS[m[2]]) {
    return `${m[1]}-${String(MONTHS[m[2]]).padStart(2,'0')}-01`
  }

  return null
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

// ── Asset identity (INN-persistence fix, backend §2.1) ─────────────────────────

/**
 * Load a lowercase INN → asset UUID map from the assets table.
 *
 * Used by the writers that already KNOW their INN at ingest (pubmed, hta): they
 * pass the drug's INN and get back the canonical asset_id, or null if the INN is
 * not (yet) an assets row — e.g. Intellia's "ntla-2002" until the lexicon gap for
 * "lonvoguran ziclumeran" is filled. Null is honest: we persist the INN and leave
 * asset_id null rather than guess.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Map<string, string>>}  inn(lowercased) → asset uuid
 */
export async function loadInnToAssetId(supabase) {
  const { data, error } = await supabase.from('assets').select('id, inn')
  if (error) throw new Error(`assets load failed: ${error.message}`)
  const map = new Map()
  for (const row of data ?? []) {
    if (row.inn) map.set(row.inn.toLowerCase(), row.id)
  }
  return map
}

/**
 * Build a lowercase term → { competitorId, inn, assetId } resolver from
 * asset_lexicon (every inn + synonym) joined to assets for the canonical asset_id.
 * Generic HAE terms resolve to a relevance-only entry (all identity fields null).
 *
 * Used by the writers that must DISCOVER the drug from free text (congress,
 * regulatory firecrawl). This is the identity-carrying superset of loadLexicon.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Map<string, {competitorId: string|null, inn: string|null, assetId: string|null}>>}
 */
export async function loadAssetResolver(supabase) {
  const innToAssetId = await loadInnToAssetId(supabase)
  const { data, error } = await supabase
    .from('asset_lexicon')
    .select('inn, brand_name, synonyms, competitor_id')
  if (error) throw new Error(`asset_lexicon load failed: ${error.message}`)
  if (!data?.length) throw new Error('asset_lexicon is empty — Source 1 must complete first.')

  const map = new Map()
  for (const row of data) {
    const assetId = row.inn ? (innToAssetId.get(row.inn.toLowerCase()) ?? null) : null
    const identity = { competitorId: row.competitor_id ?? null, inn: row.inn ?? null, assetId }
    // Match on inn + brand_name + every synonym (§2.2). brand_name was previously
    // ignored, so brand-only headlines (Orladeyo, Firazyr, Andembry) never resolved.
    const terms = [row.inn, row.brand_name, ...(row.synonyms ?? [])].filter(Boolean)
    for (const t of terms) {
      const k = t.toLowerCase()
      // Prefer an entry that carries a real drug identity (non-null inn) if one
      // already exists for this term; never let a later generic entry clobber it.
      if (!map.has(k) || (map.get(k).inn == null && identity.inn != null)) {
        map.set(k, identity)
      }
    }
  }
  for (const t of GENERIC_HAE_TERMS) {
    if (!map.has(t)) map.set(t, { competitorId: null, inn: null, assetId: null })
  }
  return map
}

/**
 * Resolve drug identity from free text against a loadAssetResolver() map.
 *
 * First specific-drug term wins (matches existing resolveCompetitor precedence;
 * the multi-drug-in-one-signal rule is §2.2, deferred). When only generic HAE
 * terms match, the signal is relevant but unattributed: competitorId falls back
 * to `sentinel`, and inn/assetId stay null (never fabricated).
 *
 * @param {string} textLower  Already-lowercased full text
 * @param {Map<string,{competitorId:string|null,inn:string|null,assetId:string|null}>} resolver
 * @param {string} [sentinel]  competitor_id fallback when only generic terms match
 * @returns {{ matched: boolean, competitorId: string|null, inn: string|null, assetId: string|null }}
 */
export function resolveAsset(textLower, resolver, sentinel = UNATTRIBUTED) {
  let matched = false
  let generic = null
  for (const [term, identity] of resolver) {
    if (!textLower.includes(term)) continue
    matched = true
    if (identity.inn != null) {
      // Specific drug named — this is the strongest signal, take it immediately.
      return { matched: true, competitorId: identity.competitorId ?? sentinel, inn: identity.inn, assetId: identity.assetId }
    }
    generic = identity   // relevance-only match; keep looking for a specific drug
  }
  if (!matched) return { matched: false, competitorId: null, inn: null, assetId: null }
  return { matched: true, competitorId: generic?.competitorId ?? sentinel, inn: null, assetId: null }
}

// ── Data-quality gate (§2.4) ───────────────────────────────────────────────────

// Synthetic headlines produced by the old composeTitle() path — a company name
// glued to an SEC item description ("Acme — Other Events"), or a bare filing
// stub ("Acme — SEC 6-K filing"). These carry no real disclosure. §2.4 LOCKED:
// show the real headline or reject; never synthesize one.
const SYNTHETIC_HEADLINE = new RegExp(
  '(?:\\u2014|--|-)\\s*(' +
    'Other Events|Results of Operations|Entry into a Material|' +
    'Completion of Acquisition|Departure|Regulation FD|' +
    'Financial Statements and Exhibits|SEC Filing \\(Item|SEC \\d-?K filing' +
  ')', 'i',
)

// SEC form headers / cover-page + XBRL boilerplate. These look like prose but are
// the filing's furniture, not its disclosure — a headline made of this is garbage.
const BOILERPLATE = new RegExp(
  'united states securities and exchange commission|securities and exchange commission|' +
  'washington,?\\s*d\\.?\\s*c\\.?|pursuant to (?:section|the requirements|rule)|' +
  'the information (?:contained|in this|furnished|set forth) in this|' +
  'check the appropriate box|indicate by check mark|registrant\\u2019?s telephone|' +
  'form\\s*(?:8-k|6-k|10-k|10-q|20-f)\\b|current report|table of contents|' +
  // an 8-K that only points at its exhibit is not itself a disclosure headline
  'attached as (?:exhibit|exhibit no)|furnished as exhibit|copy of the press release|' +
  'is incorporated (?:herein )?by reference',
  'i',
)

/**
 * True when `text` reads like real prose rather than XBRL/exhibit/boilerplate
 * garbage. Ported verbatim from the SEC ingest so the gate and the ingest agree.
 */
export function isProseText(text) {
  if (!text) return false
  if (/\d{10}\s+\d{10}/.test(text))   return false
  if (/exhibit\d+[_\-.]/i.test(text)) return false
  if (/form\d*k[_\-]/i.test(text))    return false
  const nonAlpha = (text.match(/[\d_]/g) ?? []).length
  if (nonAlpha / text.length > 0.4)   return false
  const skip = /^(true|false|null)$/i
  const proseWords = (text.match(/\b[A-Za-z]{4,}\b/g) ?? []).filter(w => !skip.test(w))
  return proseWords.length >= 3
}

/**
 * Deterministic data-quality gate (§2.4). Decides whether a signal's headline is
 * a real, publishable disclosure or must be rejected — with a distinct, honest
 * reason. It NEVER rewrites; callers either show the real headline or drop the row.
 *
 * SCOPE: this targets SEC-source quality problems (synthetic composeTitle stubs,
 * truncated XBRL boilerplate). Apply it to SEC-sourced rows only. Do NOT blanket
 * it across all sources — clean structured titles from PubMed / congress / HTA
 * (e.g. a one-word "Berotralstat" drug-review title) are real and would wrongly
 * trip the too_short/not_prose checks. Those sources have their own gates.
 *
 * @param {string|null|undefined} headline
 * @returns {{ ok: boolean, reason: string|null }}
 *   reason ∈ empty_headline | synthetic_stub | too_short | not_prose
 */
export function qualityGate(headline) {
  const h = (headline ?? '').trim()
  if (!h)                          return { ok: false, reason: 'empty_headline' }
  if (SYNTHETIC_HEADLINE.test(h))  return { ok: false, reason: 'synthetic_stub' }
  if (BOILERPLATE.test(h))         return { ok: false, reason: 'boilerplate' }
  if (h.length < 20)               return { ok: false, reason: 'too_short' }
  if (!isProseText(h))             return { ok: false, reason: 'not_prose' }
  return { ok: true, reason: null }
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
