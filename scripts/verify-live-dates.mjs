/**
 * verify-live-dates — extracts the published date from each IR article page and
 * compares it to the date stored in company_signals. Confirms the timeline-
 * critical date field is accurate.
 *
 * Usage: node --env-file=.env.local scripts/verify-live-dates.mjs
 */

import { fcScrape } from './lib/firecrawl.mjs'

const DATE_SCHEMA = {
  type: 'object',
  properties: {
    published_date: { type: 'string', description: 'The publication date of this press release exactly as shown on the page' },
    title:          { type: 'string', description: 'The headline of this press release exactly as shown' },
  },
  required: ['published_date'],
}

const CHECKS = [
  { url: 'https://ir.ionis.com/news-releases/news-release-details/dawnzeratm-donidalorsen-approved-european-union-hereditary', stored: '2026-01-11' },
  { url: 'https://ir.intelliatx.com/news-releases/news-release-details/intellia-therapeutics-reports-positive-phase-3-results', stored: '2026-04-26' },
  { url: 'https://ir.intelliatx.com/news-releases/news-release-details/intellia-therapeutics-reports-additional-positive-phase-3', stored: '2026-06-12' },
]

function toIso(raw) {
  if (!raw) return null
  const d = new Date(raw.trim())
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

for (const c of CHECKS) {
  const r = await fcScrape(c.url, { schema: DATE_SCHEMA, prompt: 'Extract the exact publication date and headline of this single press release.' })
  const raw = r.extract?.published_date ?? null
  const iso = toIso(raw)
  const match = iso === c.stored
  console.log(`\n${c.url.split('/').pop()}`)
  console.log(`   stored:    ${c.stored}`)
  console.log(`   live page: ${raw}  → ${iso ?? 'unparseable'}`)
  console.log(`   ${match ? '✅ MATCH' : '⚠️  MISMATCH — review'}`)
}
console.log()
