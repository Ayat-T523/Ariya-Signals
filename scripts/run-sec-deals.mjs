/**
 * SEC EDGAR filing ingest — fetches deal, executive change, and press release signals.
 * Usage: node --env-file=.env.local scripts/run-sec-deals.mjs
 *
 * Writes to the company_signals Supabase table. Run company_signals.sql first.
 * Form types per competitor:
 *   - Default (8-K): classified by item numbers: 1.01/2.01=deal, 5.02=exec_change, 8.01=press_release
 *   - 6-K / 20-F (e.g. Takeda): no item numbers — classified by text heuristics on the excerpt
 * Override form types by adding "secFormTypes": ["6-K","20-F"] to a competitor in competitors.json.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildWhyItMatters } from './lib/extractWhy.mjs'
import { buildNarration, NARRATION_DAYS } from './lib/buildNarration.mjs'
import { buildCleanHeadline } from './lib/buildCleanHeadline.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/run-sec-deals.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS     = 20_000
const LOOKBACK_DAYS  = 730  // 2 years
const EXCERPT_LEN    = 500

// ── Helpers ───────────────────────────────────────────────────────────────────

function padCik(cik) {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

function unpadCik(cik) {
  return String(parseInt(cik, 10))
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) return null
  return r.text()
}

function classifyItems(itemsStr) {
  if (!itemsStr) return null
  const items = itemsStr.split(',')
  if (items.some(i => ['1.01', '2.01'].includes(i.trim()))) return 'deal'
  if (items.some(i => i.trim() === '5.02'))                  return 'exec_change'
  if (items.some(i => i.trim() === '8.01'))                  return 'press_release'
  return null
}

// Strip HTML tags and decode common entities.
// Removes iXBRL hidden-metadata blocks FIRST — these contain raw DEI values
// (DocumentType, AmendmentFlag, CIK, PeriodOfReport) that produce garbage like
// "8-K false 0001652130 0001652130 2024-10-24" when HTML tags are stripped but
// text content is left. Affects all XBRL-inline 8-K filers (e.g. Intellia).
function stripHtml(html) {
  return html
    // Remove iXBRL hidden metadata sections entirely (no readable content)
    .replace(/<ix:hidden[\s\S]*?<\/ix:hidden>/gi, '')
    // Remove inline DEI/XBRL value tags — their text content is raw numeric metadata
    .replace(/<dei:[^>]*>[\s\S]*?<\/dei:[^>]*>/gi, '')
    .replace(/<xbrli?:[^>]*>[\s\S]*?<\/xbrli?:[^>]*>/gi, '')
    // Standard HTML strip + entity decode
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

// Extract the first substantive paragraph after an "Item X.XX" heading.
// After stripHtml the text is single-spaced, so we can't look for newlines.
// Instead: find the item marker, then skip the section title by searching for
// the next ". Capital" sentence boundary — avoids the old hardcoded +10 offset
// that landed mid-word when the heading title varied in length.
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
    // Section title ends at the first ". Capital" (e.g. "Entry into a Material
    // Definitive Agreement. On January 23..."). If none found, start right after.
    const titleBreak = afterMarker.search(/\.\s+[A-Z]/)
    const afterTitle  = titleBreak >= 0
      ? afterMarker.slice(titleBreak + 1).trimStart()
      : afterMarker.trimStart()
    return afterTitle.slice(0, EXCERPT_LEN).replace(/\s+/g, ' ').trim()
  }
  return text.slice(0, EXCERPT_LEN).trim()
}

// Returns false for metadata rows (exhibit indexes, accession numbers, form codes)
function isProseText(text) {
  if (/\d{10}\s+\d{10}/.test(text))    return false  // dual CIK/accession
  if (/exhibit\d+[_\-.]/i.test(text))  return false  // exhibit filename
  if (/form\d*k[_\-]/i.test(text))     return false  // form code ref
  const nonAlpha = (text.match(/[\d_]/g) ?? []).length
  if (nonAlpha / text.length > 0.4)    return false  // >40% digits/underscores
  const skip = /^(true|false|null)$/i
  const proseWords = (text.match(/\b[A-Za-z]{4,}\b/g) ?? []).filter(w => !skip.test(w))
  return proseWords.length >= 3
}

// Build a one-sentence headline from the excerpt; returns null when the
// extracted candidate looks like filing metadata rather than readable prose
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

// ── Item-based title composition ──────────────────────────────────────────────

const ITEM_DESCRIPTIONS = {
  '1.01': 'Entry into a Material Definitive Agreement',
  '2.01': 'Completion of Acquisition or Disposition of Assets',
  '2.02': 'Results of Operations and Financial Condition',
  '5.02': 'Departure/Appointment of Directors or Officers',
  '7.01': 'Regulation FD Disclosure',
  '8.01': 'Other Events',
  '9.01': 'Financial Statements and Exhibits',
}

// Strip known leading artifacts from body_excerpt before attempting prose recovery.
// The old extractExcerpt +10 offset left lowercase fragments like "ts.", "o a",
// or "of Directors" at the start. This pattern removes them so the real sentence
// can be found. Degrades gracefully when the artifact is absent.
function recoverProseSentence(text) {
  if (!text) return null
  const stripped = text.replace(/^[a-z][a-z\s,;.]{0,30}\.\s*/, '').trim()
  const match    = stripped.match(/^[A-Z][^.!?]{20,200}[.!?]/)
  return match ? match[0].trim() : null
}

