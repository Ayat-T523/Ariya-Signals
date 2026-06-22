import { createClient } from '@supabase/supabase-js'

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

function parseStudy(study: CtStudy, assetId: string) {
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
    asset_id: assetId,
    company_id: null,           // populated later when companies table is seeded
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

  // Load all assets — we search CT.gov by INN + every synonym so no trial is missed
  const { data: assets, error: assetsErr } = await supabase
    .from('assets')
    .select('id, inn, synonyms')

  if (assetsErr) return res.status(500).json({ error: assetsErr.message })
  if (!assets?.length) {
    return res.status(200).json({ message: 'No assets in database — add assets via onboarding first', upserted: 0 })
  }

  const seen = new Set<string>()   // deduplicate NCT IDs across synonym searches
  const rows: ReturnType<typeof parseStudy>[] = []
  const errors: string[] = []

  for (const asset of assets) {
    // Search by INN + all synonyms (includes research codes like KVD-900, NTLA-2002)
    const queries = [asset.inn, ...(asset.synonyms ?? [])].filter(Boolean)

    for (const query of queries) {
      try {
        const studies = await fetchAllTrials(query)
        for (const study of studies) {
          const nctId = study.protocolSection.identificationModule.nctId
          if (seen.has(nctId)) continue
          seen.add(nctId)
          rows.push(parseStudy(study, asset.id))
        }
      } catch (e: any) {
        errors.push(`${asset.inn}/${query}: ${e.message}`)
      }
    }
  }

  // Upsert in batches of 50 — keyed on nct_id so re-runs are safe
  let upserted = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase
      .from('trials')
      .upsert(batch, { onConflict: 'nct_id', ignoreDuplicates: false })
    if (error) errors.push(`upsert batch ${i / 50 + 1}: ${error.message}`)
    else upserted += batch.length
  }

  return res.status(200).json({
    upserted,
    total_found: rows.length,
    assets_processed: assets.length,
    ...(errors.length && { errors }),
  })
}
