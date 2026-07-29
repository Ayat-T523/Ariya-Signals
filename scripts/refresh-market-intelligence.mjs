/**
 * Name: refresh-market-intelligence
 * Description: Regenerates the War Room "Market weather" Implications panel
 *   (market_intelligence table) via local Ollama. Replaces the deployed
 *   Supabase Edge Function `market-weather-refresh`, which called Groq and
 *   wrote to `market_weather_snapshots` -- a table nothing in src/ reads.
 *   See scripts/lib/buildMarketImplications.mjs for why this has to be a
 *   local script rather than an edge function (Ollama is localhost-only).
 *
 *   Requires Ollama running locally with OLLAMA_MODEL pulled
 *   (OLLAMA_HOST/OLLAMA_MODEL in .env.local).
 *
 *   Run:
 *     node --env-file=.env.local scripts/refresh-market-intelligence.mjs
 *
 *   Safe to re-run: on a successful generation, existing active rows are
 *   deactivated (active=false, never deleted) and replaced with the fresh
 *   set. On insufficient data or failure, existing rows are left untouched
 *   -- getMarketImplications()'s 7-day freshness filter (src/lib/db/index.ts)
 *   will correctly stop showing them once they age out, rather than this
 *   script clobbering known-good content with nothing.
 *
 *   Severity: company_signals.ai_severity is null for most recent signals
 *   (the Groq-based enrichment pipeline that populates it has its own gaps --
 *   see project history). Uses the same resolveSeverity() fallback the
 *   frontend uses (src/lib/signalSeverity.ts) rather than filtering on the
 *   raw column, so this sees the same HIGH/MEDIUM set the War Room does.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildMarketImplications } from './lib/buildMarketImplications.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/refresh-market-intelligence.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// 30 (the deployed edge function's original default) turned out under-tuned
// for this dataset's actual cadence -- only 2 HIGH/MEDIUM signals fell in a
// 30-day window on a live run. 90 matches NARRATION_DAYS, the window the
// rest of War Room (worklist, "N signals" stat) already uses.
const EVIDENCE_WINDOW_DAYS = 90

// ── Asset config + lexicon (mirrors src/config/assets-config.ts's 'ekterly'
//    entry + src/config/demo-config.ts -- copied rather than imported since
//    those are TypeScript and this is a plain Node script, same reason
//    backfill-clean-headline.mjs reads competitors.json directly instead of
//    importing from src/data. Keep in sync by hand if those files change. ──

const ASSET_CONFIG = {
  assetName: 'Ekterly',
  assetModality: 'oral plasma kallikrein inhibitor',
  diseaseArea: 'hereditary angioedema (HAE)',
}

const LEXICON = {
  inns: [
    'berotralstat', 'navenibart', 'bcx17725', 'garadacimab',
    'lonvoguran', 'ziclumeran', 'donidalorsen', 'deucrictibant',
    'lanadelumab', 'icatibant', 'mezagitamab', 'sebetralstat',
    'orladeyo', 'takhzyro', 'firazyr', 'dawnzera', 'andembry',
  ],
  ta_terms: [
    'hae', 'hereditary angioedema', 'angioedema', 'bradykinin',
    'kallikrein', 'c1 inhibitor', 'c1-inh', 'plasma kallikrein',
    'factor xii', 'contact pathway', 'haelo',
  ],
}

// ── Severity — port of src/lib/signalSeverity.ts (computeSeverity +
//    resolveSeverity), kept behaviourally identical so this script sees the
//    same HIGH/MEDIUM set the War Room worklist and Market Weather do. ────────

function isCLevelChange(text) {
  return /chief executive|ceo|chief medical|cmo|chief commercial|cco|chief financial|cfo|board chair|president/.test(text)
}

function criticalCoOccursWithLexicon(text, lexicon) {
  const CRITICAL_BODY_RE = /phase\s*[23].*result|result.*phase\s*[23]|pivotal.*result|topline.*result|primary endpoint|phase\s*[23].*data/i
  const sentences = text.split(/(?<=[.!?])\s+/)
  return sentences.some(sentence => {
    const s = sentence.toLowerCase()
    if (!CRITICAL_BODY_RE.test(s)) return false
    return lexicon.inns.some(t => s.includes(t)) || lexicon.ta_terms.some(t => s.includes(t))
  })
}

function isRelevant(s, lexicon) {
  const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`.toLowerCase()
  return lexicon.inns.some(t => text.includes(t.toLowerCase())) || lexicon.ta_terms.some(t => text.includes(t.toLowerCase()))
}

function computeSeverity(s, lexicon, today) {
  if (!isRelevant(s, lexicon)) {
    return (s.signal_type === 'exec_change' || s.signal_type === 'deal') ? 'medium' : 'low'
  }
  const items = (s.items ?? '').split(',').map(i => i.trim())
  const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`.toLowerCase()
  const rawText = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`

  let band = 'low'
  const isCritical = (
    (items.includes('2.01') && (text.includes('acqui') || text.includes('merger'))) ||
    /complete response letter|crl|market withdrawal|black.?box warning/i.test(text) ||
    criticalCoOccursWithLexicon(rawText, lexicon)
  )
  if (isCritical) band = 'critical'
  else if (
    items.includes('1.01') ||
    /nda|bla|maa|submitted|filing accepted|pdufa|adcom|advisory committee/i.test(text) ||
    /phase\s*2.*result|hta decision|nice.*recomm|label.*expan|indication.*expan/i.test(text)
  ) band = 'high'
  else if (
    /phase\s*(1|2).*start|enrollment.*complet|trial.*initiat/i.test(text) ||
    items.includes('2.02') ||
    /guideline.*update|congress.*presentation/i.test(text) ||
    (items.includes('5.02') && isCLevelChange(text))
  ) band = 'moderate'

  if (band === 'moderate') {
    const daysOut = (new Date(s.date ?? '').getTime() - today.getTime()) / 86_400_000
    if (daysOut > 0 && daysOut <= 60) band = 'high'
  }
  return band === 'critical' || band === 'high' ? 'high' : band === 'moderate' ? 'medium' : 'low'
}

function resolveSeverity(s, lexicon, today) {
  const ai = s.ai_severity?.trim().toLowerCase()
  if (ai === 'critical' || ai === 'high') return 'high'
  if (ai === 'medium') return 'medium'
  if (ai === 'low') return 'low'
  return computeSeverity(s, lexicon, today)
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🔄  Refreshing market_intelligence via Ollama (${process.env.OLLAMA_MODEL ?? 'llama3.1'})...\n`)

const competitors = JSON.parse(readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8'))
const nameById = Object.fromEntries(competitors.map(c => [c.id, c.name]))

const cutoff = new Date()
cutoff.setDate(cutoff.getDate() - EVIDENCE_WINDOW_DAYS)
const cutoffDate = cutoff.toISOString().slice(0, 10)

const { data: rawSignals, error: fetchErr } = await supabase
  .from('company_signals')
  .select('id, date, headline, body_excerpt, signal_type, competitor_id, items, ai_severity, why_it_matters')
  .gte('date', cutoffDate)
  .not('headline', 'is', null)
  .order('date', { ascending: false })

if (fetchErr) { console.error('❌  Fetch failed:', fetchErr.message); process.exit(1) }

const today = new Date()
const signals = (rawSignals ?? [])
  .map(s => ({ ...s, severity: resolveSeverity(s, LEXICON, today) }))
  .filter(s => s.severity === 'high' || s.severity === 'medium')
  .sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    return (b.date ?? '').localeCompare(a.date ?? '')
  })
  .slice(0, 30)
  .map(s => ({ ...s, ai_severity: s.severity.toUpperCase() })) // feed the resolved tier into the prompt, not the raw (often-null) column

console.log(`  ${signals.length} HIGH/MEDIUM signals in the last ${EVIDENCE_WINDOW_DAYS} days (resolved severity, ai_severity-null rows included via fallback)\n`)

let bullets, rejected
try {
  ({ bullets, rejected } = await buildMarketImplications(signals, ASSET_CONFIG, nameById))
} catch (e) {
  console.error(`❌  Ollama call failed: ${e.message}`)
  process.exit(1)
}

if (rejected.length > 0) {
  console.log(`  ⚠️   Judge rejected ${rejected.length} candidate bullet(s) (see reasons below) — dropped, not shown:`)
  rejected.forEach((r, i) => console.log(`    ${i + 1}. [${r.stage}] "${r.bullet}"\n       reason: ${r.reason}`))
  console.log('')
}

if (bullets.length === 0) {
  console.log('ℹ️   No implications passed the judge this run — existing market_intelligence rows left untouched.')
  process.exit(0)
}

console.log(`  ${bullets.length} implication(s) passed the judge:`)
bullets.forEach((b, i) => console.log(`    ${i + 1}. ${b}`))

const { error: deactivateErr } = await supabase
  .from('market_intelligence')
  .update({ active: false })
  .eq('active', true)
if (deactivateErr) { console.error('❌  Deactivate failed:', deactivateErr.message); process.exit(1) }

const { error: insertErr } = await supabase
  .from('market_intelligence')
  .insert(bullets.map((content, i) => ({
    type: 'implication',
    content,
    display_order: i + 1,
    active: true,
    period_label: 'last 7 days',
  })))
if (insertErr) { console.error('❌  Insert failed:', insertErr.message); process.exit(1) }

console.log('\n✅  market_intelligence refreshed.\n')
