/**
 * ingest-ir-rss — Supabase Edge Function (Deno)
 *
 * Polls competitor IR press release RSS feeds daily (4 targets) and writes
 * new press releases to company_signals (signal_type = 'press_release',
 * data_source = 'ir_rss').
 *
 * source_hash = SHA-256(competitor_id + '|' + link + '|' + date_only)
 * Feeds that fail HTTP fetch are recorded in ingest_errors with a
 * consecutive_failures counter for persistent-failure detection.
 *
 * Scheduled: 0 6 * * * (06:00 UTC daily) via pg_cron.
 * Deploy:    supabase functions deploy ingest-ir-rss
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Feed registry ─────────────────────────────────────────────────────────────
//
// competitor_id values match the string keys in src/data/competitors.json.
// No 'competitors' table exists in Supabase — IDs are managed in the JSON file.
//
// Excluded:
//   takeda      — Foreign private issuer (TSE/NYSE ADR, CIK 0001395064). Neither
//                 ir.takeda.com nor investor.takeda.com resolve via DNS. Takeda's US
//                 press releases are distributed via GlobeNewswire / Business Wire from
//                 www.takeda.com/en-us/newsroom. Pending correct IR RSS URL discovery.
//   adverum     — ir.adverum.com DNS failure (domain does not resolve). Adverum's HAE
//                 program is preclinical (IND target 2027), one of several indications.
//                 Omitted pending correct IR domain confirmation.
//   csl-behring — ASX-listed; secCik=null; irScrapeUrl uses ASX announcements page
//                 (no public Q4 IR RSS feed)
//   astria      — acquired by BioCryst on 2026-01-23; omitted

interface Feed {
  competitor_id: string
  rss_url:       string
}

const FEEDS: Feed[] = [
  {
    competitor_id: 'biocryst',
    // Q4 IR platform. URL confirmed from ir.biocryst.com/ir-resources/rss-news-feeds page source.
    // Note: Akamai CDN may reject Supabase IPv6 range with HTTP/2 stream errors on some requests.
    // Feed failures are routed to ingest_errors — existing signals in DB are preserved.
    rss_url: 'https://ir.biocryst.com/rss/news-releases.xml',
  },
  {
    competitor_id: 'pharvaris',
    // Direct IR site — not on Q4/West platform. Standard path inferred.
    // GlobeNewswire /RssFeed/company/Pharvaris returned HTTP 400 in prior testing.
    rss_url: 'https://ir.pharvaris.com/rss/news-releases.xml',
  },
  {
    competitor_id: 'ionis',
    // Q4 IR platform. URL confirmed (.xml extension required).
    // Akamai CDN consistently rejects Supabase IPv6 range — expect ingest_errors entries.
    rss_url: 'https://ir.ionis.com/rss/news-releases.xml',
  },
  {
    competitor_id: 'intellia',
    // Q4 IR platform. ir.intelliatx.com confirmed reachable; Akamai CDN may intermittently
    // reject Supabase IPv6 — failures are routed to ingest_errors with consecutive_failures counter.
    rss_url: 'https://ir.intelliatx.com/rss/news-releases.xml',
  },
]

// ── Constants ─────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS    = 8        // per spec: 8-day rolling window
const FETCH_TIMEOUT_MS = 10_000   // per spec: 10-second timeout per feed
const DATA_SOURCE      = 'ir_rss'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface FeedItem {
  title:       string
  link:        string
  description: string
  pubDate:     string | null
}

function extractCdata(raw: string): string {
  const m = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
  return m ? m[1].trim() : raw.trim()
}

function innerText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? extractCdata(m[1]) : ''
}

function linkHref(block: string): string {
  const m = block.match(/<link[^>]+href="([^"]+)"/)
  return m ? m[1] : ''
}

/** Parses RSS 2.0 (<item>) and Atom 1.0 (<entry>) feeds. */
function parseFeed(xml: string): FeedItem[] {
  const isAtom   = /<feed[\s>]/.test(xml)
  const blockTag = isAtom ? 'entry' : 'item'
  const re       = new RegExp(`<${blockTag}>[\\s\\S]*?<\\/${blockTag}>`, 'g')
  const items: FeedItem[] = []

  for (const match of xml.matchAll(re)) {
    const block = match[0]

    const title = innerText(block, 'title')

    const link = isAtom
      ? (linkHref(block) || innerText(block, 'link'))
      : innerText(block, 'link')

    const description =
      innerText(block, isAtom ? 'summary' : 'description') ||
      innerText(block, 'content')

    const pubDate =
      innerText(block, isAtom ? 'updated' : 'pubDate') ||
      innerText(block, 'published') || null

    if (title && link) items.push({ title, link, description, pubDate })
  }

  return items
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseDateOnly(raw: string | null): string | null {
  if (!raw) return null
  try {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  } catch { return null }
}

// ── ingest_errors handler ─────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleFeedError(supabase: any, competitorId: string, errorMessage: string): Promise<void> {
  // Calls upsert_ingest_error() SQL function (defined in supabase/seeds/ingest_errors.sql).
  // Creates the row on first failure; increments consecutive_failures on subsequent ones.
  const { error } = await supabase.rpc('upsert_ingest_error', {
    p_source:        DATA_SOURCE,
    p_competitor_id: competitorId,
    p_error_message: errorMessage,
  })
  if (error) {
    console.error(`[handleFeedError] rpc error for ${competitorId}: ${error.message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // F. Record run start
  const { data: runRow } = await supabase
    .from('ingest_runs')
    .insert({ source: DATA_SOURCE, status: 'running' })
    .select('id')
    .single()
  const runId: string | null = runRow?.id ?? null

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)

  let totalNew      = 0
  let totalSkipped  = 0
  const errorLog: string[] = []

  // Force HTTP/1.1 to work around Q4/Akamai CDN rejection of HTTP/2 from Supabase IPv6
  // deno-lint-ignore no-explicit-any
  const httpClient = (Deno as any).createHttpClient?.({ http1Only: true })

  for (const feed of FEEDS) {
    // A. Fetch RSS with timeout
    let res: Response
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        res = await fetch(feed.rss_url, {
          // deno-lint-ignore no-explicit-any
          ...(httpClient ? { client: httpClient } : {}),
          signal:  controller.signal,
          headers: {
            'User-Agent': 'AriyaSignals ayat.tayebulla@phamax.ch',
            'Accept':     'application/rss+xml, application/xml, text/xml, */*',
          },
        })
      } finally {
        clearTimeout(timer)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${feed.competitor_id}] fetch error: ${msg}`)
      await handleFeedError(supabase, feed.competitor_id, msg)
      errorLog.push(`${feed.competitor_id}: ${msg}`)
      await sleep(1000)
      continue
    }

    if (!res.ok) {
      const msg = `HTTP ${res.status} ${res.statusText}`
      console.warn(`[${feed.competitor_id}] ${msg}`)
      await handleFeedError(supabase, feed.competitor_id, msg)
      errorLog.push(`${feed.competitor_id}: ${msg}`)
      await sleep(1000)
      continue
    }

    // B. Parse XML
    const xml   = await res.text()
    const items = parseFeed(xml)

    if (items.length === 0) {
      console.warn(`[${feed.competitor_id}] No items parsed — feed may be empty or format unrecognised`)
      await sleep(1000)
      continue
    }

    console.log(`[${feed.competitor_id}] ${items.length} items in feed`)
    let feedNew     = 0
    let feedSkipped = 0

    for (const item of items) {
      // C. Skip items outside the 8-day lookback window
      if (item.pubDate) {
        const d = new Date(item.pubDate)
        if (!isNaN(d.getTime()) && d < cutoff) {
          feedSkipped++
          continue
        }
      }

      // D.i. source_hash = SHA-256(competitor_id + '|' + link + '|' + date_only)
      const dateOnly   = parseDateOnly(item.pubDate) ?? new Date().toISOString().slice(0, 10)
      const hashInput  = `${feed.competitor_id}|${item.link}|${dateOnly}`
      const sourceHash = await sha256(hashInput)

      // Dedup check — equivalent to ON CONFLICT (source_hash) DO NOTHING
      const { count } = await supabase
        .from('company_signals')
        .select('id', { count: 'exact', head: true })
        .eq('source_hash', sourceHash)

      if ((count ?? 0) > 0) {
        feedSkipped++
        continue
      }

      // D.ii–iii. Map and insert
      const headline    = item.title.slice(0, 500)
      const bodyExcerpt = stripHtml(item.description).slice(0, 400)

      const { error: insertErr } = await supabase.from('company_signals').insert({
        competitor_id: feed.competitor_id,
        signal_type:   'press_release',
        headline,
        body_excerpt:  bodyExcerpt,
        date:          dateOnly,
        source_url:    item.link,
        source_hash:   sourceHash,
        data_source:   DATA_SOURCE,
      })

      if (insertErr) {
        console.error(`[${feed.competitor_id}] insert error: ${insertErr.message}`)
        errorLog.push(`${feed.competitor_id}: insert — ${insertErr.message}`)
        feedSkipped++
      } else {
        feedNew++
        totalNew++
        console.log(`[${feed.competitor_id}] + ${headline.slice(0, 80)}`)
      }

      await sleep(150)
    }

    totalSkipped += feedSkipped
    console.log(`[${feed.competitor_id}] done — ${feedNew} new, ${feedSkipped} skipped`)
    await sleep(800)
  }

  if (httpClient?.close) httpClient.close()

  // F. Update ingest_runs
  const feedErrorCount = errorLog.filter(e => !e.includes('insert —')).length
  const status =
    feedErrorCount === FEEDS.length  ? 'failed'  :
    feedErrorCount > 0 || totalSkipped > 0 ? 'partial' :
    'success'

  if (runId) {
    await supabase
      .from('ingest_runs')
      .update({
        status,
        new_signals: totalNew,
        skipped:     totalSkipped,
        errors:      errorLog,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
  }

  return new Response(
    JSON.stringify({ status, newSignals: totalNew, skipped: totalSkipped, errors: errorLog }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
