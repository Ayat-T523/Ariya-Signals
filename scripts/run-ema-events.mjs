/**
 * EMA regulatory calendar ingest — fetches committee meeting dates from the EMA
 * events RSS feed and upserts them to the regulatory_calendar table.
 *
 * Usage: node --env-file=.env.local scripts/run-ema-events.mjs
 *
 * Prerequisites:
 *   1. Run supabase/regulatory_calendar.sql in the Supabase SQL editor first.
 *   2. VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.
 *
 * Classifies events by committee name found in the title (CHMP, COMP, PRAC, etc.).
 * No disease-area filtering — all committee meetings are included.
 */

import { createClient } from '@supabase/supabase-js'

const EMA_RSS_URL  = 'https://www.ema.europa.eu/en/events.xml'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function classifyEventType(title = '') {
  const t = title.toUpperCase()
  if (t.includes('CHMP'))  return 'CHMP'
  if (t.includes('COMP'))  return 'COMP'
  if (t.includes('PRAC'))  return 'PRAC'
  if (t.includes('HMPC'))  return 'HMPC'
  if (t.includes('PDCO'))  return 'PDCO'
  if (t.includes('SCENIHR') || t.includes('SCCS')) return 'OTHER'
  return 'OTHER'
}

function parseIsoDate(raw) {
  if (!raw) return null
  try {
    const d = new Date(raw.trim())
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  } catch {
    return null
  }
}

function extractCdata(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
  if (m) return m[1].trim()
  const m2 = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))
  return m2 ? m2[1].trim() : null
}

// ── Fetch RSS ─────────────────────────────────────────────────────────────────

console.log(`Fetching ${EMA_RSS_URL} …`)
const res = await fetch(EMA_RSS_URL, { signal: AbortSignal.timeout(20_000) })
if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`)
  process.exit(1)
}
const xml = await res.text()

// ── Parse items ───────────────────────────────────────────────────────────────

const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1])
console.log(`Found ${itemBlocks.length} RSS items.`)

const rows = itemBlocks.flatMap(block => {
  const title   = extractCdata(block, 'title') ?? ''
  const link    = extractCdata(block, 'link')
  const pubDate = extractCdata(block, 'pubDate') ?? extractCdata(block, 'dc:date')

  const startDate = parseIsoDate(pubDate)
  if (!startDate) return []

  return [{
    event_type: classifyEventType(title),
    title:      title || null,
    start_date: startDate,
    end_date:   null,
    source_url: link ?? null,
  }]
})

if (!rows.length) {
  console.log('No parseable events found — check RSS format.')
  process.exit(0)
}

console.log(`Parsed ${rows.length} events (${new Set(rows.map(r => r.event_type)).size} types).`)

// ── Upsert ────────────────────────────────────────────────────────────────────

const { error } = await supabase
  .from('regulatory_calendar')
  .upsert(rows, { onConflict: 'event_type,start_date', ignoreDuplicates: true })

if (error) {
  console.error('Supabase upsert error:', error.message)
  process.exit(1)
}

console.log('Done.')
