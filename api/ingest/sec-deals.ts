import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS     = 20_000
const LOOKBACK_DAYS  = 730
const EXCERPT_LEN    = 500

function createSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

function padCik(cik: string) { return cik.replace(/^0+/, '').padStart(10, '0') }
function unpadCik(cik: string) { return String(parseInt(cik, 10)) }

async function fetchJson(url: string) {
  const r = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': SEC_USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return r.ok ? r.text() : null
  } catch { return null }
}

function classifyItems(itemsStr: string): string | null {
  if (!itemsStr) return null
  const items = itemsStr.split(',').map(s => s.trim())
  if (items.some(i => ['1.01', '2.01'].includes(i))) return 'deal'
  if (items.includes('5.02'))                         return 'exec_change'
  if (items.includes('8.01'))                         return 'press_release'
  return null
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function extractExcerpt(text: string, itemNumber: string) {
  for (const pat of [`Item ${itemNumber}.`, `ITEM ${itemNumber}.`, `Item ${itemNumber} `]) {
    const idx = text.indexOf(pat)
    if (idx === -1) continue
    return text.slice(idx + pat.length + 10).trimStart().slice(0, EXCERPT_LEN).trim()
  }
  return text.slice(0, EXCERPT_LEN).trim()
}

function buildHeadline(excerpt: string) {
  const match = excerpt.match(/^([^.!?]{20,200}[.!?])/)
  return match ? match[1].trim() : excerpt.slice(0, 120).trim()
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
  const cutoffDate = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10)

  const errors: string[] = []
  let inserted = 0

  for (const competitor of withCik) {
    const padded   = padCik(competitor.secCik)
    const unpadded = unpadCik(competitor.secCik)
    try {
      const data = await fetchJson(`https://data.sec.gov/submissions/CIK${padded}.json`)
      const recent = data.filings?.recent ?? {}
      const { form = [], filingDate = [], primaryDocument = [], accessionNumber = [], items = [] } = recent

      for (let i = 0; i < form.length; i++) {
        if (form[i] !== '8-K' || filingDate[i] < cutoffDate) continue
        const signalType = classifyItems(items[i] ?? '')
        if (!signalType) continue

        const accession = accessionNumber[i]
        const accNodash = accession.replace(/-/g, '')
        const docUrl = `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${primaryDocument[i]}`

        let headline: string | null = null
        let bodyExcerpt: string | null = null
        const html = await fetchText(docUrl)
        if (html) {
          const text = stripHtml(html)
          const targetItem = (items[i] ?? '').split(',').map((s: string) => s.trim())
            .find((it: string) => ['1.01', '2.01', '5.02', '8.01'].includes(it)) ?? '1'
          bodyExcerpt = extractExcerpt(text, targetItem)
          headline    = buildHeadline(bodyExcerpt)
        }

        const { error } = await supabase.from('company_signals').upsert(
          {
            competitor_id:    competitor.id,
            signal_type:      signalType,
            date:             filingDate[i],
            headline,
            body_excerpt:     bodyExcerpt,
            items:            items[i] ?? '',
            source_url:       docUrl,
            accession_number: accession,
          },
          { onConflict: 'competitor_id,accession_number' }
        )
        if (error) errors.push(`${competitor.name} ${accession}: ${error.message}`)
        else inserted++
        await new Promise(r => setTimeout(r, 120))
      }
    } catch (e: any) {
      errors.push(`${competitor.name}: ${e.message}`)
    }
  }

  return res.status(200).json({
    competitors_processed: withCik.length,
    signals_inserted:      inserted,
    ...(errors.length && { errors }),
  })
}
