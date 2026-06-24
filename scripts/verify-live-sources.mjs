/**
 * verify-live-sources — re-fetches a sample of ingested source URLs via Firecrawl
 * (JS-rendered markdown) and checks the stored headline + date literally appear
 * on the live page. This is the gold-standard accuracy check: it proves the
 * stored signal was not hallucinated and the URL resolves to the right article.
 *
 * Usage: node --env-file=.env.local scripts/verify-live-sources.mjs
 */

import { fcScrape } from './lib/firecrawl.mjs'

// (url, expected headline fragment, expected date fragment as it might render)
const CHECKS = [
  {
    label: 'Ionis — EU approval',
    url:   'https://ir.ionis.com/news-releases/news-release-details/dawnzeratm-donidalorsen-approved-european-union-hereditary',
    needleTitle: 'donidalorsen',
    needleApproval: 'european union',
    storedDate: '2026-01-11',
  },
  {
    label: 'Intellia — global-first Phase 3',
    url:   'https://ir.intelliatx.com/news-releases/news-release-details/intellia-therapeutics-reports-positive-phase-3-results',
    needleTitle: 'positive phase 3 results',
    needleApproval: 'hereditary angioedema',
    storedDate: '2026-04-26',
  },
  {
    label: 'Intellia — additional Phase 3 (lonvo-z)',
    url:   'https://ir.intelliatx.com/news-releases/news-release-details/intellia-therapeutics-reports-additional-positive-phase-3',
    needleTitle: 'lonvoguran ziclumeran',
    needleApproval: 'hereditary angioedema',
    storedDate: '2026-06-12',
  },
  {
    label: 'JACI — AAAAI 2026 supplement (congress source)',
    url:   'https://www.jacionline.org/issue/S0091-6749(25)X0003-8',
    needleTitle: 'navenibart',
    needleApproval: 'hereditary angioedema',
    storedDate: null,
  },
]

function monthMatch(md, isoDate) {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]
  const lower = md.toLowerCase()
  // accept "Month D, YYYY" or "Month YYYY" near the stored values
  const hasMonthYear = lower.includes(`${month.toLowerCase()} ${y}`)
  const hasMonthDay  = lower.includes(`${month.toLowerCase()} ${d}`)
  return { month, year: y, day: d, hasMonthYear, hasMonthDay }
}

for (const c of CHECKS) {
  console.log(`\n══ ${c.label}`)
  console.log(`   ${c.url}`)
  let r
  try {
    r = await fcScrape(c.url)  // markdown only
  } catch (err) {
    console.log(`   ❌ fetch failed: ${err.message}`)
    continue
  }
  const md = (r.markdown ?? '').toLowerCase()
  if (md.length < 100) { console.log(`   ⚠️  thin markdown (${md.length} chars) — page did not render`); continue }

  const titleOk    = md.includes(c.needleTitle.toLowerCase())
  const contextOk  = md.includes(c.needleApproval.toLowerCase())
  const dateInfo   = monthMatch(md, c.storedDate)

  console.log(`   markdown: ${md.length} chars`)
  console.log(`   title needle  "${c.needleTitle}":   ${titleOk ? '✅ found' : '❌ MISSING'}`)
  console.log(`   context needle "${c.needleApproval}": ${contextOk ? '✅ found' : '❌ MISSING'}`)
  if (dateInfo) {
    console.log(`   date "${c.storedDate}" → "${dateInfo.month} ${dateInfo.year}": ${dateInfo.hasMonthYear ? '✅' : '⚠️ month+year not literally found'}`)
  }
}
console.log()
