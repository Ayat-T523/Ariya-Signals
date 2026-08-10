/**
 * ingest-hta — Supabase Edge Function (Deno)
 *
 * Fetches NICE Technology Appraisal (TA) decisions for tracked HAE drugs
 * from the NICE internal search API (search-api.nice.org.uk). For each drug
 * in asset_lexicon, queries by INN, filters to Technology Appraisal guidance
 * only, and writes new decisions to hta_decisions and company_signals.
 *
 * Data source: https://search-api.nice.org.uk/api/search?index=guidance
 * signal_type = 'hta_decision'
 * data_source = 'nice_hta'
 * source_hash = SHA-256('nice_hta|' + guidanceRef)
 *
 * Scheduled: 0 9 * * 2 (09:00 UTC every Tuesday) via pg_cron.
 * Deploy:    supabase functions deploy ingest-hta
 *
 * Optional request body:
 *   { "lookbackDays": 1700 }   — override default 9-day window for initial
 *                                 seed / historical backfill (1700 ≈ 4.6 years)
 *
 * NICE API notes:
 *   - index=guidance returns all guidance types; filter in code by niceGuidanceType
 *   - publicationDate is ISO-8601 with time component: "2021-10-20T12:00:00"
 *   - guidanceRef is null for in-development / consultation records — skip those
 *   - decision_type is derived from title text; defaults to 'recommended' when
 *     no explicit negative language is found (NICE client-side renders the body)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_SOURCE         = 'nice_hta'
const HASH_PREFIX         = 'nice_hta'
const NICE_SEARCH_BASE    = 'https://search-api.nice.org.uk/api/search'
const LOOKBACK_DAYS_DEFAULT = 9
const FETCH_TIMEOUT       = 15_000
const TA_GUIDANCE_TYPE    = 'Technology appraisal guidance'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LexiconRow {
  inn:           string
  competitor_id: string | null
  synonyms:      string[] | null
}

interface NiceDoc {
  guidanceRef:      string
  title:            string
  titleNoHtml:      string | null
  publicationDate:  string          // "2021-10-20T12:00:00"
  niceGuidanceType: string[]
  guidanceStatus:   string[]
  url:              string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Derives decision_type from the TA title.
 * NICE body text is client-side rendered so the title is the only reliable
 * signal available from the search API. Defaults to 'recommended' — all
 * HAE drugs with published NICE TAs in the tracked lexicon were recommended.
 */
function inferDecisionType(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('not recommended') || t.includes('do not recommend')) {
    return 'not_recommended'
  }
  return 'recommended'
}

// ── NICE search for one drug INN ──────────────────────────────────────────────

async function fetchNiceDocs(inn: string, cutoffStr: string): Promise<NiceDoc[]> {
  const url = `${NICE_SEARCH_BASE}?index=guidance&q=${encodeURIComponent(inn)}&size=50`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  let res: Response
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AriyaSignals ayat.tayebulla@phamax.ch',
        'Accept':     'application/json',
      },
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

  // deno-lint-ignore no-explicit-any
  const json = await res.json() as { documents?: any[]; resultCount?: number }
  const docs: NiceDoc[] = []

  for (const d of json.documents ?? []) {
    // Must have a guidance ref (null = draft / consultation doc)
    if (!d.guidanceRef) continue

    // Must be a Technology Appraisal
    const types: string[] = d.niceGuidanceType ?? []
    if (!types.includes(TA_GUIDANCE_TYPE)) continue

    // Must have a publication date on or after cutoff
    const pubDate = (d.publicationDate ?? '').slice(0, 10)   // "2021-10-20"
    if (!pubDate || pubDate < cutoffStr) continue

    docs.push({
      guidanceRef:      String(d.guidanceRef),
      title:            stripHtml(String(d.title ?? '')),
      titleNoHtml:      d.titleNoHtml ? String(d.titleNoHtml) : null,
      publicationDate:  pubDate,
      niceGuidanceType: types,
      guidanceStatus:   d.guidanceStatus ?? [],
      url:              String(d.url ?? d.contentId ?? ''),
    })
  }

  const total = json.resultCount ?? 0
  console.log(`[hta] "${inn}" → ${total} raw, ${docs.length} TA in window`)
  return docs
}

