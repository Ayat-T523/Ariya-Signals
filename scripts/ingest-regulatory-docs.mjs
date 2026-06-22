/**
 * Regulatory document ingest — NICE Technology Appraisals and EMA EPAR product pages.
 * Usage: node --env-file=.env.local scripts/ingest-regulatory-docs.mjs
 *
 * Sources:
 *   NICE TAs  — https://www.nice.org.uk/guidance/ta{NNN}  (free, no auth)
 *   EMA EPARs — https://www.ema.europa.eu/en/medicines/human/EPAR/{name}  (free, no auth)
 *
 * Stores: document_type = 'NICE-TA' or 'EMA-EPAR', source_label = 'NICE' or 'EMA'.
 * Upsert is idempotent on source_url — safe to re-run; updates full_text if content changed.
 *
 * Requires: supabase/documents.sql to have been run first.
 *
 * To add more documents: append entries to the DOCUMENTS array below.
 */

import { createClient } from '@supabase/supabase-js'

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/ingest-regulatory-docs.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS = 30_000
const MAX_CHARS  = 200_000

// ── Document list ─────────────────────────────────────────────────────────────
//
// Add entries here as new NICE TAs or EMA EPARs become relevant.
// url:           the canonical public page — used as the unique key in documents.source_url
// competitorId:  must match src/data/competitors.json id field
// documentType:  'NICE-TA' | 'EMA-EPAR'
// datePublished: ISO date of the guidance/approval; null if unknown

const DOCUMENTS = [
  // ── NICE Technology Appraisals ────────────────────────────────────────────
  {
    url:           'https://www.nice.org.uk/guidance/ta1101',
    competitorId:  'csl-behring',
    documentType:  'NICE-TA',
    sourceLabel:   'NICE',
    datePublished: '2025-10-08',
    description:   'NICE TA1101: garadacimab (Andembry) for preventing HAE attacks in adults and adolescents',
  },

  // ── EMA European Public Assessment Reports ────────────────────────────────
  //
  // NOTE: The EMA website uses antibot (Drupal Antibot module) that returns HTTP
  // 404 to headless fetch() clients. Entries that work from a real browser but
  // fail from this script are noted below. For those drugs, download the EPAR
  // product-information PDF manually and ingest via ingest-pdf-documents.mjs.
  //
  // Andembry: no HTML EPAR product page exists yet on the EMA website.
  //   Use ingest-pdf-documents.mjs with the locally-downloaded PDF instead.
  //   PDF: https://www.ema.europa.eu/en/documents/product-information/andembry-epar-product-information_en.pdf
  //
  // Takhzyro: HTML page exists (ema.europa.eu/en/medicines/human/EPAR/takhzyro)
  //   but antibot blocks headless requests. Download the PDF and ingest via
  //   ingest-pdf-documents.mjs.
  //   PDF: https://www.ema.europa.eu/en/documents/product-information/takhzyro-epar-product-information_en.pdf
  //
  // Orladeyo: same antibot issue as Takhzyro.
  //   PDF: https://www.ema.europa.eu/en/documents/product-information/orladeyo-epar-product-information_en.pdf
  {
    url:           'https://www.ema.europa.eu/en/medicines/human/EPAR/dawnzera',
    competitorId:  'ionis',
    documentType:  'EMA-EPAR',
    sourceLabel:   'EMA',
    datePublished: '2026-01-19',
    description:   'EMA EPAR: Dawnzera (donidalorsen) — EC authorisation 19 January 2026',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi,   ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi,       ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
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

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n📋  Ingesting regulatory documents (NICE TAs + EMA EPARs)...\n')

let ingested = 0
const errors  = []

for (const doc of DOCUMENTS) {
  process.stdout.write(`  ${doc.description.slice(0, 65).padEnd(66)}`)

  let fullText
  try {
    const html = await fetchHtml(doc.url)
    fullText   = stripHtml(html).slice(0, MAX_CHARS)
  } catch (e) {
    errors.push(`${doc.url}: fetch failed — ${e.message}`)
    console.log(`❌  ${e.message}`)
    await new Promise(r => setTimeout(r, 500))
    continue
  }

  const words = countWords(fullText)

  // Guard: if we got very little text the page may have returned a JS-only shell
  if (words < 100) {
    errors.push(`${doc.url}: too little content (${words} words) — page may require JS rendering`)
    console.log(`⚠️  only ${words} words — may be JS-rendered; skipping`)
    await new Promise(r => setTimeout(r, 500))
    continue
  }

  const { error: upsertError } = await supabase
    .from('documents')
    .upsert(
      {
        competitor_id:  doc.competitorId,
        source_url:     doc.url,
        document_type:  doc.documentType,
        source_label:   doc.sourceLabel,
        date_published: doc.datePublished ?? null,
        full_text:      fullText,
        word_count:     words,
      },
      { onConflict: 'source_url', ignoreDuplicates: false }
    )

  if (upsertError) {
    errors.push(`${doc.url}: upsert failed — ${upsertError.message}`)
    console.log(`❌  upsert failed: ${upsertError.message}`)
  } else {
    ingested++
    console.log(`✅  ${words.toLocaleString()} words`)
  }

  // Polite pause between requests
  await new Promise(r => setTimeout(r, 500))
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`
─────────────────────────────────────────
  Documents ingested: ${ingested} / ${DOCUMENTS.length}
${errors.length ? `\n  Warnings / errors (${errors.length}):\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────

Note on JS-rendered pages:
  EMA product pages sometimes return a minimal HTML shell when fetched
  server-side (content loads via JavaScript in a browser). If you see
  "too little content" warnings for EMA entries, the full EPAR text is
  still available via the EMA website — this does not block A7 (Gantt).

To add more documents: append entries to the DOCUMENTS array at the top.
`)
