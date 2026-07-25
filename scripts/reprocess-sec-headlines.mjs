/**
 * reprocess-sec-headlines.mjs — §2.4 data-quality gate, existing-row cleanup.
 *
 * Targets sec_edgar company_signals rows whose headline FAILS the deterministic
 * qualityGate (synthetic composeTitle stubs like "Acme — Other Events", SEC
 * boilerplate, or truncated). For each, re-fetches the SEC filing and extracts
 * the REAL first-sentence disclosure — never synthesizes. Then:
 *   - real disclosure found & passes the gate  → KEEP, update to the real text
 *   - no real disclosure                        → REJECT (carries nothing useful)
 *
 * SAFETY:
 *   - DRY-RUN by default (writes nothing). --apply updates kept + deletes rejected.
 *   - Scoped to data_source='sec_edgar' only. PubMed/congress/HTA untouched.
 *   - Only headline + body_excerpt updated on kept rows. ai_* untouched.
 *   - Rejected rows are logged to ingest_errors before deletion (audit trail).
 *
 * Usage:
 *   node --env-file=.env.local scripts/reprocess-sec-headlines.mjs           # dry-run
 *   node --env-file=.env.local scripts/reprocess-sec-headlines.mjs --apply
 */

import { createSupabaseClient, qualityGate } from './lib/signal-gate.mjs'

const APPLY          = process.argv.includes('--apply')
const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS     = 20_000
const EXCERPT_LEN    = 500
const RATE_MS        = 150

