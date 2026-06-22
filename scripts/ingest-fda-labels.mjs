/**
 * FDA DailyMed drug label ingest — fetches full Prescribing Information (SPL) text
 * for FDA-approved products and stores them in the documents table.
 * Usage: node --env-file=.env.local scripts/ingest-fda-labels.mjs
 *
 * Source: https://dailymed.nlm.nih.gov/dailymed/services/v2 (free public API, no auth)
 * Stores: document_type = 'FDA-label', source_label = 'FDA DailyMed'
 *
 * Requires: supabase/documents.sql to have been run first.
 *
 * To add more products: append entries to the DRUGS array below.
 * source_url is the canonical DailyMed drugInfo page (human-readable citation link).
 * Upsert is idempotent — safe to re-run; updates full_text if the label has been revised.
 */

import { createClient } from '@supabase/supabase-js'

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/ingest-fda-labels.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DAILYMED_BASE = 'https://dailymed.nlm.nih.gov/dailymed/services/v2'
const USER_AGENT    = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS    = 30_000
const MAX_CHARS     = 200_000  // full label text; typical PI is 20–60k chars

// ── Drug list ─────────────────────────────────────────────────────────────────
//
// Add entries here as competitor products receive FDA approval.
// brandName must match the DailyMed brand name exactly (case-insensitive search).
// competitorId must match the id field in src/data/competitors.json.

const DRUGS = [
  {
    brandName:    'Orladeyo',
    genericName:  'berotralstat',
    competitorId: 'biocryst',
  },
  {
    brandName:    'Takhzyro',
    genericName:  'lanadelumab-flyo',
    competitorId: 'takeda',
  },
  {
    brandName:    'Andembry',
    genericName:  'garadacimab-tmgw',
    competitorId: 'csl-behring',
  },
  {
    brandName:    'Dawnzera',
    genericName:  'donidalorsen',
    competitorId: 'ionis',
  },
  {
    brandName:    'Firazyr',
    genericName:  'icatibant',
    competitorId: 'takeda',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`)
  return r.json()
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`)
  return r.text()
}

// Strip XML/HTML tags and decode entities
function stripMarkup(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&quot;/g,  '"')
    .replace(/&apos;/g,  "'")
    .replace(/&#160;/g,  ' ')
    .replace(/\s+/g,     ' ')
    .trim()
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length
}

// Search DailyMed for a brand name → return the first matching setid and published date.
// Must use /spls.json (not /drugnames.json — that endpoint only returns name strings, no set IDs).
async function findSpl(brandName) {
  const url  = `${DAILYMED_BASE}/spls.json?drug_name=${encodeURIComponent(brandName)}&pagesize=5`
  const data = await fetchJson(url)
  const hit  = data.data?.[0]
  if (!hit) return null
  const setid = hit.set_id ?? hit.spl_set_id ?? hit.setid
  if (!setid) {
    console.error(`\n    ⚠️  Unexpected API shape — got fields: ${Object.keys(hit).join(', ')}`)
    return null
  }
  return {
    setid,
    publishedDate: hit.published_date?.slice(0, 10) ?? null,
  }
}

// Fetch and strip the full SPL XML for a setid
async function fetchSplText(setid) {
  const xml = await fetchText(`${DAILYMED_BASE}/spls/${setid}.xml`)
  return stripMarkup(xml)
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n💊  Ingesting FDA drug labels from DailyMed...\n')

let ingested = 0
const errors = []

for (const drug of DRUGS) {
  const label = `${drug.brandName} (${drug.genericName})`
  process.stdout.write(`  ${label.padEnd(42)}`)

  // Step 1 — look up the setid on DailyMed
  let setid, publishedDate
  try {
    const found = await findSpl(drug.brandName)
    if (!found) {
      console.log('⚠️  Not found in DailyMed — may not yet be FDA-approved or name differs')
      continue
    }
    setid         = found.setid
    publishedDate = found.publishedDate
  } catch (e) {
    errors.push(`${drug.brandName}: DailyMed search failed — ${e.message}`)
    console.log(`❌  search failed: ${e.message}`)
    continue
  }

  // Step 2 — fetch the full SPL document text
  let fullText
  try {
    fullText = (await fetchSplText(setid)).slice(0, MAX_CHARS)
  } catch (e) {
    errors.push(`${drug.brandName}: SPL fetch failed — ${e.message}`)
    console.log(`❌  SPL fetch failed: ${e.message}`)
    continue
  }

  // Step 3 — upsert into documents table
  // source_url is the human-readable DailyMed page — a citable, stable URL for display
  const sourceUrl = `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`

  const { error: upsertError } = await supabase
    .from('documents')
    .upsert(
      {
        competitor_id:  drug.competitorId,
        source_url:     sourceUrl,
        document_type:  'FDA-label',
        source_label:   'FDA DailyMed',
        date_published: publishedDate,
        full_text:      fullText,
        word_count:     countWords(fullText),
      },
      { onConflict: 'source_url', ignoreDuplicates: false }
    )

  if (upsertError) {
    errors.push(`${drug.brandName}: upsert failed — ${upsertError.message}`)
    console.log(`❌  upsert failed: ${upsertError.message}`)
  } else {
    ingested++
    console.log(`✅  ${countWords(fullText).toLocaleString()} words  (setid: ${setid})`)
  }

  // Brief pause between DailyMed calls
  await new Promise(r => setTimeout(r, 500))
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`
─────────────────────────────────────────
  Labels ingested: ${ingested} / ${DRUGS.length}
${errors.length ? `\n  Errors (${errors.length}):\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────

To add more products: edit the DRUGS array at the top of this script.
Next: run scripts/ingest-regulatory-docs.mjs (A3) for NICE TAs and EMA EPARs.
`)
