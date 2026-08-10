/**
 * ingest-pubmed — Supabase Edge Function (Deno)
 *
 * Monitors PubMed for new publications mentioning tracked HAE drugs.
 * INN list is read dynamically from asset_lexicon (length >= 8) so new
 * drugs added to the lexicon are picked up automatically.
 *
 * For each INN:
 *   1. esearch  — find PMIDs published in the last RELDATE days
 *   2. esummary — fetch title, journal, date, authors per PMID
 *   3. Relevance gate: title must contain the INN (case-insensitive)
 *   4. Severity: HIGH for tier-1 journals, LOW otherwise
 *   5. Insert into company_signals (dedup via source_hash)
 *
 * NCBI_API_KEY (optional) raises rate limit from 3 to 10 req/s.
 * Get a free key at https://www.ncbi.nlm.nih.gov/account/
 *
 * Scheduled: 0 7 * * 3  (07:00 UTC every Wednesday) via pg_cron.
 * Deploy:    supabase functions deploy ingest-pubmed
 *
 * Acceptance: if total signals per run exceeds 20, tighten RELDATE from 8 to 4.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decodeHtmlEntities, stripKnownHtmlTags } from '../_shared/htmlEntities.ts'

// ── Constants ─────────────────────────────────────────────────────────────────

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const DATA_SOURCE = 'pubmed'
const RELDATE     = 8   // search last N days of publications
const RETMAX      = 20  // max results per INN per run

// HIGH severity if the journal name contains any of these strings (case-insensitive)
const TIER_1_JOURNALS = [
  'new england journal of medicine', 'nejm',
  'the lancet', 'lancet',
  'journal of allergy and clinical immunology', 'jaci',
  'allergy', 'annals of allergy asthma and immunology',
  'journal of clinical investigation',
  'nature medicine',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function parsePubDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const MONTHS: Record<string, string> = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
  }
  // "YYYY Mon DD" or "YYYY Mon"
  const m = s.match(/^(\d{4})\s+([A-Za-z]{3})\w*(?:\s+(\d{1,2}))?/)
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()]
    if (mon) return `${m[1]}-${mon}-${(m[3] ?? '1').padStart(2,'0')}`
  }
  // "YYYY" only
  const yr = s.match(/^(\d{4})$/)
  if (yr) return `${yr[1]}-01-01`
  return null
}

function classifySeverity(journal: string): string {
  const lower = journal.toLowerCase()
  return TIER_1_JOURNALS.some(j => lower.includes(j)) ? 'HIGH' : 'LOW'
}

function buildEutilsUrl(endpoint: string, params: Record<string, string>, apiKey: string | null): string {
  const qs = new URLSearchParams({
    ...params,
    tool:  'ariya-signals',
    email: 'ayattayebulla@gmail.com',
    ...(apiKey ? { api_key: apiKey } : {}),
  })
  return `${EUTILS_BASE}/${endpoint}?${qs}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const ncbiKey = Deno.env.get('NCBI_API_KEY') ?? null
  if (!ncbiKey) console.warn('[ingest-pubmed] NCBI_API_KEY not set — 3 req/s limit applies')

  // Rate delay: 334ms = ~3/s (no key), 110ms = ~9/s (with key)
  const RATE_DELAY = ncbiKey ? 110 : 334

  // Record run start
  const { data: runRow } = await supabase
    .from('ingest_runs')
    .insert({ source: DATA_SOURCE, status: 'running' })
    .select('id')
    .single()
  const runId: string | null = runRow?.id ?? null

  // Load INNs from asset_lexicon (length >= 8 excludes short abbreviations like "hae")
  const { data: lexRows, error: lexErr } = await supabase
    .from('asset_lexicon')
    .select('inn')
    .not('inn', 'is', null)
    .gte('inn', '        ')  // length >= 8 via lexicographic comparison

  if (lexErr || !lexRows?.length) {
    console.error('[ingest-pubmed] asset_lexicon load failed:', lexErr?.message)
    if (runId) {
      await supabase.from('ingest_runs').update({
        status: 'failed', errors: ['asset_lexicon load failed'], finished_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return new Response(JSON.stringify({ status: 'failed', error: 'asset_lexicon load failed' }), { status: 500 })
  }

  // Deduplicate INNs
  const inns = [...new Set(lexRows.map(r => r.inn as string).filter(inn => inn.length >= 8))]
  console.log(`[ingest-pubmed] ${inns.length} INNs from asset_lexicon: ${inns.join(', ')}`)

  let totalNew = 0, totalSkipped = 0
  const errors: string[] = []

  for (const inn of inns) {
    console.log(`\n[${inn}] esearch reldate=${RELDATE} retmax=${RETMAX}`)

    // A. esearch — find PMIDs published in last RELDATE days
    let pmids: string[] = []
    try {
      const searchUrl = buildEutilsUrl('esearch.fcgi', {
        db:       'pubmed',
        term:     `${inn}[Title/Abstract]`,
        datetype: 'pdat',
        reldate:  String(RELDATE),
        retmode:  'json',
        retmax:   String(RETMAX),
      }, ncbiKey)

      const searchResp = await fetch(searchUrl)
      await sleep(RATE_DELAY)
      if (!searchResp.ok) throw new Error(`esearch HTTP ${searchResp.status}`)
      const searchData = await searchResp.json()
      pmids = searchData.esearchresult?.idlist ?? []
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[${inn}] esearch error: ${msg}`)
      errors.push(`${inn}: ${msg}`)
      continue
    }

    // B. No results for this INN
    if (!pmids.length) {
      console.log(`[${inn}] 0 PMIDs found`)
      continue
    }
    console.log(`[${inn}] ${pmids.length} PMID(s): ${pmids.join(', ')}`)

    // C. esummary — fetch metadata for each PMID
    for (const pmid of pmids) {
      try {
        const summaryUrl = buildEutilsUrl('esummary.fcgi', {
          db:      'pubmed',
          id:      pmid,
          retmode: 'json',
        }, ncbiKey)

        const summaryResp = await fetch(summaryUrl)
        await sleep(RATE_DELAY)
        if (!summaryResp.ok) throw new Error(`esummary HTTP ${summaryResp.status}`)
        const summaryData = await summaryResp.json()
        const s = summaryData.result?.[pmid]
        if (!s || s.error) { totalSkipped++; continue }

        const title   = (s.title ?? '').replace(/\.$/, '').trim()
        const journal = (s.source ?? '').trim()
        const pubdate = (s.pubdate ?? '').trim()
        // deno-lint-ignore no-explicit-any
        const authors = ((s.authors ?? []) as any[]).slice(0, 3).map((a: any) => a.name).join(', ')

        if (!title) { totalSkipped++; continue }

        // D. Relevance gate — title must contain the INN (case-insensitive)
        if (!title.toLowerCase().includes(inn.toLowerCase())) {
          console.log(`[${inn}] PMID ${pmid} — title does not mention INN, skipping`)
          totalSkipped++
          continue
        }

        // E. Severity
        const severity = classifySeverity(journal)

        // F. source_hash
        const sourceHash = await sha256hex(`pubmed|${pmid}`)

        // Dedup
        const { count } = await supabase
          .from('company_signals')
          .select('id', { count: 'exact', head: true })
          .eq('source_hash', sourceHash)
        if ((count ?? 0) > 0) { totalSkipped++; continue }

        // G. Write to company_signals
        // PubMed titles carry entities for Greek letters, primes and curly
        // quotes. Decode before truncating, so a slice never lands inside an
        // entity and leaves a fragment like "&#82" that can no longer be decoded.
        const clean = (s: string) => stripKnownHtmlTags(decodeHtmlEntities(s))
        const headline    = `${inn}: new publication in ${clean(journal)} — ${clean(title).slice(0, 100)}`
        const bodyExcerpt = `Authors: ${clean(authors) || 'N/A'}. Published: ${pubdate}.`
        const date        = parsePubDate(pubdate)
        const sourceUrl   = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`

        const { error: insertErr } = await supabase.from('company_signals').insert({
          competitor_id: null,
          signal_type:   'publication',
          headline:      headline.slice(0, 500),
          body_excerpt:  bodyExcerpt.slice(0, 400),
          date,
          source_url:    sourceUrl,
          source_hash:   sourceHash,
          data_source:   DATA_SOURCE,
          severity,
        })

        if (insertErr) {
          console.error(`[${inn}] PMID ${pmid} insert error: ${insertErr.message}`)
          errors.push(`PMID ${pmid}: ${insertErr.message}`)
        } else {
          totalNew++
          console.log(`[${inn}] ✅ [${severity}] PMID ${pmid} — ${title.slice(0, 70)}`)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[${inn}] PMID ${pmid} error: ${msg}`)
        errors.push(`${inn}/${pmid}: ${msg}`)
      }

      // H. Rate limit between PMIDs
      await sleep(RATE_DELAY)
    }
  }

  // I. Update ingest_runs
  const status = errors.length && !totalNew ? 'failed' : errors.length ? 'partial' : 'success'
  if (runId) {
    await supabase.from('ingest_runs').update({
      status,
      new_signals: totalNew,
      skipped:     totalSkipped,
      errors,
      notes:       `${inns.length} INNs, reldate=${RELDATE}`,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  console.log(`\n[ingest-pubmed] done — ${totalNew} new, ${totalSkipped} skipped, ${errors.length} errors`)
  return new Response(
    JSON.stringify({ status, newSignals: totalNew, skipped: totalSkipped, errors }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
