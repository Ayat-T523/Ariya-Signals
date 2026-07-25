/**
 * ingest-eu-hta-firecrawl — Phase 5: EU HTA decisions + EMA EPAR data via Firecrawl.
 *
 * Sources (in run order):
 *   EMA  — individual EPAR product pages per drug (EU-wide authorisation)
 *   G-BA — AMNOG early benefit assessments per drug (Germany)
 *   HAS  — Commission de la Transparence opinions per drug (France)
 *   AIFA — reimbursement/determinazione decisions per drug (Italy)
 *
 * Coverage note: NICE (UK) is already handled by the ingest-hta Edge Function.
 * Actual list prices are NOT available from any free public source for hospital-
 * dispensed specialty drugs — this script captures the HTA/access layer only.
 *
 * All rows: signal_type = 'hta_decision', data_source = 'eu_hta_firecrawl'.
 * They surface on Competitor Profile → Key Events tab via getHtaSignalsByCompetitorId.
 *
 * Anti-hallucination: extracted titles must appear literally in raw markdown.
 * EMA pages additionally check that the drug INN appears in the markdown.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-eu-hta-firecrawl.mjs
 *   node --env-file=.env.local scripts/ingest-eu-hta-firecrawl.mjs --agency EMA
 *   node --env-file=.env.local scripts/ingest-eu-hta-firecrawl.mjs --agency GBA
 *   node --env-file=.env.local scripts/ingest-eu-hta-firecrawl.mjs --agency HAS
 *   node --env-file=.env.local scripts/ingest-eu-hta-firecrawl.mjs --agency AIFA
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
 */

import {
  createSupabaseClient,
  sha256,
  parseSignalDate,
  isDuplicate,
  writeIngestRun,
  loadInnToAssetId,
} from './lib/signal-gate.mjs'
import { fcScrape } from './lib/firecrawl.mjs'

const DATA_SOURCE = 'eu_hta_firecrawl'
const SIGNAL_TYPE = 'hta_decision'

// ── Drug registry ─────────────────────────────────────────────────────────────
// Only EMA-authorised HAE drugs: Takhzyro (2018), Orladeyo (2022),
// Andembry (2024), Dawnzera (2026). Lonvo-z / PHVS416 are Phase 3 — no EPAR yet.

const DRUGS = [
  { inn: 'lanadelumab',  brand: 'Takhzyro', competitor_id: 'takeda'      },
  { inn: 'berotralstat', brand: 'Orladeyo', competitor_id: 'biocryst'    },
  { inn: 'garadacimab',  brand: 'Andembry', competitor_id: 'csl-behring' },
  { inn: 'donidalorsen', brand: 'Dawnzera', competitor_id: 'ionis'       },
]

// ── Target lists ──────────────────────────────────────────────────────────────

// EMA EPAR URLs: older approvals use /EPAR/{brand}; newer pages (post-2023 EMA
// redesign) may return a thin redirect. Each entry has a primary URL and a
// fallback (EMA search) so the script retries automatically on thin content.
const EMA_TARGETS = [
  {
    ...DRUGS[0], agency: 'EMA', country: 'EU',
    url:         'https://www.ema.europa.eu/en/medicines/human/EPAR/takhzyro',
    fallbackUrl: `https://www.ema.europa.eu/en/medicines/search-medicine?search_api_views_fulltext=lanadelumab`,
  },
  {
    ...DRUGS[1], agency: 'EMA', country: 'EU',
    url:         'https://www.ema.europa.eu/en/medicines/human/EPAR/orladeyo',
    fallbackUrl: `https://www.ema.europa.eu/en/medicines/search-medicine?search_api_views_fulltext=berotralstat`,
  },
  {
    ...DRUGS[2], agency: 'EMA', country: 'EU',
    url:         'https://www.ema.europa.eu/en/medicines/human/EPAR/andembry',
    fallbackUrl: `https://www.ema.europa.eu/en/medicines/search-medicine?search_api_views_fulltext=garadacimab`,
  },
  {
    ...DRUGS[3], agency: 'EMA', country: 'EU',
    url:         'https://www.ema.europa.eu/en/medicines/human/EPAR/dawnzera',
    fallbackUrl: `https://www.ema.europa.eu/en/medicines/search-medicine?search_api_views_fulltext=donidalorsen`,
  },
]

const GBA_TARGETS = DRUGS.map(d => ({
  ...d, agency: 'G-BA', country: 'DE',
  url: `https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/?q=${encodeURIComponent(d.inn)}`,
}))

