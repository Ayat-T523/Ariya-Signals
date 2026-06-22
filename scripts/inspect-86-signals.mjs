/**
 * Name: inspect-86-signals
 * Description: Finds company_signals rows where headline contains '86' across all
 *   competitors and prints them. For Takeda rows where '86' clearly refers to a
 *   clinical endpoint (attack rate reduction / vs placebo) rather than market share,
 *   prepends "Phase III result: " to the headline to make the clinical context explicit
 *   in the War Room display.
 *
 * Run in inspect-only mode first (no updates):
 *   node --env-file=.env.local scripts/inspect-86-signals.mjs
 *
 * Then run with --fix to apply updates:
 *   node --env-file=.env.local scripts/inspect-86-signals.mjs --fix
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/inspect-86-signals.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const FIX_MODE = process.argv.includes('--fix')

// Patterns that indicate clinical efficacy language (not market share)
const CLINICAL_PATTERNS = [
  /reduction/i,
  /vs\.?\s+placebo/i,
  /attack\s+rate/i,
  /efficacy/i,
  /clinical\s+trial/i,
  /phase\s+(i{1,3}|[123])/i,
  /endpoint/i,
  /response\s+rate/i,
]

// Patterns that indicate market share language (leave as-is)
const MARKET_PATTERNS = [
  /market\s+share/i,
  /prophylaxis\s+share/i,
  /share\s+of\s+market/i,
  /commercial\s+share/i,
]

console.log('\n🔍  Searching company_signals for headlines containing "86"...\n')

const { data: rows, error } = await supabase
  .from('company_signals')
  .select('id, competitor_id, signal_type, date, headline, body_excerpt, source_url')
  .ilike('headline', '%86%')
  .order('date', { ascending: false })

if (error) {
  console.error('❌  Query failed:', error.message)
  process.exit(1)
}

if (!rows || rows.length === 0) {
  console.log('✅  No rows found with "86" in headline.')
  process.exit(0)
}

console.log(`Found ${rows.length} row(s):\n`)
console.log('─'.repeat(80))

let updateCount = 0

for (const row of rows) {
  const isClinical = CLINICAL_PATTERNS.some(p => p.test(row.headline ?? ''))
  const isMarket   = MARKET_PATTERNS.some(p => p.test(row.headline ?? ''))
  const needsPrefix = isClinical && !isMarket && row.competitor_id === 'takeda'
    && !(row.headline ?? '').startsWith('Phase III result:')

  console.log(`[${row.competitor_id}] ${row.date ?? 'no date'} · ${row.signal_type}`)
  console.log(`  Headline    : ${row.headline}`)
  console.log(`  Excerpt     : ${(row.body_excerpt ?? '').slice(0, 120)}…`)
  console.log(`  Source      : ${row.source_url ?? 'n/a'}`)
  console.log(`  Assessment  : ${isMarket ? '✅ market share language — leave as-is' : isClinical ? '⚠️  clinical language — ambiguous as market share claim' : '❓ unclear context'}`)
  if (needsPrefix) {
    console.log(`  Action      : ${FIX_MODE ? '🔧 updating headline with clinical context prefix' : '→ run with --fix to prepend "Phase III result: "'}`)
  }
  console.log()

  if (FIX_MODE && needsPrefix) {
    const newHeadline = `Phase III result: ${row.headline}`
    const { error: updateError } = await supabase
      .from('company_signals')
      .update({ headline: newHeadline })
      .eq('id', row.id)

    if (updateError) {
      console.error(`  ❌ Update failed for ${row.id}: ${updateError.message}`)
    } else {
      console.log(`  ✅ Updated: "${newHeadline}"`)
      updateCount++
    }
  }
}

console.log('─'.repeat(80))
console.log(`\nTotal rows with "86" in headline: ${rows.length}`)
if (FIX_MODE) {
  console.log(`Rows updated with clinical context prefix: ${updateCount}`)
} else {
  const toFix = rows.filter(r => {
    const isClinical = CLINICAL_PATTERNS.some(p => p.test(r.headline ?? ''))
    const isMarket   = MARKET_PATTERNS.some(p => p.test(r.headline ?? ''))
    return isClinical && !isMarket && r.competitor_id === 'takeda'
      && !(r.headline ?? '').startsWith('Phase III result:')
  })
  if (toFix.length > 0) {
    console.log(`\n${toFix.length} row(s) eligible for clinical context prefix.`)
    console.log('Re-run with --fix to apply updates:\n')
    console.log('  node --env-file=.env.local scripts/inspect-86-signals.mjs --fix\n')
  } else {
    console.log('\nNo updates needed — all rows either have market context or are already prefixed.\n')
  }
}