// Compose a readable headline from the structured items field.
// For press-release items (8.01, 7.01): attempts to recover a real prose sentence
// from body_excerpt first — real content wins over the generic description.
// For all other item types: returns "<CompetitorName> — <Item Description>".
// Guard: returns null for null/empty items (6-K rows — handled by Phase 4).
function composeTitle(competitorName, items, bodyExcerpt) {
  if (!items) return null
  const itemCodes   = items.split(',').map(s => s.trim()).filter(Boolean)
  if (!itemCodes.length) return null

  const isPressRelease = itemCodes.some(c => c === '8.01' || c === '7.01')
  if (isPressRelease && bodyExcerpt) {
    const prose = recoverProseSentence(bodyExcerpt)
    if (prose) return prose
  }

  // Priority order: deal/acquisition items first, then exec, then press/general
  const priority = ['2.01', '1.01', '2.02', '5.02', '8.01', '7.01', '9.01']
  const leadItem  = priority.find(c => itemCodes.includes(c)) ?? itemCodes[0]
  const desc      = ITEM_DESCRIPTIONS[leadItem] ?? `SEC Filing (Item ${leadItem})`
  return `${competitorName} — ${desc}`
}

// Text-heuristic classifier for forms that lack SEC item numbering (6-K, 20-F)
function classifyByText(text) {
  const t = text.toLowerCase()
  if (/\b(execut|appoint|resign|ceo|cfo|president|officer|director)\b/.test(t)) return 'exec_change'
  if (/\b(acqui|merger|license|collaborat|partner|agreement|deal)\b/.test(t))    return 'deal'
  return 'press_release'
}

// ── Phase 4.1: Foreign-filer EX-99 adapter ───────────────────────────────────

// Reconstruct the dashed accession number from the no-dash form.
// "000139506426000177" → "0001395064-26-000177"
function dashAccession(accNodash) {
  return `${accNodash.slice(0, 10)}-${accNodash.slice(10, 12)}-${accNodash.slice(12)}`
}

