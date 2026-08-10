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
import { buildNarration, NARRATION_DAYS } from './lib/buildNarration.mjs'
import { qualityGate, refineSignalType, loadAssetResolver, resolveAsset } from './lib/signal-gate.mjs'
import { recoverDisclosure } from './lib/sec-extract.mjs'

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

function classifyItems(itemsStr) {
  if (!itemsStr) return null
  const items = itemsStr.split(',')
  if (items.some(i => ['1.01', '2.01'].includes(i.trim()))) return 'deal'
  if (items.some(i => i.trim() === '5.02'))                  return 'exec_change'
  if (items.some(i => i.trim() === '8.01'))                  return 'press_release'
  return null
}

// Text-heuristic classifier for forms that lack SEC item numbering (6-K, 20-F)
function classifyByText(text) {
  const t = text.toLowerCase()
  if (/\b(execut|appoint|resign|ceo|cfo|president|officer|director)\b/.test(t)) return 'exec_change'
  if (/\b(acqui|merger|license|collaborat|partner|agreement|deal)\b/.test(t))    return 'deal'
  return 'press_release'
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

// deal and press_release are lexicon-matched (§2.2), same as every other
// text-discovered signal type. exec_change never gets an asset by design — a
// leadership change has no drug — so it's never passed through this resolver.
const assetResolver = await loadAssetResolver(supabase)

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

      // §2.4: recover a REAL disclosure (8-K body, else the EX-99.1 exhibit) via
      // the shared extractor — never synthesize a headline. Show the real
      // headline or REJECT the row (quality gate). Congress-style synthesis and
      // "Company — Other Events" stubs are no longer produced here.
      const rec = await recoverDisclosure(docUrl, filing.itemsStr, itemSignalType)
      const headline    = rec?.headline ?? null
      const bodyExcerpt = rec?.body ?? null
      if (!headline || !qualityGate(headline).ok) { skipped++; continue }

      // SEC item codes cannot express a regulatory event — companies announce
      // approvals under item 8.01 ("Other Events"), which classifyItems maps to
      // press_release. Refine from the filing's own words so the arc (and
      // therefore D11 importance) reflects what actually happened (§4.1).
      const signalType = refineSignalType(
        headline,
        bodyExcerpt,
        itemSignalType ?? classifyByText(bodyExcerpt ?? ''),
      )

      // Lexicon-match deal/press_release to a specific tracked drug. competitor_id
      // is already known (this filing's own filer) — never overwritten by the
      // resolver's competitorId, which exists for writers that must discover it
      // from free text. No match found: inn/asset_id stay null, same honest
      // fallback as everywhere else — never forced onto a guess.
      let inn = null, assetId = null
      if (signalType === 'deal' || signalType === 'press_release') {
        const identity = resolveAsset(`${headline ?? ''} ${bodyExcerpt ?? ''}`.toLowerCase(), assetResolver, undefined, id)
        if (identity.inn != null) { inn = identity.inn; assetId = identity.assetId }
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
            inn,
            asset_id:         assetId,
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
