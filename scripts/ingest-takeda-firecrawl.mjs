/**
 * ingest-takeda-firecrawl — Phase 3: Takeda newsroom via Firecrawl.
 *
 * Scrapes takeda.com/en-us/newsroom/news-releases/ (static HTML — DNS-dead IR
 * domain was the previous blocker; the main newsroom is accessible).
 * Extracts HAE-relevant press releases (TAKHZYRO / lanadelumab / donidalorsen).
 *
 * Anti-hallucination: every extracted title is cross-validated against the raw
 * page markdown before writing. Titles not found in the markdown are rejected.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-takeda-firecrawl.mjs
 *   node --env-file=.env.local scripts/ingest-takeda-firecrawl.mjs --pages 5
 *   node --env-file=.env.local scripts/ingest-takeda-firecrawl.mjs --url "https://www.takeda.com/en-us/newsroom/news-releases/2025/" --pages 3
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
 */

import {
  createSupabaseClient,
  sha256,
  isDuplicate,
  writeIngestRun,
} from './lib/signal-gate.mjs'
import { fcScrape } from './lib/firecrawl.mjs'

const COMPETITOR_ID = 'takeda'
const DATA_SOURCE   = 'takeda_firecrawl'
const DEFAULT_URL   = 'https://www.takeda.com/en-us/newsroom/news-releases/'

const TAKEDA_HAE_TERMS = [
  'takhzyro', 'lanadelumab', 'donidalorsen', 'tak-661', 'tak661',
  'hereditary angioedema', 'hae', 'angioedema',
]

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if      (argv[i] === '--url')   out.url   = argv[++i]
    else if (argv[i] === '--pages') out.pages = argv[++i]
  }
  return out
}

const { url: urlArg, pages: pagesArg } = parseArgs(process.argv.slice(2))
const BASE_URL  = urlArg   ?? DEFAULT_URL
const MAX_PAGES = pagesArg ? Math.max(1, parseInt(pagesArg, 10)) : 5

// ── Extraction schema ─────────────────────────────────────────────────────────

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    articles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:   { type: 'string', description: 'Exact press release headline as it appears on the page — do not paraphrase' },
          date:    { type: 'string', description: 'Publication date exactly as shown on the page' },
          summary: { type: 'string', description: 'Teaser or body text shown for this release' },
          url:     { type: 'string', description: 'Full absolute URL to the press release' },
        },
        required: ['title'],
      },
    },
  },
  required: ['articles'],
}

const EXTRACT_PROMPT =
  'Extract all press releases and news articles listed on this page. ' +
  'Copy each title EXACTLY as it appears — do not paraphrase, summarise, or invent titles. ' +
  'Focus especially on articles mentioning: ' +
  'TAKHZYRO, lanadelumab, donidalorsen, TAK-661, ' +
  'hereditary angioedema, HAE, rare blood disorders, or angioedema. ' +
  'Include the exact publication date and full article URL for each item.'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isHaeRelevant(text) {
  const lower = text.toLowerCase()
  return TAKEDA_HAE_TERMS.some(t => lower.includes(t))
}

function parseDate(raw) {
  if (!raw) return null
  const d = new Date(raw.trim())
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  const m = raw.match(/(\w+\s+\d{1,2},?\s*\d{4})/)
  if (m) {
    const d2 = new Date(m[1])
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10)
  }
  return null
}

function classifySignalType(text) {
  const lower = text.toLowerCase()
  if (/(deal|collaborat|licens|acqui|partner|agreement)/.test(lower)) return 'deal'
  if (/(fda|ema|approv|cleared|authoris|pdufa|nda|bla|maa|granted|rejected)/.test(lower)) return 'regulatory_catalyst'
  return 'press_release'
}

function titleInMarkdown(title, markdown) {
  if (!markdown || !title) return false
  const words = title.trim().split(/\s+/).slice(0, 10).join(' ')
  return markdown.toLowerCase().includes(words.toLowerCase())
}

