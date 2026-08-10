import { createClient } from '@supabase/supabase-js'
import { contentHash, sourceHash } from '../lib/snapshot'

const CTGOV_BASE = 'https://clinicaltrials.gov/api/v2/studies'
const TIMEOUT_MS = 30_000
const PAGE_SIZE = 100

function createSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// ClinicalTrials.gov returns partial dates like "2025-02" — normalise to full date string
function parseDate(s: string | undefined): string | null {
  if (!s) return null
  const parts = s.split('-')
  if (parts.length === 1) return `${s}-01-01`
  if (parts.length === 2) return `${s}-01`
  return s
}

interface CtStudy {
  protocolSection: {
    identificationModule: { nctId: string; briefTitle?: string }
    statusModule: {
      overallStatus: string
      startDateStruct?: { date: string }
      primaryCompletionDateStruct?: { date: string }
    }
    descriptionModule?: { briefSummary?: string }
    designModule?: { phases?: string[]; studyType?: string }
    conditionsModule?: { conditions?: string[] }
    armsInterventionsModule?: { interventions?: Array<{ name: string; type: string }> }
    sponsorCollaboratorsModule?: { leadSponsor?: { name: string } }
    contactsLocationsModule?: { locations?: unknown[] }
  }
}

interface Asset {
  id: string
  inn: string
  synonyms: string[] | null
  competitor_id: string | null
}

