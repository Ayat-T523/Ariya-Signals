/**
 * ingest-ir-firecrawl — Phase 4: IR news pages via Firecrawl.
 *
 * Scrapes the IR news pages for BioCryst, Pharvaris, Ionis, and Intellia —
 * the same competitors covered by the ingest-ir-rss Edge Function, but using
 * Firecrawl to bypass the Akamai IPv6 blocks that cause RSS failures.
 *
 * source_hash uses the same formula as ir_rss (competitor_id|link|date) so
 * rows dedup cleanly against any articles already ingested via RSS.
 *
 * Anti-hallucination: extracted titles are cross-validated against raw markdown.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-ir-firecrawl.mjs
 *   node --env-file=.env.local scripts/ingest-ir-firecrawl.mjs --competitor biocryst
 *   node --env-file=.env.local scripts/ingest-ir-firecrawl.mjs --pages 3
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

const DATA_SOURCE = 'ir_firecrawl'

// ── Competitor registry ───────────────────────────────────────────────────────
// Mirrors the feed registry in ingest-ir-rss/index.ts with news-page URLs.
// haeTerms: terms that make a press release relevant to the HAE portfolio.

const TARGETS = [
  {
    competitor_id: 'biocryst',
    newsUrl:  'https://ir.biocryst.com/news-releases',
    haeTerms: [
      'berotralstat', 'orladeyo', 'navenibart', 'bcx9930', 'bcx10013',
      'hereditary angioedema', 'hae', 'angioedema', 'plasma kallikrein',
    ],
  },
  {
    competitor_id: 'pharvaris',
    newsUrl:  'https://ir.pharvaris.com/news-releases',
    haeTerms: [
      'phvs416', 'deucrictibant', 'ph94b', 'bradykinin',
      'hereditary angioedema', 'hae', 'angioedema',
    ],
  },
  {
    competitor_id: 'ionis',
    newsUrl:  'https://ir.ionis.com/news-releases',
    haeTerms: [
      'ionis-pkk', 'isis-pkkrx', 'donidalorsen', 'eplontersen',
      'hereditary angioedema', 'hae', 'plasma kallikrein', 'angioedema',
    ],
  },
  {
    competitor_id: 'intellia',
    newsUrl:  'https://ir.intelliatx.com/news-releases',
    haeTerms: [
      'ntla-2002', 'crispr', 'gene editing', 'complement',
      'hereditary angioedema', 'hae', 'angioedema',
    ],
  },
]

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if      (argv[i] === '--competitor') out.competitor = argv[++i]
    else if (argv[i] === '--pages')      out.pages      = argv[++i]
  }
  return out
}

const { competitor: competitorArg, pages: pagesArg } = parseArgs(process.argv.slice(2))
const MAX_PAGES = pagesArg ? Math.max(1, parseInt(pagesArg, 10)) : 2

const targets = competitorArg
  ? TARGETS.filter(t => t.competitor_id === competitorArg)
  : TARGETS

if (targets.length === 0) {
  console.error(`❌  Unknown competitor "${competitorArg}". Valid: ${TARGETS.map(t => t.competitor_id).join(', ')}`)
  process.exit(1)
}

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
          date:    { type: 'string', description: 'Publication date exactly as shown' },
          summary: { type: 'string', description: 'Teaser or description text for the article' },
          url:     { type: 'string', description: 'Full URL to the press release article' },
        },
        required: ['title'],
      },
    },
  },
  required: ['articles'],
}

function buildPrompt(haeTerms) {
  return (
    'Extract all press releases listed on this page. ' +
    'Copy each title EXACTLY as shown — do not paraphrase or invent. ' +
    `Focus on articles mentioning: ${haeTerms.slice(0, 6).join(', ')}. ` +
    'Include the exact publication date and full article URL for each.'
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRelevant(text, haeTerms) {
  const lower = text.toLowerCase()
  return haeTerms.some(t => lower.includes(t))
}

function classifySignalType(text) {
  const lower = text.toLowerCase()
  if (/(deal|collaborat|licens|acqui|partner|agreement)/.test(lower)) return 'deal'
  if (/(fda|ema|approv|cleared|authoris|pdufa|nda|bla|maa|granted)/.test(lower)) return 'regulatory_catalyst'
  return 'press_release'
}

function titleInMarkdown(title, markdown) {
  if (!markdown || !title) return false
  const words = title.trim().split(/\s+/).slice(0, 10).join(' ')
  return markdown.toLowerCase().includes(words.toLowerCase())
}

function resolveUrl(raw, baseUrl) {
  if (!raw) return baseUrl
  if (raw.startsWith('http')) return raw
  try {
    return new URL(raw, baseUrl).href
  } catch {
    return baseUrl
  }
}

// ── Per-target ingest ─────────────────────────────────────────────────────────

async function ingestTarget(supabase, target) {
  const { competitor_id, newsUrl, haeTerms } = target
  const prompt = buildPrompt(haeTerms)

  console.log(`\n── ${competitor_id.toUpperCase()} — ${newsUrl}`)

  let written      = 0
  let skipped      = 0
  let hallucinated = 0
  let errors       = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const sep     = newsUrl.includes('?') ? '&' : '?'
    const pageUrl = page === 1 ? newsUrl : `${newsUrl}${sep}page=${page}`
    console.log(`   Page ${page}: ${pageUrl}`)

    let result
    try {
      result = await fcScrape(pageUrl, { schema: ARTICLE_SCHEMA, prompt })
    } catch (err) {
      console.error(`   ❌  Firecrawl error: ${err.message}`)
      errors++
      continue
    }

    const articles = result.extract?.articles ?? []
    const markdown = result.markdown ?? ''
    console.log(`   ${articles.length} article(s) | markdown: ${markdown.length} chars`)

    if (articles.length === 0 || markdown.length < 100) {
      console.log(`   No content — stopping for ${competitor_id}.`)
      break
    }

    const beforeWritten = written

    for (const article of articles) {
      const title   = (article.title   ?? '').trim()
      const summary = (article.summary ?? '').trim()
      if (!title) { skipped++; continue }

      // Anti-hallucination guard
      if (!titleInMarkdown(title, markdown)) {
        console.log(`   🚫  [hallucinated] ${title.slice(0, 70)}`)
        hallucinated++
        continue
      }

      // Relevance gate
      if (!isRelevant(`${title} ${summary}`, haeTerms)) { skipped++; continue }

      const date       = parseSignalDate(article.date)
      const sourceUrl  = resolveUrl(article.url, pageUrl)
      const signalType = classifySignalType(`${title} ${summary}`)

      // Use same hash formula as ir_rss for cross-dedup compatibility
      const sourceHash = sha256(`${competitor_id}|${sourceUrl}|${date ?? ''}`)

      if (await isDuplicate(supabase, sourceHash)) { skipped++; continue }

      const { error } = await supabase.from('company_signals').insert({
        competitor_id,
        signal_type:  signalType,
        headline:     title.slice(0, 500),
        body_excerpt: summary.slice(0, 400),
        date,
        source_url:   sourceUrl,
        source_hash:  sourceHash,
        data_source:  DATA_SOURCE,
      })

      if (error) {
        console.error(`   ❌  insert failed: ${error.message}`)
        errors++
      } else {
        written++
        console.log(`   ✅  [${signalType}] ${title.slice(0, 65)}`)
      }
    }

    if (written - beforeWritten === 0 && page > 1) break
  }

  console.log(`   → written: ${written} | skipped: ${skipped} | hallucinated: ${hallucinated} | errors: ${errors}`)
  return { written, skipped: skipped + hallucinated, errors }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── IR ingest (Firecrawl) — ${targets.map(t => t.competitor_id).join(', ')} ──`)
  console.log(`   pages per target: ${MAX_PAGES}\n`)

  const supabase = createSupabaseClient()

  let totalWritten = 0
  let totalSkipped = 0
  let totalErrors  = 0

  for (const target of targets) {
    const { written, skipped, errors } = await ingestTarget(supabase, target)
    totalWritten += written
    totalSkipped += skipped
    totalErrors  += errors

    await writeIngestRun(supabase, {
      source:     DATA_SOURCE,
      newSignals: written,
      skipped,
      errors,
      notes:      target.competitor_id,
    })
  }

  console.log('\n── Final Summary ─────────────────────────────────────────')
  console.log(`Targets run:       ${targets.length}`)
  console.log(`Signals written:   ${totalWritten}`)
  console.log(`Skipped:           ${totalSkipped}`)
  console.log(`Errors:            ${totalErrors}`)
  console.log('──────────────────────────────────────────────────────────\n')
}

main().catch(err => {
  console.error(`\n❌  ${err.message}\n`)
  process.exit(1)
})