// ── Extraction (real disclosure only; NO synthesis) ─────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<ix:hidden[\s\S]*?<\/ix:hidden>/gi, '')
    .replace(/<dei:[^>]*>[\s\S]*?<\/dei:[^>]*>/gi, '')
    .replace(/<xbrli?:[^>]*>[\s\S]*?<\/xbrli?:[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#160;/g, ' ')
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"').replace(/&#8217;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

// SEC 8-K item titles that sit between the item marker and the real disclosure.
const ITEM_TITLE = new RegExp(
  '^(?:Other Events|Results of Operations and Financial Condition|Results of Operations|' +
  'Entry into a Material Definitive Agreement|Completion of Acquisition or Disposition of Assets|' +
  'Departure of Directors or Certain Officers[^.]*|Election of Directors[^.]*|' +
  'Appointment of Certain Officers[^.]*|Regulation FD Disclosure|' +
  'Financial Statements and Exhibits|Compensatory Arrangements[^.]*)[.\\s:]*', 'i',
)

// A sentence end = [.!?] followed by whitespace/end, NOT preceded by a known
// abbreviation (so "...Inc. announced..." is not truncated at "Inc.").
const SENTENCE = new RegExp(
  '^[A-Z0-9"][\\s\\S]{25,240}?' +
  '(?<!\\b(?:Inc|Corp|Ltd|Co|LLC|plc|U\\.S|Dr|Mr|Mrs|Ms|Jr|Sr|St|No|vs|' +
  'Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec))[.!?](?=\\s|$)',
)

/**
 * Extract the real first-sentence disclosure for an 8-K item. Uses the LAST item
 * marker (skips the table-of-contents entry), strips the item title, and returns
 * { headline, body } — or null when there is no real disclosure (stub filing).
 */
function extractDisclosure(text, itemCode) {
  const marker = new RegExp(`Item\\s*${itemCode.replace('.', '\\.')}`, 'gi')
  let last = -1, m
  while ((m = marker.exec(text)) !== null) last = m.index + m[0].length
  if (last === -1) return null

  const body = text.slice(last).replace(/^[.\s:—-]+/, '').replace(ITEM_TITLE, '').trim()
  const sent = body.match(SENTENCE)
  if (!sent) return null
  return {
    headline: sent[0].replace(/\s+/g, ' ').trim(),
    body: body.slice(0, EXCERPT_LEN).replace(/\s+/g, ' ').trim(),
  }
}

async function fetchText(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    return r.ok ? r.text() : null
  } catch { return null }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const trunc = (s, n) => (s ?? '').replace(/\s+/g, ' ').slice(0, n)

// The 8-K body often only points at the real content ("...attached as Exhibit 99.1").
const EXHIBIT_REF = /attached as Exhibit 99|furnished as Exhibit 99|copy of the (?:press release|presentation)|is incorporated (?:herein )?by reference/i

// Parse CIK (unpadded) + accession (no-dash) out of an EDGAR document URL.
function parseSecUrl(url) {
  const m = (url ?? '').match(/edgar\/data\/(\d+)\/(\d+)\//)
  return m ? { unpadded: m[1], accNodash: m[2] } : null
}

const dashAccession = (a) => `${a.slice(0, 10)}-${a.slice(10, 12)}-${a.slice(12)}`

// Fetch the filing index and return the first EX-99 exhibit URL (the press
// release), or null. Ported from run-sec-deals.mjs.
async function fetchEx99Url(unpadded, accNodash) {
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${dashAccession(accNodash)}-index.htm`
  const html = await fetchText(indexUrl)
  if (!html) return null
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let match
  while ((match = rowRegex.exec(html)) !== null) {
    if (!/EX-99/i.test(match[1])) continue
    const href = match[1].match(/href="([^"#]+\.htm[l]?)"/i)
    if (href) {
      const f = href[1]
      return f.startsWith('http') ? f
        : `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${f.replace(/^.*\//, '')}`
    }
  }
  return null
}

// Strip the EDGAR exhibit wrapper that precedes the actual press release, e.g.
// "EX-99.1 2 ef20050532_ex99-1.htm EXHIBIT 99.1 Exhibit 99.1 <real release>".
function stripExhibitHeader(t) {
  return t.replace(
    /^(?:\s*(?:EX-99[.\d]*|Exhibit\s+99[.\d]*|PRESS RELEASE|EdgarFiling|FINAL|[A-Za-z0-9_.-]+\.html?|\d+))+\s*/i,
    '',
  ).trim()
}

// Extract a real headline from a press-release exhibit: prefer the release title
// (the text before the dateline), else the first real sentence.
function extractPressRelease(raw) {
  const text = stripExhibitHeader(raw)
  const dateline = text.search(/\([A-Z][A-Za-z ]+WIRE\)|\b[A-Z]{2,}[A-Za-z.]*,\s+[A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4}|\s--\s/)
  if (dateline > 20 && dateline < 220) {
    const title = text.slice(0, dateline).replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '')
    if (title.length >= 20 && qualityGate(title).ok) return title
  }
  const sent = text.match(SENTENCE)
  return sent ? sent[0].replace(/\s+/g, ' ').trim() : null
}

// Full recovery for one row: 8-K body first, then the EX-99.1 exhibit.
async function recoverRow(row) {
  if (!row.source_url) return null
  const html = await fetchText(row.source_url)
  await sleep(RATE_MS)
  let recovered = null
  if (html) {
    const text = stripHtml(html)
    const declared = (row.items ?? '').split(',').map(s => s.trim())
      .find(x => ['1.01', '2.01', '5.02', '8.01', '7.01'].includes(x))
    const byType = { exec_change: '5.02', deal: '1.01', press_release: '8.01', regulatory_catalyst: '8.01' }[row.signal_type]
    const candidates = [...new Set([declared, byType, '8.01', '5.02', '1.01', '2.01', '7.01'].filter(Boolean))]
    for (const item of candidates) {
      const r = extractDisclosure(text, item)
      if (r && qualityGate(r.headline).ok) { recovered = r; break }
    }
  }
  // If the body is missing or only points at the exhibit, go get the exhibit.
  if (!recovered || EXHIBIT_REF.test(recovered.headline)) {
    const p = parseSecUrl(row.source_url)
    if (p) {
      const ex99Url = await fetchEx99Url(p.unpadded, p.accNodash)
      await sleep(RATE_MS)
      if (ex99Url) {
        const exHtml = await fetchText(ex99Url)
        await sleep(RATE_MS)
        if (exHtml) {
          const exText = stripHtml(exHtml)
          const prHeadline = extractPressRelease(exText)
          if (prHeadline && qualityGate(prHeadline).ok) {
            recovered = { headline: prHeadline, body: stripExhibitHeader(exText).slice(0, EXCERPT_LEN).replace(/\s+/g, ' ').trim() }
          }
        }
      }
    }
  }
  return recovered
}

async function main() {
  console.log(`\n── Re-process SEC headlines (${APPLY ? 'APPLY — WILL WRITE + DELETE' : 'DRY-RUN — no writes'}) ──\n`)
  const supabase = createSupabaseClient()

  const { data: rows, error } = await supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, headline, body_excerpt, source_url, items, accession_number')
    .eq('data_source', 'sec_edgar')
  if (error) { console.error(error.message); process.exit(1) }

  const targets = rows.filter(r => !qualityGate(r.headline).ok)
  console.log(`sec_edgar rows: ${rows.length} | failing gate: ${targets.length}\n`)

  const kept = [], rejected = []
  let i = 0
  for (const row of targets) {
    process.stdout.write(`\r  re-fetching ${++i}/${targets.length}   `)
    const recovered = await recoverRow(row)
    if (recovered && qualityGate(recovered.headline).ok) {
      kept.push({ ...row, newHeadline: recovered.headline, newBody: recovered.body })
    } else {
      rejected.push({ ...row, reason: 'no_prose_disclosure' })
    }
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r')

  console.log(`KEEP (recovered real disclosure): ${kept.length}`)
  console.log(`REJECT (no real disclosure):      ${rejected.length}\n`)
  const byType = {}
  for (const r of rejected) byType[r.signal_type] = (byType[r.signal_type] ?? 0) + 1
  console.log('Rejected by signal_type:', JSON.stringify(byType))

  console.log('\n── sample KEEP (old → recovered real headline) ──')
  for (const k of kept.slice(0, 12)) {
    console.log(`  (${k.competitor_id}/${k.signal_type})`)
    console.log(`    old: ${trunc(k.headline, 60)}`)
    console.log(`    new: ${trunc(k.newHeadline, 90)}`)
  }
  console.log('\n── sample REJECT ──')
  for (const r of rejected.slice(0, 10)) console.log(`  [${r.reason}] (${r.competitor_id}/${r.signal_type}) ${trunc(r.headline, 46)}`)

  if (!APPLY) { console.log('\n── DRY-RUN complete. No writes. Re-run with --apply. ──\n'); return }

  console.log('\n── Applying ──')
  let updated = 0, deleted = 0
  for (const k of kept) {
    const { error: e } = await supabase.from('company_signals')
      .update({ headline: k.newHeadline, body_excerpt: k.newBody }).eq('id', k.id)
    if (e) console.error(`  ❌ update ${k.id}: ${e.message}`); else updated++
  }
  for (const r of rejected) {
    await supabase.from('ingest_errors').insert({
      source: 'sec_edgar', competitor_id: r.competitor_id,
      error_message: `quality-gate reject (${r.reason}): ${trunc(r.headline, 120)}`,
    })
    const { error: e } = await supabase.from('company_signals').delete().eq('id', r.id)
    if (e) console.error(`  ❌ delete ${r.id}: ${e.message}`); else deleted++
  }
  console.log(`\n── Applied: ${updated} headlines recovered, ${deleted} stub rows rejected. ──\n`)
}
main().catch(e => { console.error(e); process.exit(1) })
