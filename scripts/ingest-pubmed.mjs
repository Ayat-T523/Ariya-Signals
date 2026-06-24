/**
 * ingest-pubmed.mjs — Phase 6: PubMed publications via NCBI E-utilities API.
 *
 * Fetches clinical trial results + congress/RWE publications for each HAE
 * competitor drug. No Firecrawl credits used — NCBI E-utilities is a free,
 * structured REST API with JSON + XML responses.
 *
 * Anti-hallucination: not needed here — NCBI returns structured data directly
 * from the authoritative PubMed database. PMIDs are stable unique identifiers.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-pubmed.mjs
 *   node --env-file=.env.local scripts/ingest-pubmed.mjs --drug lanadelumab
 *   node --env-file=.env.local scripts/ingest-pubmed.mjs --max 100 --since 2018
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      NCBI_API_KEY  (optional — raises rate limit from 3 to 10 req/s)
 */

import {
  createSupabaseClient,
  sha256,
  parseSignalDate,
  isDuplicate,
  writeIngestRun,
} from './lib/signal-gate.mjs'

const DATA_SOURCE = 'pubmed'
const SIGNAL_TYPE = 'publication'
const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

// 340 ms ≈ 3 req/s (no key limit); 110 ms ≈ 9 req/s (with NCBI_API_KEY)
const RATE_DELAY = process.env.NCBI_API_KEY ? 110 : 340

// ── Drug registry ─────────────────────────────────────────────────────────────
// Covers EMA-approved + late-stage pipeline HAE drugs.
// search_term overrides the default INN when PubMed uses a different identifier.

const DRUGS = [
  { inn: 'lanadelumab',   brand: 'Takhzyro',  competitor_id: 'takeda'      },
  { inn: 'berotralstat',  brand: 'Orladeyo',  competitor_id: 'biocryst'    },
  { inn: 'garadacimab',   brand: 'Andembry',  competitor_id: 'csl-behring' },
  { inn: 'donidalorsen',  brand: 'Dawnzera',  competitor_id: 'ionis'       },
  { inn: 'deucrictibant', brand: 'PHVS416',   competitor_id: 'pharvaris'   },
  { inn: 'ntla-2002',     brand: 'NTLA-2002', competitor_id: 'intellia',
    search_term: 'NTLA-2002' },
]

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { drug: null, max: 50, since: 2018 }
  for (let i = 0; i < argv.length; i++) {
    if      (argv[i] === '--drug')  out.drug  = argv[++i]
    else if (argv[i] === '--max')   out.max   = parseInt(argv[++i], 10)
    else if (argv[i] === '--since') out.since = parseInt(argv[++i], 10)
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

const targets = args.drug
  ? DRUGS.filter(d => d.inn === args.drug || d.competitor_id === args.drug)
  : DRUGS

if (!targets.length) {
  console.error(`❌  Unknown drug/competitor "${args.drug}"`)
  console.error(`    Valid: ${DRUGS.map(d => d.inn).join(', ')}`)
  process.exit(1)
}

// ── NCBI E-utilities helpers ──────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function eutils(endpoint, params) {
  const key = process.env.NCBI_API_KEY
  const qs = new URLSearchParams({
    ...params,
    tool:  'ariya-signals',
    email: 'ayattayebulla@gmail.com',
    ...(key ? { api_key: key } : {}),
  })
  const resp = await fetch(`${EUTILS_BASE}/${endpoint}?${qs}`)
  if (!resp.ok) throw new Error(`NCBI ${endpoint} HTTP ${resp.status}`)
  return resp
}

// esearch → { pmids: string[], total: number }
async function searchPmids(term, retmax, since) {
  const query =
    `"${term}"[Title/Abstract] AND "hereditary angioedema"[Title/Abstract]` +
    ` AND ${since}:3000[dp]`
  const resp = await eutils('esearch.fcgi', {
    db: 'pubmed', term: query, retmax, retmode: 'json', usehistory: 'n',
  })
  await sleep(RATE_DELAY)
  const data = await resp.json()
  return {
    pmids: data.esearchresult?.idlist ?? [],
    total: parseInt(data.esearchresult?.count ?? '0', 10),
    query,
  }
}

// esummary → { [pmid]: DocSum } (title, pubdate, authors, source, articleids)
async function getSummaries(pmids) {
  if (!pmids.length) return {}
  const resp = await eutils('esummary.fcgi', {
    db: 'pubmed', id: pmids.join(','), retmode: 'json',
  })
  await sleep(RATE_DELAY)
  return (await resp.json()).result ?? {}
}

