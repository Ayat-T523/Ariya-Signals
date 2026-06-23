/**
 * ingest-federal-register — Supabase Edge Function (Deno)
 *
 * Fetches FDA advisory committee and PDUFA notices from the Federal Register
 * API. Writes landscape-level regulatory events (competitor_id = null).
 *
 * PART A — builds query terms from asset_lexicon INNs + first synonym per row,
 *           plus TA terms 'hereditary angioedema' and 'HAE'. Caps at 10 terms.
 *           Makes one API call per term (the FR API does AND on spaces, not OR),
 *           then merges results by document_number.
 *
 * PART B — applies relevance gate (title/abstract must mention a tracked term),
 *           parses event type, writes to regulatory_calendar and company_signals.
 *
 * signal_type = 'regulatory_catalyst'
 * data_source = 'federal_register'
 * source_hash = SHA-256('fed_register|' + document_number)
 *
 * Scheduled: 0 8 * * 1 (08:00 UTC every Monday) via pg_cron.
 * Deploy:    supabase functions deploy ingest-federal-register
 *
 * FR API notes:
 *   - Endpoint is /documents.json (spec says /articles.json — that does not exist)
 *   - conditions[type] requires ALL-CAPS value: 'NOTICE'
 *   - conditions[term] does AND-of-words for spaces; OR requires separate calls per term
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_SOURCE   = 'federal_register'
const HASH_PREFIX   = 'fed_register'   // SHA-256('fed_register|' + document_number)
const FR_BASE       = 'https://www.federalregister.gov/api/v1/documents.json'
const LOOKBACK_DAYS = 9
const MAX_TERMS     = 10
const FETCH_TIMEOUT = 15_000

const TA_TERMS = ['hereditary angioedema', 'HAE']

// ── Types ─────────────────────────────────────────────────────────────────────

interface LexiconRow {
  inn:      string
  synonyms: string[] | null
}

interface FRDocument {
  document_number:  string
  title:            string
  abstract:         string | null
  publication_date: string   // YYYY-MM-DD
  html_url:         string
  action:           string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── PART A — Build query terms ────────────────────────────────────────────────

function buildQueryTerms(lexicon: LexiconRow[]): string[] {
  const seen = new Set<string>()
  const terms: string[] = []

  const add = (raw: string | null | undefined) => {
    if (!raw) return
    const t = raw.trim().toLowerCase()
    if (t && !seen.has(t)) { seen.add(t); terms.push(t) }
  }

  for (const row of lexicon) {
    add(row.inn)
    const firstSyn = (row.synonyms ?? [])[0]
    add(firstSyn)
  }

  for (const ta of TA_TERMS) add(ta)

  return terms.slice(0, MAX_TERMS)
}

// ── PART A — Per-term fetch (FR API does AND on spaces; one call per term) ───

async function fetchTermDocs(term: string, cutoffStr: string): Promise<FRDocument[]> {
  const qs = [
    'conditions[agencies][]=food-and-drug-administration',
    'conditions[type][]=NOTICE',
    `conditions[term]=${encodeURIComponent(term)}`,
    `conditions[publication_date][gte]=${cutoffStr}`,
    'fields[]=document_number',
    'fields[]=title',
    'fields[]=abstract',
    'fields[]=publication_date',
    'fields[]=html_url',
    'fields[]=action',
    'fields[]=docket_id',
    'per_page=20',
    'order=newest',
  ].join('&')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  let res: Response
  try {
    res = await fetch(`${FR_BASE}?${qs}`, {
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
  const json = await res.json() as { count?: number; results?: any[] }
  const out: FRDocument[] = []
  for (const d of json.results ?? []) {
    if (!d.document_number || !d.title || !d.publication_date || !d.html_url) continue
    out.push({
      document_number:  String(d.document_number),
      title:            String(d.title),
      abstract:         d.abstract ? String(d.abstract) : null,
      publication_date: String(d.publication_date),
      html_url:         String(d.html_url),
      action:           d.action ? String(d.action) : null,
    })
  }
  console.log(`[fr] term "${term}" → ${json.count ?? 0} total, ${out.length} in page`)
  return out
}

// ── PART B — Relevance gate ───────────────────────────────────────────────────

function passesRelevanceGate(doc: FRDocument, allTerms: string[]): boolean {
  const haystack = `${doc.title} ${doc.abstract ?? ''}`.toLowerCase()
  return allTerms.some(term => {
    const idx = haystack.indexOf(term)
    if (idx === -1) return false
    const before = idx > 0 ? haystack[idx - 1] : ' '
    const after  = idx + term.length < haystack.length ? haystack[idx + term.length] : ' '
    return !/[a-z]/.test(before) && !/[a-z]/.test(after)
  })
}

// ── PART B — Event type parser ────────────────────────────────────────────────

function parseEventType(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('advisory committee')) return 'FDA AdComm'
  if (t.includes('pdufa'))              return 'FDA PDUFA'
  return 'FDA Notice'
}

// ── ingest_errors handler ─────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleSourceError(supabase: any, key: string, msg: string): Promise<void> {
  await supabase.rpc('upsert_ingest_error', {
    p_source:        DATA_SOURCE,
    p_competitor_id: key.replace(/\s+/g, '_').slice(0, 60),
    p_error_message: msg,
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // F. Record run start
  const { data: runRow } = await supabase
    .from('ingest_runs')
    .insert({ source: DATA_SOURCE, status: 'running' })
    .select('id')
    .single()
  const runId: string | null = runRow?.id ?? null

  // ── PART A: Load asset_lexicon → build query terms ─────────────────────────

  const { data: lexicon, error: lexErr } = await supabase
    .from('asset_lexicon')
    .select('inn, synonyms')

  if (lexErr || !lexicon || lexicon.length === 0) {
    const msg = lexErr?.message ?? 'empty asset_lexicon'
    console.error(`[ingest-federal-register] asset_lexicon load failed: ${msg}`)
    if (runId) {
      await supabase.from('ingest_runs').update({
        status: 'failed', errors: [msg], finished_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return new Response(JSON.stringify({ status: 'failed', error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const allTerms = buildQueryTerms(lexicon as LexiconRow[])
  console.log(`[fr] query terms (${allTerms.length}): ${allTerms.join(', ')}`)

  // Compute lookback cutoff
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Fetch one call per term, merge by document_number
  const allDocs = new Map<string, FRDocument>()
  const errorLog: string[] = []

  for (const term of allTerms) {
    try {
      const docs = await fetchTermDocs(term, cutoffStr)
      for (const doc of docs) {
        if (!allDocs.has(doc.document_number)) {
          allDocs.set(doc.document_number, doc)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[fr] fetch error for "${term}": ${msg}`)
      await handleSourceError(supabase, term, msg)
      errorLog.push(`fetch "${term}": ${msg}`)
    }
    await sleep(500)
  }

  const rawCount = allDocs.size
  console.log(`[fr] ${rawCount} unique documents after merge`)

  // ── PART B: Relevance gate → write ────────────────────────────────────────

  let totalNew     = 0
  let totalSkipped = 0
  let passedGate   = 0

  for (const [, doc] of allDocs) {
    // A. Relevance gate
    if (!passesRelevanceGate(doc, allTerms)) {
      totalSkipped++
      console.log(`[fr] skip (no match): ${doc.document_number} — ${doc.title.slice(0, 60)}`)
      continue
    }

    passedGate++
    console.log(`[fr] match: ${doc.document_number} — ${doc.title.slice(0, 60)}`)

    // B. Parse event type
    const eventType = parseEventType(doc.title)

    // C. source_hash
    const sourceHash = await sha256(`${HASH_PREFIX}|${doc.document_number}`)

    // D. Write to regulatory_calendar
    const { count: rcCount } = await supabase
      .from('regulatory_calendar')
      .select('id', { count: 'exact', head: true })
      .eq('source_hash', sourceHash)

    if ((rcCount ?? 0) === 0) {
      const { error: rcErr } = await supabase.from('regulatory_calendar').insert({
        event_type:  eventType,
        title:       doc.title.slice(0, 500),
        start_date:  doc.publication_date,
        end_date:    doc.publication_date,
        source_url:  doc.html_url,
        agency:      'FDA',
        source_hash: sourceHash,
      })
      if (rcErr) {
        console.error(`[fr] regulatory_calendar error: ${rcErr.message}`)
        errorLog.push(`rc ${doc.document_number}: ${rcErr.message}`)
      }
    }

    // E. Write to company_signals (dedup check)
    const { count: csCount } = await supabase
      .from('company_signals')
      .select('id', { count: 'exact', head: true })
      .eq('source_hash', sourceHash)

    if ((csCount ?? 0) > 0) {
      totalSkipped++
      console.log(`[fr] skip (dup): ${doc.document_number}`)
      await sleep(150)
      continue
    }

    const headline    = `${eventType}: ${doc.title.slice(0, 100)}`
    const bodyExcerpt = (doc.abstract ?? doc.action ?? doc.title).slice(0, 400)

    const { error: csErr } = await supabase.from('company_signals').insert({
      competitor_id: null,
      signal_type:   'regulatory_catalyst',
      headline,
      body_excerpt:  bodyExcerpt,
      date:          doc.publication_date,
      source_url:    doc.html_url,
      source_hash:   sourceHash,
      data_source:   DATA_SOURCE,
    })

    if (csErr) {
      console.error(`[fr] company_signals error: ${csErr.message}`)
      errorLog.push(`cs ${doc.document_number}: ${csErr.message}`)
      totalSkipped++
    } else {
      totalNew++
      console.log(`[fr] + company_signals: ${headline.slice(0, 70)}`)
    }

    await sleep(150)
  }

  // F. Update ingest_runs
  const allFetchFailed = errorLog.filter(e => e.startsWith('fetch')).length === allTerms.length
  const status =
    allFetchFailed                ? 'failed'  :
    errorLog.length > 0           ? 'partial' :
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
      rawArticles: rawCount,
      passedGate,
      newSignals:  totalNew,
      skipped:     totalSkipped,
      errors:      errorLog,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
