/**
 * ingest-fda-labels — Supabase Edge Function (Deno)
 *
 * Detects FDA drug label changes by diffing the current openFDA label against
 * a stored snapshot in label_snapshots. A change writes a signal to company_signals
 * with signal_type = 'label_update'. The first run per drug seeds the baseline and
 * writes no signal.
 *
 * Scheduled: 0 2 * * 0 (02:00 UTC every Sunday) via pg_cron.
 * Deploy: supabase functions deploy ingest-fda-labels
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Targets ───────────────────────────────────────────────────────────────────

// competitor_id values match the string keys used in src/data/competitors.json
// Pharming (Ruconest) is not tracked as a competitor — signals are skipped for null ids
const TARGETS = [
  { inn: 'lanadelumab',                      brand: 'Takhzyro', app_no: 'BLA761090', competitor_id: 'takeda'      },
  { inn: 'berotralstat',                     brand: 'Orladeyo', app_no: 'NDA214094', competitor_id: 'biocryst'    },
  { inn: 'icatibant',                        brand: 'Firazyr',  app_no: 'NDA022150', competitor_id: 'takeda'      },
  { inn: 'conestat alfa',                    brand: 'Ruconest', app_no: 'BLA125495', competitor_id: null          },
  { inn: 'c1-esterase inhibitor (haegarda)', brand: 'Haegarda', app_no: 'BLA761053', competitor_id: 'csl-behring' },
]

const OPENFDA_BASE = 'https://api.fda.gov/drug/label.json'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function detectChangedSection(
  oldLabel: Record<string, unknown> | null,
  newLabel: Record<string, unknown>,
): string {
  const sections: Array<{ key: string; label: string }> = [
    { key: 'boxed_warning',          label: 'boxed warning' },
    { key: 'warnings',               label: 'warnings' },
    { key: 'indications_and_usage',  label: 'indications and usage' },
    { key: 'adverse_reactions',      label: 'adverse reactions' },
  ]
  if (!oldLabel) return 'label sections'
  for (const { key, label } of sections) {
    const oldVal = (oldLabel[key] as string[] | undefined)?.[0] ?? ''
    const newVal = (newLabel[key] as string[] | undefined)?.[0] ?? ''
    if (oldVal !== newVal) return label
  }
  return 'label sections'
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Record run start
  const { data: runRow } = await supabase
    .from('ingest_runs')
    .insert({ source: 'openfda_label', status: 'running' })
    .select('id')
    .single()
  const runId: string | null = runRow?.id ?? null

  let newSignals = 0
  let skipped    = 0
  const errors: string[] = []

  for (const drug of TARGETS) {
    try {
      // A. Fetch current label from openFDA
      const url = `${OPENFDA_BASE}?search=openfda.application_number:${drug.app_no}&limit=1`
      const res = await fetch(url, { headers: { 'User-Agent': 'AriyaSignals ayat.tayebulla@phamax.ch' } })

      if (res.status === 404) {
        console.warn(`[${drug.brand}] openFDA 404 — skipping`)
        skipped++
        await sleep(500)
        continue
      }

      const json = await res.json()
      const result: Record<string, unknown> = json.results?.[0] ?? null

      if (!result) {
        console.warn(`[${drug.brand}] empty results — skipping`)
        skipped++
        await sleep(500)
        continue
      }

      const labelVersion  = (result.effective_time as string | undefined) ?? 'unknown'
      const indications   = (result.indications_and_usage  as string[] | undefined)?.[0] ?? ''
      const warnings      = (result.warnings               as string[] | undefined)?.[0] ?? ''
      const boxedWarning  = (result.boxed_warning           as string[] | undefined)?.[0] ?? ''
      const adverseRx     = (result.adverse_reactions       as string[] | undefined)?.[0] ?? ''

      if (!indications && !warnings && !boxedWarning && !adverseRx) {
        console.warn(`[${drug.brand}] all sections empty — skipping`)
        skipped++
        await sleep(500)
        continue
      }

      // B. Compute hash of key sections
      const sectionsHash = await sha256(`${indications}|${warnings}|${boxedWarning}|${adverseRx}`)

      // C. Load existing snapshot
      const { data: snapshot } = await supabase
        .from('label_snapshots')
        .select('id, sections_hash, label_version, raw_label_json')
        .eq('application_no', drug.app_no)
        .maybeSingle()

      if (!snapshot) {
        // Baseline seed — no signal written
        await supabase.from('label_snapshots').insert({
          drug_inn:       drug.inn,
          application_no: drug.app_no,
          label_version:  labelVersion,
          sections_hash:  sectionsHash,
          raw_label_json: result,
        })
        console.log(`[${drug.brand}] Baseline seeded (label version ${labelVersion})`)
        await sleep(500)
        continue
      }

      if (snapshot.sections_hash === sectionsHash) {
        console.log(`[${drug.brand}] No change`)
        await sleep(500)
        continue
      }

      // Hash differs — determine which section changed
      const changedSection = detectChangedSection(
        snapshot.raw_label_json as Record<string, unknown> | null,
        result,
      )

      // Skip if this drug's manufacturer isn't tracked as a competitor
      if (!drug.competitor_id) {
        console.warn(`[${drug.brand}] No competitor_id configured — skipping signal`)
        skipped++
        await sleep(500)
        continue
      }
      const competitorId = drug.competitor_id

      const sourceHash = await sha256(`${drug.app_no}:${labelVersion}`)
      const sourceUrl  = `${OPENFDA_BASE}?search=openfda.application_number:${drug.app_no}`
      const headline   = `${drug.brand} FDA label updated — ${changedSection} changed`
      const body       = `Label version changed from ${snapshot.label_version} to ${labelVersion}. Section affected: ${changedSection}.`

      // Deduplication check before insert
      const { count } = await supabase
        .from('company_signals')
        .select('id', { count: 'exact', head: true })
        .eq('source_hash', sourceHash)

      if ((count ?? 0) === 0) {
        const { error: insertErr } = await supabase.from('company_signals').insert({
          competitor_id:    competitorId,
          signal_type:      'label_update',
          headline,
          body_excerpt:     body,
          date:             new Date().toISOString().slice(0, 10),
          source_url:       sourceUrl,
          source_hash:      sourceHash,
          data_source:      'openfda_label',
          accession_number: drug.app_no,
        })
        if (insertErr) {
          console.error(`[${drug.brand}] Insert failed: ${insertErr.message}`)
          errors.push(`${drug.brand}: insert failed — ${insertErr.message}`)
        } else {
          newSignals++
          console.log(`[${drug.brand}] Signal written — ${changedSection} changed`)
        }
      } else {
        console.log(`[${drug.brand}] Signal already exists (deduplicated)`)
      }

      // Update snapshot to new state
      await supabase
        .from('label_snapshots')
        .update({
          sections_hash:  sectionsHash,
          label_version:  labelVersion,
          raw_label_json: result,
          fetched_at:     new Date().toISOString(),
        })
        .eq('application_no', drug.app_no)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${drug.brand}] Error: ${msg}`)
      errors.push(`${drug.brand}: ${msg}`)
      skipped++
    }

    await sleep(500)
  }

  // Update ingest_runs
  const succeeded = TARGETS.length - skipped - errors.length
  const status =
    errors.length === TARGETS.length ? 'failed' :
    errors.length > 0 || skipped > 0 ? 'partial' :
    'success'

  if (runId) {
    await supabase
      .from('ingest_runs')
      .update({
        status,
        new_signals: newSignals,
        skipped,
        errors:      errors,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
  }

  const body = JSON.stringify({ status, newSignals, skipped, errors, succeeded })
  return new Response(body, { headers: { 'Content-Type': 'application/json' } })
})
