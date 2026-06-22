/**
 * Name: delete-fake-csl-rows
 * Description: Deletes 5 fabricated CSL Behring document rows that were seeded
 *   during the initial demo setup. These rows reference URLs that do not resolve
 *   to real public documents and were never fetched/stored as real full_text.
 *
 * Usage: node --env-file=.env.local scripts/delete-fake-csl-rows.mjs
 *
 * What to expect: deletes exactly 5 rows from the documents table.
 *   The real CSL Behring documents (NICE TA1101 and Andembry EMA EPAR) remain intact.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/delete-fake-csl-rows.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// These 5 URLs were fabricated during demo seeding and do not point to real documents.
const FAKE_URLS = [
  'https://www.csl.com/investors/reports/2026-q3-update',
  'https://www.cslbehring.com/vita/2026/andembry-germany-formulary',
  'https://www.cslbehring.com/careers/leadership',
  'https://www.cslbehring.com/vita/2025/andembry-fda-approval',
  'https://www.cslbehring.com/vita/2025/andembry-ec-approval',
]

console.log('\n🗑️  Deleting fabricated CSL Behring document rows...\n')

let deleted = 0
const errors = []

for (const url of FAKE_URLS) {
  // Step 1 — find the document id
  const { data: docRows, error: findErr } = await supabase
    .from('documents')
    .select('id')
    .eq('source_url', url)

  if (findErr) {
    errors.push(`${url}: find failed — ${findErr.message}`)
    console.log(`  ❌  ${url.split('/').pop()} — find: ${findErr.message}`)
    continue
  }
  if (!docRows || docRows.length === 0) {
    console.log(`  ⚠️  ${url.split('/').pop()} — not found (may already be deleted)`)
    continue
  }

  const docId = docRows[0].id

  // Step 2 — null out FK references in company_signals
  const { error: nullErr } = await supabase
    .from('company_signals')
    .update({ document_id: null })
    .eq('document_id', docId)

  if (nullErr) {
    errors.push(`${url}: could not nullify FK — ${nullErr.message}`)
    console.log(`  ❌  ${url.split('/').pop()} — nullify FK: ${nullErr.message}`)
    continue
  }

  // Step 3 — delete the document row
  const { error: delErr } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId)

  if (delErr) {
    errors.push(`${url}: delete failed — ${delErr.message}`)
    console.log(`  ❌  ${url.split('/').pop()} — delete: ${delErr.message}`)
  } else {
    deleted++
    console.log(`  ✅  Deleted: ${url}`)
  }
}

console.log(`
─────────────────────────────────────────
  Rows deleted: ${deleted} / ${FAKE_URLS.length}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────

Real CSL Behring documents preserved:
  • NICE TA1101 (garadacimab / Andembry)
  • EMA EPAR: Andembry

Manual action still required:
  • CSL FY2025 annual report → download from csl.com/investors and upload to documents table
`)
