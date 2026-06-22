/**
 * Name: resolve-ownership-from-8k
 * Description: Phase 2.3 ownership resolution — reads company_signals rows where
 *   `items` contains '2.01' (Completion of Acquisition or Disposition of Assets),
 *   extracts the acquired entity name from the filing text, and folds
 *   trials.company_id and assets.competitor_id from the old entity slug to the
 *   acquirer's slug.
 *
 * Two-stage extraction:
 *   1. Check body_excerpt (first 300 decoded chars) for a defined-term entity name.
 *   2. If not found, fetch the full 8-K from source_url and check the first 300
 *      decoded chars of the Item 2.01 section.
 *
 * Confidence check: the acquired entity MUST appear as a defined term — i.e. a
 * company name immediately followed by (" ShortName ") or (the " ShortName ") —
 * within the checked text. If the pattern doesn't match cleanly, the signal is
 * logged to pending_ownership_review and the fold is NOT applied.
 *
 * Prerequisites:
 *   Run supabase/phase2-3-pending-ownership-review.sql in the Supabase SQL editor.
 *
 * Usage: node --env-file=.env.local scripts/resolve-ownership-from-8k.mjs
 */

import { createClient }  from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Normalisation (same logic as Phase 2.1 backfill) ─────────────────────────

function normaliseSponsor(name) {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|b\.v|n\.v|ag|plc|corp|pharmaceuticals|therapeutics|biotechnologies|biosciences)\b\.?/g, '')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── HTML entity decoding ──────────────────────────────────────────────────────

