/**
 * Name: ingest-proxy
 * Description: Scrapes executive officer rosters from SEC proxy statements (DEF 14A) and
 *   annual reports (20-F Item 6) and upserts Name + Title into the personnel table.
 *   Also processes existing 8-K Item 5.02 signals from company_signals for real-time changes.
 *
 * Coverage:
 *   US filers (DEF 14A):  BioCryst, Ionis, Intellia, Adverum, Astria
 *   FPIs (20-F Item 6):   Pharvaris, Takeda
 *   Not covered:          CSL Behring (ASX filer — download annual report manually from csl.com/investors)
 *
 * Prerequisites:
 *   1. Run supabase/personnel.sql in the Supabase SQL editor first.
 *   2. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-proxy.mjs
 *
 * Rate limits: SEC EDGAR allows 10 requests/second. Script pauses 150ms between requests.
 */

import { createClient } from '@supabase/supabase-js'

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/ingest-proxy.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SEC_BASE   = 'https://data.sec.gov'
const EDGAR_BASE = 'https://www.sec.gov'
const USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS = 45_000
const PAUSE_MS   = 150

// ── Company list ──────────────────────────────────────────────────────────────
//
// formType: filing type that contains the executive officer table.
// US domestic filers: DEF 14A (annual proxy statement)
// Foreign private issuers: 20-F (annual report, Item 6 "Directors, Senior Management and Employees")
//
// CIKs verified against EDGAR submissions API.

const COMPANIES = [
  { competitorId: 'biocryst',  cik: '882796',  formType: 'DEF 14A', name: 'BioCryst Pharmaceuticals' },
  { competitorId: 'ionis',     cik: '874015',  formType: 'DEF 14A', name: 'Ionis Pharmaceuticals'    },
  { competitorId: 'intellia',  cik: '1652130', formType: 'DEF 14A', name: 'Intellia Therapeutics'    },
  { competitorId: 'adverum',   cik: '1501756', formType: 'DEF 14A', name: 'Adverum Biotechnologies'  },
  { competitorId: 'astria',    cik: '1454789', formType: 'DEF 14A', name: 'Astria Therapeutics'      },
  { competitorId: 'pharvaris', cik: '1830487', formType: '20-F',    name: 'Pharvaris'                },
  { competitorId: 'takeda',    cik: '1395064', formType: '20-F',    name: 'Takeda Pharmaceutical'    },
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

function pause(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// ── EDGAR: find the latest filing of a given form type ───────────────────────

async function getLatestFiling(cik, formType) {
  const url = `${SEC_BASE}/submissions/CIK${pad10(cik)}.json`
  const data = await fetchJson(url)

  const forms = data.filings?.recent?.form ?? []
  const dates = data.filings?.recent?.filingDate ?? []
  const accessions = data.filings?.recent?.accessionNumber ?? []

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === formType) {
      return {
        accession: accessions[i].replace(/-/g, ''),
        date: dates[i],
      }
    }
  }
  return null
}

// ── EDGAR: get the primary document URL from a filing index ──────────────────

async function getPrimaryDocUrl(cik, accession) {
  const indexUrl = `${EDGAR_BASE}/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=&dateb=&owner=include&count=1&search_text=&accession=${accession}`
  const url = `${EDGAR_BASE}/Archives/edgar/data/${cik}/${accession}/${accession}-index.htm`
  const html = await fetchText(url)

  // Find the primary .htm document link in the filing index
  const match = html.match(/href="(\/Archives\/edgar\/data\/\d+\/[^"]+\.htm[^"]*)"/i)
  if (match) return `${EDGAR_BASE}${match[1]}`

  // Fallback: construct from accession number pattern
  const acc = accession.replace(/(\d{10})(\d{18})/, '$1-$2-index.htm')
  return `${EDGAR_BASE}/Archives/edgar/data/${cik}/${accession}/${acc}`
}

// ── Parse executive officers table from filing text ──────────────────────────
//
// Both DEF 14A and 20-F use an "EXECUTIVE OFFICERS" section with a Name / Title / Age / Bio
// table. We extract only Name and Title — no age or biographical text.
//
// Heuristic: find the EXECUTIVE OFFICERS section header, then scan subsequent lines for
// name-like text (all-caps or title-case) followed by a title-like line.

