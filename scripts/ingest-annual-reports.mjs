/**
 * Annual report ingest — fetches 10-K (US) and 20-F (foreign private issuer) Business
 * Description text (Item 1) from SEC EDGAR and stores it in the documents table.
 * Usage: node --env-file=.env.local scripts/ingest-annual-reports.mjs
 *
 * Source: https://data.sec.gov/submissions/ (free, no auth required)
 * Stores: document_type = '10-K' or '20-F', source_label = 'SEC EDGAR'
 *
 * Rate limits: SEC EDGAR allows 10 requests/second. This script pauses 150ms between fetches.
 *
 * CSL Behring (ASX filer): NOT covered here — CSL Limited files with the Australian
 * Securities Exchange, not the SEC. Annual reports must be downloaded manually from
 * csl.com/investors and uploaded to the documents table.
 *
 * Requires: supabase/documents.sql to have been run first.
 */

import { createClient } from '@supabase/supabase-js'

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/ingest-annual-reports.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SEC_BASE      = 'https://data.sec.gov'
const EDGAR_BASE    = 'https://www.sec.gov'
const USER_AGENT    = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS    = 45_000
const MAX_CHARS     = 200_000
const PAUSE_MS      = 150    // SEC rate limit: 10 req/s

// ── Company list ──────────────────────────────────────────────────────────────
//
// CIK must be padded to 10 digits when constructing the submissions URL.
// formType: the exact form type as filed ('10-K' for US domestic, '20-F' for foreign issuers).
// Note: Takeda and Pharvaris are foreign private issuers filing 20-F.
// CSL Behring (csl-behring) is an ASX filer — not covered; manual download required.

