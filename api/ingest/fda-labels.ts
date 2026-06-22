import { createClient } from '@supabase/supabase-js'

const FDA_LABEL_BASE = 'https://api.fda.gov/drug/label.json'
const FDA_DRUGS_BASE = 'https://api.fda.gov/drug/drugsfda.json'
const TIMEOUT_MS     = 15_000
const LABEL_LIMIT    = 10  // fetch up to 10 SPL records — icatibant has 9

function createSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// DrugsFDA dates arrive as "20180823" — convert to ISO "2018-08-23"
function parseFdaDate(s: string | undefined): string | null {
  if (!s || s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

// SPL effective_time arrives as "20250630" — same format
function parseEffectiveTime(s: string | undefined): string | null {
  return parseFdaDate(s)
}

// ── API response types ────────────────────────────────────────────────────────

interface OpenFdaBlock {
  brand_name?: string[]
  // generic_name = bare INN stem — may be MISSING biologic suffix (e.g. 'GARADACIMAB' not 'GARADACIMAB-GXII')
  // Use substance_name as authoritative for full name including suffix and salt form
  generic_name?: string[]
  // substance_name = full active ingredient name incl. suffix and salt
  // Examples: 'GARADACIMAB-GXII', 'DONIDALORSEN SODIUM', 'ICATIBANT ACETATE', 'LANADELUMAB-FLYO'
  substance_name?: string[]
  application_number?: string[]
  // manufacturer_name is unreliable for some drugs:
  //   - CSL Behring LLC → truncated to 'CSL'
  //   - Dyax Corp → shows old BLA holder, not current Takeda
  // Store as fallback; override manually for known-bad entries via seed_classification.sql
  manufacturer_name?: string[]
}

interface LabelResult {
  set_id?: string
  version?: string           // SPL version number (e.g. '14') — store to detect label changes
  effective_time?: string    // label effective date "20250630" — always >= approval date
  mechanism_of_action?: string[]
  indications_and_usage?: string[]
  warnings_and_precautions?: string[]
  recent_major_changes?: string[]
  description?: string[]
  openfda?: OpenFdaBlock
}

interface DrugsFdaSubmission {
  submission_type: string
  submission_status: string
  submission_status_date: string
  submission_number?: string
}

interface DrugsFdaResult {
  application_number?: string
  sponsor_name?: string
  submissions?: DrugsFdaSubmission[]
}

interface FdaApiMeta {
  results: { total: number; skip: number; limit: number }
}

interface FdaApiResponse<T> {
  meta?: FdaApiMeta
  results?: T[]
  error?: { code: string; message: string }
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

// Fetch all SPL label records for a drug (paginating if total > LABEL_LIMIT).
// Icatibant has 9 records (1 originator NDA + 8 generic ANDAs) — limit=1 would miss 8 of them.
async function fetchAllLabels(inn: string): Promise<LabelResult[]> {
  const baseUrl = `${FDA_LABEL_BASE}?search=openfda.generic_name:"${encodeURIComponent(inn)}"&limit=${LABEL_LIMIT}`
  const r = await fetch(baseUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) return []
  const d = await r.json() as FdaApiResponse<LabelResult>
  if (!d.results?.length) return []

  const results = [...d.results]
  const total = d.meta?.results.total ?? results.length

  if (total > LABEL_LIMIT) {
    const pages = Math.ceil(total / LABEL_LIMIT)
    for (let p = 1; p < pages; p++) {
      const pageUrl = `${baseUrl}&skip=${p * LABEL_LIMIT}`
      const pr = await fetch(pageUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!pr.ok) break
      const pd = await pr.json() as FdaApiResponse<LabelResult>
      results.push(...(pd.results ?? []))
    }
  }

  return results
}

// Pick the best label record for a drug.
// Prefer NDA/BLA (originator) over ANDA (generic) — originator labels are most complete.
// For icatibant, this returns the Firazyr NDA 022150 label, not the Sajazir ANDA.
function selectBestLabel(labels: LabelResult[]): LabelResult | null {
  if (!labels.length) return null
  const originator = labels.find(l =>
    l.openfda?.application_number?.some(a => /^(NDA|BLA)/.test(a))
  )
  return originator ?? labels[0]
}

async function fetchDrugsFda(inn: string): Promise<DrugsFdaResult | null> {
  const url = `${FDA_DRUGS_BASE}?search=openfda.generic_name:"${encodeURIComponent(inn)}"&limit=1`
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) return null
  const d = await r.json() as FdaApiResponse<DrugsFdaResult>
  return d.results?.[0] ?? null
}

// ── INN / substance name helpers ──────────────────────────────────────────────

// Determine the full INN including biologic suffix from substance_name.
// Pattern: biologics get a 4-letter FDA suffix after a hyphen (e.g. '-gxii', '-flyo').
// Small molecules: salt modifier is NOT the inn_full (e.g. 'donidalorsen sodium' → inn_full = 'donidalorsen').
// Returns null if indeterminate.
function extractInnFull(substanceName: string | undefined, genericName: string | undefined): string | null {
  if (!substanceName) return genericName?.toLowerCase() ?? null
  const sub = substanceName.toLowerCase().trim()
  // Biologic qualifier suffix: word-hyphen-exactly-4-lowercase-letters at end
  if (/^[a-z]+(?:-[a-z]+)*-[a-z]{4}$/.test(sub)) return sub
  // Otherwise: salt form — inn_full is just the INN stem from generic_name
  return genericName?.toLowerCase() ?? sub
}

// ── Main handler ──────────────────────────────────────────────────────────────

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

  // Select fields we need to decide what to write
  const { data: assets, error: assetsErr } = await supabase
    .from('assets')
    .select('id, inn, mechanism, manufacturer_current')

  if (assetsErr) return res.status(500).json({ error: assetsErr.message })
  if (!assets?.length) {
    return res.status(200).json({ message: 'No assets to sync', updated: 0 })
  }

  const errors: string[] = []
  let mechanismUpdated  = 0
  let labelMetaUpdated  = 0
  let eventsUpserted    = 0

  for (const asset of assets) {
    try {
      const [allLabels, drugsFda] = await Promise.all([
        fetchAllLabels(asset.inn),
        fetchDrugsFda(asset.inn),
      ])

      // Select best label: prefer originator NDA/BLA over generics
      const label = selectBestLabel(allLabels)

      // ── INN / substance name ────────────────────────────────────────────────
      // substance_name is authoritative for full active ingredient name:
      //   - Garadacimab: generic_name = 'GARADACIMAB' (WRONG, suffix dropped)
      //                  substance_name = 'GARADACIMAB-GXII' (CORRECT)
      //   - Donidalorsen: generic_name = 'DONIDALORSEN' (free acid INN)
      //                   substance_name = 'DONIDALORSEN SODIUM' (formulated form)
      const rawSubstanceName = label?.openfda?.substance_name?.[0] ?? null
      const rawGenericName   = label?.openfda?.generic_name?.[0] ?? null
      const innStem          = rawGenericName?.toLowerCase() ?? null
      const innFull          = extractInnFull(rawSubstanceName ?? undefined, rawGenericName ?? undefined)
      const substanceNameFormulated = rawSubstanceName

      // ── Label version / currency ────────────────────────────────────────────
      // effective_time is the correct currency date — always >= original approval date
      // (e.g. Garadacimab approved 06/16/2025, label effective 06/30/2025 — 14-day gap is normal)
      const labelVersion       = label?.version ?? null
      const labelEffectiveDate = parseEffectiveTime(label?.effective_time)

      // ── Application numbers (multi-NDA handling) ────────────────────────────
      // Berotralstat: two NDAs (214094 capsules + 219776 pellets) share one SPL
      // Store all application numbers found across all label records for this drug
      const allAppNums = allLabels.flatMap(l => l.openfda?.application_number ?? [])
      const applicationNumbers = [...new Set(allAppNums)]

      // ── Manufacturer (best-effort, known to be imperfect) ───────────────────
      // API openfda.manufacturer_name is unreliable:
      //   CSL Behring LLC → 'CSL' (truncated)
      //   Takeda (formerly Dyax) → still shows 'DYAX CORP' in Drugs@FDA screenshots
      // We write here if the column is empty; correct values are in seed_classification.sql
      const manufacturerFromApi = label?.openfda?.manufacturer_name?.[0] ?? null

      // ── Build asset update payload ─────────────────────────────────────────
      // Only set fields that have a value; never overwrite non-null with null
      const assetUpdate: Record<string, unknown> = {}

      if (innStem)    assetUpdate.inn_stem = innStem
      if (innFull)    assetUpdate.inn_full = innFull
      if (substanceNameFormulated) assetUpdate.substance_name_formulated = substanceNameFormulated
      if (labelVersion)      assetUpdate.label_version       = labelVersion
      if (labelEffectiveDate) assetUpdate.label_effective_date = labelEffectiveDate
      if (applicationNumbers.length) assetUpdate.application_numbers = applicationNumbers

      // Manufacturer: write from API only if not already set (seed_classification.sql takes priority)
      if (manufacturerFromApi && !asset.manufacturer_current) {
        assetUpdate.manufacturer_current = manufacturerFromApi
      }

      // Mechanism: only write if currently null — never overwrite manually entered data
      if (label && !asset.mechanism) {
        const rawMoa = label.mechanism_of_action?.[0]
        if (rawMoa) {
          assetUpdate.mechanism = rawMoa
          mechanismUpdated++
        }
      }

      if (Object.keys(assetUpdate).length) {
        const { error } = await supabase
          .from('assets')
          .update(assetUpdate)
          .eq('id', asset.id)
        if (error) errors.push(`assets update ${asset.inn}: ${error.message}`)
        else labelMetaUpdated++
      }

      // ── Upsert regulatory_events for original FDA approval ──────────────────
      // Unique constraint on (asset_id, authority, event_type) prevents duplicate rows.
      // REQUIRES: add_drug_detail_columns.sql must have been run first to create the constraint.
      if (drugsFda?.submissions?.length) {
        const origApproval = drugsFda.submissions.find(
          (s) => s.submission_type === 'ORIG' && s.submission_status === 'AP'
        )
        if (origApproval) {
          const approvalDate = parseFdaDate(origApproval.submission_status_date)
          const brandName    = label?.openfda?.brand_name?.[0] ?? null
          const appNumber    = drugsFda.application_number ?? applicationNumbers[0] ?? null
          const sponsor      = drugsFda.sponsor_name ?? asset.manufacturer_current ?? manufacturerFromApi ?? null

          const headline = [
            'FDA approved',
            brandName ? `${brandName} (${asset.inn})` : asset.inn,
            appNumber ? `— ${appNumber}` : '',
          ].filter(Boolean).join(' ')

          const { error } = await supabase
            .from('regulatory_events')
            .upsert(
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
              // onConflict must match the constraint name column list exactly
              { onConflict: 'asset_id,authority,event_type', ignoreDuplicates: false }
            )
          if (error) errors.push(`regulatory_events ${asset.inn}: ${error.message}`)
          else eventsUpserted++
        }
      }
    } catch (e: any) {
      errors.push(`${asset.inn}: ${e.message}`)
    }
  }

  return res.status(200).json({
    assets_processed:    assets.length,
    mechanism_updated:   mechanismUpdated,
    label_meta_updated:  labelMetaUpdated,
    events_upserted:     eventsUpserted,
    ...(errors.length && { errors }),
  })
}
