/**
 * ingest-congress-firecrawl — Phase 1 congress abstract ingest via Firecrawl.
 *
 * Replaces ingest-congress-abstract.mjs (DIY pdf-parse + regex approach).
 * Uses Firecrawl's LLM-guided JSON extraction — no regex splitting, no PDF download.
 * Works on both HTML supplement pages (JACI/jacionline.org) and web-hosted PDFs.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-congress-firecrawl.mjs \
 *     --congress "AAAAI 2026" \
 *     --url "https://www.jacionline.org/issue/S0091-6749(25)X0003-8" \
 *     --date "2026-02-28" \
 *     --pages 50
 *
 * --pages N  (default 1): scrape N pages using ?page=2, ?page=3 … pagination.
 * Stops early if a page returns zero new abstracts (dedup + empty = done).
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
 *
 * After verifying output, clean up the 33 DIY test rows with:
 *   -- Name: delete_congress_pdf_test_rows
 *   DELETE FROM company_signals WHERE data_source = 'congress_pdf';
 */

import {
  createSupabaseClient,
  sha256,
  loadLexicon,
  resolveCompetitor,
  classifySeverity,
  isDuplicate,
  writeIngestRun,
} from './lib/signal-gate.mjs'
import { fcScrape } from './lib/firecrawl.mjs'

const SIGNAL_TYPE = 'congress_abstract'
const DATA_SOURCE = 'congress_firecrawl'

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if      (argv[i] === '--congress') out.congress = argv[++i]
    else if (argv[i] === '--url')      out.url      = argv[++i]
    else if (argv[i] === '--date')     out.date     = argv[++i]
    else if (argv[i] === '--pages')    out.pages    = argv[++i]
  }
  return out
}

const { congress, url, date, pages: pagesArg } = parseArgs(process.argv.slice(2))
const missing = ['congress', 'url', 'date'].filter(k => !({ congress, url, date })[k])
if (missing.length) {
  console.error(`❌  Missing required arg(s): ${missing.map(m => '--' + m).join(', ')}`)
  console.error('   node --env-file=.env.local scripts/ingest-congress-firecrawl.mjs \\')
  console.error('     --congress "AAAAI 2026" --url "https://..." --date "2026-02-28" --pages 50')
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`❌  --date must be YYYY-MM-DD, got "${date}"`)
  process.exit(1)
}
const MAX_PAGES = pagesArg ? Math.max(1, parseInt(pagesArg, 10)) : 1

// ── Extraction schema ─────────────────────────────────────────────────────────
// Passed to Firecrawl's LLM extractor. Fields map to what gets written to
// company_signals (headline = title, body_excerpt = summary).

const ABSTRACT_SCHEMA = {
  type: 'object',
  properties: {
    abstracts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          abstract_number: {
            type: 'string',
            description: 'Abstract number e.g. P001, OA-23, LB-004',
          },
          title: {
            type: 'string',
            description: 'Full abstract title',
          },
          authors: {
            type: 'string',
            description: 'Author list (comma-separated)',
          },
          drug_mentions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Drug or compound names explicitly mentioned',
          },
          phase: {
            type: 'string',
            description: 'Clinical trial phase if stated (e.g. "Phase 3", "Phase 2/3")',
          },
          primary_endpoint_result: {
            type: 'string',
            description: 'Primary endpoint result or key efficacy/safety finding',
          },
          summary: {
            type: 'string',
            description: 'Full abstract body including background, methods, results, conclusion',
          },
        },
        required: ['title', 'summary'],
      },
    },
  },
  required: ['abstracts'],
}

const EXTRACT_PROMPT =
  'Extract every congress abstract from this page. ' +
  'Focus especially on abstracts mentioning hereditary angioedema (HAE), ' +
  'berotralstat, garadacimab, donidalorsen, sebetralstat, KVD824, PHVS416, ' +
  'BioCryst, CSL Behring, Pharvaris, Ionis, Intellia, Takeda, ' +
  'or any HAE prevention/treatment drug. ' +
  'Include all available fields for each abstract — do not truncate summaries.'

// ── Main ─────────────────────────────────────────────────────────────────────

// ── Per-abstract processor ────────────────────────────────────────────────────

