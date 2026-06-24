/**
 * ingest-csl-firecrawl — Phase 2: CSL Behring newsroom via Firecrawl.
 *
 * Scrapes newsroom.csl.com (SPA — previously blocked by automated fetch).
 * Extracts HAE-relevant press releases (garadacimab / Andembry / HAEGARDA).
 * Complements run-csl-ir.mjs which covers FDA openFDA + EMA RSS.
 *
 * Anti-hallucination: every extracted title is cross-validated against the
 * raw markdown Firecrawl returns. If the title does not appear literally in
 * the page text, the row is rejected — it was invented by the LLM extractor.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-csl-firecrawl.mjs
 *   node --env-file=.env.local scripts/ingest-csl-firecrawl.mjs --pages 5
 *   node --env-file=.env.local scripts/ingest-csl-firecrawl.mjs --url "https://newsroom.csl.com/?s=hereditary+angioedema"
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
 */

import {
  createSupabaseClient,
  sha256,
  parseSignalDate,
  isDuplicate,
  writeIngestRun,
} from './lib/signal-gate.mjs'
import { fcScrape } from './lib/firecrawl.mjs'

const COMPETITOR_ID = 'csl-behring'
const DATA_SOURCE   = 'csl_firecrawl'
const DEFAULT_URL   = 'https://newsroom.csl.com/?s=hereditary+angioedema'

const CSL_HAE_TERMS = [
  'garadacimab', 'andembry', 'haegarda', 'hereditary angioedema',
  'hae', 'c1 esterase', 'kallikrein inhibitor', 'angioedema',
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
const MAX_PAGES = pagesArg ? Math.max(1, parseInt(pagesArg, 10)) : 3

// ── Extraction schema ─────────────────────────────────────────────────────────

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    articles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:   { type: 'string', description: 'Exact article headline as it appears on the page' },
          date:    { type: 'string', description: 'Publication date exactly as shown (e.g. "May 13, 2026")' },
          summary: { type: 'string', description: 'Teaser or body text for the article' },
          url:     { type: 'string', description: 'Full absolute URL to the article page' },
        },
        required: ['title'],
      },
    },
  },
  required: ['articles'],
}

const EXTRACT_PROMPT =
  'Extract all news articles listed on this page. ' +
  'Copy titles EXACTLY as they appear — do not paraphrase or invent. ' +
  'Only include articles whose titles or descriptions mention: ' +
  'garadacimab, Andembry, HAEGARDA, hereditary angioedema, HAE, ' +
  'C1 esterase inhibitor, or plasma-derived HAE therapy. ' +
  'Include the exact publication date and article URL for each.'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isHaeRelevant(text) {
  const lower = text.toLowerCase()
  return CSL_HAE_TERMS.some(t => lower.includes(t))
}

function classifySignalType(text) {
  const lower = text.toLowerCase()
  if (/(deal|collaborat|licens|acqui|partner|agreement)/.test(lower)) return 'deal'
  if (/(fda|ema|approv|cleared|authoris|pdufa|nda|bla|maa)/.test(lower))   return 'regulatory_catalyst'
  return 'press_release'
}

/**
 * Anti-hallucination guard.
 * Returns true if the title appears verbatim (case-insensitive) in the raw
 * page markdown. Rejects LLM-invented titles that were never on the page.
 */
function titleInMarkdown(title, markdown) {
  if (!markdown || !title) return false
  // Use a 10-word prefix match to handle minor truncation
  const words  = title.trim().split(/\s+/).slice(0, 10).join(' ')
  return markdown.toLowerCase().includes(words.toLowerCase())
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── CSL Behring ingest (Firecrawl) ─────────────────────────`)
  console.log(`   url:   ${BASE_URL}`)
  console.log(`   pages: ${MAX_PAGES}\n`)

  const supabase = createSupabaseClient()

  let written   = 0
  let skipped   = 0
  let hallucinated = 0
  let errors    = 0
  let total     = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = page === 1 ? BASE_URL : `${BASE_URL}&paged=${page}`
    console.log(`── Page ${page}/${MAX_PAGES}: ${pageUrl}`)

    let result
    try {
      result = await fcScrape(pageUrl, { schema: ARTICLE_SCHEMA, prompt: EXTRACT_PROMPT })
    } catch (err) {
      console.error(`  ❌  Firecrawl error: ${err.message}`)
      errors++
      continue
    }

    const articles  = result.extract?.articles ?? []
    const markdown  = result.markdown ?? ''
    console.log(`   Firecrawl returned ${articles.length} article(s) | markdown: ${markdown.length} chars`)

    if (articles.length === 0) {
      console.log(`   No articles — stopping.\n`)
      break
    }

    const beforeWritten = written

    for (const article of articles) {
      const title   = (article.title   ?? '').trim()
      const summary = (article.summary ?? '').trim()
      if (!title) { skipped++; continue }

      // Anti-hallucination: title must exist in the real page markdown
      if (!titleInMarkdown(title, markdown)) {
        console.log(`  🚫  [hallucinated] ${title.slice(0, 70)}`)
        hallucinated++
        continue
      }

      // Relevance gate
      const fullText = [title, summary].join(' ')
      if (!isHaeRelevant(fullText)) { skipped++; continue }

      const date       = parseSignalDate(article.date)
      const sourceUrl  = article.url ?? pageUrl
      const signalType = classifySignalType(fullText)
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
    console.log(`   New signals this page: ${written - beforeWritten} | hallucinated: ${hallucinated}\n`)

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
