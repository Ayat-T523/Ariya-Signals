/**
 * ingest-messaging-firecrawl — Phase 5: competitor product page messaging drift.
 *
 * Scrapes a fixed, reviewed list of competitor product/pipeline URLs.
 * Uses a hybrid gate to detect real messaging shifts vs. rotating-banner noise:
 *   1. Normalize page markdown (strip nav/footer/cookie/rotating elements) → hash
 *   2. Hash unchanged → skip (no signal)
 *   3. Hash changed (candidate) → run Firecrawl structured extraction
 *   4. Compare extracted core_message + pillars to stored values
 *   5. Fields unchanged → banner noise (update hash, no signal)
 *   6. Fields changed + anti-hallucination guard passes → write messaging_shift signal
 *
 * Anti-hallucination: extracted coreMessage must appear verbatim (10-word prefix)
 * in the raw page markdown. Rejects LLM-invented text.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-messaging-firecrawl.mjs
 *   node --env-file=.env.local scripts/ingest-messaging-firecrawl.mjs --competitor takeda
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
 */

import { createSupabaseClient, sha256, writeIngestRun } from './lib/signal-gate.mjs'
import { fcScrape } from './lib/firecrawl.mjs'

// ── Competitor URL config (reviewed list — never scrape arbitrary domains) ────

const TARGETS = [
  { competitorId: 'takeda',    name: 'Takeda / Takhzyro',   url: 'https://www.takhzyro.com/' },
  { competitorId: 'biocryst',  name: 'BioCryst / Orladeyo', url: 'https://www.orladeyo.com/' },
  { competitorId: 'pharvaris', name: 'Pharvaris',            url: 'https://pharvaris.com/science/pipeline/' },
]

// ── CLI filter ────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2)
const filterIdx = args.indexOf('--competitor')
const filterId  = filterIdx !== -1 ? args[filterIdx + 1] : null
const targets   = filterId ? TARGETS.filter(t => t.competitorId === filterId) : TARGETS

if (filterId && targets.length === 0) {
  console.error(`Unknown competitor "${filterId}". Available: ${TARGETS.map(t => t.competitorId).join(', ')}`)
  process.exit(1)
}

// ── Normalization ─────────────────────────────────────────────────────────────
//
// Strips page noise before hashing so the hash reflects only the stable core
// content. Same core content with a different rotating banner → same hash.
//
// Strips:
//   1. Lines with ≥4 markdown links          — nav/footer link blocks
//   2. Cookie/consent/GDPR lines             — rotating banners
//   3. Lines < 4 words                       — button labels, isolated words
//   4. Social-proof counters (rotating)      — "X,000+ patients treated"
//   5. Collapses 3+ consecutive blank lines  — whitespace normalization

const LINK_PATTERN        = /\[([^\]]+)\]\([^)]+\)/g
const COOKIE_PATTERN      = /\b(cookie|accept all|privacy policy|gdpr|we use cookies|decline)\b/i
const SOCIAL_PROOF_PATTERN = /\d[\d,]*\+?\s+(patient|physician|countr|people|provider)/i

function normalizeMarkdown(md) {
  const lines = md.split('\n')

  const filtered = lines.filter(line => {
    if ((line.match(LINK_PATTERN) ?? []).length >= 4) return false
    if (COOKIE_PATTERN.test(line)) return false
    const wordCount = line.trim().split(/\s+/).filter(Boolean).length
    if (wordCount > 0 && wordCount < 4) return false
    if (SOCIAL_PROOF_PATTERN.test(line)) return false
    return true
  })

  // Collapse 3+ consecutive blank lines to 1
  const collapsed = []
  let blanks = 0
  for (const line of filtered) {
    if (line.trim() === '') {
      blanks++
      if (blanks <= 1) collapsed.push(line)
    } else {
      blanks = 0
      collapsed.push(line)
    }
  }

  return collapsed.join('\n').trim()
}

// ── Anti-hallucination guard ──────────────────────────────────────────────────
//
// Returns true only if the first 10 words of `text` appear literally
// (case-insensitive) in the raw page markdown. Rejects LLM-invented text
// that was never on the page — same pattern as ingest-csl-firecrawl.mjs.

function titleInMarkdown(text, markdown) {
  if (!markdown || !text) return false
  const words = text.trim().split(/\s+/).slice(0, 10).join(' ')
  return markdown.toLowerCase().includes(words.toLowerCase())
}

// ── Structured extraction schema ──────────────────────────────────────────────

