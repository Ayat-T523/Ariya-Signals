/**
 * FDA label ingest — run directly with Node.js (no Vercel dev server needed).
 * Usage: node --env-file=.env.local scripts/run-ingest.mjs
 *
 * Reads all assets from Supabase, fetches FDA label + Drugs@FDA data for each,
 * writes inn_stem, inn_full, substance_name_formulated, label_version,
 * label_effective_date, application_numbers, manufacturer_current, mechanism,
 * and upserts a regulatory_events row for the original FDA approval.
 */

import { createClient } from '@supabase/supabase-js'

const FDA_LABEL_BASE = 'https://api.fda.gov/drug/label.json'
const FDA_DRUGS_BASE = 'https://api.fda.gov/drug/drugsfda.json'
const LABEL_LIMIT    = 10
const TIMEOUT_MS     = 15_000

// ── Env check ─────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Run with: node --env-file=.env.local scripts/run-ingest.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFdaDate(s) {
  if (!s || s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

async function fetchAllLabels(inn) {
  const url = `${FDA_LABEL_BASE}?search=openfda.generic_name:"${encodeURIComponent(inn)}"&limit=${LABEL_LIMIT}`
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) return []
  const d = await r.json()
  if (!d.results?.length) return []

  const results = [...d.results]
  const total   = d.meta?.results?.total ?? results.length

  if (total > LABEL_LIMIT) {
    const pages = Math.ceil(total / LABEL_LIMIT)
    for (let p = 1; p < pages; p++) {
      const pr = await fetch(`${url}&skip=${p * LABEL_LIMIT}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!pr.ok) break
      const pd = await pr.json()
      results.push(...(pd.results ?? []))
    }
  }
  return results
}

function selectBestLabel(labels) {
  if (!labels.length) return null
  return labels.find(l => l.openfda?.application_number?.some(a => /^(NDA|BLA)/.test(a))) ?? labels[0]
}

async function fetchDrugsFda(inn) {
  const url = `${FDA_DRUGS_BASE}?search=openfda.generic_name:"${encodeURIComponent(inn)}"&limit=1`
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) return null
  const d = await r.json()
  return d.results?.[0] ?? null
}

function extractInnFull(substanceName, genericName) {
  if (!substanceName) return genericName?.toLowerCase() ?? null
  const sub = substanceName.toLowerCase().trim()
  // Biologic suffix pattern: ends with hyphen + exactly 4 lowercase letters
  if (/^[a-z]+(?:-[a-z]+)*-[a-z]{4}$/.test(sub)) return sub
  // Salt form — inn_full is just the INN stem
  return genericName?.toLowerCase() ?? sub
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { data: assets, error: assetsErr } = await supabase
  .from('assets')
  .select('id, inn, mechanism, manufacturer_current')

if (assetsErr) { console.error('❌  Supabase error:', assetsErr.message); process.exit(1) }
if (!assets?.length) { console.log('⚠️  No assets in database — run the INSERT SQL first'); process.exit(0) }

console.log(`\n🔄  Processing ${assets.length} assets...\n`)

const errors = []
let mechanismUpdated = 0
let labelMetaUpdated = 0
let eventsUpserted   = 0
let noFdaData        = 0

for (const asset of assets) {
  process.stdout.write(`  ${asset.inn.padEnd(28)}`)

  try {
    const [allLabels, drugsFda] = await Promise.all([
      fetchAllLabels(asset.inn),
      fetchDrugsFda(asset.inn),
    ])

    const label = selectBestLabel(allLabels)

    if (!label && !drugsFda) {
      console.log('— no FDA data (pipeline drug, not yet approved)')
      noFdaData++
      continue
    }

    const rawSubstanceName = label?.openfda?.substance_name?.[0] ?? null
    const rawGenericName   = label?.openfda?.generic_name?.[0] ?? null
    const innStem          = rawGenericName?.toLowerCase() ?? null
    const innFull          = extractInnFull(rawSubstanceName, rawGenericName)
    const labelVersion     = label?.version ?? null
    const labelEffDate     = parseFdaDate(label?.effective_time)
    const allAppNums       = allLabels.flatMap(l => l.openfda?.application_number ?? [])
    const appNums          = [...new Set(allAppNums)]
    const mfr              = label?.openfda?.manufacturer_name?.[0] ?? null

    const update = {}
    if (innStem)      update.inn_stem                  = innStem
    if (innFull)      update.inn_full                  = innFull
    if (rawSubstanceName) update.substance_name_formulated = rawSubstanceName
    if (labelVersion) update.label_version             = labelVersion
    if (labelEffDate) update.label_effective_date      = labelEffDate
    if (appNums.length) update.application_numbers     = appNums
    if (mfr && !asset.manufacturer_current) update.manufacturer_current = mfr

    if (label && !asset.mechanism) {
      const moa = label.mechanism_of_action?.[0]
      if (moa) { update.mechanism = moa; mechanismUpdated++ }
    }

    if (Object.keys(update).length) {
      const { error } = await supabase.from('assets').update(update).eq('id', asset.id)
      if (error) { errors.push(`assets ${asset.inn}: ${error.message}`); console.log('❌') }
      else labelMetaUpdated++
    }

    // Upsert regulatory_events for original FDA approval
    if (drugsFda?.submissions?.length) {
      const origApproval = drugsFda.submissions.find(
        s => s.submission_type === 'ORIG' && s.submission_status === 'AP'
      )
      if (origApproval) {
        const approvalDate = parseFdaDate(origApproval.submission_status_date)
        const brandName    = label?.openfda?.brand_name?.[0] ?? null
        const appNum       = drugsFda.application_number ?? appNums[0] ?? null
        const sponsor      = drugsFda.sponsor_name ?? asset.manufacturer_current ?? mfr ?? null
        const headline     = ['FDA approved', brandName ? `${brandName} (${asset.inn})` : asset.inn, appNum ? `— ${appNum}` : ''].filter(Boolean).join(' ')

        const { error } = await supabase.from('regulatory_events').upsert(
          {
            asset_id:       asset.id,
            event_type:     'approval',
            date:           approvalDate,
            authority:      'FDA',
            country:        'US',
            headline,
            details:        label?.indications_and_usage?.[0]?.slice(0, 1000) ?? null,
            source_url:     `${FDA_LABEL_BASE}?search=openfda.generic_name:"${encodeURIComponent(asset.inn)}"`,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'asset_id,authority,event_type', ignoreDuplicates: false }
        )
        if (error) errors.push(`regulatory_events ${asset.inn}: ${error.message}`)
        else eventsUpserted++
      }
    }

    const flags = [
      label        ? `v${labelVersion ?? '?'}` : '',
      appNums.length ? appNums[0] : '',
    ].filter(Boolean).join(' ')

    console.log(`✅  ${flags}`)
  } catch (e) {
    errors.push(`${asset.inn}: ${e.message}`)
    console.log(`❌  ${e.message}`)
  }
}

console.log(`
─────────────────────────────────────────
  Assets processed:      ${assets.length}
  Label meta updated:    ${labelMetaUpdated}
  Mechanism updated:     ${mechanismUpdated}
  Approval events saved: ${eventsUpserted}
  No FDA data (pipeline):${noFdaData}
${errors.length ? `\n  Errors:\n${errors.map(e => `    • ${e}`).join('\n')}` : '  No errors ✅'}
─────────────────────────────────────────
`)
