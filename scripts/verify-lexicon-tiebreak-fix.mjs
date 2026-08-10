/**
 * verify-lexicon-tiebreak-fix.mjs — ad-hoc check for the resolveAsset tiebreak
 * fix (no test runner is configured in this repo, per CLAUDE.md).
 *
 * Three cases, matching the fix's stated contract:
 *   (a) two drugs named, no owning-competitor signal — picks whichever is
 *       mentioned FIRST in the text, using a synthetic resolver where the
 *       earlier-mentioned drug is deliberately inserted SECOND (so the old
 *       drugs[0]/row-order bug would have picked the other one).
 *   (b) three-plus drugs named, no owning-competitor signal — returns no
 *       match rather than forcing a pick, again with row order deliberately
 *       working against the correct answer.
 *   (c) the real case that motivated this fix: company_signals row
 *       25962d17-b066-423e-a307-38b9f78990f3 (PMID 38366937), whose full
 *       abstract names sebetralstat/KVD900, IONIS-PKKRx, STAR-0215, and
 *       NTLA-2002 — reviewed and confirmed ambiguous. Previously resolved to
 *       sebetralstat (a resolver-map-order artifact); must now return no
 *       match. Requires scripts/.cache/pubmed-abstracts.json to already have
 *       this PMID cached (it does, from investigate-unmatched-abstracts.mjs).
 *
 * Usage: node --env-file=.env.local scripts/verify-lexicon-tiebreak-fix.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSupabaseClient, loadAssetResolver, resolveAsset } from './lib/signal-gate.mjs'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const CACHE_PATH = `${__dirname}/.cache/pubmed-abstracts.json`

let failures = 0

function check(label, cond, detail) {
  const pass = !!cond
  console.log(`  ${pass ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures++
}

// ── (a) two drugs, earliest-mentioned wins, not row order ──────────────────────
console.log('\n(a) Two drugs named, no owning-competitor signal:')
{
  // Insertion order deliberately puts drugB first — the old drugs[0] bug would
  // pick drugB regardless of the text. drugA is mentioned first in the text.
  const resolver = new Map([
    ['drugb', { competitorId: 'compB', inn: 'drugB', assetId: 'idB' }],
    ['druga', { competitorId: 'compA', inn: 'drugA', assetId: 'idA' }],
  ])
  const text = 'this review discusses drugA at length before a brief mention of drugB near the end'.toLowerCase()
  const result = resolveAsset(text, resolver, undefined, null)
  check('picks drugA (mentioned first in text)', result.inn === 'drugA', `got inn=${result.inn}`)
  check('did not pick drugB (row order)', result.inn !== 'drugB')

  // Reverse the text order too, to confirm it's genuinely text-position-driven
  // and not some other tiebreak accidentally lining up.
  const text2 = 'this review discusses drugB at length before a brief mention of drugA near the end'.toLowerCase()
  const result2 = resolveAsset(text2, resolver, undefined, null)
  check('flips to drugB when drugB is mentioned first instead', result2.inn === 'drugB', `got inn=${result2.inn}`)
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
  const result = resolveAsset(text, resolver, undefined, null)
  check('returns no match (ambiguous)', result.matched === false, `got matched=${result.matched}, inn=${result.inn}`)
  check('inn is null, not a guess', result.inn === null)
  check('did not fall back to drugC (row order)', result.inn !== 'drugC')
}

// ── (c) the real ambiguous case ─────────────────────────────────────────────────
console.log('\n(c) Real case: row 25962d17 (PMID 38366937) — previously mis-matched to sebetralstat:')
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
      const resolver = await loadAssetResolver(supabase)
      const headline = 'Kallikrein inhibitors for angioedema: the progress of preclinical and early phase studies'
      const text = `${headline} ${abstract}`.toLowerCase()
      // Row's actual stored competitor_id at the time — ionis. No ionis-owned
      // drug (donidalorsen) is actually named in this abstract, so the
      // owning-competitor signal doesn't resolve it either — this is the
      // real 3+-drug ambiguous case, not a 2-drug one.
      const result = resolveAsset(text, resolver, undefined, 'ionis')
      check('no longer resolves to sebetralstat', result.inn !== 'sebetralstat', `got inn=${result.inn}`)
      check('returns no match (genuinely ambiguous, 4 drugs named)', result.matched === false, `got matched=${result.matched}, inn=${result.inn}`)
    }
  }
}

console.log(`\n${failures === 0 ? '✅ All checks passed.' : `❌ ${failures} check(s) failed.`}\n`)
process.exit(failures === 0 ? 0 : 1)
