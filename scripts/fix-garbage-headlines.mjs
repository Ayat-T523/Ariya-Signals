/**
 * fix-garbage-headlines — Phase 3 DB fix
 *
 * Finds company_signals rows where the headline matches known garbage patterns
 * (lowercase start, "8-K false …", "tak-YYYYMMDD" accession prefix),
 * re-fetches each source document, re-runs extractExcerpt + composeTitle with
 * the Phase-3.2 fixes, and upserts the corrected headline + body_excerpt.
 *
 * Run ONCE after deploying the Phase 3.2 ingest-script fixes.
 * Usage: node --env-file=.env.local scripts/fix-garbage-headlines.mjs
 *
 * Name: fix-garbage-headlines
 * Description: Re-extract headlines for ~68 company_signals rows with known
 *   garbage values. Uses the fixed extractExcerpt + composeTitle from
 *   run-sec-deals.mjs. Upserts corrected rows; leaves good rows untouched.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS     = 20_000
const EXCERPT_LEN    = 500

// ── Helpers (identical to run-sec-deals.mjs fixed versions) ──────────────────

function stripHtml(html) {
  return html
    .replace(/<ix:hidden[\s\S]*?<\/ix:hidden>/gi, '')
    .replace(/<dei:[^>]*>[\s\S]*?<\/dei:[^>]*>/gi, '')
    .replace(/<xbrli?:[^>]*>[\s\S]*?<\/xbrli?:[^>]*>/gi, '')
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

function extractExcerpt(text, itemNumber) {
  const patterns = [
    `Item ${itemNumber}.`,
    `ITEM ${itemNumber}.`,
    `Item ${itemNumber} `,
  ]
  for (const pat of patterns) {
    const idx = text.indexOf(pat)
    if (idx === -1) continue
    const afterMarker = text.slice(idx + pat.length)
    const titleBreak  = afterMarker.search(/\.\s+[A-Z]/)
    const afterTitle  = titleBreak >= 0
      ? afterMarker.slice(titleBreak + 1).trimStart()
      : afterMarker.trimStart()
    return afterTitle.slice(0, EXCERPT_LEN).replace(/\s+/g, ' ').trim()
  }
  return text.slice(0, EXCERPT_LEN).trim()
}

function isProseText(text) {
  if (/\d{10}\s+\d{10}/.test(text))    return false
  if (/exhibit\d+[_\-.]/i.test(text)) return false
  if (/form\d*k[_\-]/i.test(text))    return false
  const nonAlpha = (text.match(/[\d_]/g) ?? []).length
  if (nonAlpha / text.length > 0.4)   return false
  const skip = /^(true|false|null)$/i
  const proseWords = (text.match(/\b[A-Za-z]{4,}\b/g) ?? []).filter(w => !skip.test(w))
  return proseWords.length >= 3
}

function buildHeadline(excerpt) {
  const match = excerpt.match(/^([^.!?]{20,200}[.!?])/)
  const candidate = match
    ? match[1].trim()
    : (() => {
        const MAX = 200
        if (excerpt.length <= MAX) return excerpt.trim()
        const cut = excerpt.lastIndexOf(' ', MAX)
        return excerpt.slice(0, cut > 0 ? cut : MAX).trim() + '…'
      })()
  return isProseText(candidate) ? candidate : null
}

const ITEM_DESCRIPTIONS = {
  '1.01': 'Entry into a Material Definitive Agreement',
  '2.01': 'Completion of Acquisition or Disposition of Assets',
  '2.02': 'Results of Operations and Financial Condition',
  '5.02': 'Departure/Appointment of Directors or Officers',
  '7.01': 'Regulation FD Disclosure',
  '8.01': 'Other Events',
  '9.01': 'Financial Statements and Exhibits',
}

function recoverProseSentence(text) {
  if (!text) return null
  const stripped = text.replace(/^[a-z][a-z\s,;.]{0,30}\.\s*/, '').trim()
  const match    = stripped.match(/^[A-Z][^.!?]{20,200}[.!?]/)
  return match ? match[0].trim() : null
}