// Fetch the EDGAR filing index for a 6-K and return the URL of the first
// EX-99.1 press release exhibit, or null when no EX-99 is present (the filing
// is a pure financial statement with no press release attached).
async function fetchEx99Url(unpadded, accNodash) {
  const dashed   = dashAccession(accNodash)
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${dashed}-index.htm`
  const html     = await fetchText(indexUrl)
  if (!html) return null

  // Walk the filing index table rows and return the href of the first row
  // whose type cell contains "EX-99" (covers EX-99.1, EX-99.2, EX-99, etc.).
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let match
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1]
    if (!/EX-99/i.test(row)) continue
    const hrefMatch = row.match(/href="([^"#]+\.htm[l]?)"/i)
    if (hrefMatch) {
      const filename = hrefMatch[1]
      if (filename.startsWith('http')) return filename
      // Relative path — strip any leading directory components the index may include
      const base = filename.replace(/^.*\//, '')
      return `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${base}`
    }
  }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)
const withCik     = competitors.filter(c => c.secCik)
// Phase 1: competitors with no SEC CIK are routed through an IR scrape path.
// The ASX structured adapter for CSL Behring is deferred pending access-terms
// confirmation — this loop establishes the routing without executing scrapes.
const withIrScrape = competitors.filter(c => !c.secCik && c.dataSource === 'IR_SCRAPE')

const cutoffDate = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10)

console.log(`\n🔄  Fetching SEC EDGAR signals for ${withCik.length} competitors (since ${cutoffDate})...\n`)

const errors = []
let inserted  = 0
let skipped   = 0

for (const competitor of withCik) {
  const { id, name, secCik } = competitor
  const padded   = padCik(secCik)
  const unpadded = unpadCik(secCik)
  process.stdout.write(`  ${name.padEnd(28)}`)

  try {
    const data = await fetchJson(`https://data.sec.gov/submissions/CIK${padded}.json`)
    const recent = data.filings?.recent ?? {}
    const { form = [], filingDate = [], primaryDocument = [], accessionNumber = [], items = [] } = recent

    // Resolve form types: explicit JSON override takes priority; otherwise auto-derive
    // from the company's actual EDGAR filing history (6-K presence = foreign private issuer)
    const uniqueForms   = new Set(form)
    const formTypes     = competitor.secFormTypes
      ?? (uniqueForms.has('6-K') ? ['6-K', '20-F'] : ['8-K'])

    // Filter to target form types within lookback window
    const relevantFilings = []
    for (let i = 0; i < form.length; i++) {
      if (formTypes.includes(form[i]) && filingDate[i] >= cutoffDate) {
        relevantFilings.push({
          date:       filingDate[i],
          doc:        primaryDocument[i],
          accession:  accessionNumber[i],
          itemsStr:   items[i] ?? '',
          formType:   form[i],
        })
      }
    }

    if (!relevantFilings.length) {
      console.log(`— no recent ${formTypes.join('/')}s`)
      continue
    }

    let count = 0
    for (const filing of relevantFilings) {
      // 8-K: classify by item numbers. Other forms: defer to text heuristics after fetch.
      const itemSignalType = classifyItems(filing.itemsStr)
      // For 8-K we skip if items don't match known signal types (e.g. 4.01, 9.01 only)
      if (filing.formType === '8-K' && !itemSignalType) { skipped++; continue }
      // 20-F annual reports contain XBRL financials only — no press release signal
      if (filing.formType === '20-F') { skipped++; continue }

      const accNodash = filing.accession.replace(/-/g, '')
      const docUrl = `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${filing.doc}`

      let headline    = null
      let bodyExcerpt = null

      try {
        const html = await fetchText(docUrl)
        if (html) {
          const text = stripHtml(html)
          if (filing.formType === '8-K') {
            // Guard: 6-K rows reach here with empty itemsStr — skip composition,
            // Phase 4 foreign-filer adapter handles those rows.
            if (!filing.itemsStr) continue

            // Pick the most relevant item number for excerpt extraction
            const targetItem = filing.itemsStr.split(',')
              .map(s => s.trim())
              .find(i => ['1.01', '2.01', '5.02', '8.01'].includes(i)) ?? '1'
            bodyExcerpt = extractExcerpt(text, targetItem)
            // Compose title from structured items metadata instead of slicing text.
            // recoverProseSentence handles press-release items (8.01/7.01) that
            // have real prose content worth surfacing.
            headline = composeTitle(name, filing.itemsStr, bodyExcerpt)
          } else {
            // Phase 4.1: 6-K adapter — fetch the EX-99.1 press release exhibit.
            // Financial-only 6-Ks (no EX-99) are skipped; the cover filing text
            // is a table of contents, not prose worth extracting.
            const ex99Url = await fetchEx99Url(unpadded, accNodash)
            if (!ex99Url) { skipped++; continue }
            const ex99Html = await fetchText(ex99Url)
            if (ex99Html) {
              const ex99Text = stripHtml(ex99Html)
              bodyExcerpt = ex99Text.slice(0, EXCERPT_LEN).trim()
              headline    = buildHeadline(bodyExcerpt) ?? recoverProseSentence(bodyExcerpt)
            }
          }
        }
      } catch (_) {
        // Document fetch failed — still store the filing metadata
      }

      // Resolve final signal type: item-based for 8-K, text-based for everything else
      const signalType = itemSignalType ?? classifyByText(bodyExcerpt ?? headline ?? '')

      // Phase 2: generate why_it_matters at ingest time (deterministic — no external API)
      const whyItMatters = buildWhyItMatters(
        { headline, body_excerpt: bodyExcerpt, signal_type: signalType },
        name,
      )

      // Round 2 R4: clean_headline via local Ollama — best-effort. A down/slow
      // Ollama must never block ingestion of the underlying filing signal, so
      // failures fall back to omitting the column entirely (see below), not
      // to writing null — this is an upsert on re-runs, and an explicit null
      // would clobber a clean_headline a previous, successful run already
      // wrote for this same accession_number.
      let cleanHeadline = null
      try {
        cleanHeadline = await buildCleanHeadline(
          { headline, body_excerpt: bodyExcerpt, signal_type: signalType },
          name,
        )
      } catch (e) {
        errors.push(`${name} ${filing.accession} clean_headline: ${e.message}`)
      }

      const { error } = await supabase
        .from('company_signals')
        .upsert(
          {
            competitor_id:    id,
            signal_type:      signalType,
            date:             filing.date,
            headline,
            body_excerpt:     bodyExcerpt,
            items:            filing.itemsStr || null,
            source_url:       `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${filing.doc}`,
            accession_number: filing.accession,
            why_it_matters:   whyItMatters,
            ...(cleanHeadline ? { clean_headline: cleanHeadline } : {}),
          },
          { onConflict: 'competitor_id,accession_number', ignoreDuplicates: false }
        )

      if (error) errors.push(`${name} ${filing.accession}: ${error.message}`)
      else { inserted++; count++ }

      // Respect SEC EDGAR rate limit (10 req/s) — document fetch already takes time
      await new Promise(r => setTimeout(r, 120))
    }

    console.log(`✅  ${count} signals (${relevantFilings.length} ${formTypes.join('/')}s scanned)`)
  } catch (e) {
    errors.push(`${name}: ${e.message}`)
    console.log(`❌  ${e.message}`)
  }
}

