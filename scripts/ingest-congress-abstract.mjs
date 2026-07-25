/**
 * ingest-congress-abstract — one-shot CLI (Source 6)
 *
 * Ingests a congress abstract-book PDF and writes HAE-relevant abstracts to
 * company_signals. This is NOT a cron job — run it once per congress when the
 * PDF URL becomes known.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-congress-abstract.mjs \
 *     --congress "EAACI 2026" \
 *     --url "https://.../abstract-book.pdf" \
 *     --date "2026-06-15"
 *
 * Env (matches the rest of scripts/ — NOT the prompt's literal names):
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Schema reconciliation vs the Source-6 prompt (live company_signals differs):
 *   - prompt's `published_at`     → live column is `date`
 *   - prompt's `competitor_id=null`→ column is NOT NULL; resolved from the matched
 *                                     lexicon drug, else 'congress' sentinel
 *   - prompt's `severity`         → added via add_company_signals_severity_column migration
 *   - prompt's ON CONFLICT(source_hash) → no such unique constraint; dedup via a
 *                                     source_hash existence check (same as ingest-hta)
 */

import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { loadAssetResolver, resolveAsset } from './lib/signal-gate.mjs'

// pdf-parse is CommonJS and its index.js runs a debug harness that reads a bundled
// test PDF (throws ENOENT when imported as a dependency). Import the lib entry directly.
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

// ── Constants ───────────────────────────────────────────────────────────────
const SIGNAL_TYPE       = 'congress_abstract'
const DATA_SOURCE       = 'congress_pdf'
// Abstract-number patterns: P001, OA-23, OP-12, EP045, LB-001, AB-1234
const ABSTRACT_NO_RE    = /\b(?:P|OA|OP|EP|LB|AB)-?\d{2,4}\b/i
const ABSTRACT_SPLIT_RE = /(?=\b(?:P|OA|OP|EP|LB|AB)-?\d{2,4}\b)/i

// ── Env ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/ingest-congress-abstract.mjs ...')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── A. CLI args ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--congress') out.congress = argv[++i]
    else if (a === '--url')  out.url      = argv[++i]
    else if (a === '--date') out.date     = argv[++i]
  }
  return out
}

const { congress, url, date } = parseArgs(process.argv.slice(2))
const missing = ['congress', 'url', 'date'].filter(k => !({ congress, url, date })[k])
if (missing.length) {
  console.error(`❌  Missing required arg(s): ${missing.map(m => '--' + m).join(', ')}`)
  console.error('   Usage:')
  console.error('   node --env-file=.env.local scripts/ingest-congress-abstract.mjs \\')
  console.error('     --congress "EAACI 2026" --url "https://.../book.pdf" --date "2026-06-15"')
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`❌  --date must be YYYY-MM-DD, got "${date}"`)
  process.exit(1)
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function extractAbstractNo(block) {
  const m = block.match(ABSTRACT_NO_RE)
  return m ? m[0].toUpperCase() : null
}

function classifySeverity(body) {
  const b = body.toLowerCase()
  const isPhase3 = /phase\s*(3|iii)/.test(b)
  const hasOutcome = /(primary endpoint|significant reduction|met|achieved)/.test(b)
  return isPhase3 && hasOutcome ? 'HIGH' : 'MEDIUM'
}

// ── B. Relevance + identity resolution ─────────────────────────────────────────
// Lexicon load + drug resolution now come from the shared signal-gate resolver
// (loadAssetResolver / resolveAsset), which also carries inn + asset_id so the
// matched drug identity is persisted, not discarded (§2.1).

