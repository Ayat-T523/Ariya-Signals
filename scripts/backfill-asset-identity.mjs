/**
 * backfill-asset-identity.mjs — Ariya Light INN-persistence fix, Phase 3 (§2.1).
 *
 * Populates inn + asset_id on EXISTING company_signals rows that predate the
 * go-forward ingest fix. Deterministic text match only: resolves the drug named
 * in headline + body_excerpt against the shared asset resolver (asset_lexicon
 * joined to assets). Unmatched rows are left NULL — never guessed.
 *
 * SAFETY:
 *   - DRY-RUN by default. Prints proposed changes + coverage; writes NOTHING.
 *     Add --apply to actually write.
 *   - Only ever writes the inn + asset_id columns. Never touches ai_* / enrichment
 *     columns, or any other field.
 *   - Only considers rows where inn IS NULL (idempotent — never overwrites).
 *   - exec_change is corporate by nature (no asset) and is skipped entirely.
 *   - Flags cross-attributions (resolved drug owner != row competitor_id) so they
 *     can be eyeballed before applying.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-asset-identity.mjs            # dry-run
 *   node --env-file=.env.local scripts/backfill-asset-identity.mjs --apply    # write
 *   node --env-file=.env.local scripts/backfill-asset-identity.mjs --sample 40
 */

import { createSupabaseClient, loadAssetResolver } from './lib/signal-gate.mjs'

const APPLY   = process.argv.includes('--apply')
const sampleI = process.argv.indexOf('--sample')
const SAMPLE  = sampleI !== -1 ? parseInt(process.argv[sampleI + 1], 10) : 25

// Corporate by nature — a leadership change has no drug asset. Never attempt.
const SKIP_TYPES = new Set(['exec_change'])

function trunc(s, n) { return (s ?? '').replace(/\s+/g, ' ').slice(0, n) }

/**
 * Collect every DISTINCT drug named in the text (identity entries only; generic
 * HAE terms are skipped). Deduped by canonical inn. Unlike the go-forward
 * resolveAsset (first-match, §2.1/J1), the backfill sees all named drugs so it
 * can apply the competitor_id tiebreaker below.
 */
function resolveAllDrugs(textLower, resolver) {
  const byInn = new Map()
  for (const [term, identity] of resolver) {
    if (identity.inn == null) continue            // relevance-only term, not a drug
    if (!textLower.includes(term)) continue
    if (!byInn.has(identity.inn)) byInn.set(identity.inn, identity)
  }
  return [...byInn.values()]
}

