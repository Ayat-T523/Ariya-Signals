/**
 * Full-text document ingest — fetches primary source documents for existing company_signals rows.
 * Usage: node --env-file=.env.local scripts/ingest-documents.mjs
 *
 * What it does:
 *   1. Reads all company_signals rows that have a source_url but no document_id yet.
 *   2. Fetches the full text of each SEC EDGAR document (HTML-stripped).
 *   3. Upserts into the documents table (on conflict source_url = skips already-ingested docs).
 *   4. Updates company_signals.document_id with the returned documents.id.
 *
 * Requires: supabase/documents.sql to have been run first (creates the documents table and
 * adds the document_id column to company_signals).
 *
 * Rate limits: SEC EDGAR allows 10 requests/second. This script pauses 120ms between fetches.
 * Full backfill of ~200 signals takes roughly 4–5 minutes.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/ingest-documents.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS     = 30_000
const MAX_CHARS      = 200_000  // ~33 000 words — enough for any 8-K, well under Postgres limits

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`)
  return r.text()
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&quot;/g,  '"')
    .replace(/&#160;/g,  ' ')
    .replace(/\s+/g,     ' ')
    .trim()
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length
}

// Derive the SEC form type from the competitor record.
// Competitors with secFormTypes = ['6-K', '20-F'] → '6-K'; default → '8-K'.
function deriveDocType(competitor) {
  const forms = competitor?.secFormTypes ?? ['8-K']
  if (forms.includes('6-K'))  return '6-K'
  if (forms.includes('20-F')) return '20-F'
  return '8-K'
}

// ── Load competitors for metadata lookup ─────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)
const competitorById = new Map(competitors.map(c => [c.id, c]))

// ── Fetch signals that need document backfill ─────────────────────────────────

console.log('\n📄  Fetching company_signals rows that need document backfill...')

const { data: signals, error: fetchError } = await supabase
  .from('company_signals')
  .select('id, competitor_id, source_url, date, items')
  .not('source_url', 'is', null)
  .is('document_id', null)
  .order('date', { ascending: false })

if (fetchError) {
  console.error('❌  Could not fetch company_signals:', fetchError.message)
  process.exit(1)
}

if (!signals.length) {
  console.log('✅  All company_signals already have a document_id — nothing to do.')
  process.exit(0)
}

console.log(`   Found ${signals.length} signal(s) without a linked document.\n`)

// ── Process each signal ───────────────────────────────────────────────────────

let ingested = 0
let skipped  = 0
const errors = []

for (const signal of signals) {
  const competitor = competitorById.get(signal.competitor_id)
  const docType    = deriveDocType(competitor)
  const label      = `[${signal.competitor_id}] ${signal.source_url.slice(-60)}`

  process.stdout.write(`  ${label.padEnd(70)}`)

  // ── Step 1: Fetch full text ────────────────────────────────────────────────

  let fullText = null
  try {
    const html = await fetchText(signal.source_url)
    fullText = stripHtml(html).slice(0, MAX_CHARS)
  } catch (e) {
    errors.push(`${label}: ${e.message}`)
    console.log(`❌  fetch failed: ${e.message}`)
    await new Promise(r => setTimeout(r, 120))
    continue
  }

  // ── Step 2: Upsert into documents ─────────────────────────────────────────

  const { data: docRow, error: upsertError } = await supabase
    .from('documents')
    .upsert(
      {
        competitor_id:  signal.competitor_id,
        source_url:     signal.source_url,
        document_type:  docType,
        source_label:   'SEC EDGAR',
        date_published: signal.date ?? null,
        full_text:      fullText,
        word_count:     countWords(fullText),
      },
      { onConflict: 'source_url', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (upsertError) {
    errors.push(`${label}: upsert error — ${upsertError.message}`)
    console.log(`❌  upsert failed: ${upsertError.message}`)
    await new Promise(r => setTimeout(r, 120))
    continue
  }

  // ── Step 3: Link company_signal → document ────────────────────────────────

  const { error: linkError } = await supabase
    .from('company_signals')
    .update({ document_id: docRow.id })
    .eq('id', signal.id)

  if (linkError) {
    errors.push(`${label}: link error — ${linkError.message}`)
    console.log(`❌  link failed: ${linkError.message}`)
  } else {
    ingested++
    console.log(`✅  ${countWords(fullText).toLocaleString()} words`)
  }

  // Respect SEC EDGAR rate limit (10 req/s)
  await new Promise(r => setTimeout(r, 120))
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`
─────────────────────────────────────────
  Signals processed: ${signals.length}
  Documents ingested: ${ingested}
  Skipped (fetch failed): ${skipped}
${errors.length ? `\n  Errors (${errors.length}):\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────

Next steps:
  • Run scripts/ingest-fda-labels.mjs  (A2) for approved drug label text
  • Run scripts/ingest-regulatory-docs.mjs  (A3) for NICE TAs and EMA EPARs
`)