const HAS_TARGETS = DRUGS.map(d => ({
  ...d, agency: 'HAS', country: 'FR',
  url: `https://www.has-sante.fr/jcms/search?text=${encodeURIComponent(d.inn)}&portal=hasclient&type=AVIS_CT`,
}))

const AIFA_TARGETS = DRUGS.map(d => ({
  ...d, agency: 'AIFA', country: 'IT',
  // Scope to "determina" documents — avoids OsMed reports and formulary lists
  // that mention the INN incidentally but are not drug-specific HTA decisions.
  url: `https://www.aifa.gov.it/search?q=${encodeURIComponent(`determina ${d.inn}`)}`,
}))

// ── CLI args ──────────────────────────────────────────────────────────────────

const AGENCY_MAP = { EMA: EMA_TARGETS, GBA: GBA_TARGETS, HAS: HAS_TARGETS, AIFA: AIFA_TARGETS }

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--agency') out.agency = argv[++i]
  }
  return out
}

const { agency: agencyArg } = parseArgs(process.argv.slice(2))

let allTargets
if (!agencyArg) {
  allTargets = [...EMA_TARGETS, ...GBA_TARGETS, ...HAS_TARGETS, ...AIFA_TARGETS]
} else {
  const key = agencyArg.toUpperCase()
  if (!AGENCY_MAP[key]) {
    console.error(`❌  Unknown agency "${agencyArg}". Valid: EMA, GBA, HAS, AIFA`)
    process.exit(1)
  }
  allTargets = AGENCY_MAP[key]
}

// ── Extraction schemas ────────────────────────────────────────────────────────

const EMA_SCHEMA = {
  type: 'object',
  properties: {
    drug_name:          { type: 'string', description: 'Brand name of the medicine as shown on the page' },
    active_substance:   { type: 'string', description: 'INN / active substance' },
    authorization_date: { type: 'string', description: 'Date of initial marketing authorisation (EU authorisation date) exactly as printed' },
    status:             { type: 'string', description: 'Current authorisation status (Authorised, Withdrawn, Refused, etc.)' },
    indication:         { type: 'string', description: 'Full authorised therapeutic indication as printed on the EPAR page — do not truncate' },
    mah:                { type: 'string', description: 'Marketing authorisation holder (company name)' },
  },
  required: ['drug_name', 'status'],
}

function emaPrompt(drug) {
  return (
    `Extract the marketing authorisation details for ${drug.brand} (${drug.inn}) from this EMA EPAR page. ` +
    `Return: brand name, active substance (INN), initial authorisation date, current status, ` +
    `full indication text, and marketing authorisation holder. ` +
    `Copy ALL text EXACTLY as shown — do not paraphrase or abbreviate.`
  )
}

const HTA_SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:     { type: 'string', description: 'Title of the HTA decision or opinion document EXACTLY as it appears on the page' },
          date:      { type: 'string', description: 'Decision or publication date exactly as shown' },
          outcome:   { type: 'string', description: 'Decision outcome or rating (e.g. Zusatznutzen level / SMR/ASMR grade / reimbursement class)' },
          indication:{ type: 'string', description: 'Therapeutic indication assessed' },
          url:       { type: 'string', description: 'URL to the full decision document or page' },
          summary:   { type: 'string', description: 'Summary or excerpt from the decision' },
        },
        required: ['title'],
      },
    },
  },
  required: ['decisions'],
}