const COMPANIES = [
  { competitorId: 'biocryst', cik: '882796',   formType: '10-K', name: 'BioCryst Pharmaceuticals' },
  { competitorId: 'ionis',    cik: '874015',   formType: '10-K', name: 'Ionis Pharmaceuticals'    },
  { competitorId: 'pharvaris', cik: '1830487',  formType: '20-F', name: 'Pharvaris'                },
  { competitorId: 'takeda',   cik: '1395064',  formType: '20-F', name: 'Takeda Pharmaceutical'    },
  { competitorId: 'intellia', cik: '1652130',  formType: '10-K', name: 'Intellia Therapeutics'    },
  { competitorId: 'adverum',  cik: '1501756',  formType: '10-K', name: 'Adverum Biotechnologies'  },
  { competitorId: 'astria',   cik: '1454789',  formType: '10-K', name: 'Astria Therapeutics'      },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad10(cik) {
  return String(cik).padStart(10, '0')
}

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
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain,*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`)
  return r.text()
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&quot;/g,  '"')
    .replace(/&#160;/g,  ' ')
    .replace(/\s+/g,     ' ')
    .trim()
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length
}

// Extract Item 1 (Business Description) from 10-K/20-F full text.
// Returns a string between "Item 1" and "Item 1A" (or Item 2 if 1A not found).
function extractItem1(fullText) {
  // Normalise section breaks
  const text = fullText.replace(/\n{2,}/g, '\n\n')

  // Various Item 1 heading patterns used across filings
  const START_PATTERNS = [
    /\bITEM\s+1[.\s]+BUSINESS\b/i,
    /\bITEM\s+1[.\s]+Business\b/,
    /\bItem\s+1\.\s*Business\b/,
    /\bITEM\s+1\b/i,
  ]

  // Section after Item 1 — we cut here
  const END_PATTERNS = [
    /\bITEM\s+1A[.\s]+RISK\b/i,
    /\bITEM\s+1A[.\s]+Risk\b/,
    /\bItem\s+1A\b/i,
    /\bITEM\s+2[.\s]+PROPERT/i,
    /\bItem\s+2\.\s*Propert/,
  ]

  let startIdx = -1
  for (const pat of START_PATTERNS) {
    const m = pat.exec(text)
    if (m) { startIdx = m.index; break }
  }
  if (startIdx === -1) return null  // Could not locate Item 1

  let endIdx = text.length
  for (const pat of END_PATTERNS) {
    const m = pat.exec(text.slice(startIdx + 50))  // skip the heading itself
    if (m) { endIdx = startIdx + 50 + m.index; break }
  }

  const item1 = text.slice(startIdx, endIdx).trim()
  if (item1.length < 200) return null  // Too short — extraction likely failed
  return item1
}

// ── Find the most recent 10-K or 20-F filing for a company ───────────────────
async function findLatestFiling(company) {
  const submissionsUrl = `${SEC_BASE}/submissions/CIK${pad10(company.cik)}.json`
  const subs = await fetchJson(submissionsUrl)
  await new Promise(r => setTimeout(r, PAUSE_MS))

  const recent = subs.filings?.recent
  if (!recent) throw new Error('No filings.recent in submissions JSON')

  const forms   = recent.form          ?? []
  const accNos  = recent.accessionNumber ?? []
  const priDocs = recent.primaryDocument ?? []
  const dates   = recent.filingDate     ?? []

  // Find the most recent filing matching the target form type
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === company.formType) {
      return {
        accessionNumber: accNos[i],
        primaryDocument: priDocs[i],
        filingDate:      dates[i],
      }
    }
  }
  throw new Error(`No ${company.formType} found in recent filings`)
}

// Build SEC EDGAR filing document URL from accession number + primary document filename
function buildDocUrl(cik, accessionNumber, primaryDocument) {
  // Accession number format: 0001234567-24-001234 → remove dashes for path
  const accPath = accessionNumber.replace(/-/g, '')
  return `${EDGAR_BASE}/Archives/edgar/data/${cik}/${accPath}/${primaryDocument}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n📊  Ingesting annual reports (10-K / 20-F Item 1 Business Description)...\n')
console.log('   Note: CSL Behring (ASX filer) is not covered — manual download required.\n')

let ingested = 0
const errors  = []

for (const company of COMPANIES) {
  const label = `${company.name} (${company.formType})`
  process.stdout.write(`  ${label.padEnd(52)}`)

  // Step 1 — find most recent filing
  let filing
  try {
    filing = await findLatestFiling(company)
  } catch (e) {
    errors.push(`${label}: could not find filing — ${e.message}`)
    console.log(`❌  ${e.message}`)
    continue
  }

  const docUrl = buildDocUrl(company.cik, filing.accessionNumber, filing.primaryDocument)

  // Step 2 — fetch the full document text
  let fullText
  try {
    const raw = await fetchText(docUrl)
    fullText  = stripHtml(raw)
  } catch (e) {
    errors.push(`${label}: fetch failed — ${e.message}`)
    console.log(`❌  fetch failed: ${e.message}`)
    await new Promise(r => setTimeout(r, PAUSE_MS))
    continue
  }
  await new Promise(r => setTimeout(r, PAUSE_MS))

  // Step 3 — extract Item 1 (Business Description)
  const item1 = extractItem1(fullText)
  const textToStore = (item1 ?? fullText).slice(0, MAX_CHARS)
  const extracted   = item1 != null

  // Step 4 — upsert into documents table
  const sourceUrl = `${EDGAR_BASE}/Archives/edgar/data/${company.cik}/${filing.accessionNumber.replace(/-/g, '')}/${filing.primaryDocument}`

  const { error: upsertError } = await supabase
    .from('documents')
    .upsert(
      {
        competitor_id:  company.competitorId,
        source_url:     sourceUrl,
        document_type:  company.formType,
        source_label:   'SEC EDGAR',
        date_published: filing.filingDate,
        full_text:      textToStore,
        word_count:     countWords(textToStore),
      },
      { onConflict: 'source_url', ignoreDuplicates: false }
    )

  if (upsertError) {
    errors.push(`${label}: upsert failed — ${upsertError.message}`)
    console.log(`❌  upsert failed: ${upsertError.message}`)
  } else {
    ingested++
    const wordCount = countWords(textToStore)
    console.log(`✅  ${wordCount.toLocaleString()} words  ${extracted ? '(Item 1 extracted)' : '(full text — Item 1 not found)'}  filed: ${filing.filingDate}`)
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`
─────────────────────────────────────────
  Reports ingested: ${ingested} / ${COMPANIES.length}
  CSL Behring: skipped — ASX filer, manual download required from csl.com/investors
${errors.length ? `\n  Errors (${errors.length}):\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────

All documents stored in Supabase documents table.
Next: implement getDocumentsByCompetitorId in src/lib/db/index.ts to surface these
in the Messaging Tab source documents panel.
`)
