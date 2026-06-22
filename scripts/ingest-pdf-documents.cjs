/**
 * Name: ingest-pdf-documents
 * Description: Ingests locally downloaded PDF documents into the Supabase documents table.
 *   Extracts full text from each PDF using pdf-parse and upserts into documents.
 *
 *   Documents:
 *   1. CSL Limited FY2025 Annual Report (ASX filer — not on SEC EDGAR)
 *      Source: https://investors.csl.com/annualreport/2025/
 *   2. Andembry EMA EPAR Product Information PDF (full SmPC)
 *      Source: https://www.ema.europa.eu/documents/product-information/andembry-epar-product-information_en.pdf
 *
 * Usage: node --env-file=.env.local scripts/ingest-pdf-documents.cjs
 *
 * Requires: npm install --save-dev pdf-parse
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { readFileSync }  = require('fs')
const pdfParse          = require('pdf-parse')

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/ingest-pdf-documents.cjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const MAX_CHARS = 300_000

const DOCUMENTS = [
  {
    localPath:    'C:\\Users\\AyatTayebulla\\Downloads\\CSL 2025 Annual Report.pdf',
    competitorId: 'csl-behring',
    sourceUrl:    'https://investors.csl.com/annualreport/2025/',
    documentType: 'annual-report',
    sourceLabel:  'CSL Investors',
    datePublished: '2025-08-01',
    description:  'CSL Limited FY2025 Annual Report — ASX filer; CSL Behring pipeline, Andembry commercial launch, group financials',
  },
  {
    localPath:    'C:\\Users\\AyatTayebulla\\Downloads\\andembry-epar-product-information_en.pdf',
    competitorId: 'csl-behring',
    sourceUrl:    'https://www.ema.europa.eu/documents/product-information/andembry-epar-product-information_en.pdf',
    documentType: 'EMA-EPAR',
    sourceLabel:  'EMA',
    datePublished: '2025-02-10',
    description:  'EMA EPAR: Andembry (garadacimab) — full SmPC product information PDF, EC authorisation 10 February 2025',
  },
]

async function main() {
  console.log('\n📄  Ingesting PDF documents into Supabase...\n')

  let ingested = 0
  const errors  = []

  for (const doc of DOCUMENTS) {
    process.stdout.write(`  ${doc.description.slice(0, 65).padEnd(66)}`)

    let fullText
    let pageCount
    try {
      const buffer = readFileSync(doc.localPath)
      const parsed = await pdfParse(buffer)
      fullText  = parsed.text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
      pageCount = parsed.numpages
    } catch (e) {
      errors.push(`${doc.localPath}: parse failed — ${e.message}`)
      console.log(`❌  ${e.message}`)
      continue
    }

    const wordCount = fullText.split(/\s+/).filter(Boolean).length

    if (wordCount < 100) {
      errors.push(`${doc.localPath}: too little text (${wordCount} words) — PDF may be image-based`)
      console.log(`⚠️  only ${wordCount} words — PDF may be image-based; skipping`)
      continue
    }

    const { error: upsertError } = await supabase
      .from('documents')
      .upsert(
        {
          competitor_id:  doc.competitorId,
          source_url:     doc.sourceUrl,
          document_type:  doc.documentType,
          source_label:   doc.sourceLabel,
          date_published: doc.datePublished,
          full_text:      fullText,
          word_count:     wordCount,
        },
        { onConflict: 'source_url', ignoreDuplicates: false }
      )

    if (upsertError) {
      errors.push(`${doc.sourceUrl}: upsert failed — ${upsertError.message}`)
      console.log(`❌  upsert: ${upsertError.message}`)
    } else {
      ingested++
      console.log(`✅  ${wordCount.toLocaleString()} words  (${pageCount} pages)`)
    }
  }

  console.log(`
─────────────────────────────────────────
  Documents ingested: ${ingested} / ${DOCUMENTS.length}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
