/**
 * Financial ingest — fetches revenue and R&D spend for all competitors with a secCik.
 *
 * Source priority:
 *   1. GlobeNewswire (annual earnings press release) — more accurate, includes product-level breakdown
 *   2. SEC EDGAR XBRL — fallback when GNW search finds nothing
 *
 * Writes to the financial_snapshots Supabase table.
 * Run financial_snapshots.sql and add_hae_revenue.sql first.
 *
 * Usage: node --env-file=.env.local scripts/run-sec-financials.mjs
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
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Constants ─────────────────────────────────────────────────────────────────

const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const GNW_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const TIMEOUT_MS     = 30_000
const TARGET_YEAR    = 2025   // most recent completed fiscal year

// Static annual average exchange rates to USD
const EXCHANGE_RATES = {
  JPY: { 2025: 153.8, 2024: 149.8, 2023: 134.4, 2022: 131.5, 2021: 109.8 },
  EUR: { 2025: 1.072, 2024: 1.082, 2023: 1.081, 2022: 1.053, 2021: 1.183 },
  GBP: { 2025: 1.272, 2024: 1.269, 2023: 1.244, 2022: 1.237, 2021: 1.375 },
}

// XBRL concept fallback chains — tried in order, first non-empty wins
const REVENUE_CONCEPTS = {
  'us-gaap': [
    'Revenues',                                             // most comprehensive — total revenue
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromCollaborativeArrangement',                  // pre-commercial biotech (Intellia)
    'LicenseAndServiceRevenue',
    'RevenueFromProductSales',
  ],
  'ifrs-full': [
    'Revenue',
    'RevenueFromContractsWithCustomers',
  ],
}

const RD_CONCEPTS = {
  'us-gaap':   ['ResearchAndDevelopmentExpense'],
  'ifrs-full': ['ResearchAndDevelopmentExpense'],
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function formatUSD(v) {
  if (v == null) return 'n/a'
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

function toUSD(value, currency, fy) {
  if (value == null) return null
  if (currency === 'USD') return value
  const rates = EXCHANGE_RATES[currency]
  if (!rates) return null
  const rate = rates[fy] ?? rates[Object.keys(rates).sort().pop()]
  // EUR and GBP are multipliers; JPY is divisor
  return currency === 'JPY'
    ? Math.round(value / rate)
    : Math.round(value * rate)
}

// ── GlobeNewswire helpers ─────────────────────────────────────────────────────

async function fetchTextGnw(url) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': GNW_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return r.ok ? r.text() : null
  } catch { return null }
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<').replace(/&#160;/g, ' ').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

// Parse "$X.X million" or "$X.X billion" amounts from a text slice
function parseDollarAmt(slice) {
  const b = slice.match(/\$([\d,]+\.?\d*)\s*billion/i)
  if (b) return Math.round(parseFloat(b[1].replace(/,/g, '')) * 1e9)
  const m = slice.match(/\$([\d,]+\.?\d*)\s*million/i)
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 1e6)
  return null
}

// Parse "€X million" or "EUR X million" amounts (Pharvaris reports in EUR)
function parseEuroAmt(slice) {
  const m = slice.match(/(?:€|EUR\s*)([\d,]+\.?\d*)\s*million/i)
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 1e6)
  return null
}

function extractFromText(text, gnwCurrency, gnwHaeProduct) {
  const isEur = gnwCurrency === 'EUR'

  // Helper: search for keyword, read 250 chars after it
  function after(pattern) {
    const idx = text.search(pattern)
    return idx >= 0 ? text.slice(idx, idx + 250) : ''
  }

  const parseAmt = isEur
    ? (slice) => parseEuroAmt(slice) || parseDollarAmt(slice)
    : parseDollarAmt

  // Total revenue — try multiple labels
  let totalRevenue = null
  for (const pat of [
    /total\s+(?:net\s+)?revenue/i,
    /total\s+\d{4}\s+revenue/i,
    /full.year\s+\d{4}\s+revenue/i,
    /net\s+revenue/i,
    /revenue\s+of/i,
  ]) {
    totalRevenue = parseAmt(after(pat))
    if (totalRevenue) break
  }

  // R&D expense
  const rdExpense = parseAmt(after(/research\s+and\s+development\s+(?:expense|cost)/i))

  // HAE product revenue (e.g. ORLADEYO for BioCryst)
  let haeRevenue = null
  if (gnwHaeProduct) {
    const prodPattern = new RegExp(gnwHaeProduct, 'i')
    haeRevenue = parseAmt(after(prodPattern))
  }

  return { totalRevenue, rdExpense, haeRevenue }
}

async function fetchGnwFinancials(competitor, year) {
  if (!competitor.gnwKeyword) return null

  // Search GlobeNewswire for the annual earnings press release
  const query = encodeURIComponent(`${competitor.gnwKeyword} ${year}`)
  const searchUrl = `https://www.globenewswire.com/en/search/keyword/${query}`
  const searchHtml = await fetchTextGnw(searchUrl)
  if (!searchHtml || searchHtml.length < 500) return null   // likely JS-only page

  // Find the first press release link matching a full-year / Q4 earnings slug.
  // Deliberately excludes Q1/Q2/Q3-only releases — we only want annual results.
  const linkRe = /href="(\/news-release\/\d{4}\/\d{2}\/\d{2}\/\d+\/\d+\/en\/[^"]+\.html)"/g
  const earningsRe = /full.year|fourth.quarter|annual.result/i

  let releaseUrl = null
  for (const m of searchHtml.matchAll(linkRe)) {
    if (earningsRe.test(m[1])) {
      releaseUrl = `https://www.globenewswire.com${m[1]}`
      break
    }
  }
  if (!releaseUrl) return null

  const releaseHtml = await fetchTextGnw(releaseUrl)
  if (!releaseHtml || releaseHtml.length < 1000) return null

  const text = stripHtml(releaseHtml)
  const { totalRevenue, rdExpense, haeRevenue } = extractFromText(
    text,
    competitor.gnwCurrency ?? 'USD',
    competitor.gnwHaeProduct ?? null,
  )

  if (!totalRevenue && !rdExpense) return null

  const currency = competitor.gnwCurrency ?? 'USD'
  return {
    total_revenue_raw: totalRevenue,
    total_revenue_usd: currency === 'USD' ? totalRevenue : toUSD(totalRevenue, currency, year),
    rd_expense_raw:    rdExpense,
    rd_expense_usd:    currency === 'USD' ? rdExpense : toUSD(rdExpense, currency, year),
    hae_revenue_usd:   haeRevenue,   // null for most; populated for BioCryst (ORLADEYO)
    currency,
    exchange_rate_usd: currency !== 'USD' ? (EXCHANGE_RATES[currency]?.[year] ?? null) : null,
    source_url:        releaseUrl,
    _source:           'globenewswire',
  }
}

// ── SEC EDGAR XBRL helpers ────────────────────────────────────────────────────

function padCik(cik) {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// Extract annual FY values — deduped by fiscal year, latest filing wins
function extractFyValues(facts, taxonomy, concepts) {
  const ns = facts[taxonomy]
  if (!ns) return []

  for (const concept of concepts) {
    const info = ns[concept]
    if (!info) continue
    const units = info.units ?? {}
    const unitKey = Object.keys(units)[0]
    if (!unitKey) continue

    const records = units[unitKey]
    const fyRecords = records.filter(r =>
      ['10-K', '20-F'].includes(r.form) && r.fp === 'FY' && r.val != null
    )
    if (!fyRecords.length) continue

    const byYear = new Map()
    for (const r of fyRecords) {
      const prev = byYear.get(r.fy)
      if (!prev || r.filed > prev.filed) byYear.set(r.fy, r)
    }

    return [...byYear.values()]
      .sort((a, b) => b.fy - a.fy)
      .map(r => ({ fy: r.fy, value: r.val, currency: unitKey, filedDate: r.filed }))
  }
  return []
}

async function fetchXbrlFinancials(competitor) {
  const { id, secCik } = competitor
  const padded  = padCik(secCik)
  const data    = await fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`)
  const facts   = data.facts ?? {}
  const taxonomy = facts['ifrs-full'] ? 'ifrs-full' : 'us-gaap'

  const revRows = extractFyValues(facts, taxonomy, REVENUE_CONCEPTS[taxonomy])
  const rdRows  = extractFyValues(facts, taxonomy, RD_CONCEPTS[taxonomy])

  if (!revRows.length && !rdRows.length) return null

  const years   = new Set([...revRows.map(r => r.fy), ...rdRows.map(r => r.fy)])
  const revByYr = new Map(revRows.map(r => [r.fy, r]))
  const rdByYr  = new Map(rdRows.map(r  => [r.fy, r]))

  return [...years].sort((a, b) => b - a).slice(0, 3).map(fy => {
    const rev = revByYr.get(fy)
    const rd  = rdByYr.get(fy)
    const currency     = rev?.currency ?? rd?.currency ?? 'USD'
    const exchangeRate = currency !== 'USD' ? (EXCHANGE_RATES[currency]?.[fy] ?? null) : null
    return {
      fiscal_year:       fy,
      total_revenue_raw: rev?.value ?? null,
      total_revenue_usd: toUSD(rev?.value ?? null, currency, fy),
      rd_expense_raw:    rd?.value ?? null,
      rd_expense_usd:    toUSD(rd?.value ?? null, currency, fy),
      hae_revenue_usd:   null,
      currency,
      exchange_rate_usd: exchangeRate,
      filing_date:       rev?.filedDate ?? rd?.filedDate ?? null,
      source_url:        `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`,
      _source:           'sec_xbrl',
    }
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)

// Skip competitors marked as acquired — they no longer file independently
const withCik = competitors.filter(c => c.secCik && c.status !== 'acquired')

console.log(`\n🔄  Fetching financials for ${withCik.length} competitors (GlobeNewswire → XBRL fallback)...\n`)

const errors = []
let inserted = 0

for (const competitor of withCik) {
  const { id, name } = competitor
  process.stdout.write(`  ${name.padEnd(28)}`)

  try {
    // ── Step 1: Try GlobeNewswire (primary) ──────────────────────────────────
    const gnwData = await fetchGnwFinancials(competitor, TARGET_YEAR)

    let upserts = []

    if (gnwData) {
      // GNW gives us one year (the latest press release)
      upserts.push({
        competitor_id:     id,
        fiscal_year:       TARGET_YEAR,
        total_revenue_raw: gnwData.total_revenue_raw,
        total_revenue_usd: gnwData.total_revenue_usd,
        rd_expense_raw:    gnwData.rd_expense_raw,
        rd_expense_usd:    gnwData.rd_expense_usd,
        hae_revenue_usd:   gnwData.hae_revenue_usd,
        currency:          gnwData.currency,
        exchange_rate_usd: gnwData.exchange_rate_usd,
        filing_date:       null,
        source_url:        gnwData.source_url,
      })
      process.stdout.write(`[GNW] `)
    }

    // ── Step 2: XBRL fallback (fills prior years + any company GNW missed) ──
    if (competitor.secCik) {
      await new Promise(r => setTimeout(r, 150))  // SEC rate limit
      const xbrlRows = await fetchXbrlFinancials(competitor).catch(() => null)

      if (xbrlRows) {
        for (const row of xbrlRows) {
          // If GNW already covered this year, skip (GNW is more accurate)
          if (gnwData && row.fiscal_year === TARGET_YEAR) continue
          upserts.push({
            competitor_id:     id,
            fiscal_year:       row.fiscal_year,
            total_revenue_raw: row.total_revenue_raw,
            total_revenue_usd: row.total_revenue_usd,
            rd_expense_raw:    row.rd_expense_raw,
            rd_expense_usd:    row.rd_expense_usd,
            hae_revenue_usd:   null,
            currency:          row.currency,
            exchange_rate_usd: row.exchange_rate_usd,
            filing_date:       row.filing_date,
            source_url:        row.source_url,
          })
        }
        if (!gnwData) process.stdout.write(`[XBRL] `)
      }
    }

    if (!upserts.length) {
      console.log('— no data found')
      continue
    }

    const { error } = await supabase
      .from('financial_snapshots')
      .upsert(upserts, { onConflict: 'competitor_id,fiscal_year', ignoreDuplicates: false })

    if (error) {
      errors.push(`${name}: ${error.message}`)
      console.log(`❌  ${error.message}`)
    } else {
      inserted += upserts.length
      const latest = upserts[0]
      const revStr = latest.total_revenue_usd
        ? formatUSD(latest.total_revenue_usd)
        : latest.total_revenue_raw != null
          ? `${latest.total_revenue_raw.toLocaleString()} ${latest.currency}`
          : 'Pre-commercial ($0)'
      const rdStr = latest.rd_expense_usd ? formatUSD(latest.rd_expense_usd) : 'n/a'
      const haeStr = latest.hae_revenue_usd ? ` | HAE ${formatUSD(latest.hae_revenue_usd)}` : ''
      console.log(`✅  FY${latest.fiscal_year} rev ${revStr}, R&D ${rdStr}${haeStr} (${upserts.length} years)`)
    }

  } catch (e) {
    errors.push(`${name}: ${e.message}`)
    console.log(`❌  ${e.message}`)
  }

  await new Promise(r => setTimeout(r, 200))
}

// Report skipped (acquired) competitors
const acquired = competitors.filter(c => c.status === 'acquired')
if (acquired.length) {
  console.log('\n  Skipped (acquired companies — no independent filings):')
  for (const c of acquired) {
    console.log(`    • ${c.name} → acquired by ${c.acquiredBy} on ${c.acquisitionDate}`)
  }
}

console.log(`
─────────────────────────────────────────
  Competitors processed: ${withCik.length}
  Rows upserted:         ${inserted}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