function buildPageUrl(base, page) {
  if (page === 1) return base
  // Try Takeda's pagination — append page number as query param
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}page=${page}`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── Takeda ingest (Firecrawl) ───────────────────────────────`)
  console.log(`   url:   ${BASE_URL}`)
  console.log(`   pages: ${MAX_PAGES}\n`)

  const supabase = createSupabaseClient()

  let written      = 0
  let skipped      = 0
  let hallucinated = 0
  let errors       = 0
  let total        = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = buildPageUrl(BASE_URL, page)
    console.log(`── Page ${page}/${MAX_PAGES}: ${pageUrl}`)

    let result
    try {
      result = await fcScrape(pageUrl, { schema: ARTICLE_SCHEMA, prompt: EXTRACT_PROMPT })
    } catch (err) {
      console.error(`  ❌  Firecrawl error: ${err.message}`)
      errors++
      continue
    }

    const articles = result.extract?.articles ?? []
    const markdown = result.markdown ?? ''
    console.log(`   Firecrawl returned ${articles.length} article(s) | markdown: ${markdown.length} chars`)

    if (articles.length === 0 || markdown.length < 100) {
      console.log(`   No content on page ${page} — stopping.\n`)
      break
    }

    const beforeWritten = written

    for (const article of articles) {
      const title   = (article.title   ?? '').trim()
      const summary = (article.summary ?? '').trim()
      if (!title) { skipped++; continue }

      // Anti-hallucination: title must appear literally in the raw markdown
      if (!titleInMarkdown(title, markdown)) {
        console.log(`  🚫  [hallucinated] ${title.slice(0, 70)}`)
        hallucinated++
        continue
      }

      // Relevance gate — HAE-specific only
      if (!isHaeRelevant(`${title} ${summary}`)) { skipped++; continue }

      const date       = parseDate(article.date)
      const sourceUrl  = article.url
        ? (article.url.startsWith('http') ? article.url : `https://www.takeda.com${article.url}`)
        : pageUrl
      const signalType = classifySignalType(`${title} ${summary}`)
      const sourceHash = sha256(`${COMPETITOR_ID}|${title.slice(0, 80)}|${date ?? ''}`)

      if (await isDuplicate(supabase, sourceHash)) { skipped++; continue }

      const { error } = await supabase.from('company_signals').insert({
        competitor_id: COMPETITOR_ID,
        signal_type:   signalType,
        headline:      title.slice(0, 500),
        body_excerpt:  summary.slice(0, 400),
        date,
        source_url:    sourceUrl,
        source_hash:   sourceHash,
        data_source:   DATA_SOURCE,
      })

      if (error) {
        console.error(`  ❌  insert failed: ${error.message}`)
        errors++
      } else {
        written++
        console.log(`  ✅  [${signalType}] ${title.slice(0, 70)}`)
      }
    }

    total += articles.length
    console.log(`   New this page: ${written - beforeWritten} | hallucinated: ${hallucinated}\n`)

    if (written - beforeWritten === 0 && page > 1) {
      console.log('No new signals — pagination complete.\n')
      break
    }
  }

  console.log('── Summary ────────────────────────────────────────────────')
  console.log(`Total articles seen:         ${total}`)
  console.log(`Signals written (new):       ${written}`)
  console.log(`Hallucinated (rejected):     ${hallucinated}`)
  console.log(`Skipped (dup/irrel):         ${skipped}`)
  console.log(`Errors:                      ${errors}`)
  console.log('────────────────────────────────────────────────────────────\n')

  await writeIngestRun(supabase, {
    source:     DATA_SOURCE,
    newSignals: written,
    skipped:    skipped + hallucinated,
    errors,
    notes:      `${BASE_URL} (${MAX_PAGES} pages)`,
  })
  console.log('ingest_runs row written.\n')
}

main().catch(err => {
  console.error(`\n❌  ${err.message}\n`)
  process.exit(1)
})
