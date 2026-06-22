/**
 * run-csl-ir — Phase 4.2 (CSL Behring signals)
 *
 * CSL Limited is an ASX filer (not SEC). Their website and the ASX API are
 * both JavaScript-rendered or blocked from automated fetch — confirmed after
 * trying four endpoints. This script therefore uses two sources that ARE
 * reliably accessible:
 *
 *   1. FDA openFDA API  — regulatory events for garadacimab/Andembry
 *      (free, no auth, JSON). Covers the most competitively significant
 *      signals: FDA approvals, label changes, application history.
 *
 *   2. EMA product RSS  — European regulatory events for Andembry
 *      (free, public RSS feed from ema.europa.eu).
 *
 * Upserts to company_signals with competitor_id = csl-behring.
 *
 * Blocked sources (documented):
 *   - cslbehring.com — React SPA, no static article links (198 KB HTML, 0 links)
 *   - csl.com — React SPA
 *   - ASX API /asx/1/company/CSL/announcements — HTTP 404 (API deprecated ~2023)
 * For press releases: manual download from csl.com/investors per plan section A
 * (CSL exception).
 *
 * Name: run-csl-ir
 * Description: Fetch CSL Behring regulatory signals via FDA openFDA API and
 *   EMA product RSS. Upserts to company_signals. Logs SCRAPER_STALE if no
 *   CSL signals exist in the last 90 days (regulatory signals are infrequent).
 * Usage: node --env-file=.env.local scripts/run-csl-ir.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase      = createClient(SUPABASE_URL, SERVICE_KEY)
const USER_AGENT    = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS    = 20_000
const EXCERPT_LEN   = 500
const COMPETITOR_ID = 'csl-behring'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function fetchText(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!r.ok) return null
    return r.text()
  } catch { return null }
}

async function upsertSignal({ date, headline, bodyExcerpt, sourceUrl, accessionKey, signalType = 'press_release' }) {
  return supabase
    .from('company_signals')
    .upsert(
      {
        competitor_id:    COMPETITOR_ID,
        signal_type:      signalType,
        date,
        headline,
        body_excerpt:     bodyExcerpt?.slice(0, EXCERPT_LEN),
        items:            null,
        source_url:       sourceUrl,
        accession_number: accessionKey,
      },
      { onConflict: 'competitor_id,accession_number', ignoreDuplicates: false }
    )
}

// ── Source 1: FDA openFDA drug applications API ───────────────────────────────
// Returns NDA/BLA application history for garadacimab from the official FDA DB.

const FDA_URL = 'https://api.fda.gov/drug/drugsfda.json?search=openfda.generic_name:garadacimab&limit=20'

console.log(`\n🔄  CSL Behring — FDA openFDA API\n   ${FDA_URL}\n`)

let inserted = 0
let errors   = 0

try {
  const fdaData = await fetchJson(FDA_URL)
  const results = fdaData.results ?? []
  console.log(`   ${results.length} FDA application record(s) found for garadacimab\n`)

  for (const app of results) {
    const appNumber  = app.application_number ?? 'unknown'
    const sponsor    = app.sponsor_name ?? 'CSL Behring'
    const products   = app.products ?? []
    const submissions = app.submissions ?? []

    for (const sub of submissions) {
      const date      = (sub.submission_status_date ?? '').slice(0, 10)
      const subType   = sub.submission_type ?? ''
      const subNumber = sub.submission_number ?? ''
      const action    = sub.submission_status ?? ''
      const reviewPriority = sub.review_priority ?? ''

      if (!date || !action) continue

      // Build a readable headline from the structured fields
      const productName = products[0]?.brand_name ?? 'Andembry (garadacimab)'
      const headline    = `${sponsor} — ${productName} FDA ${subType} ${subNumber}: ${action}`
      const bodyExcerpt = [
        `Application: ${appNumber}`,
        `Submission: ${subType} ${subNumber}`,
        `Status: ${action}`,
        reviewPriority ? `Review priority: ${reviewPriority}` : null,
        products[0]?.dosage_form ? `Dosage form: ${products[0].dosage_form}` : null,
      ].filter(Boolean).join(' · ')

      const sourceUrl   = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/\D/g, '')}`
      const accKey      = `fda-${appNumber}-${subType}-${subNumber}`
      const signalType  = /approv/i.test(action) ? 'press_release' : 'press_release'

      process.stdout.write(`  ${date}  ${headline.slice(0, 70).padEnd(72)}`)

      const { error } = await upsertSignal({ date, headline, bodyExcerpt, sourceUrl, accessionKey: accKey, signalType })
      if (error) { console.log(`❌  ${error.message}`); errors++ }
      else        { console.log(`✅`); inserted++ }
    }
  }
} catch (e) {
  console.error(`❌  FDA openFDA API failed: ${e.message}`)
}

// ── Source 2: EMA product-page press releases (RSS) ──────────────────────────
// The EMA publishes press releases for CHMP opinions via their news RSS feed.

const EMA_RSS = 'https://www.ema.europa.eu/en/news/press-releases/rss'

console.log(`\n   EMA press release RSS — ${EMA_RSS}\n`)

try {
  const rssText = await fetchText(EMA_RSS)
  if (rssText) {
    // Extract <item> blocks and filter for garadacimab/Andembry
    const items   = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1])
    const relevant = items.filter(item => /garadacimab|andembry/i.test(item))
    console.log(`   ${items.length} EMA RSS items · ${relevant.length} match garadacimab/Andembry\n`)

    for (const item of relevant) {
      const title    = (item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) ?? [])[1]?.trim() ?? ''
      const link     = (item.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1]?.trim() ?? ''
      const pubDate  = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1]?.trim() ?? ''
      const desc     = (item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) ?? [])[1]?.trim() ?? ''

      const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10)
                           : new Date().toISOString().slice(0, 10)
      const accKey = `ema-pr-${link.split('/').pop()}`

      process.stdout.write(`  ${date}  ${title.slice(0, 70).padEnd(72)}`)

      const { error } = await upsertSignal({
        date,
        headline:    title,
        bodyExcerpt: desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        sourceUrl:   link,
        accessionKey: accKey,
      })
      if (error) { console.log(`❌  ${error.message}`); errors++ }
      else        { console.log(`✅`); inserted++ }
    }
  } else {
    console.log('   EMA RSS not reachable')
  }
} catch (e) {
  console.log(`   EMA RSS error: ${e.message}`)
}

// ── Blocked-source notice ─────────────────────────────────────────────────────

console.log(`
─────────────────────────────────────────────────────────────────
  NOTE — press releases blocked (automated fetch not possible):

  • cslbehring.com  React SPA — no static links in HTML
  • asx.com.au      API deprecated, all paths return HTTP 404

  For general press releases, use one of:
    a) Playwright headless browser (add as devDependency)
    b) Manual download from csl.com/investors (annual report PDF)
       → ingest via ingest-documents.mjs once built (Plan step A1)
─────────────────────────────────────────────────────────────────
`)

// ── Health check ──────────────────────────────────────────────────────────────
// Regulatory signals are infrequent — use 90-day window not 14-day

const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
const { data: recent } = await supabase
  .from('company_signals')
  .select('date, headline')
  .eq('competitor_id', COMPETITOR_ID)
  .gte('date', ninetyDaysAgo)
  .order('date', { ascending: false })
  .limit(5)

console.log(`
─────────────────────────────────────────
  Inserted/updated: ${inserted}
  Errors:           ${errors}
${recent?.length
  ? `  Most recent CSL signals (90d):\n${recent.map(r => `    ${r.date}  ${(r.headline ?? '').slice(0, 65)}`).join('\n')}`
  : '  ⚠️  No CSL signals in last 90 days — consider manual PR ingestion'}
─────────────────────────────────────────
`)