function parseExecutiveOfficers(text) {
  // Locate the executive officers section
  const sectionRe = /EXECUTIVE OFFICERS\b/i
  const startIdx = text.search(sectionRe)
  if (startIdx === -1) return []

  // Take up to 8000 chars of the section (avoids picking up unrelated content)
  const section = text.slice(startIdx, startIdx + 8_000)

  const officers = []
  const seen = new Set()

  // Pattern A: table rows separated by newlines — "FIRSTNAME LASTNAME\nTitle goes here"
  // Pattern B: inline — "Name: John Smith; Title: Chief Executive Officer"
  // We use two passes: structured table first, then inline fallback

  // ── Pass 1: line-pair scan (most SEC filings) ─────────────────────────────
  const lines = section.split(/\n/).map(l => l.trim()).filter(Boolean)

  // Known non-title words that appear between name and title lines
  const SKIP_WORDS = /^(age|director|officer|nominee|class|term|year|since|the|a|an|and|or|of|in|at|for)$/i

  const TITLE_KEYWORDS = /\b(chief|president|vice\s+president|vp|officer|director|head|senior|general|counsel|managing|principal|executive|cfo|ceo|cmo|cso|cco|cto|evp|svp|treasurer|secretary|controller)\b/i

  // A name line: 2–5 capitalised words, ≤40 chars, no digits
  const NAME_RE = /^([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,4})$/

  for (let i = 0; i < lines.length - 1; i++) {
    const l = lines[i]
    if (!NAME_RE.test(l) || l.length > 40) continue
    // Check if the following non-skip line looks like a title
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const candidate = lines[j]
      if (SKIP_WORDS.test(candidate) || /^\d+$/.test(candidate)) continue
      if (TITLE_KEYWORDS.test(candidate) && candidate.length < 100) {
        const key = l.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          officers.push({ name: l, title: candidate })
        }
        break
      }
      // Non-title, non-skip line — stop looking
      break
    }
  }

  // ── Pass 2: inline "Name: X, Title: Y" format (some 20-F filings) ─────────
  const inlineRe = /(?:name|officer)s?:?\s*([A-Z][a-zA-Z'.\- ]{3,35})\s*[,;]\s*(?:title|position|role):?\s*([A-Za-z,./\- ]{8,90})/gi
  let m
  while ((m = inlineRe.exec(section)) !== null) {
    const name = m[1].trim()
    const title = m[2].trim()
    const key = name.toLowerCase()
    if (!seen.has(key) && TITLE_KEYWORDS.test(title)) {
      seen.add(key)
      officers.push({ name, title })
    }
  }

  return officers
}

// ── Process one company ───────────────────────────────────────────────────────

async function processCompany(company) {
  const { competitorId, cik, formType, name } = company
  console.log(`\n▶  ${name} (${formType})`)

  const filing = await getLatestFiling(cik, formType)
  if (!filing) {
    console.log(`   ⚠️  No ${formType} found — skipping`)
    return { competitorId, inserted: 0, skipped: 0 }
  }

  const sourceType = formType === 'DEF 14A' ? 'def-14a' : '20-f'
  const sourceUrl = `${EDGAR_BASE}/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${encodeURIComponent(formType)}&dateb=&owner=include&count=1`

  console.log(`   Filing: ${filing.date} | accession: ${filing.accession}`)
  await pause(PAUSE_MS)

  // Fetch the full filing text
  let docUrl
  try {
    docUrl = await getPrimaryDocUrl(cik, filing.accession)
    await pause(PAUSE_MS)
  } catch (e) {
    console.log(`   ⚠️  Could not resolve doc URL: ${e.message}`)
    return { competitorId, inserted: 0, skipped: 0 }
  }

  let html
  try {
    html = await fetchText(docUrl)
    await pause(PAUSE_MS)
  } catch (e) {
    console.log(`   ⚠️  Could not fetch filing: ${e.message}`)
    return { competitorId, inserted: 0, skipped: 0 }
  }

  const text = stripHtml(html)
  const officers = parseExecutiveOfficers(text)
  console.log(`   Found ${officers.length} executive officer(s)`)

  if (officers.length === 0) {
    console.log(`   ℹ️  No officers extracted — check filing structure manually`)
    return { competitorId, inserted: 0, skipped: 0 }
  }

  let inserted = 0
  let skipped = 0

  for (const officer of officers) {
    const row = {
      competitor_id:  competitorId,
      name:           officer.name,
      title:          officer.title,
      source_url:     sourceUrl,
      source_type:    sourceType,
      effective_date: filing.date,
      is_current:     true,
    }

    const { error } = await supabase
      .from('personnel')
      .upsert(row, { onConflict: 'competitor_id,name' })

    if (error) {
      console.log(`   ❌  ${officer.name}: ${error.message}`)
      skipped++
    } else {
      console.log(`   ✓  ${officer.name} — ${officer.title}`)
      inserted++
    }
  }

  return { competitorId, inserted, skipped }
}

// ── 8-K Item 5.02 pass: update personnel from exec_change signals ─────────────
//
// company_signals rows with signal_type = 'exec_change' represent 8-K Item 5.02 filings.
// We look for name+title patterns in the headline and body_excerpt and upsert them.

async function process8K502Signals() {
  console.log('\n▶  Processing 8-K Item 5.02 exec_change signals…')

  const { data: signals, error } = await supabase
    .from('company_signals')
    .select('id, competitor_id, headline, body_excerpt, date, source_url')
    .eq('signal_type', 'exec_change')
    .order('date', { ascending: false })

  if (error) {
    console.log(`   ❌  Could not fetch exec_change signals: ${error.message}`)
    return 0
  }

  console.log(`   Found ${signals.length} exec_change signal(s)`)

  const TITLE_KW = /\b(chief|president|vice\s+president|vp|officer|director|head|senior|general|counsel|executive|cfo|ceo|cmo|cso|cco)\b/i
  const NAME_RE_INLINE = /\b([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+){1,3})\b/g

  let inserted = 0

  for (const s of signals) {
    const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`
    if (!TITLE_KW.test(text)) continue

    // Extract name-like tokens near appointment/departure language
    const APPT_RE = /(?:appoints?|names?|promotes?|elects?|designates?)\s+([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+){1,3})\s+(?:as|to)\s+([A-Za-z ,./\-]{8,80})/i
    const m = text.match(APPT_RE)
    if (!m) continue

    const name = m[1].trim()
    const title = m[2].trim().replace(/[.,]+$/, '')
    if (!TITLE_KW.test(title)) continue

    const row = {
      competitor_id:  s.competitor_id,
      name,
      title,
      source_url:     s.source_url ?? null,
      source_type:    '8-k-5.02',
      effective_date: s.date ?? null,
      is_current:     true,
    }

    const { error: upsertErr } = await supabase
      .from('personnel')
      .upsert(row, { onConflict: 'competitor_id,name' })

    if (!upsertErr) {
      console.log(`   ✓  [8-K] ${name} (${s.competitor_id}) — ${title}`)
      inserted++
    }
  }

  console.log(`   8-K pass: ${inserted} upserted`)
  return inserted
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('ingest-proxy — executive officer roster from DEF 14A / 20-F')
  console.log('='.repeat(60))
  console.log('Note: CSL Behring (ASX filer) is NOT covered.')
  console.log('      Download csl.com/investors annual report and load manually.\n')

  const results = []
  for (const company of COMPANIES) {
    try {
      const r = await processCompany(company)
      results.push(r)
    } catch (e) {
      console.log(`   ❌  ${company.name}: ${e.message}`)
      results.push({ competitorId: company.competitorId, inserted: 0, skipped: 1 })
    }
  }

  const eightKCount = await process8K502Signals()

  console.log('\n' + '='.repeat(60))
  console.log('Summary:')
  for (const r of results) {
    console.log(`  ${r.competitorId.padEnd(15)} inserted=${r.inserted}  skipped=${r.skipped}`)
  }
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  console.log(`  8-K 5.02 pass:   inserted=${eightKCount}`)
  console.log(`  Total inserted:  ${totalInserted + eightKCount}`)
  console.log('\nDone.')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