function htaPrompt(drug, agency) {
  const dateHint = agency === 'AIFA'
    ? 'Dates appear below each result in DD/MM/YYYY format (e.g. "21/06/2024") — extract the date for each document exactly as shown. '
    : agency === 'HAS'
    ? 'Dates appear in French format e.g. "31 janvier 2024" or "31/01/2024" — extract the date for each document exactly as shown. '
    : ''
  return (
    `Find all HTA assessment decisions or reimbursement opinions for ${drug.brand} (${drug.inn}) on this ${agency} page. ` +
    `Copy each document title EXACTLY as it appears — do not invent, paraphrase, or combine titles. ` +
    dateHint +
    `Include date, outcome/rating, indication, and URL for each item. ` +
    `Only return items that explicitly mention ${drug.inn} or ${drug.brand}.`
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function titleInMarkdown(title, markdown) {
  if (!markdown || !title) return false
  const words = title.trim().split(/\s+/).slice(0, 8).join(' ')
  // Firecrawl escapes special chars in markdown link text (e.g. _ → \_).
  // Strip backslash escapes before comparing so PDF filenames and French
  // apostrophes (l\'Orladeyo) don't false-positive as hallucinations.
  const normalizedMarkdown = markdown.replace(/\\(.)/g, '$1')
  return normalizedMarkdown.toLowerCase().includes(words.toLowerCase())
}

function innInMarkdown(inn, markdown) {
  return (markdown ?? '').toLowerCase().includes(inn.toLowerCase())
}

// ── EMA EPAR ingest ───────────────────────────────────────────────────────────

async function ingestEma(supabase, target, innToAssetId) {
  console.log(`\n── EMA | ${target.brand} (${target.inn})`)
  console.log(`   ${target.url}`)

  // Try primary URL; fall back to EMA search if content is thin (< 2000 chars
  // or INN absent) — newer EMA pages post-2023 redesign sometimes render thin.
  let result
  let usedUrl = target.url
  for (const tryUrl of [target.url, target.fallbackUrl].filter(Boolean)) {
    usedUrl = tryUrl
    try {
      result = await fcScrape(tryUrl, { schema: EMA_SCHEMA, prompt: emaPrompt(target) })
    } catch (e) {
      console.log(`   ❌  Firecrawl error (${tryUrl}): ${e.message}`)
      continue
    }
    const md = result.markdown ?? ''
    console.log(`   markdown: ${md.length} chars (${tryUrl === target.url ? 'primary' : 'fallback'})`)
    if (md.length >= 2000 && innInMarkdown(target.inn, md)) break
    console.log(`   ↩️   Thin/no INN — ${tryUrl === target.url && target.fallbackUrl ? 'trying fallback…' : 'no more URLs'}`)
    result = null
  }

  if (!result) {
    console.log(`   ⚠️   No usable EPAR content on primary or fallback URL`)
    return { written: 0, skipped: 1, errors: 0 }
  }

  const epar     = result.extract
  const markdown = result.markdown ?? ''

  if (!innInMarkdown(target.inn, markdown)) {
    console.log(`   🚫  INN "${target.inn}" not found even on fallback — skipping`)
    return { written: 0, skipped: 1, errors: 0 }
  }

  const date       = parseSignalDate(epar.authorization_date)
  const statusText = epar.status ? epar.status.trim() : 'Authorised'
  const headline   = `EMA: ${target.brand} (${target.inn}) — ${statusText} | EU authorisation`
  const excerpt    = [
    epar.status       ? `Status: ${epar.status}`                              : null,
    epar.indication   ? `Indication: ${epar.indication.slice(0, 250)}`        : null,
    epar.mah          ? `MAH: ${epar.mah}`                                    : null,
  ].filter(Boolean).join(' | ')

  const sourceHash = sha256(`${target.competitor_id}|EMA|${target.inn}|epar`)

  if (await isDuplicate(supabase, sourceHash)) {
    console.log(`   ↩️   Already in DB — skipping`)
    return { written: 0, skipped: 1, errors: 0 }
  }

  const { error } = await supabase.from('company_signals').insert({
    competitor_id: target.competitor_id,
    signal_type:   SIGNAL_TYPE,
    headline:      headline.slice(0, 500),
    body_excerpt:  excerpt.slice(0, 400),
    date,
    source_url:    usedUrl,
    source_hash:   sourceHash,
    data_source:   DATA_SOURCE,
    inn:           target.inn,
    asset_id:      innToAssetId.get(target.inn.toLowerCase()) ?? null,
  })

  if (error) {
    console.log(`   ❌  Insert failed: ${error.message}`)
    return { written: 0, skipped: 0, errors: 1 }
  }

  console.log(`   ✅  ${headline.slice(0, 90)}`)
  return { written: 1, skipped: 0, errors: 0 }
}

// ── National HTA ingest ───────────────────────────────────────────────────────

async function ingestNationalHta(supabase, target, innToAssetId) {
  console.log(`\n── ${target.agency} (${target.country}) | ${target.brand} (${target.inn})`)
  console.log(`   ${target.url}`)

  let result
  try {
    result = await fcScrape(target.url, { schema: HTA_SCHEMA, prompt: htaPrompt(target, target.agency) })
  } catch (e) {
    console.log(`   ❌  Firecrawl error: ${e.message}`)
    return { written: 0, skipped: 0, errors: 1 }
  }

  const decisions = result.extract?.decisions ?? []
  const markdown  = result.markdown ?? ''
  console.log(`   ${decisions.length} decision(s) | markdown: ${markdown.length} chars`)

  if (markdown.length < 100) {
    console.log(`   ⚠️   Thin markdown — page did not render`)
    return { written: 0, skipped: 0, errors: 0 }
  }

  if (!innInMarkdown(target.inn, markdown)) {
    console.log(`   ⚠️   INN "${target.inn}" not in page markdown — no content for this drug`)
    return { written: 0, skipped: decisions.length, errors: 0 }
  }

  let written = 0, skipped = 0, hallucinated = 0

  for (const d of decisions) {
    const title = (d.title ?? '').trim()
    if (!title) { skipped++; continue }

    // Anti-hallucination: title must appear in the raw markdown
    if (!titleInMarkdown(title, markdown)) {
      console.log(`   🚫  [hallucinated] ${title.slice(0, 70)}`)
      hallucinated++
      continue
    }

    let date        = parseSignalDate(d.date)
    // Fallback: many AIFA PDFs embed the year in the filename (e.g. _2021_, -2026_)
    if (!date) {
      const yr = title.match(/[_\-](20\d{2})[_\-]/)
      if (yr) date = `${yr[1]}-01-01`
    }
    const outcome   = (d.outcome ?? '').slice(0, 120)
    const headline  = `${target.agency} (${target.country}): ${target.brand} (${target.inn})${outcome ? ` — ${outcome}` : ''}`
    const excerpt   = [
      outcome           ? `Outcome: ${outcome}`             : null,
      d.indication      ? `Indication: ${d.indication}`     : null,
      d.summary         ? d.summary.slice(0, 200)           : null,
    ].filter(Boolean).join(' | ')

    const sourceUrl  = d.url ?? target.url
    // Hash on agency + inn + date (falls back to title prefix) for dedup
    const hashKey    = date ?? title.toLowerCase().slice(0, 50)
    const sourceHash = sha256(`${target.competitor_id}|${target.agency}|${target.inn}|${hashKey}`)

    if (await isDuplicate(supabase, sourceHash)) { skipped++; continue }

    const { error } = await supabase.from('company_signals').insert({
      competitor_id: target.competitor_id,
      signal_type:   SIGNAL_TYPE,
      headline:      headline.slice(0, 500),
      body_excerpt:  excerpt.slice(0, 400),
      date,
      source_url:    sourceUrl,
      source_hash:   sourceHash,
      data_source:   DATA_SOURCE,
      inn:           target.inn,
      asset_id:      innToAssetId.get(target.inn.toLowerCase()) ?? null,
    })

    if (error) {
      console.log(`   ❌  Insert: ${error.message}`)
    } else {
      written++
      console.log(`   ✅  ${headline.slice(0, 90)}`)
    }
  }

  const totalSkipped = skipped + hallucinated
  console.log(`   → written: ${written} | skipped: ${totalSkipped} (${hallucinated} hallucinated)`)
  return { written, skipped: totalSkipped, errors: 0 }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const agencies = [...new Set(allTargets.map(t => t.agency))]
  console.log(`\n── EU HTA ingest (Firecrawl) — ${agencies.join(', ')} ──`)
  console.log(`   ${allTargets.length} targets\n`)

  const supabase = createSupabaseClient()
  const innToAssetId = await loadInnToAssetId(supabase)
  let totalWritten = 0, totalSkipped = 0, totalErrors = 0

  for (const target of allTargets) {
    const fn = target.agency === 'EMA' ? ingestEma : ingestNationalHta
    const { written, skipped, errors } = await fn(supabase, target, innToAssetId)
    totalWritten += written
    totalSkipped += skipped
    totalErrors  += errors

    await writeIngestRun(supabase, {
      source:     DATA_SOURCE,
      newSignals: written,
      skipped,
      errors,
      notes:      `${target.agency} — ${target.drug ?? target.brand}`,
    })
  }

  console.log('\n── Final Summary ─────────────────────────────────────────')
  console.log(`Agencies:          ${agencies.join(', ')}`)
  console.log(`Signals written:   ${totalWritten}`)
  console.log(`Skipped:           ${totalSkipped}`)
  console.log(`Errors:            ${totalErrors}`)
  console.log('──────────────────────────────────────────────────────────\n')
}

main().catch(e => { console.error(`\n❌  ${e.message}\n`); process.exit(1) })