// ── IR scrape path (Phase 1) ──────────────────────────────────────────────────
// Competitors without an SEC CIK are routed here instead of the EDGAR loop.
// The actual scraping logic is deferred — CSL ASX adapter is held pending
// automated-access terms confirmation (see plan "Held pending external checks").
if (withIrScrape.length > 0) {
  console.log(`\n🔄  IR scrape path (${withIrScrape.length} competitor(s) — adapter deferred)...\n`)
  for (const { name, irScrapeUrl } of withIrScrape) {
    process.stdout.write(`  ${name.padEnd(28)}`)
    console.log(`⏳  IR scrape pending  (${irScrapeUrl ?? 'no URL set'})`)
  }
}

// ── Phase 2C: per-competitor narration summaries ─────────────────────────────
// Runs after all signals are upserted so every competitor's full window is current.

console.log(`\n🔄  Generating competitor narration summaries...\n`)

const narrationCutoff = new Date(Date.now() - NARRATION_DAYS * 86_400_000).toISOString().slice(0, 10)
let narrationsWritten = 0

for (const { id, name } of withCik) {
  const { data: recentSigs } = await supabase
    .from('company_signals')
    .select('signal_type, why_it_matters, date')
    .eq('competitor_id', id)
    .gte('date', narrationCutoff)
    .order('date', { ascending: false })

  const narration = buildNarration(recentSigs ?? [], name)

  const { error: narErr } = await supabase
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

  if (!narErr) narrationsWritten++
  else errors.push(`narration ${name}: ${narErr.message}`)
}

console.log(`
─────────────────────────────────────────
  SEC filers processed:  ${withCik.length}
  IR-scrape deferred:    ${withIrScrape.length}
  Signals inserted:      ${inserted}
  Non-signal 8-Ks skipped: ${skipped}
  Narrations written:    ${narrationsWritten}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