// Fetch all pages for a given intervention query
async function fetchAllTrials(query: string): Promise<CtStudy[]> {
  const results: CtStudy[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(CTGOV_BASE)
    url.searchParams.set('query.intr', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('pageSize', String(PAGE_SIZE))
    url.searchParams.set('countTotal', 'true')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!r.ok) break
    const data = await r.json() as { studies?: CtStudy[]; nextPageToken?: string }
    results.push(...(data.studies ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return results
}

function parseStudy(study: CtStudy, asset: Asset) {
  const p = study.protocolSection
  const id = p.identificationModule
  const status = p.statusModule
  const desc = p.descriptionModule ?? {}
  const design = p.designModule ?? {}
  const conds = p.conditionsModule ?? {}
  const arms = p.armsInterventionsModule ?? {}
  const locs = p.contactsLocationsModule ?? {}

  return {
    nct_id: id.nctId,
    asset_id: asset.id,
    company_id: asset.competitor_id,
    title: id.briefTitle ?? null,
    phase: (design.phases ?? []).join(', ') || null,
    status: status.overallStatus,
    brief_summary: desc.briefSummary ?? null,
    start_date: parseDate(status.startDateStruct?.date),
    completion_date: parseDate(status.primaryCompletionDateStruct?.date),
    conditions: conds.conditions ?? [],
    interventions: (arms.interventions ?? []).map((i) => i.name),
    sites_count: Array.isArray(locs.locations) ? locs.locations.length : null,
    raw_json: study,
    last_synced_at: new Date().toISOString(),
  }
}

// Only hash the fields that represent a meaningful clinical state change.
// Avoids false-positive signals from CT.gov cosmetic text edits.
function signalFields(row: ReturnType<typeof parseStudy>) {
  return { status: row.status, phase: row.phase, completion_date: row.completion_date, title: row.title }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (req.headers['x-ingest-secret'] !== process.env.INGEST_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let supabase: ReturnType<typeof createSupabaseAdmin>
  try {
    supabase = createSupabaseAdmin()
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }

  // Load all assets — competitor_id is needed for signal attribution
  const { data: assets, error: assetsErr } = await supabase
    .from('assets')
    .select('id, inn, synonyms, competitor_id')

  if (assetsErr) return res.status(500).json({ error: assetsErr.message })
  if (!assets?.length) {
    return res.status(200).json({ message: 'No assets in database — add assets via onboarding first', upserted: 0 })
  }

  // trial_update is NCT-native to asset_id: a trial is only found in the first
  // place by querying CT.gov for a specific asset's own INN/synonyms (below), so
  // every row already carries the right asset_id — no text matching needed.
  // trials.asset_id already gets this (line below); this map just makes the
  // same identity available for the company_signals insert further down,
  // without adding an inn column to the trials table itself.
  const assetIdToInn = new Map((assets as Asset[]).map((a) => [a.id, a.inn]))

  const seen = new Set<string>()   // deduplicate NCT IDs across synonym searches
  const rows: ReturnType<typeof parseStudy>[] = []
  const errors: string[] = []

  for (const asset of assets as Asset[]) {
    // Search by INN + all synonyms (includes research codes like KVD-900, NTLA-2002)
    const queries = [asset.inn, ...(asset.synonyms ?? [])].filter(Boolean)

    for (const query of queries) {
      try {
        const studies = await fetchAllTrials(query)
        for (const study of studies) {
          const nctId = study.protocolSection.identificationModule.nctId
          if (seen.has(nctId)) continue
          seen.add(nctId)
          rows.push(parseStudy(study, asset))
        }
      } catch (e: any) {
        errors.push(`${asset.inn}/${query}: ${e.message}`)
      }
    }
  }

  // Load all existing snapshots in one query — avoids N+1 per trial
  const { data: snaps } = await supabase
    .from('trial_snapshots')
    .select('nct_id, content_hash')
  const snapMap = new Map(
    (snaps ?? []).map((s: { nct_id: string; content_hash: string }) => [s.nct_id, s.content_hash])
  )

  // Classify: first-run (no snapshot), unchanged, or changed
  type ChangedEntry = { row: ReturnType<typeof parseStudy>; newHash: string }
  const firstRun: ReturnType<typeof parseStudy>[] = []
  const changed: ChangedEntry[] = []

  for (const row of rows) {
    const newHash = contentHash(signalFields(row))
    const oldHash = snapMap.get(row.nct_id)
    if (oldHash === undefined) {
      firstRun.push(row)
    } else if (oldHash !== newHash) {
      changed.push({ row, newHash })
    }
    // oldHash === newHash: unchanged, no action needed
  }

  // Upsert all trial rows (keep live data fresh regardless of diff result)
  let upserted = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase
      .from('trials')
      .upsert(batch, { onConflict: 'nct_id', ignoreDuplicates: false })
    if (error) errors.push(`upsert batch ${i / 50 + 1}: ${error.message}`)
    else upserted += batch.length
  }

  // Seed baselines for first-seen trials — no signals emitted on first run
  if (firstRun.length > 0) {
    const seedRows = firstRun.map(row => ({
      nct_id: row.nct_id,
      content_hash: contentHash(signalFields(row)),
    }))
    for (let i = 0; i < seedRows.length; i += 50) {
      const { error } = await supabase
        .from('trial_snapshots')
        .insert(seedRows.slice(i, i + 50))
      if (error) errors.push(`seed snapshots batch ${i / 50 + 1}: ${error.message}`)
    }
  }

  // Emit signals and update snapshots for changed trials
  const today = new Date().toISOString().slice(0, 10)
  let signalsWritten = 0

  for (const { row, newHash } of changed) {
    const competitorId = row.company_id
    // Compound accession_number so multiple state changes for the same trial
    // don't collide on the unique(competitor_id, accession_number) constraint
    const accessionNumber = `${row.nct_id}:${newHash.slice(0, 8)}`
    const sHash = sourceHash(`${row.nct_id}:${newHash}`)

    // Deduplicate via source_hash — guards against re-runs before snapshot updates
    const { count } = await supabase
      .from('company_signals')
      .select('id', { count: 'exact', head: true })
      .eq('source_hash', sHash)

    if ((count ?? 0) === 0 && competitorId) {
      const { error: insertErr } = await supabase.from('company_signals').insert({
        competitor_id:    competitorId,
        signal_type:      'trial_update',
        date:             today,
        headline:         `${row.nct_id} — ${row.status}${row.phase ? ` (${row.phase})` : ''}`,
        body_excerpt:     `Trial: ${row.title ?? row.nct_id}. Status: ${row.status}. Completion: ${row.completion_date ?? 'TBD'}.`,
        source_url:       `https://clinicaltrials.gov/study/${row.nct_id}`,
        source_hash:      sHash,
        data_source:      'clinicaltrials_gov',
        accession_number: accessionNumber,
        inn:              assetIdToInn.get(row.asset_id) ?? null,
        asset_id:         row.asset_id,
      })
      if (insertErr) {
        errors.push(`${row.nct_id}: signal insert failed — ${insertErr.message}`)
      } else {
        signalsWritten++
      }
    }

    // Update snapshot regardless — keeps hash current for next run
    await supabase
      .from('trial_snapshots')
      .update({ content_hash: newHash, fetched_at: new Date().toISOString() })
      .eq('nct_id', row.nct_id)
  }

  return res.status(200).json({
    upserted,
    total_found: rows.length,
    assets_processed: assets.length,
    first_run_seeded: firstRun.length,
    changed: changed.length,
    signals_written: signalsWritten,
    ...(errors.length && { errors }),
  })
}
