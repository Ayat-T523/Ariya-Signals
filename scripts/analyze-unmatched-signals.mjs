/**
 * analyze-unmatched-signals.mjs — READ-ONLY review aid (§2.2/review stage).
 *
 * Categorises company_signals rows that have NO asset_id, to separate the
 * genuinely-not-taggable (corporate/no-drug, or an untracked HAE drug outside
 * the tracked asset universe) from a fixable recall miss (a TRACKED drug that
 * should have resolved but didn't). No writes.
 *
 * Usage: node --env-file=.env.local scripts/analyze-unmatched-signals.mjs
 */

import { createSupabaseClient, loadAssetResolver, resolveAsset } from './lib/signal-gate.mjs'

// HAE-relevant drugs/brands NOT in the tracked 11-asset universe. Presence of one
// of these means the signal IS about a drug, just not one we track — genuinely
// not taggable today, and a candidate for universe expansion (not a bug).
const UNTRACKED_HAE = [
  'cinryze', 'berinert', 'haegarda', 'ruconest', 'conestat', 'cetor',
  'ecallantide', 'kalbitor', 'avoralstat', 'kalbitor',
  'c1 esterase inhibitor', 'c1-inh', 'c1 inhibitor', 'rhc1inh',
]

// Corporate / financial / governance markers → no drug by nature.
const CORPORATE = [
  'financial results', 'results of operations', 'quarter', 'full year', 'earnings',
  'offering', 'registered direct', 'prospectus', 'annual report', 'annual meeting',
  'appoints', 'appointment', 'board of directors', 'chief ', 'officer', 'resignation',
  'material definitive agreement', 'private placement', 'proposed public offering',
  'stockholder', 'nasdaq', 'credit facility', 'senior notes',
  // terse SEC-derived headlines (the EDGAR bulk)
  'sec 6-k', 'sec 8-k', '6-k filing', '8-k filing', 'other events', 'the company announced',
  'entry into a material', 'license agreement', 'amendment', 'pharmaceuticals, inc',
  'therapeutics, inc', 'general meeting', 'shareholders', 'presents at', 'to present',
  'conference', 'webcast', 'business update', 'corporate update', 'form 10',
]
// SEC/press headlines that lead with a filing date, e.g. "On May 14, 2025, BioCryst..."
const DATE_LEAD = /^on \w+ \d{1,2},? \d{4}/i

// A dev-code-like token, e.g. ABC-123, XYZ1234 — hints at a pipeline drug.
const DEV_CODE = /\b[a-z]{2,4}-?\d{3,5}\b/i

function has(text, list) { return list.find(k => text.includes(k)) ?? null }

async function main() {
  const supabase = createSupabaseClient()
  const resolver = await loadAssetResolver(supabase)

  const { data: rows, error } = await supabase
    .from('company_signals')
    .select('id, signal_type, competitor_id, headline, body_excerpt')
    .is('asset_id', null)
  if (error) { console.error(error.message); process.exit(1) }

  const cat = { exec_change: [], untracked_drug: [], corporate: [], generic_hae: [], dev_code: [], possible_miss: [], other: [] }
  const untrackedHits = {}

  for (const r of rows) {
    const text = `${r.headline ?? ''} ${r.body_excerpt ?? ''}`.toLowerCase()

    // sanity: confirm the resolver really finds no tracked drug
    const { inn } = resolveAsset(text, resolver)
    if (inn) { cat.possible_miss.push({ ...r, note: `resolver now matches ${inn}` }); continue }

    if (r.signal_type === 'exec_change') { cat.exec_change.push(r); continue }

    const u = has(text, UNTRACKED_HAE)
    if (u) { untrackedHits[u] = (untrackedHits[u] ?? 0) + 1; cat.untracked_drug.push({ ...r, hit: u }); continue }

    if (has(text, CORPORATE) || DATE_LEAD.test((r.headline ?? '').trim())) { cat.corporate.push(r); continue }
    if (text.includes('hereditary angioedema') || text.includes('angioedema') || text.includes(' hae'))
                                          { cat.generic_hae.push(r); continue }
    if (DEV_CODE.test(text))             { cat.dev_code.push(r); continue }
    cat.other.push(r)
  }

  const n = (a) => a.length
  console.log(`\n── Unmatched signal analysis (${rows.length} rows with no asset_id) ──\n`)
  console.log('GENUINELY NOT TAGGABLE (correct as NULL):')
  console.log(`  exec_change (corporate by nature):        ${n(cat.exec_change)}`)
  console.log(`  corporate / financial / governance:       ${n(cat.corporate)}`)
  console.log(`  generic HAE science (no drug named):      ${n(cat.generic_hae)}`)
  console.log(`  untracked HAE drug (outside our 11):      ${n(cat.untracked_drug)}`)
  console.log('\nWORTH A LOOK:')
  console.log(`  dev-code token, no tracked/untracked hit: ${n(cat.dev_code)}  (possible untracked pipeline drug)`)
  console.log(`  other / uncategorised:                    ${n(cat.other)}`)
  console.log(`  POSSIBLE MISS (tracked drug, should match): ${n(cat.possible_miss)}  ← recall bug if > 0`)

  if (Object.keys(untrackedHits).length) {
    console.log('\nUntracked HAE drugs mentioned (universe-expansion candidates):')
    for (const [k, v] of Object.entries(untrackedHits).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${v}`)
  }

  const sample = (label, arr, n2 = 6) => {
    if (!arr.length) return
    console.log(`\n── sample: ${label} ──`)
    for (const r of arr.slice(0, n2)) console.log(`  [${r.signal_type}] (${r.competitor_id})${r.hit ? ' {' + r.hit + '}' : ''} ${(r.headline || '').replace(/\s+/g, ' ').slice(0, 66)}`)
  }
  sample('untracked HAE drug', cat.untracked_drug, 10)
  sample('dev-code (possible untracked pipeline)', cat.dev_code, 8)
  sample('other / uncategorised', cat.other, 8)
  sample('POSSIBLE MISS', cat.possible_miss, 10)
}
main().catch(e => { console.error(e); process.exit(1) })
