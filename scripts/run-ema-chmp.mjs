/**
 * Name: run-ema-chmp
 * Description: Scrapes CHMP plenary meeting dates from the EMA website and upserts
 *   upcoming sessions into the regulatory_calendar table (event_type = 'CHMP').
 *   The EMA RSS feed (used by run-ema-events.mjs) does NOT include CHMP meetings —
 *   they are published as individual event pages linked from the CHMP meetings page.
 *
 * Source: https://www.ema.europa.eu/en/committees/chmp/chmp-meetings
 *
 * Strategy: The CHMP meetings page lists each session as a link whose URL slug
 * contains the date range, e.g.:
 *   /en/events/committee-medicinal-products-human-use-chmp-22-25-june-2026
 * Dates are parsed directly from the slug — no fragile HTML table parsing needed.
 *
 * Usage: node --env-file=.env.local scripts/run-ema-chmp.mjs
 *
 * Prerequisites: regulatory_calendar table must exist (supabase/regulatory_calendar.sql).
 * The UNIQUE constraint on (event_type, start_date) is already in the table DDL.
 */

import { createClient } from '@supabase/supabase-js'

const CHMP_URL    = 'https://www.ema.europa.eu/en/committees/committee-medicinal-products-human-use-chmp'
const BASE_URL    = 'https://www.ema.europa.eu'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/run-ema-chmp.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Date parsing ──────────────────────────────────────────────────────────────

const MONTH_MAP = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
}

function isoDate(day, monthStr, year) {
  const m = MONTH_MAP[monthStr.toLowerCase()]
  if (!m || !year) return null
  return `${year}-${String(m).padStart(2, '0')}-${String(+day).padStart(2, '0')}`
}

// Parses dates from a CHMP event URL slug.
// EMA URL pattern: /en/events/committee-medicinal-products-human-use-chmp-{start}-{end}-{month}-{year}
// Examples:
//   chmp-22-25-june-2026    → start=2026-06-22, end=2026-06-25
//   chmp-14-17-september-2026
// All CHMP plenary meetings run within the same calendar month (Mon–Thu).
function parseSampeMonthSlug(slug) {
  // Extract the date suffix after the last occurrence of "chmp-"
  const chmpIdx = slug.lastIndexOf('chmp-')
  if (chmpIdx === -1) return null
  const datePart = slug.slice(chmpIdx + 5)  // e.g. "22-25-june-2026"

  const m = datePart.match(/^(\d{1,2})-(\d{1,2})-([a-z]+)-(\d{4})/)
  if (!m) return null
  const [, startDay, endDay, monthStr, year] = m
  const start = isoDate(startDay, monthStr, year)
  const end   = isoDate(endDay,   monthStr, year)
  if (!start || !end) return null
  return { start, end }
}

// Build a human-readable title from the start date
function buildTitle(startIso) {
  const d = new Date(startIso + 'T12:00:00Z')
  const month = d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  const year  = d.getUTCFullYear()
  return `CHMP Plenary Meeting — ${month} ${year}`
}

// ── Fetch page ────────────────────────────────────────────────────────────────

console.log(`\n🔄  Fetching EMA CHMP meeting schedule…\n    ${CHMP_URL}\n`)

const res = await fetch(CHMP_URL, {
  headers: {
    'User-Agent': 'AriyaSignals/1.0 (ayat.tayebulla@phamax.ch; competitive intelligence research)',
    'Accept': 'text/html,application/xhtml+xml',
  },
  signal: AbortSignal.timeout(30_000),
})

if (!res.ok) {
  console.error(`❌  HTTP ${res.status} ${res.statusText}`)
  process.exit(1)
}

const html = await res.text()
console.log(`    Fetched ${(html.length / 1024).toFixed(0)} KB of HTML`)

// ── Extract event links ───────────────────────────────────────────────────────

// EMA publishes each CHMP session as a distinct event page; the date range is
// embedded in the URL slug. Match all CHMP-specific event hrefs.
const EVENT_RE = /href="(\/en\/events\/committee-medicinal-products-human-use-chmp-[^"]+)"/g
const slugs = [...html.matchAll(EVENT_RE)].map(m => m[1])

console.log(`    Found ${slugs.length} CHMP event link(s)`)

const today = new Date().toISOString().slice(0, 10)
const rows  = []
const seen  = new Set()

for (const slug of slugs) {
  const range = parseSampeMonthSlug(slug)
  if (!range) {
    console.log(`    ⚠️  Could not parse dates from: ${slug}`)
    continue
  }
  if (seen.has(range.start)) continue  // dedupe same-day duplicates

  // Only ingest future or current meetings (include today)
  if (range.start < today) continue

  seen.add(range.start)
  rows.push({
    event_type: 'CHMP',
    title:      buildTitle(range.start),
    start_date: range.start,
    end_date:   range.end,
    source_url: `${BASE_URL}${slug}`,
  })
}

if (!rows.length) {
  console.log('\n⚠️  No future CHMP meeting dates found on the page.')
  console.log('   The EMA may not have published upcoming session dates yet.')
  console.log(`   Check manually at: ${CHMP_URL}`)
  process.exit(0)
}

rows.sort((a, b) => a.start_date.localeCompare(b.start_date))

console.log(`\n📅  ${rows.length} future CHMP meetings parsed:\n`)
rows.forEach(r => console.log(`    ${r.start_date} → ${r.end_date}  ${r.title}`))
console.log()

// ── Upsert ────────────────────────────────────────────────────────────────────

const { error } = await supabase
  .from('regulatory_calendar')
  .upsert(rows, { onConflict: 'event_type,start_date', ignoreDuplicates: false })

if (error) {
  console.error('\n❌  Supabase upsert error:', error.message)
  process.exit(1)
}

console.log(`✅  ${rows.length} CHMP meetings upserted into regulatory_calendar.\n`)