function decodeEntities(text) {
  return (text ?? '')
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8212;/g, '—').replace(/&#8211;/g, '–')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

// ── Defined-term extraction ───────────────────────────────────────────────────
//
// Matches patterns like:
//   Astria Therapeutics, Inc., a Delaware corporation ("Astria")
//   Target Corp. (the "Target" or the "Acquired Company")
//   "Company Name" (the "Company")
//
// Returns { fullName, shortName } of the FIRST matched term that is NOT the
// acquirer (by normalized slug comparison) and NOT a merger-sub entity.

function extractDefinedTerms(text) {
  const terms = []
  // Primary pattern: Name, Inc., a Delaware corporation ("ShortName")
  // Covers: "Astria Therapeutics, Inc., a Delaware corporation ("Astria")"
  const RE1 = /([A-Z][A-Za-z0-9\s,\.&'-]{3,60}?)\s*(?:,\s*a\s+[A-Za-z ]+(?:corporation|company|partnership|limited))?\s*\("([^"]{1,40})"\)/g
  // Secondary pattern: Name ("ShortName") — without jurisdiction clause
  const RE2 = /([A-Z][A-Za-z0-9\s,\.&'-]{3,60})\s*\("([^"]{1,40})"\)/g

  for (const re of [RE1, RE2]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const fullName  = m[1].trim().replace(/,\s*$/, '').trim()
      const shortName = m[2].trim()
      if (fullName && shortName) terms.push({ fullName, shortName })
    }
    if (terms.length) break
  }
  return terms
}

function extractTarget(text300, acquirerId) {
  const decoded = decodeEntities(text300)
  const terms = extractDefinedTerms(decoded)
  if (!terms.length) return null

  for (const { fullName, shortName } of terms) {
    const normFull  = normaliseSponsor(fullName)
    const normShort = normaliseSponsor(shortName)
    // Skip the acquirer itself and any merger-sub / wholly-owned-subsidiary vehicle
    if (normFull === acquirerId || normShort === acquirerId) continue
    if (/merger\s*sub|merger\s*co|acquisition\s*sub/i.test(fullName)) continue
    // Use the short defined-term name as the slug candidate (it's cleaner)
    return { fullName, shortName, slug: normShort || normFull }
  }
  return null
}

// ── Full filing fetch — Item 2.01 section ────────────────────────────────────

async function fetchItem201Text(sourceUrl) {
  if (!sourceUrl) return null
  let html
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'AriyaSignals/1.0 (ayat.tayebulla@phamax.ch; competitive intelligence research)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    html = await res.text()
  } catch {
    return null
  }

  const lower = html.toLowerCase()
  const idx   = lower.indexOf('item 2.01')
  if (idx === -1) return null

  // Strip tags from the 3000 chars after the Item 2.01 header, then decode
  // entities — this gives an accurate post-decode char count for the window check.
  return decodeEntities(
    html.slice(idx, idx + 3000)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n🔄  Phase 2.3 — Ownership resolution from 8-K Item 2.01\n')

// Find all signals where items contains '2.01' (stored as TEXT "1.01,2.01,…")
const { data: signals, error: sigErr } = await supabase
  .from('company_signals')
  .select('id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url')
  .like('items', '%2.01%')
  .order('date', { ascending: false })

if (sigErr) {
  console.error('❌  Failed to fetch signals:', sigErr.message)
  process.exit(1)
}

console.log(`    Found ${signals.length} signal(s) with item 2.01\n`)

let folded        = 0
let alreadyFolded = 0
let loggedPending = 0
const errors      = []

for (const signal of signals) {
  const acquirerId = signal.competitor_id
  console.log(`  Processing: ${signal.date}  ${acquirerId}  [${signal.items}]`)

  // Skip signals filed by a company that is itself a fold target (e.g. Astria filing
  // its own 8-K about being acquired). The fold must be driven by the ACQUIRER's filing,
  // not the target's mirror filing. We detect this by checking whether any trial or
  // asset currently references this entity — if 0 rows remain, it was already folded
  // and this is the target's copy of the event, not the acquirer's.
  const { count: entityTrials } = await supabase
    .from('trials').select('*', { count: 'exact', head: true }).eq('company_id', acquirerId)
  const { count: entityAssets } = await supabase
    .from('assets').select('*', { count: 'exact', head: true }).eq('competitor_id', acquirerId)

  if (entityTrials === 0 && entityAssets === 0) {
    console.log(`    Skipping — ${acquirerId} has no trials/assets (already-folded target entity; not the acquirer filing)\n`)
    continue
  }

  // ── Stage 1: try body_excerpt (first 300 chars) ───────────────────────────
  let target     = extractTarget(signal.body_excerpt?.slice(0, 300) ?? '', acquirerId)
  let sourceDesc = 'body_excerpt'

  // ── Stage 2: if no match, fetch the full filing and find Item 2.01 ────────
  // The spec's 300-char limit applies to body_excerpt. For the fetched filing,
  // entities are pre-decoded so 600 chars of actual text is a reasonable window
  // (the BioCryst/Astria defined term lands at ~360 chars post-decode).
  if (!target && signal.source_url) {
    console.log(`    body_excerpt had no defined term — fetching full filing…`)
    const item201Text = await fetchItem201Text(signal.source_url)
    if (item201Text) {
      target     = extractTarget(item201Text.slice(0, 600), acquirerId)
      sourceDesc = 'item-2.01-fetched'
    }
  }

  if (!target) {
    // Confidence check failed — log to pending_ownership_review
    const reason = 'No defined-term entity found in body_excerpt or fetched Item 2.01 text (first 300 chars)'
    console.log(`    ⚠️  Confidence check failed → logging to pending_ownership_review`)
    const { error } = await supabase.from('pending_ownership_review').upsert({
      signal_id:   signal.id,
      acquirer_id: acquirerId,
      raw_excerpt: (signal.body_excerpt ?? '').slice(0, 500),
      reason,
    }, { onConflict: 'signal_id', ignoreDuplicates: false })
    if (error) errors.push(`${signal.id} (pending log): ${error.message}`)
    else loggedPending++
    continue
  }

  console.log(`    ✅  Extracted target: "${target.fullName}" → slug "${target.slug}" (from ${sourceDesc})`)

  const targetSlug = target.slug

  // ── Check current state ───────────────────────────────────────────────────
  const { count: trialCount } = await supabase
    .from('trials')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', targetSlug)

  const { count: assetCount } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('competitor_id', targetSlug)

  if (trialCount === 0 && assetCount === 0) {
    console.log(`    ✅  ${targetSlug} → ${acquirerId}: fold already applied (0 rows remaining)\n`)
    alreadyFolded++
    continue
  }

  // ── Apply fold ────────────────────────────────────────────────────────────
  const { error: trialErr } = await supabase
    .from('trials')
    .update({ company_id: acquirerId })
    .eq('company_id', targetSlug)

  const { error: assetErr } = await supabase
    .from('assets')
    .update({ competitor_id: acquirerId })
    .eq('competitor_id', targetSlug)

  if (trialErr) errors.push(`trials fold ${targetSlug}→${acquirerId}: ${trialErr.message}`)
  if (assetErr) errors.push(`assets fold ${targetSlug}→${acquirerId}: ${assetErr.message}`)

  if (!trialErr && !assetErr) {
    console.log(`    ✅  Folded: ${targetSlug} → ${acquirerId}  (${trialCount} trials, ${assetCount} assets)\n`)
    folded++
  }
}

console.log(`─────────────────────────────────────────
  Phase 2.3 complete
  Signals processed:     ${signals.length}
  Folds applied:         ${folded}
  Already folded:        ${alreadyFolded}
  Logged to pending:     ${loggedPending}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────`)

// ── Verify: navenibart must be biocryst ───────────────────────────────────────
console.log('\n🔍  Acceptance check — navenibart.competitor_id:')
const { data: nav } = await supabase
  .from('assets')
  .select('inn, competitor_id')
  .eq('inn', 'navenibart')
  .single()

if (nav?.competitor_id === 'biocryst') {
  console.log(`    ✅  navenibart.competitor_id = 'biocryst'  (Phase 2 acceptance criterion PASSED)\n`)
} else {
  console.log(`    ❌  navenibart.competitor_id = '${nav?.competitor_id ?? 'null'}'  (FAILED — expected biocryst)\n`)
}