// ── ingest_errors handler ─────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleSourceError(supabase: any, inn: string, msg: string): Promise<void> {
  await supabase.rpc('upsert_ingest_error', {
    p_source:        DATA_SOURCE,
    p_competitor_id: inn.replace(/\s+/g, '_').slice(0, 60),
    p_error_message: msg,
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Parse optional lookbackDays override
  let lookbackDays = LOOKBACK_DAYS_DEFAULT
  try {
    const body = await req.json() as { lookbackDays?: number }
    if (typeof body.lookbackDays === 'number' && body.lookbackDays > 0) {
      lookbackDays = body.lookbackDays
    }
  } catch {
    // no body or non-JSON — use default
  }

  // Record run start
  const { data: runRow } = await supabase
    .from('ingest_runs')
    .insert({ source: DATA_SOURCE, status: 'running' })
    .select('id')
    .single()
  const runId: string | null = runRow?.id ?? null

  // Load asset_lexicon
  const { data: lexicon, error: lexErr } = await supabase
    .from('asset_lexicon')
    .select('inn, competitor_id, synonyms')

  if (lexErr || !lexicon || lexicon.length === 0) {
    const msg = lexErr?.message ?? 'empty asset_lexicon'
    console.error(`[ingest-hta] asset_lexicon load failed: ${msg}`)
    if (runId) {
      await supabase.from('ingest_runs').update({
        status: 'failed', errors: [msg], finished_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return new Response(JSON.stringify({ status: 'failed', error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // INN (lowercase) → asset_id, mirroring scripts/lib/signal-gate.mjs's loadInnToAssetId.
  // Non-fatal if it fails: decisions can still be found and written, just
  // without asset_id for this run, rather than failing the whole ingest.
  const { data: assetRows, error: assetErr } = await supabase.from('assets').select('id, inn')
  if (assetErr) console.error('[ingest-hta] assets load failed:', assetErr.message)
  const innToAssetId = new Map<string, string>()
  for (const a of assetRows ?? []) {
    if (a.inn) innToAssetId.set((a.inn as string).toLowerCase(), a.id as string)
  }

  // Compute lookback cutoff
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - lookbackDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  console.log(`[hta] lookback ${lookbackDays} days → cutoff ${cutoffStr}`)

  const errorLog:   string[] = []
  let totalNew      = 0
  let totalSkipped  = 0
  let rawResults    = 0
  let passedGate    = 0
  const drugsScanned = (lexicon as LexiconRow[]).length

  for (const row of lexicon as LexiconRow[]) {
    const { inn, competitor_id } = row

    let docs: NiceDoc[] = []
    try {
      docs = await fetchNiceDocs(inn, cutoffStr)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[hta] fetch error for "${inn}": ${msg}`)
      await handleSourceError(supabase, inn, msg)
      errorLog.push(`fetch "${inn}": ${msg}`)
      await sleep(500)
      continue
    }

    rawResults += docs.length

    for (const doc of docs) {
      passedGate++

      const sourceHash   = await sha256(`${HASH_PREFIX}|${doc.guidanceRef}`)
      const decisionType = inferDecisionType(doc.titleNoHtml ?? doc.title)
      const indication   = doc.title.slice(0, 500)

      // ── Write to hta_decisions ───────────────────────────────────────────

      const { error: htaErr } = await supabase.from('hta_decisions').upsert({
        drug_inn:      inn,
        agency:        'NICE',
        decision_type: decisionType,
        guidance_ref:  doc.guidanceRef,
        decision_date: doc.publicationDate,
        indication,
        source_url:    doc.url,
        source_hash:   sourceHash,
        raw_summary:   doc.title,
      }, { onConflict: 'source_hash', ignoreDuplicates: true })

      if (htaErr) {
        console.error(`[hta] hta_decisions error: ${htaErr.message}`)
        errorLog.push(`hta ${doc.guidanceRef}: ${htaErr.message}`)
      }

      // ── Write to company_signals (dedup by source_hash) ──────────────────

      const { count: csCount } = await supabase
        .from('company_signals')
        .select('id', { count: 'exact', head: true })
        .eq('source_hash', sourceHash)

      if ((csCount ?? 0) > 0) {
        totalSkipped++
        console.log(`[hta] skip dup: ${doc.guidanceRef}`)
        await sleep(100)
        continue
      }

      const companyName = competitor_id ?? inn
      const headline    = `NICE ${decisionType === 'recommended' ? 'recommends' : 'does not recommend'} ${inn} (${doc.guidanceRef})`
      const bodyExcerpt = indication

      const { error: csErr } = await supabase.from('company_signals').insert({
        competitor_id,
        signal_type:  'hta_decision',
        headline,
        body_excerpt: bodyExcerpt,
        date:         doc.publicationDate,
        source_url:   doc.url,
        source_hash:  sourceHash,
        data_source:  DATA_SOURCE,
        inn,
        asset_id:     innToAssetId.get(inn.toLowerCase()) ?? null,
      })

      if (csErr) {
        console.error(`[hta] company_signals error: ${csErr.message}`)
        errorLog.push(`cs ${doc.guidanceRef}: ${csErr.message}`)
        totalSkipped++
      } else {
        totalNew++
        console.log(`[hta] + signal: ${headline}`)
      }

      await sleep(100)
    }

    await sleep(500)   // polite gap between drug queries
  }

  // Update ingest_runs
  const allFetchFailed = errorLog.filter(e => e.startsWith('fetch')).length === drugsScanned
  const status =
    allFetchFailed       ? 'failed'  :
    errorLog.length > 0  ? 'partial' :
    'success'

  if (runId) {
    await supabase.from('ingest_runs').update({
      status,
      new_signals: totalNew,
      skipped:     totalSkipped,
      errors:      errorLog,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  return new Response(
    JSON.stringify({
      status,
      lookbackDays,
      drugsScanned,
      rawResults,
      passedGate,
      newSignals:  totalNew,
      skipped:     totalSkipped,
      errors:      errorLog,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