const MESSAGING_SCHEMA = {
  type: 'object',
  properties: {
    coreMessage: {
      type: 'string',
      description: 'The primary brand or product message headline EXACTLY as it appears on the page — copy verbatim, do not paraphrase or summarize',
    },
    pillars: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key messaging themes or benefit claims stated on the page (3–6 items, use exact page wording)',
    },
  },
  required: ['coreMessage', 'pillars'],
}

const EXTRACT_PROMPT =
  'Extract the primary product or brand message and key benefit claims from this pharmaceutical product page. ' +
  'Copy the core message headline EXACTLY as it appears on the page — do not rewrite, translate, or summarize. ' +
  'List 3–6 key messaging pillars or benefit claims using the exact phrasing from the page.'

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Messaging drift ingest (Firecrawl) ─────────────────────')
  console.log(`   targets: ${targets.map(t => t.competitorId).join(', ')}\n`)

  const supabase = createSupabaseClient()
  const today    = new Date().toISOString().slice(0, 10)

  let seeded         = 0
  let noChange       = 0
  let bannerNoise    = 0
  let signalsWritten = 0
  const errors       = []

  for (const { competitorId, name, url } of targets) {
    console.log(`\n── ${name}`)
    console.log(`   url: ${url}`)

    // ── Step 1: Scrape markdown ────────────────────────────────────────────
    let markdown
    try {
      const result = await fcScrape(url)
      markdown = result.markdown ?? ''
      console.log(`   markdown: ${markdown.length} chars`)
    } catch (err) {
      console.error(`   ❌  scrape failed: ${err.message}`)
      errors.push(`${competitorId}: scrape failed — ${err.message}`)
      continue
    }

    if (!markdown) {
      console.log('   ⚠️  No markdown returned — skipping.')
      errors.push(`${competitorId}: empty markdown`)
      continue
    }

    // ── Step 2: Normalize + hash ───────────────────────────────────────────
    const normalized = normalizeMarkdown(markdown)
    const newHash    = sha256(normalized)
    console.log(`   normalized: ${normalized.length} chars | hash: ${newHash.slice(0, 12)}…`)

    // ── Step 3: Load existing snapshot ────────────────────────────────────
    const { data: snap, error: snapErr } = await supabase
      .from('messaging_snapshots')
      .select('content_hash, core_message, pillars')
      .eq('competitor_id', competitorId)
      .maybeSingle()

    if (snapErr) {
      console.error(`   ❌  snapshot load failed: ${snapErr.message}`)
      errors.push(`${competitorId}: snapshot load — ${snapErr.message}`)
      continue
    }

    // ── Step 4: First run — seed baseline, no signal ──────────────────────
    if (!snap) {
      const { error: seedErr } = await supabase
        .from('messaging_snapshots')
        .insert({
          competitor_id: competitorId,
          content_hash:  newHash,
          core_message:  '',
          pillars:       [],
          source_url:    url,
          scraped_at:    new Date().toISOString(),
        })
      if (seedErr) {
        console.error(`   ❌  seed failed: ${seedErr.message}`)
        errors.push(`${competitorId}: seed — ${seedErr.message}`)
      } else {
        seeded++
        console.log('   ✅  Baseline seeded (no signal).')
      }
      continue
    }

    // ── Step 5: Hash unchanged — no candidate ─────────────────────────────
    if (snap.content_hash === newHash) {
      noChange++
      console.log('   ✓  No change in normalized content.')
      continue
    }

    console.log('   ⚡  Candidate change — running structured extraction…')

    // ── Step 6: Structured extraction ─────────────────────────────────────
    let extracted
    try {
      const result = await fcScrape(url, { schema: MESSAGING_SCHEMA, prompt: EXTRACT_PROMPT })
      extracted = result.extract
    } catch (err) {
      console.error(`   ❌  extraction failed: ${err.message}`)
      errors.push(`${competitorId}: extraction — ${err.message}`)
      // Update hash so next run doesn't retry extraction on a broken page
      await supabase.from('messaging_snapshots')
        .update({ content_hash: newHash, scraped_at: new Date().toISOString() })
        .eq('competitor_id', competitorId)
      continue
    }

    if (!extracted?.coreMessage) {
      console.log('   ⚠️  Extraction returned no coreMessage — treating as noise.')
      bannerNoise++
      await supabase.from('messaging_snapshots')
        .update({ content_hash: newHash, scraped_at: new Date().toISOString() })
        .eq('competitor_id', competitorId)
      continue
    }

    // ── Step 7: Anti-hallucination guard ──────────────────────────────────
    if (!titleInMarkdown(extracted.coreMessage, markdown)) {
      console.log(`   🚫  coreMessage not found in raw markdown — rejected (hallucination).`)
      console.log(`       Rejected: "${extracted.coreMessage.slice(0, 80)}"`)
      bannerNoise++
      await supabase.from('messaging_snapshots')
        .update({ content_hash: newHash, scraped_at: new Date().toISOString() })
        .eq('competitor_id', competitorId)
      continue
    }

    // ── Step 8: Field comparison — real shift vs. banner noise ────────────
    const oldMessage  = (snap.core_message ?? '').trim()
    const newMessage  = extracted.coreMessage.trim()
    const oldPillars  = Array.isArray(snap.pillars) ? [...snap.pillars].sort().join('|') : ''
    const newPillars  = [...(extracted.pillars ?? [])].sort().join('|')

    const messageChanged = newMessage !== oldMessage
    const pillarsChanged = newPillars !== oldPillars

    if (!messageChanged && !pillarsChanged) {
      bannerNoise++
      console.log('   ✓  Extracted fields unchanged — rotating banner noise. Hash updated.')
      await supabase.from('messaging_snapshots')
        .update({ content_hash: newHash, scraped_at: new Date().toISOString() })
        .eq('competitor_id', competitorId)
      continue
    }

    // ── Step 9: Real shift confirmed — write company_signals row ──────────
    console.log(`   ⚡  Real messaging shift confirmed.`)
    console.log(`      Core message: "${newMessage.slice(0, 80)}"`)
    console.log(`      Pillars: ${(extracted.pillars ?? []).join(' · ').slice(0, 100)}`)

    const signalSourceHash = sha256(`${competitorId}|messaging_shift|${newHash}`)

    const { count } = await supabase
      .from('company_signals')
      .select('id', { count: 'exact', head: true })
      .eq('source_hash', signalSourceHash)

    if ((count ?? 0) === 0) {
      const pillarList = (extracted.pillars ?? []).join(', ')
      const { error: insertErr } = await supabase.from('company_signals').insert({
        competitor_id:    competitorId,
        signal_type:      'messaging_shift',
        date:             today,
        headline:         `${name} — messaging updated on product page`,
        body_excerpt:     `Core message: "${newMessage.slice(0, 200)}". Pillars: ${pillarList.slice(0, 200)}.`,
        why_it_matters:   `${name}'s product messaging has changed. Review updated pillars for positioning implications.`,
        source_url:       url,
        source_hash:      signalSourceHash,
        data_source:      'firecrawl_messaging',
        accession_number: `${competitorId}:messaging`,
      })

      if (insertErr) {
        console.error(`   ❌  signal insert failed: ${insertErr.message}`)
        errors.push(`${competitorId}: signal insert — ${insertErr.message}`)
      } else {
        signalsWritten++
        console.log('   ✅  Signal written to company_signals.')
      }
    } else {
      console.log('   ⧖  Signal already exists (deduplicated by source_hash).')
    }

    // ── Step 10: Update snapshot with new fields ───────────────────────────
    const { error: updateErr } = await supabase
      .from('messaging_snapshots')
      .update({
        content_hash: newHash,
        core_message: newMessage,
        pillars:      extracted.pillars ?? [],
        source_url:   url,
        scraped_at:   new Date().toISOString(),
      })
      .eq('competitor_id', competitorId)

    if (updateErr) {
      console.error(`   ❌  snapshot update failed: ${updateErr.message}`)
      errors.push(`${competitorId}: snapshot update — ${updateErr.message}`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n── Summary ─────────────────────────────────────────────────')
  console.log(`Targets processed:     ${targets.length}`)
  console.log(`Seeded (first run):    ${seeded}`)
  console.log(`No change:             ${noChange}`)
  console.log(`Banner noise filtered: ${bannerNoise}`)
  console.log(`Signals written:       ${signalsWritten}`)
  if (errors.length) {
    console.log(`Errors (${errors.length}):`)
    errors.forEach(e => console.log(`  • ${e}`))
  }
  console.log('────────────────────────────────────────────────────────────\n')

  await writeIngestRun(supabase, {
    source:     'firecrawl_messaging',
    newSignals: signalsWritten,
    skipped:    noChange + bannerNoise,
    errors:     errors.length,
    notes:      `targets: ${targets.map(t => t.competitorId).join(', ')}`,
  })
  console.log('ingest_runs row written.\n')
}

main().catch(err => {
  console.error(`\n❌  ${err.message}\n`)
  process.exit(1)
})
