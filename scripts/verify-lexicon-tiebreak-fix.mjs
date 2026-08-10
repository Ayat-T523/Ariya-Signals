/**
 * verify-lexicon-tiebreak-fix.mjs — ad-hoc check for the resolveAsset tiebreak
 * fix (no test runner is configured in this repo, per CLAUDE.md).
 *
 * Three cases, matching the fix's stated contract. Each prints the matcher's
 * RAW return value before asserting anything on it, and each is deliberately
 * checked for confounds that could make it pass without actually exercising
 * the tiebreak path (an owning-competitor match resolving things before the
 * tiebreak is ever reached, or a hand-typed/paraphrased input that doesn't
 * match what's really stored):
 *   (a) two drugs named, no owning-competitor signal (ownCompetitorId=null,
 *       explicitly) — picks whichever is mentioned FIRST in the text. Run
 *       TWICE with the same resolver (map/insertion order held fixed) and
 *       the two drug mentions' text order swapped, to confirm the result
 *       flips with text position rather than being pinned to map order.
 *   (b) three-plus drugs named, no owning-competitor signal (ownCompetitorId
 *       =null, explicitly, so the higher-priority owning-competitor branch
 *       can't be resolving this before the tiebreak is reached) — returns no
 *       match rather than forcing a pick.
 *   (c) the real case that motivated this fix: company_signals row
 *       25962d17-b066-423e-a307-38b9f78990f3 (PMID 38366937). headline,
 *       body_excerpt, and competitor_id are fetched live from company_signals
 *       (not hand-typed) so there's no paraphrase/reconstruction risk; the
 *       full abstract (which is what actually reveals the ambiguity, vs. the
 *       short stored body_excerpt) comes from
 *       scripts/.cache/pubmed-abstracts.json, built by
 *       investigate-unmatched-abstracts.mjs. Previously resolved to
 *       sebetralstat (a resolver-map-order artifact); must now return no
 *       match.
 *
 * Usage: node --env-file=.env.local scripts/verify-lexicon-tiebreak-fix.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSupabaseClient, loadAssetResolver, resolveAsset } from './lib/signal-gate.mjs'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const CACHE_PATH = `${__dirname}/.cache/pubmed-abstracts.json`
const ROW_ID     = '25962d17-b066-423e-a307-38b9f78990f3'

let failures = 0

function printRaw(label, result) {
  console.log(`  RAW RESULT (${label}): ${JSON.stringify(result)}`)
}

function check(label, cond, detail) {
  const pass = !!cond
  console.log(`  ${pass ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures++
}

// ── (a) two drugs, earliest-mentioned wins, not row order ──────────────────────
console.log('\n(a) Two drugs named, no owning-competitor signal — order-sensitivity check:')
{
  // Map/insertion order is held FIXED across both runs below (drugB inserted
  // first) — the old drugs[0] bug would return drugB for BOTH texts regardless
  // of wording. Only the TEXT order changes between the two calls.
  const resolver = new Map([
    ['drugb', { competitorId: 'compB', inn: 'drugB', assetId: 'idB' }],
    ['druga', { competitorId: 'compA', inn: 'drugA', assetId: 'idA' }],
  ])
  console.log('  ownCompetitorId passed: null (no owning-competitor confound)')

  const text = 'this review discusses drugA at length before a brief mention of drugB near the end'.toLowerCase()
  console.log(`  INPUT (drugA first): "${text}"`)
  const result = resolveAsset(text, resolver, undefined, null)
  printRaw('drugA-first text', result)
  check('picks drugA (mentioned first in text)', result.inn === 'drugA', `got inn=${result.inn}`)
  check('did not pick drugB (row order)', result.inn !== 'drugB')

  // Reverse the text order — same resolver, same map order, only word order
  // in the sentence changes. If this returns the same drug as above, the fix
  // is still keyed to map order, not text position.
  const text2 = 'this review discusses drugB at length before a brief mention of drugA near the end'.toLowerCase()
  console.log(`  INPUT (drugB first): "${text2}"`)
  const result2 = resolveAsset(text2, resolver, undefined, null)
  printRaw('drugB-first text', result2)
  check('flips to drugB when drugB is mentioned first instead', result2.inn === 'drugB', `got inn=${result2.inn}`)
  check('the two orderings produced DIFFERENT results (genuine order-sensitivity, not a coincidence)', result.inn !== result2.inn, `${result.inn} vs ${result2.inn}`)
}

// ── (b) three-plus drugs, no disambiguating signal — no match ──────────────────
console.log('\n(b) Three-plus drugs named, no owning-competitor signal:')
{
  const resolver = new Map([
    ['drugc', { competitorId: 'compC', inn: 'drugC', assetId: 'idC' }],
    ['drugb', { competitorId: 'compB', inn: 'drugB', assetId: 'idB' }],
    ['druga', { competitorId: 'compA', inn: 'drugA', assetId: 'idA' }],
  ])
  const text = 'a landscape review covering drugA, drugB, and drugC across the competitive set'.toLowerCase()
  console.log(`  INPUT: "${text}"`)
  console.log('  ownCompetitorId passed: null — confirms the higher-priority owning-competitor')
  console.log('  branch is NOT what resolves this; the ambiguous-tiebreak path is what is being exercised.')
  const result = resolveAsset(text, resolver, undefined, null)
  printRaw('3-drug ambiguous, no competitor context', result)
  check('returns no match (ambiguous)', result.matched === false, `got matched=${result.matched}, inn=${result.inn}`)
  check('inn is null, not a guess', result.inn === null)
  check('asset_id is null, not a guess', result.assetId === null)
  check('did not fall back to drugC (row order)', result.inn !== 'drugC')

  // matched:false only means resolveAsset found no specific drug — it does NOT
  // mean the signal gets dropped. Every writer that calls resolveAsset (e.g.
  // scripts/backfill-signal-identity.mjs) already has its own known
  // competitor_id independent of this call, and only fills inn/asset_id from
  // the result; competitor_id is never cleared because resolveAsset found no
  // drug. Downstream, useCompetitorSupabase.ts's buildContainment() routes any
  // signal with no asset_id to the Corporate bucket for that competitor — not
  // dropped, per the design's own honest-fallback rule (confirmed in the prior
  // architecture recon, item 9). Nothing to run here — this is a statement
  // about the caller contract, not something resolveAsset itself controls.
  console.log('  ℹ️  matched:false does not mean dropped — callers keep their own already-known')
  console.log('     competitor_id; the row stays attached at competitor/Corporate level.')
}

// ── (c) the real ambiguous case ─────────────────────────────────────────────────
console.log(`\n(c) Real case: row ${ROW_ID} (PMID 38366937) — previously mis-matched to sebetralstat:`)
{
  let cache
  try {
    cache = JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
  } catch (e) {
    console.log(`  ⚠️  skipped — couldn't read ${CACHE_PATH}: ${e.message}`)
    console.log('     Run scripts/investigate-unmatched-abstracts.mjs first to build the cache.')
  }
  if (cache) {
    const abstract = cache['38366937']
    if (!abstract) {
      console.log('  ⚠️  skipped — PMID 38366937 not in cache')
    } else {
      const supabase = createSupabaseClient()

      // Fetched live, not hand-typed — headline/competitor_id below are exactly
      // what's stored today, not a paraphrase or a recollection of an earlier check.
      const { data: row, error: rowErr } = await supabase
        .from('company_signals')
        .select('id, headline, body_excerpt, competitor_id')
        .eq('id', ROW_ID)
        .single()
      if (rowErr || !row) {
        console.log(`  ⚠️  skipped — couldn't load row from company_signals: ${rowErr?.message}`)
      } else {
        console.log(`  Stored headline (verbatim, live from DB): "${row.headline}"`)
        console.log(`  Stored competitor_id (verbatim, live from DB): ${row.competitor_id}`)
        console.log(`  Full abstract used (verbatim, from cache, first 150 chars): "${abstract.slice(0, 150)}..."`)

        const resolver = await loadAssetResolver(supabase)
        const text = `${row.headline} ${abstract}`.toLowerCase()
        // ownCompetitorId is the row's OWN real competitor_id, fetched above —
        // not assumed. No ionis-owned drug (donidalorsen) is actually named in
        // this abstract, so the owning-competitor branch doesn't resolve it
        // either; this genuinely exercises the 3+-drug ambiguous-tiebreak path.
        const result = resolveAsset(text, resolver, undefined, row.competitor_id)
        printRaw('real row 25962d17, live headline + real competitor_id', result)
        check('no longer resolves to sebetralstat', result.inn !== 'sebetralstat', `got inn=${result.inn}`)
        check('returns no match (genuinely ambiguous, 4 drugs named)', result.matched === false, `got matched=${result.matched}, inn=${result.inn}`)
        check('asset_id is null, not a guess', result.assetId === null)
      }
    }
  }
}

console.log(`\n${failures === 0 ? '✅ All checks passed.' : `❌ ${failures} check(s) failed.`}\n`)
process.exit(failures === 0 ? 0 : 1)
