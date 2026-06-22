import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS     = 30_000

const REVENUE_CONCEPTS = {
  'us-gaap': [
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'RevenueFromProductSales',
  ],
  'ifrs-full': ['Revenue', 'RevenueFromContractsWithCustomers'],
}
const RD_CONCEPTS = {
  'us-gaap':   ['ResearchAndDevelopmentExpense'],
  'ifrs-full': ['ResearchAndDevelopmentExpense'],
}

const EXCHANGE_RATES: Record<string, Record<number, number>> = {
  JPY: { 2025: 153.8, 2024: 149.8, 2023: 134.4, 2022: 131.5, 2021: 109.8 },
  EUR: { 2025: 1.072, 2024: 1.082, 2023: 1.081, 2022: 1.053, 2021: 1.183 },
  GBP: { 2025: 1.272, 2024: 1.269, 2023: 1.244, 2022: 1.237, 2021: 1.375 },
}

function createSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

function padCik(cik: string) {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

async function fetchJson(url: string) {
  const r = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

function extractFyValues(facts: any, taxonomy: string, concepts: string[]) {
  const ns = facts[taxonomy]
  if (!ns) return []
  for (const concept of concepts) {
    const info = ns[concept]
    if (!info) continue
    const units = info.units ?? {}
    const unitKey = Object.keys(units)[0]
    if (!unitKey) continue
    const records: any[] = units[unitKey]
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

function toUSD(value: number | null, currency: string, fy: number): number | null {
  if (!value) return null
  if (currency === 'USD') return value
  const rates = EXCHANGE_RATES[currency]
  if (!rates) return null
  const rate = rates[fy] ?? Object.values(rates).at(-1)
  return Math.round(value / (rate as number))
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.headers['x-ingest-secret'] !== process.env.INGEST_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let supabase: ReturnType<typeof createSupabaseAdmin>
  try { supabase = createSupabaseAdmin() } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }

  const competitors: any[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/competitors.json'), 'utf-8')
  )
  const withCik = competitors.filter(c => c.secCik)

  const errors: string[] = []
  let inserted = 0

  for (const competitor of withCik) {
    const padded = padCik(competitor.secCik)
    try {
      const data = await fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`)
      const facts = data.facts ?? {}
      const taxonomy = facts['ifrs-full'] ? 'ifrs-full' : 'us-gaap'
      const revRows = extractFyValues(facts, taxonomy, REVENUE_CONCEPTS[taxonomy])
      const rdRows  = extractFyValues(facts, taxonomy, RD_CONCEPTS[taxonomy])
      const years = new Set([...revRows.map(r => r.fy), ...rdRows.map(r => r.fy)])
      const revByYear = new Map(revRows.map(r => [r.fy, r]))
      const rdByYear  = new Map(rdRows.map(r  => [r.fy, r]))
      const sortedYears = [...years].sort((a, b) => (b as number) - (a as number)).slice(0, 3)
      const upserts = sortedYears.map(fy => {
        const rev = revByYear.get(fy)
        const rd  = rdByYear.get(fy)
        const currency = (rev?.currency ?? rd?.currency ?? 'USD') as string
        const exchangeRate = currency !== 'USD' ? (EXCHANGE_RATES[currency]?.[fy as number] ?? null) : null
        return {
          competitor_id:     competitor.id,
          fiscal_year:       fy,
          total_revenue_raw: rev?.value ?? null,
          total_revenue_usd: toUSD(rev?.value ?? null, currency, fy as number),
          currency,
          rd_expense_raw:    rd?.value ?? null,
          rd_expense_usd:    toUSD(rd?.value ?? null, currency, fy as number),
          exchange_rate_usd: exchangeRate,
          filing_date:       rev?.filedDate ?? rd?.filedDate ?? null,
          source_url:        `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`,
        }
      })
      const { error } = await supabase
        .from('financial_snapshots')
        .upsert(upserts, { onConflict: 'competitor_id,fiscal_year' })
      if (error) errors.push(`${competitor.name}: ${error.message}`)
      else inserted += upserts.length
    } catch (e: any) {
      errors.push(`${competitor.name}: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 150))
  }

  return res.status(200).json({
    competitors_processed: withCik.length,
    rows_upserted:         inserted,
    ...(errors.length && { errors }),
  })
}
