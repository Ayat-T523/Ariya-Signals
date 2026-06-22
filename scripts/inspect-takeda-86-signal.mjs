/**
 * Name: inspect-takeda-86-signal
 * Description: Finds company_signals rows where headline contains '86' (or similar
 *   clinical percentages), prints them, and prepends "Phase III result: " to any
 *   headline where the figure is clearly clinical efficacy rather than market share.
 *   Also checks all competitors, not just Takeda.
 * Usage: node --env-file=.env.local scripts/inspect-takeda-86-signal.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Patterns that indicate the % is a clinical efficacy figure, not market share
const CLINICAL_EFFICACY_RE = /reduction|vs\.?\s*placebo|vs\s+placebo|attack rate|attack\s+rate|trial|phase [23]|phase iii|endpoint|efficacy|responder|response rate|remission|primary endpoint/i

// Patterns that would indicate it IS a market share / revenue figure
const MARKET_SHARE_RE = /market share|share of|revenue|sales|patients treated|units sold/i

async function main() {
  console.log('\n🔍  Searching all competitors for headlines containing percentage figures...\n')

  // Broad search — any headline with a % or common efficacy percentages
  const { data, error } = await supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, date, headline, body_excerpt, source_url')
    .or('headline.ilike.%86%,headline.ilike.%87%,headline.ilike.%85%,headline.ilike.%reduction%,headline.ilike.%efficacy%')
    .order('date', { ascending: false })

  if (error) {
    console.error('❌  Query failed:', error.message)
    process.exit(1)
  }

  console.log(`Found ${data.length} signals with potential efficacy % in headline.\n`)

  const toUpdate = []

  for (const row of data) {
    const h = row.headline ?? ''
    const b = row.body_excerpt ?? ''
    const text = `${h} ${b}`

    const isClinical  = CLINICAL_EFFICACY_RE.test(text)
    const isMarket    = MARKET_SHARE_RE.test(text)
    const alreadyTagged = h.startsWith('Phase') || h.startsWith('Clinical')

    console.log(`─── ${row.competitor_id.padEnd(14)} [${row.date}]`)
    console.log(`    Headline:  ${h.slice(0, 120)}`)
    console.log(`    Excerpt:   ${b.slice(0, 120)}`)
    console.log(`    Clinical?  ${isClinical}  |  Market share?  ${isMarket}  |  Already tagged?  ${alreadyTagged}`)

    // Update if: clinical figure, not already tagged as market share, not already prefixed
    if (isClinical && !isMarket && !alreadyTagged) {
      toUpdate.push(row)
      console.log(`    → WILL prefix with "Phase III result: "`)
    }
    console.log()
  }

  if (!toUpdate.length) {
    console.log('✅  No ambiguous clinical % headlines found — nothing to update.')
    return
  }

  console.log(`\nUpdating ${toUpdate.length} rows...\n`)
  let updated = 0
  const errors = []

  for (const row of toUpdate) {
    const newHeadline = `Phase III result: ${row.headline}`
    const { error: updateErr } = await supabase
      .from('company_signals')
      .update({ headline: newHeadline })
      .eq('id', row.id)

    if (updateErr) {
      errors.push(`${row.id}: ${updateErr.message}`)
      console.log(`  ❌  ${row.competitor_id}: ${updateErr.message}`)
    } else {
      updated++
      console.log(`  ✅  ${row.competitor_id}: prefixed — "${newHeadline.slice(0, 80)}…"`)
    }
  }

  console.log(`
─────────────────────────────────────────
  Inspected: ${data.length}
  Updated:   ${updated}
${errors.length ? `  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
}

main()