function composeTitle(competitorName, items, bodyExcerpt) {
  if (!items) return null
  const itemCodes = items.split(',').map(s => s.trim()).filter(Boolean)
  if (!itemCodes.length) return null
  const isPressRelease = itemCodes.some(c => c === '8.01' || c === '7.01')
  if (isPressRelease && bodyExcerpt) {
    const prose = recoverProseSentence(bodyExcerpt)
    if (prose) return prose
  }
  const priority = ['2.01', '1.01', '2.02', '5.02', '8.01', '7.01', '9.01']
  const leadItem  = priority.find(c => itemCodes.includes(c)) ?? itemCodes[0]
  const desc      = ITEM_DESCRIPTIONS[leadItem] ?? `SEC Filing (Item ${leadItem})`
  return `${competitorName} — ${desc}`
}

async function fetchText(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': SEC_USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!r.ok) return null
    return r.text()
  } catch {
    return null
  }
}

// ── Load competitor names ─────────────────────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)
const nameById = Object.fromEntries(competitors.map(c => [c.id, c.name]))

// ── Fetch garbage rows ────────────────────────────────────────────────────────

const { data: rows, error: fetchErr } = await supabase
  .from('company_signals')
  .select('id, competitor_id, headline, body_excerpt, source_url, items, accession_number, signal_type')
  .or('headline.ilike.8-K false%,headline.ilike.tak-%')

const { data: lcRows } = await supabase
  .from('company_signals')
  .select('id, competitor_id, headline, body_excerpt, source_url, items, accession_number, signal_type')
  .not('headline', 'is', null)

const allGarbage = [
  ...(rows ?? []),
  ...(lcRows ?? []).filter(r => /^[a-z]/.test(r.headline ?? '')),
].reduce((map, r) => { map.set(r.id, r); return map }, new Map())

console.log(`\n🔍  Found ${allGarbage.size} garbage-headline rows to fix...\n`)

if (!allGarbage.size) {
  console.log('Nothing to fix. ✅')
  process.exit(0)
}

// ── Re-process each row ────────────────────────────────────────────────────────

let fixed = 0
let nulled = 0
let failed = 0
const RATE_MS = 150

for (const row of allGarbage.values()) {
  const competitorName = nameById[row.competitor_id] ?? row.competitor_id
  process.stdout.write(`  ${competitorName.padEnd(20)} ${row.accession_number.slice(0, 22).padEnd(24)}`)

  let newHeadline    = null
  let newBodyExcerpt = null

  if (row.source_url) {
    const html = await fetchText(row.source_url)
    if (html) {
      const text = stripHtml(html)
      // Choose target item for excerpt extraction
      const targetItem = (row.items ?? '').split(',')
        .map(s => s.trim())
        .find(i => ['1.01', '2.01', '5.02', '8.01'].includes(i)) ?? '1'
      newBodyExcerpt = extractExcerpt(text, targetItem)
      newHeadline    = composeTitle(competitorName, row.items, newBodyExcerpt)
      if (!newHeadline) {
        // composeTitle failed (null items or all items unknown) — try raw prose
        newHeadline = buildHeadline(newBodyExcerpt)
      }
    }
  }

  const { error: upErr } = await supabase
    .from('company_signals')
    .update({ headline: newHeadline, body_excerpt: newBodyExcerpt })
    .eq('id', row.id)

  if (upErr) {
    console.log(`❌  ${upErr.message}`)
    failed++
  } else if (newHeadline) {
    console.log(`✅  ${newHeadline.slice(0, 60)}`)
    fixed++
  } else {
    console.log(`—   (headline null — filtered by isProseText)`)
    nulled++
  }

  await new Promise(r => setTimeout(r, RATE_MS))
}

console.log(`
─────────────────────────────────────
  Total rows processed: ${allGarbage.size}
  Fixed with new headline: ${fixed}
  Set to null (filtered):  ${nulled}
  Errors:                  ${failed}
─────────────────────────────────────
`)