async function main() {
  console.log(`\n── Backfill asset identity (${APPLY ? 'APPLY — WILL WRITE' : 'DRY-RUN — no writes'}) ──\n`)

  const supabase = createSupabaseClient()
  const resolver = await loadAssetResolver(supabase)
  console.log(`Resolver: ${resolver.size} terms loaded.\n`)

  // Candidates: only rows that don't already carry an inn (idempotent).
  const { data: rows, error } = await supabase
    .from('company_signals')
    .select('id, signal_type, competitor_id, headline, body_excerpt')
    .is('inn', null)
  if (error) { console.error(`❌  load failed: ${error.message}`); process.exit(1) }

  const proposals = []
  const stats = {}   // signal_type → { scanned, matched, unmatched, skipped }
  let tiebroken = 0  // rows where the competitor_id tiebreaker overrode first-match

  for (const row of rows) {
    const st = (stats[row.signal_type] ??= { scanned: 0, matched: 0, unmatched: 0, skipped: 0 })
    st.scanned++

    if (SKIP_TYPES.has(row.signal_type)) { st.skipped++; continue }

    const text = `${row.headline ?? ''} ${row.body_excerpt ?? ''}`.toLowerCase()
    const drugs = resolveAllDrugs(text, resolver)

    if (drugs.length === 0) { st.unmatched++; continue }   // no drug named → honest null

    // Tiebreaker (B): when >1 drug is named, prefer the one owned by this row's
    // competitor_id; otherwise keep the first drug named (a genuine mis-tag or a
    // lexicon owner error will still resolve to the real drug in the text).
    const own = drugs.find(d => d.competitorId === row.competitor_id)
    const chosen = own ?? drugs[0]
    if (own && own !== drugs[0]) tiebroken++

    st.matched++
    proposals.push({
      id: row.id,
      signal_type: row.signal_type,
      competitor_id: row.competitor_id,
      headline: row.headline,
      inn: chosen.inn,
      assetId: chosen.assetId,
      resolvedCompetitor: chosen.competitorId,
      namedCount: drugs.length,
      // sebetralstat (home asset) has null competitor_id in the lexicon → not a mismatch
      mismatch: chosen.competitorId != null && chosen.competitorId !== row.competitor_id,
    })
  }

  // ── Coverage table ──────────────────────────────────────────────────────────
  console.log('Coverage by signal_type:')
  console.log('  type'.padEnd(24) + 'scanned  matched  unmatched  skipped')
  let totScan = 0, totMatch = 0, totUnmatch = 0, totSkip = 0
  for (const [type, s] of Object.entries(stats).sort()) {
    console.log(
      `  ${type.padEnd(22)}${String(s.scanned).padStart(7)}${String(s.matched).padStart(9)}` +
      `${String(s.unmatched).padStart(11)}${String(s.skipped).padStart(9)}`,
    )
    totScan += s.scanned; totMatch += s.matched; totUnmatch += s.unmatched; totSkip += s.skipped
  }
  console.log('  ' + '─'.repeat(50))
  console.log(
    `  ${'TOTAL'.padEnd(22)}${String(totScan).padStart(7)}${String(totMatch).padStart(9)}` +
    `${String(totUnmatch).padStart(11)}${String(totSkip).padStart(9)}`,
  )

  const withAsset = proposals.filter(p => p.assetId != null).length
  const mismatches = proposals.filter(p => p.mismatch)
  console.log(`\nProposed writes: ${proposals.length}  (asset_id resolved: ${withAsset}, inn-only: ${proposals.length - withAsset})`)
  console.log(`Tiebreaker applied (multi-drug rows resolved to row's own competitor): ${tiebroken}`)
  console.log(`Cross-attributions remaining (resolved owner != row competitor_id): ${mismatches.length}`)

  // ── Sample ───────────────────────────────────────────────────────────────────
  console.log(`\nSample (${Math.min(SAMPLE, proposals.length)} of ${proposals.length}):`)
  for (const p of proposals.slice(0, SAMPLE)) {
    const flag = p.mismatch ? `  ⚠️ owner→${p.resolvedCompetitor}` : ''
    console.log(`  [${p.signal_type}] (${p.competitor_id}) "${trunc(p.headline, 60)}"`)
    console.log(`      → inn=${p.inn}  asset_id=${p.assetId ?? 'NULL'}${flag}`)
  }

  if (mismatches.length) {
    console.log(`\nAll ${mismatches.length} cross-attributions (review these):`)
    for (const p of mismatches) {
      console.log(`  [${p.signal_type}] row=${p.competitor_id} → drug=${p.inn} (owner ${p.resolvedCompetitor})  "${trunc(p.headline, 55)}"`)
    }
  }

  if (!APPLY) {
    console.log('\n── DRY-RUN complete. No rows written. Re-run with --apply to write. ──\n')
    return
  }

  // ── Apply (only inn + asset_id, grouped, chunked) ─────────────────────────────
  console.log('\n── Applying ──')
  const groups = new Map()   // `inn||assetId` → { inn, assetId, ids[] }
  for (const p of proposals) {
    const key = `${p.inn}||${p.assetId ?? ''}`
    if (!groups.has(key)) groups.set(key, { inn: p.inn, assetId: p.assetId, ids: [] })
    groups.get(key).ids.push(p.id)
  }

  let updated = 0
  for (const g of groups.values()) {
    for (let i = 0; i < g.ids.length; i += 100) {
      const chunk = g.ids.slice(i, i + 100)
      const { error: upErr } = await supabase
        .from('company_signals')
        .update({ inn: g.inn, asset_id: g.assetId })
        .in('id', chunk)
      if (upErr) console.error(`  ❌  ${g.inn}: ${upErr.message}`)
      else { updated += chunk.length; console.log(`  ✅  ${g.inn} (${g.assetId ?? 'no asset'}): ${chunk.length}`) }
    }
  }
  console.log(`\n── Applied: ${updated} rows updated. Unmatched left NULL. ──\n`)
}

main().catch(e => { console.error(`\n❌  ${e.message}\n`); process.exit(1) })