// ── C. Download PDF ───────────────────────────────────────────────────────────
async function downloadPdf(pdfUrl) {
  let res
  try {
    res = await fetch(pdfUrl, { headers: { 'User-Agent': 'AriyaSignals congress-ingest' } })
  } catch (err) {
    throw new Error(`PDF download failed (network): ${err.message}`)
  }
  if (!res.ok) throw new Error(`PDF download failed: HTTP ${res.status} ${res.statusText}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

// ── E. Split text into abstract blocks ─────────────────────────────────────────
function splitBlocks(text) {
  let blocks = text.split(ABSTRACT_SPLIT_RE).map(b => b.trim()).filter(Boolean)
  if (blocks.length < 5) {
    // Fallback: split on a blank line followed by an uppercase line
    blocks = text.split(/\n\s*\n(?=[A-Z])/).map(b => b.trim()).filter(Boolean)
  }
  return blocks
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n── Congress ingest: ${congress} ──────────────────────────`)
  console.log(`   url:  ${url}`)
  console.log(`   date: ${date}\n`)

  const resolver = await loadAssetResolver(supabase)
  console.log(`Loaded ${resolver.size} relevance terms from asset_lexicon (+generic).`)

  const buffer = await downloadPdf(url)
  console.log(`Downloaded PDF: ${(buffer.length / 1024).toFixed(0)} KB`)

  const parsed = await pdfParse(buffer)
  const text = parsed.text ?? ''
  console.log(`Extracted ${text.length.toLocaleString()} chars from ${parsed.numpages} pages.`)

  const blocks = splitBlocks(text)

  let passedGate = 0
  let written = 0
  let skipped = 0
  const writtenNos = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const blockLower = block.toLowerCase()

    // F.i — relevance gate
    const { matched, competitorId, inn, assetId } = resolveAsset(blockLower, resolver)
    if (!matched) continue
    passedGate++

    // F.ii — abstract number
    const abstractNo = extractAbstractNo(block) ?? `UNKNOWN-${i}`

    // F.iii/iv — title + body
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    // drop the leading token line if it's just the abstract number
    const startIdx = lines[0] && ABSTRACT_NO_RE.test(lines[0]) && lines[0].length < 16 ? 1 : 0
    const title = (lines[startIdx] ?? '').slice(0, 120)
    const body  = lines.slice(startIdx + 1).join(' ').slice(0, 400)

    // F.v — severity
    const severity = classifySeverity(body)

    // F.vi — source hash
    const sourceHash = sha256(`${congress}|${abstractNo}`)

    // dedup — existence check (no unique constraint on source_hash)
    const { count } = await supabase
      .from('company_signals')
      .select('id', { count: 'exact', head: true })
      .eq('source_hash', sourceHash)
    if ((count ?? 0) > 0) { skipped++; continue }

    // F.vii — write
    const { error: insErr } = await supabase.from('company_signals').insert({
      competitor_id: competitorId,            // resolved drug owner, or 'unattributed' container (§2.3)
      signal_type:   SIGNAL_TYPE,
      headline:      `${congress}: ${title}`,
      body_excerpt:  body,
      date,                                    // prompt's published_at → live `date`
      source_url:    url,
      source_hash:   sourceHash,
      data_source:   DATA_SOURCE,
      severity,
      inn,                                     // matched drug INN (§2.1), null if generic-only
      asset_id:      assetId,                  // canonical asset UUID, null if unresolved
    })
    if (insErr) {
      console.error(`  ❌  insert failed (${abstractNo}): ${insErr.message}`)
      skipped++
    } else {
      written++
      writtenNos.push(abstractNo)
    }
  }

  // G — summary
  console.log('\n── Summary ───────────────────────────────────────────────')
  console.log(`Total blocks parsed:        ${blocks.length}`)
  console.log(`Passed relevance gate:      ${passedGate}`)
  console.log(`Signals written (new):      ${written}`)
  console.log(`Signals skipped (dup/err):  ${skipped}`)
  if (writtenNos.length <= 20) {
    console.log(`Abstract numbers written:   ${writtenNos.join(', ') || '(none)'}`)
  } else {
    console.log(`Abstract numbers written:   ${writtenNos.length} (too many to list)`)
  }
  console.log('───────────────────────────────────────────────────────────\n')

  // H — ingest_runs
  const nowIso = new Date().toISOString()
  const { error: runErr } = await supabase.from('ingest_runs').insert({
    source:      DATA_SOURCE,
    status:      'success',
    new_signals: written,
    skipped,
    notes:       congress,
    started_at:  nowIso,
    finished_at: nowIso,
  })
  if (runErr) console.error(`  ⚠️  ingest_runs write failed: ${runErr.message}`)
}

main().catch(err => {
  console.error(`\n❌  ${err.message}\n`)
  process.exit(1)
})
