/**
 * retype-signals.mjs — one-time signal_type correction (§4.1, unblocks D11).
 *
 * signal_type decides the arc, and the arc decides importance (§4.2), so rows
 * typed by the old rules are mis-ranked. Two corrections, both deterministic:
 *
 *   1. refineSignalType() on company announcements — SEC item codes cannot
 *      express a regulatory event (approvals are filed under item 8.01 "Other
 *      Events"), and the IR RSS path typed everything press_release. Also
 *      demotes rows the previous loose /fda|approv|granted/ regex over-typed as
 *      regulatory_catalyst when they were really trial readouts or earnings.
 *   2. EMA rows move hta_decision -> regulatory_catalyst. An EMA marketing
 *      authorisation is a regulatory decision; HTA (NICE, G-BA, HAS, AIFA) is
 *      reimbursement and stays hta_decision.
 *
 * SAFETY:
 *   - DRY-RUN by default; --apply writes.
 *   - Only the signal_type column is written. Nothing else is touched, and no
 *     row is created or deleted.
 *   - publication, congress_abstract, exec_change and deal are never refined —
 *     a journal article about an approval is still evidence.
 *   - Idempotent: re-running proposes nothing once applied.
 *
 * Usage:
 *   node --env-file=.env.local scripts/retype-signals.mjs           # dry-run
 *   node --env-file=.env.local scripts/retype-signals.mjs --apply
 */

import { createSupabaseClient, refineSignalType } from './lib/signal-gate.mjs'

const APPLY = process.argv.includes('--apply')
const trunc = (s, n) => (s ?? '').replace(/\s+/g, ' ').slice(0, n)

// EMA authorisations were written by the EU-HTA scraper with an "EMA:" prefix.
const IS_EMA_AUTHORISATION = (r) =>
  r.signal_type === 'hta_decision' && /^EMA:/i.test(r.headline ?? '')

async function main() {
  console.log(`\n── Re-type signals (${APPLY ? 'APPLY — WILL WRITE' : 'DRY-RUN — no writes'}) ──\n`)
  const supabase = createSupabaseClient()

  const { data: rows, error } = await supabase
    .from('company_signals')
    .select('id, signal_type, data_source, competitor_id, headline, body_excerpt')
  if (error) { console.error(error.message); process.exit(1) }

  const changes = []
  for (const r of rows) {
    let next = r.signal_type
    let why  = ''
    if (IS_EMA_AUTHORISATION(r)) {
      next = 'regulatory_catalyst'
      why  = 'EMA authorisation is regulatory, not HTA'
    } else {
      next = refineSignalType(r.headline, r.body_excerpt, r.signal_type)
      if (next !== r.signal_type) why = 'refined from the source text'
    }
    if (next !== r.signal_type) changes.push({ ...r, next, why })
  }

  const pairs = {}
  for (const c of changes) {
    const k = `${c.signal_type} -> ${c.next}`
    pairs[k] = (pairs[k] ?? 0) + 1
  }
  console.log(`rows: ${rows.length} | proposed re-types: ${changes.length}`)
  console.log('transitions:', JSON.stringify(pairs, null, 1))

  console.log('\n── every proposed change ──')
  for (const c of changes) {
    console.log(`  ${c.signal_type} -> ${c.next}  [${c.data_source}/${c.competitor_id}]`)
    console.log(`     ${trunc(c.headline, 76)}`)
  }

  if (!APPLY) { console.log('\n── DRY-RUN complete. No writes. Re-run with --apply. ──\n'); return }

  console.log('\n── Applying ──')
  // Group by target type so each type is one bulk update.
  const byType = new Map()
  for (const c of changes) {
    if (!byType.has(c.next)) byType.set(c.next, [])
    byType.get(c.next).push(c.id)
  }
  let updated = 0
  for (const [type, ids] of byType) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { error: e } = await supabase
        .from('company_signals')
        .update({ signal_type: type })
        .in('id', chunk)
      if (e) console.error(`  ❌  ${type}: ${e.message}`)
      else { updated += chunk.length; console.log(`  ✅  ${type}: ${chunk.length}`) }
    }
  }
  console.log(`\n── Applied: ${updated} rows re-typed. ──\n`)
}
main().catch(e => { console.error(e); process.exit(1) })