// efetch (batch) → { [pmid]: abstractText }
async function getAbstracts(pmids) {
  if (!pmids.length) return {}
  const resp = await eutils('efetch.fcgi', {
    db: 'pubmed', id: pmids.join(','), rettype: 'abstract', retmode: 'xml',
  })
  await sleep(RATE_DELAY)
  const xml = await resp.text()
  const out = {}
  for (const m of xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)) {
    const block = m[1]
    const pmid  = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1]
    if (!pmid) continue
    const parts = []
    for (const ab of block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)) {
      parts.push(ab[1].replace(/<[^>]+>/g, '').trim())
    }
    out[pmid] = parts.join(' ')
  }
  return out
}

// ── Per-drug ingest ───────────────────────────────────────────────────────────

async function ingestDrug(supabase, drug) {
  const term = drug.search_term ?? drug.inn
  console.log(`\n── ${drug.competitor_id.toUpperCase()} — ${drug.brand} (${term})`)

  const { pmids, total, query } = await searchPmids(term, args.max, args.since)
  console.log(`   Query: ${query}`)
  console.log(`   Found: ${total} total, fetching ${pmids.length}`)

  if (!pmids.length) {
    console.log('   No results.')
    return { written: 0, skipped: 0, errors: 0 }
  }

  const summaryData = await getSummaries(pmids)

  // Fetch abstracts in batches of 20 (URL length safety)
  const abstractMap = {}
  for (let i = 0; i < pmids.length; i += 20) {
    Object.assign(abstractMap, await getAbstracts(pmids.slice(i, i + 20)))
  }

  let written = 0, skipped = 0, errors = 0

  for (const pmid of pmids) {
    const s = summaryData[pmid]
    if (!s || s.error) { skipped++; continue }

    const title    = (s.title ?? '').replace(/\.$/, '').trim()
    const abstract = (abstractMap[pmid] ?? '').trim()
    if (!title) { skipped++; continue }

    const date      = parseSignalDate(s.pubdate)
    const journal   = s.source ?? ''
    const authors   = (s.authors ?? []).map(a => a.name).slice(0, 3).join(', ')
    const doi       = (s.articleids ?? []).find(a => a.idtype === 'doi')?.value ?? ''
    const sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    const sourceHash = sha256(`pubmed|${pmid}`)

    if (await isDuplicate(supabase, sourceHash)) { skipped++; continue }

    const headline = title.slice(0, 500)
    const bodyExcerpt = [
      journal  ? `${journal}`         : null,
      authors  ? `${authors}`         : null,
      abstract ? abstract.slice(0, 200) : null,
    ].filter(Boolean).join(' | ').slice(0, 400)

    const { error } = await supabase.from('company_signals').insert({
      competitor_id: drug.competitor_id,
      signal_type:   SIGNAL_TYPE,
      headline,
      body_excerpt:  bodyExcerpt,
      date,
      source_url:    sourceUrl,
      source_hash:   sourceHash,
      data_source:   DATA_SOURCE,
    })

    if (error) {
      console.error(`   ❌  PMID ${pmid}: ${error.message}`)
      errors++
    } else {
      written++
      console.log(`   ✅  [${date ?? 'no date'}] ${title.slice(0, 70)}`)
    }
  }

  console.log(`   → written: ${written} | skipped: ${skipped} | errors: ${errors}`)
  return { written, skipped, errors }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── PubMed ingest — ${targets.map(d => d.inn).join(', ')} ──`)
  console.log(`   retmax: ${args.max} per drug | since: ${args.since}\n`)

  const supabase = createSupabaseClient()
  let totalWritten = 0, totalSkipped = 0, totalErrors = 0

  for (const drug of targets) {
    const { written, skipped, errors } = await ingestDrug(supabase, drug)
    totalWritten += written
    totalSkipped += skipped
    totalErrors  += errors

    await writeIngestRun(supabase, {
      source:     DATA_SOURCE,
      newSignals: written,
      skipped,
      errors,
      notes:      `${drug.inn} (${drug.competitor_id})`,
    })
  }

  console.log('\n── Final Summary ─────────────────────────────────────────')
  console.log(`Drugs:             ${targets.length}`)
  console.log(`Signals written:   ${totalWritten}`)
  console.log(`Skipped (dup):     ${totalSkipped}`)
  console.log(`Errors:            ${totalErrors}`)
  console.log('──────────────────────────────────────────────────────────\n')
}

main().catch(e => { console.error(`\n❌  ${e.message}\n`); process.exit(1) })
