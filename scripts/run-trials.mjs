/**
 * ClinicalTrials.gov ingest — run directly with Node.js.
 * Usage: node --env-file=.env.local scripts/run-trials.mjs
 *
 * Searches CT.gov by INN + all synonyms for every asset in Supabase,
 * deduplicates by NCT ID, and upserts to the trials table.
 */

import { createClient } from '@supabase/supabase-js'

const CTGOV_BASE = 'https://clinicaltrials.gov/api/v2/studies'
const TIMEOUT_MS = 30_000
const PAGE_SIZE  = 100

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/run-trials.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(s) {
  if (!s) return null
  const parts = s.split('-')
  if (parts.length === 1) return `${s}-01-01`
  if (parts.length === 2) return `${s}-01`
  return s
}

async function fetchAllTrials(query) {
  const results = []
  let pageToken

  do {
    const url = new URL(CTGOV_BASE)
    url.searchParams.set('query.intr', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('pageSize', String(PAGE_SIZE))
    url.searchParams.set('countTotal', 'true')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!r.ok) break
    const data = await r.json()
    results.push(...(data.studies ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return results
}

function parseStudy(study, assetId) {
  const p      = study.protocolSection
  const id     = p.identificationModule
  const status = p.statusModule
  const desc   = p.descriptionModule ?? {}
  const design = p.designModule ?? {}
  const conds  = p.conditionsModule ?? {}
  const arms   = p.armsInterventionsModule ?? {}
  const locs   = p.contactsLocationsModule ?? {}

  return {
    nct_id:          id.nctId,
    asset_id:        assetId,
    company_id:      null,
    title:           id.briefTitle ?? null,
    phase:           (design.phases ?? []).join(', ') || null,
    status:          status.overallStatus,
    brief_summary:   desc.briefSummary ?? null,
    start_date:      parseDate(status.startDateStruct?.date),
    completion_date: parseDate(status.primaryCompletionDateStruct?.date),
    conditions:      conds.conditions ?? [],
    interventions:   (arms.interventions ?? []).map(i => i.name),
    sites_count:     Array.isArray(locs.locations) ? locs.locations.length : null,
    raw_json:        study,
    last_synced_at:  new Date().toISOString(),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { data: assets, error: assetsErr } = await supabase
  .from('assets')
  .select('id, inn, synonyms')

if (assetsErr) { console.error('❌  Supabase error:', assetsErr.message); process.exit(1) }
if (!assets?.length) { console.log('⚠️  No assets in database'); process.exit(0) }

console.log(`\n🔄  Searching ClinicalTrials.gov for ${assets.length} assets...\n`)

const seen   = new Set()
const rows   = []
const errors = []

for (const asset of assets) {
  const queries = [asset.inn, ...(asset.synonyms ?? [])].filter(Boolean)
  let found = 0

  for (const query of queries) {
    try {
      const studies = await fetchAllTrials(query)
      for (const study of studies) {
        const nctId = study.protocolSection.identificationModule.nctId
        if (seen.has(nctId)) continue
        seen.add(nctId)
        rows.push(parseStudy(study, asset.id))
        found++
      }
    } catch (e) {
      errors.push(`${asset.inn}/${query}: ${e.message}`)
    }
  }

  const icon = found > 0 ? '✅' : '—'
  console.log(`  ${asset.inn.padEnd(28)} ${icon}  ${found} trial${found !== 1 ? 's' : ''}`)
}

// Upsert in batches of 50
let upserted = 0
for (let i = 0; i < rows.length; i += 50) {
  const batch = rows.slice(i, i + 50)
  const { error } = await supabase
    .from('trials')
    .upsert(batch, { onConflict: 'nct_id', ignoreDuplicates: false })
  if (error) errors.push(`upsert batch ${Math.floor(i / 50) + 1}: ${error.message}`)
  else upserted += batch.length
}

console.log(`
─────────────────────────────────────────
  Assets searched:  ${assets.length}
  Unique trials:    ${rows.length}
  Upserted:         ${upserted}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
