/**
 * Name: backfill-trials-company-id
 * Description: Populates trials.company_id from the leadSponsor name stored in
 *   raw_json (CT.gov v2 protocolSection.sponsorCollaboratorsModule.leadSponsor.name).
 *   No additional API calls — all data is already in Supabase.
 *
 * Prerequisites:
 *   1. Run supabase/phase2-company-id-setup.sql in the Supabase SQL editor first.
 *      This changes trials.company_id from UUID to TEXT and creates unresolved_trials.
 *
 * Phase 2.3 (M&A sponsor lag) is handled at the end of this script:
 *   Astria Therapeutics trials are reassigned from competitor_id "astria" to
 *   "biocryst" (BioCryst acquired Astria on 2026-01-23). CT.gov still shows the
 *   original sponsor name at time of registration — this remapping corrects that.
 *
 * Usage: node --env-file=.env.local scripts/backfill-trials-company-id.mjs
 *
 * Acceptance check: prints unresolved % at the end. Investigate if >10% unresolved.
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

// ── Competitor lookup ─────────────────────────────────────────────────────────

const competitors = JSON.parse(
  readFileSync(join(__dirname, '../src/data/competitors.json'), 'utf-8')
)

// Strips legal suffixes and lowercases so "Pharvaris B.V." → "pharvaris"
function normaliseSponsor(name) {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|b\.v|n\.v|ag|plc|corp|pharmaceuticals|therapeutics|biotechnologies|biosciences)\b\.?/g, '')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Pre-build normalised name → slug map from competitors.json
// Include all competitors including acquired ones (Phase 2.3 handles the M&A remap)
const NORM_TO_ID = new Map(
  competitors.map(c => [normaliseSponsor(c.name), c.id])
)

// Extra aliases for known CT.gov sponsor name variations not covered by normaliseSponsor
const EXTRA_ALIASES = new Map([
  ['takeda pharmaceutical company limited', 'takeda'],
  ['takeda pharmaceutical company',         'takeda'],
  ['takeda pharmaceuticals',                'takeda'],
  ['shire',                                 'takeda'],  // Shire acquired by Takeda 2019
  ['shire human genetic therapies',         'takeda'],
  ['dyax',                                  'takeda'],  // Dyax acquired by Shire/Takeda
  ['millennium',                            'takeda'],  // Takeda acquired Millennium Pharmaceuticals 2008 — normaliseSponsor strips "pharmaceuticals"
  ['biocryst pharmaceuticals inc',          'biocryst'],
  ['ionis pharmaceuticals inc',             'ionis'],
  ['csl behring llc',                       'csl-behring'],
  ['csl limited',                           'csl-behring'],
  ['adverum biotechnologies inc',           'adverum'],
  ['intellia therapeutics inc',             'intellia'],
  ['astria therapeutics inc',               'astria'],
  ['escient pharmaceuticals',               'astria'],  // Escient merged into Astria
])

// Sponsors that are our own asset developer — intentionally left with company_id = null.
// Sebetralstat was originally developed by KalVista Pharmaceuticals.
const OWN_ASSET_SPONSORS = new Set([
  'kalvista pharmaceuticals, ltd.',
  'kalvista pharmaceuticals',
  'kalvista pharmaceuticals ltd',
])

// Academic, hospital, and non-competitor sponsors running investigator-initiated trials (IIT).
// These are studies of HAE drugs run by researchers — they are not competitor-controlled trials
// and should not appear in the competitive intelligence feed.
const KNOWN_NON_COMPETITORS = new Set([
  // Vanderbilt University Medical Center runs the largest academic HAE programme in the US
  'vanderbilt university medical center',
  'vanderbilt university',
  // Other academic/hospital-sponsored IIT studies in the unresolved set
  'belfast health and social care trust',
  'bernstein clinical research center',
  'charite university, berlin, germany',
  'gcs ramsay santé pour l\'enseignement et la recherche',
  'institute for asthma and allergy',
  'massachusetts general hospital',
  'quantumleap healthcare collaborative',
  'radboud university medical center',
  'sebastian videla',
  'st vincent\'s institute of medical research',
  'technical university of munich',
  'university hospital, grenoble',
  'university of edinburgh',
  // Pharma companies without HAE assets in our tracked competitor set
  'amgen',
  'nang kuang pharmaceutical co., ltd.',
  'sanofi',
])

// Two-pass match: exact → prefix (handles "Pharvaris Netherlands B.V." → "pharvaris")
function matchSponsor(raw) {
  if (!raw) return null
  const norm = normaliseSponsor(raw)

  // Pass 1a: exact match from NORM_TO_ID
  if (NORM_TO_ID.has(norm)) return NORM_TO_ID.get(norm)

  // Pass 1b: extra alias map
  if (EXTRA_ALIASES.has(norm)) return EXTRA_ALIASES.get(norm)

  // Pass 2: check if any competitor's normalised name is a prefix of the sponsor string
  // Longer keys checked first so "csl behring" beats "csl" if both were present
  const sorted = [...NORM_TO_ID.entries()].sort((a, b) => b[0].length - a[0].length)
  for (const [key, id] of sorted) {
    if (norm.startsWith(key)) return id
  }

  return null
}

// ── Extract sponsor from raw_json ─────────────────────────────────────────────

// CT.gov v2 API path
function extractLeadSponsor(rawJson) {
  try {
    return rawJson
      ?.protocolSection
      ?.sponsorCollaboratorsModule
      ?.leadSponsor
      ?.name ?? null
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n🔄  Phase 2.1 — Populating trials.company_id from raw_json sponsor names\n')

// Fetch all trials — we need raw_json so we can't filter in the query
const { data: trials, error: trialsErr } = await supabase
  .from('trials')
  .select('id, nct_id, raw_json, company_id')

if (trialsErr) {
  console.error('❌  Failed to fetch trials:', trialsErr.message)
  process.exit(1)
}

console.log(`    Fetched ${trials.length} trials from Supabase\n`)

let updated       = 0
let alreadySet    = 0
let unresolved    = 0
let ownAsset      = 0
let nonCompetitor = 0
let noSponsor     = 0
const errors      = []

// Clear any stale unresolved_trials rows from previous runs
await supabase.from('unresolved_trials').delete().neq('id', '00000000-0000-0000-0000-000000000000')

for (const trial of trials) {
  const sponsor = extractLeadSponsor(trial.raw_json)

  if (!sponsor) {
    noSponsor++
    // No raw_json or sponsor field — log as unresolved
    const { error } = await supabase.from('unresolved_trials').upsert({
      trial_id:         trial.id,
      nct_id:           trial.nct_id,
      raw_sponsor_name: null,
    }, { onConflict: 'trial_id', ignoreDuplicates: true })
    if (error) errors.push(`${trial.nct_id} (upsert unresolved): ${error.message}`)
    continue
  }

  const sponsorLower = sponsor.toLowerCase()

  // Own asset (sebetralstat / KalVista): intentionally null — not a competitor trial
  if (OWN_ASSET_SPONSORS.has(sponsorLower)) {
    ownAsset++
    // Ensure company_id is null (clear any stale value from a previous run)
    if (trial.company_id !== null) {
      const { error } = await supabase.from('trials').update({ company_id: null }).eq('id', trial.id)
      if (error) errors.push(`${trial.nct_id} (clear own-asset): ${error.message}`)
    }
    continue
  }

  // Academic / non-competitor sponsor: investigator-initiated trial — not a CI signal
  if (KNOWN_NON_COMPETITORS.has(sponsorLower)) {
    nonCompetitor++
    continue
  }

  const competitorId = matchSponsor(sponsor)

  if (!competitorId) {
    unresolved++
    // Log but leave company_id null — these are genuinely unmatched and need investigation
    const { error } = await supabase.from('unresolved_trials').upsert({
      trial_id:         trial.id,
      nct_id:           trial.nct_id,
      raw_sponsor_name: sponsor,
    }, { onConflict: 'trial_id', ignoreDuplicates: false })
    if (error) errors.push(`${trial.nct_id} (upsert unresolved): ${error.message}`)
    continue
  }

  // Skip if already set to the same value (idempotent re-runs)
  if (trial.company_id === competitorId) {
    alreadySet++
    continue
  }

  const { error } = await supabase
    .from('trials')
    .update({ company_id: competitorId })
    .eq('id', trial.id)

  if (error) {
    errors.push(`${trial.nct_id}: ${error.message}`)
  } else {
    updated++
  }
}

// Acceptance check — only count competitor-sponsored trials in the denominator.
// Own-asset and known-non-competitor trials are excluded: they are expected nulls,
// not matching failures.
const competitorTrials = trials.length - ownAsset - nonCompetitor - noSponsor
const resolvedCount    = updated + alreadySet
const unresolvedPct    = competitorTrials > 0 ? (unresolved / competitorTrials * 100).toFixed(1) : 0

console.log(`─────────────────────────────────────────
  Phase 2.1 complete
  Total trials:           ${trials.length}
  ─ Own asset (KalVista): ${ownAsset}   (expected null — sebetralstat)
  ─ Non-competitor (IIT): ${nonCompetitor}  (academic/hospital-sponsored)
  ─ No sponsor field:     ${noSponsor}
  ─────────────────────────────────────
  Competitor trials:      ${competitorTrials}
    Updated:              ${updated}
    Already correct:      ${alreadySet}
    Unresolved:           ${unresolved}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────`)

console.log(`\n  Unresolved rate (competitor trials only): ${unresolvedPct}%`)
if (parseFloat(unresolvedPct) > 10) {
  console.log(`  ⚠️  OVER 10% UNRESOLVED — investigate before continuing to Phase 3.`)
  console.log(`  Query: SELECT * FROM unresolved_trials ORDER BY raw_sponsor_name;`)
} else {
  console.log(`  ✅  Within acceptable threshold (<10%)`)
}

// ── Phase 2.3 — M&A sponsor lag: Astria → BioCryst ───────────────────────────
// CT.gov reflects the sponsor at time of trial registration. Astria's trials
// show leadSponsor = "Astria Therapeutics" even though BioCryst acquired Astria
// on 2026-01-23. Remap them now, after the sponsor-name pass assigns "astria".

console.log('\n\n🔄  Phase 2.3 — M&A remap: astria → biocryst\n')

const { data: astriaTrials, error: astriaErr } = await supabase
  .from('trials')
  .select('id, nct_id')
  .eq('company_id', 'astria')

if (astriaErr) {
  console.error('❌  Failed to fetch Astria trials:', astriaErr.message)
} else if (!astriaTrials.length) {
  console.log('    No Astria trials found — nothing to remap.')
} else {
  const { error: updateErr } = await supabase
    .from('trials')
    .update({ company_id: 'biocryst' })
    .eq('company_id', 'astria')

  if (updateErr) {
    console.error('❌  Remap failed:', updateErr.message)
  } else {
    console.log(`    ✅  ${astriaTrials.length} Astria trial(s) remapped to biocryst:`)
    astriaTrials.forEach(t => console.log(`       ${t.nct_id}`))
  }
}

// ── Final distribution ────────────────────────────────────────────────────────
console.log('\n\n📊  Final company_id distribution:\n')
const { data: dist } = await supabase.from('trials').select('company_id')
const counts = {}
for (const row of dist ?? []) {
  const k = row.company_id ?? '(null)'
  counts[k] = (counts[k] ?? 0) + 1
}
for (const [k, v] of Object.entries(counts).sort()) {
  console.log(`    ${k.padEnd(22)} ${v}`)
}
console.log()