async function processAbstracts(supabase, abstracts, termToCompetitor, pageUrl, counters) {
  for (let i = 0; i < abstracts.length; i++) {
    const abstract = abstracts[i]
    const title    = (abstract.title   ?? '').trim()
    const summary  = (abstract.summary ?? '').trim()
    const absNo    = (abstract.abstract_number ?? `IDX-${counters.total + i + 1}`).trim()

    if (!title && !summary) { counters.skipped++; continue }

    const allText = [
      title,
      summary,
      (abstract.drug_mentions ?? []).join(' '),
      abstract.phase ?? '',
      abstract.primary_endpoint_result ?? '',
    ].join(' ').toLowerCase()

    const { matched, competitorId } = resolveCompetitor(allText, termToCompetitor)
    if (!matched) { counters.skipped++; continue }

    const severity    = classifySeverity(`${title} ${summary}`)
    const sourceHash  = sha256(`${congress}|${absNo}|${title.slice(0, 60)}`)
    const headline    = `${congress}: ${title}`.slice(0, 500)
    const bodyExcerpt = summary.slice(0, 400)

    if (await isDuplicate(supabase, sourceHash)) { counters.skipped++; continue }

    const { error } = await supabase.from('company_signals').insert({
      competitor_id: competitorId,
      signal_type:   SIGNAL_TYPE,
      headline,
      body_excerpt:  bodyExcerpt,
      date,
      source_url:    pageUrl,
      source_hash:   sourceHash,
      data_source:   DATA_SOURCE,
      severity,
    })

    if (error) {
      console.error(`  ❌  insert failed (${absNo}): ${error.message}`)
      counters.errors++
    } else {
      counters.written++
      counters.writtenNos.push(absNo)
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── Congress ingest (Firecrawl): ${congress} ────────────────`)
  console.log(`   url:    ${url}`)
  console.log(`   date:   ${date}`)
  console.log(`   pages:  ${MAX_PAGES}\n`)

  const supabase = createSupabaseClient()
  const termToCompetitor = await loadLexicon(supabase)
  console.log(`Loaded ${termToCompetitor.size} relevance terms from asset_lexicon.\n`)

  const counters = { written: 0, skipped: 0, errors: 0, total: 0, writtenNos: [] }

  for (let page = 1; page <= MAX_PAGES; page++) {
    // Page 1 uses the base URL; subsequent pages append ?page=N (Elsevier pattern)
    const pageUrl = page === 1 ? url : `${url}?page=${page}`
    console.log(`── Page ${page}/${MAX_PAGES}: ${pageUrl}`)

    let result
    try {
      result = await fcScrape(pageUrl, { schema: ABSTRACT_SCHEMA, prompt: EXTRACT_PROMPT })
    } catch (err) {
      console.error(`  ❌  Firecrawl error on page ${page}: ${err.message}`)
      counters.errors++
      continue
    }

    const abstracts = result.extract?.abstracts ?? []
    console.log(`   Firecrawl returned ${abstracts.length} abstract(s)`)

    if (abstracts.length === 0) {
      console.log(`   No abstracts on page ${page} — stopping pagination.\n`)
      break
    }

    const beforeWritten = counters.written
    await processAbstracts(supabase, abstracts, termToCompetitor, pageUrl, counters)
    counters.total += abstracts.length

    const newThisPage = counters.written - beforeWritten
    console.log(`   New signals written this page: ${newThisPage}\n`)

    // Stop early if this page wrote nothing new (all dups = we've reached the end)
    if (newThisPage === 0 && page > 1) {
      console.log('All abstracts on this page were duplicates — pagination complete.\n')
      break
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('── Final Summary ──────────────────────────────────────────')
  console.log(`Pages scraped:              up to ${MAX_PAGES}`)
  console.log(`Total abstracts seen:       ${counters.total}`)
  console.log(`Signals written (new):      ${counters.written}`)
  console.log(`Signals skipped (dup/irrel):${counters.skipped}`)
  console.log(`Errors:                     ${counters.errors}`)
  if (counters.writtenNos.length > 0 && counters.writtenNos.length <= 30) {
    console.log(`Abstract IDs written:       ${counters.writtenNos.join(', ')}`)
  } else if (counters.writtenNos.length > 30) {
    console.log(`Abstract IDs written:       ${counters.writtenNos.length} total`)
  }
  console.log('────────────────────────────────────────────────────────────\n')

  await writeIngestRun(supabase, {
    source:     DATA_SOURCE,
    newSignals: counters.written,
    skipped:    counters.skipped,
    notes:      `${congress} (${MAX_PAGES} pages)`,
    errors:     counters.errors,
  })
  console.log('ingest_runs row written.\n')
}

main().catch(err => {
  console.error(`\n❌  ${err.message}\n`)
  process.exit(1)
})
