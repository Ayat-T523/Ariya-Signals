/**
 * Name: fix-fda-label-dates
 * Description: Fixes two FDA label date_published values that were stored with year
 *   2020 instead of 2025 — a data entry error from the initial seed.
 *
 *   Corrections (verified against DailyMed 2026-06-19):
 *   • Dawnzera (donidalorsen) setid 3ff501e0 — label issued 08/2025, revised 09/2025
 *     Wrong: 2020-10-01 → Correct: 2025-08-01
 *   • Andembry (garadacimab-gxii) setid 07b0b671 — label published 2025-07-10
 *     Wrong: 2020-07-10 → Correct: 2025-07-10
 *
 * Usage: node --env-file=.env.local scripts/fix-fda-label-dates.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/fix-fda-label-dates.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const FIXES = [
  {
    description:  'Dawnzera (donidalorsen) FDA label',
    setid:        '3ff501e0-f75f-07da-e063-6294a90a0cb7',
    wrongDate:    '2020-10-01',
    correctDate:  '2025-08-01',
    source:       'DailyMed: label issued 08/2025, revised 09/2025 (NDA 219407)',
  },
  {
    description:  'Andembry (garadacimab-gxii) FDA label',
    setid:        '07b0b671-db81-49f0-a402-0c0219db7fa2',
    wrongDate:    '2020-07-10',
    correctDate:  '2025-07-10',
    source:       'DailyMed: label published 2025-07-10 (BLA761367)',
  },
]

console.log('\n🔧  Fixing FDA label date_published values...\n')

let fixed = 0
const errors = []

for (const fix of FIXES) {
  const url = `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${fix.setid}`

  const { data, error } = await supabase
    .from('documents')
    .update({ date_published: fix.correctDate })
    .eq('source_url', url)
    .eq('date_published', fix.wrongDate)
    .select('id, date_published')

  if (error) {
    errors.push(`${fix.description}: ${error.message}`)
    console.log(`  ❌  ${fix.description} — ${error.message}`)
  } else if (!data || data.length === 0) {
    console.log(`  ⚠️  ${fix.description} — row not found (may already be fixed or URL mismatch)`)
    console.log(`      URL tried: ${url}`)
  } else {
    fixed++
    console.log(`  ✅  ${fix.description}`)
    console.log(`      ${fix.wrongDate} → ${fix.correctDate}`)
    console.log(`      Source: ${fix.source}`)
  }
}

console.log(`
─────────────────────────────────────────
  Dates fixed: ${fixed} / ${FIXES.length}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
