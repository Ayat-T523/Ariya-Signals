/**
 * scripts/decode-signal-entities.mjs
 *
 * NAME
 *   Decode HTML entities in stored company_signals text.
 *
 * DESCRIPTION
 *   A one-time cleanup for rows written before the ingest paths decoded HTML
 *   entities. Those rows carry literal entity text that users read on screen:
 *
 *     "the FDA has approved DAWNZERA&#8482; (donidalorsen)"
 *     "Food and Drug Administration (&#8220;FDA&#8221;) notified BioCryst"
 *
 *   It rewrites only `headline` and `body_excerpt`, and only where decoding
 *   actually changes the text. It uses the same decoder the ingest paths now use
 *   (scripts/lib/html-entities.mjs), so this cleanup and future ingests cannot
 *   disagree.
 *
 *   Never touches ai_* columns, dates, ids, source_hash, or any other field.
 *
 * WHAT TO EXPECT
 *   Dry run (default): prints every proposed change as before/after, plus totals.
 *   Nothing is written. Read the sample before applying.
 *
 *   With --apply: writes the changes and saves a snapshot of the original values
 *   to scripts/snapshots/ first, so the edit is reversible.
 *
 * USAGE
 *   node --env-file=.env.local scripts/decode-signal-entities.mjs           # dry run
 *   node --env-file=.env.local scripts/decode-signal-entities.mjs --apply   # write
 *   node --env-file=.env.local scripts/decode-signal-entities.mjs --limit=5  # sample
 */

import { writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createSupabaseClient } from './lib/signal-gate.mjs'
import {
  decodeHtmlEntities,
  hasHtmlEntities,
  stripKnownHtmlTags,
  hasKnownHtmlTags,
} from './lib/html-entities.mjs'

/**
 * Decode, then remove the formatting tags decoding reveals.
 *
 * Same two steps, in the same order, as the ingest paths now use, so a row
 * cleaned here is byte-identical to the same row re-ingested from source.
 */
function clean(text) {
  if (text == null) return null
  return stripKnownHtmlTags(decodeHtmlEntities(text))
}

const APPLY = process.argv.includes('--apply')
/** Override the one-shot guard below. Only for a deliberate, reviewed re-run. */
const FORCE = process.argv.includes('--force')
const LIMIT = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? 0)
const SNAPSHOT_DIR = 'scripts/snapshots'

/**
 * A window around the FIRST difference between two strings.
 *
 * Truncating from the start hides changes that occur later in a long SEC body,
 * which would print an identical-looking before/after pair and make the dry run
 * impossible to review honestly. This centres the excerpt on the change instead.
 */
function diffWindow(before, after, width = 110) {
  const a = before ?? ''
  const b = after ?? ''
  let i = 0
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++
  const start = Math.max(0, i - Math.floor(width / 3))
  const clip = (s) =>
    (start > 0 ? '…' : '') +
    s.slice(start, start + width) +
    (start + width < s.length ? '…' : '')
  return { before: JSON.stringify(clip(a)), after: JSON.stringify(clip(b)), at: i }
}

async function main() {
  const supabase = createSupabaseClient()

  const { data: rows, error } = await supabase
    .from('company_signals')
    .select('id, headline, body_excerpt, data_source')
    .order('id')
  if (error) throw new Error(`fetch failed: ${error.message}`)

  // Select only rows with a real defect: an entity that decodes, or a formatting
  // tag that decoding reveals.
  //
  // Deliberately NOT "any row where clean() differs". stripKnownHtmlTags also
  // collapses whitespace, so that looser test pulled in every row carrying a
  // stray double space and grew the write from 72 rows to 96 without repairing
  // anything. A targeted fix should not quietly become a reformatting pass.
  const needsRepair = (original) => {
    if (original == null) return false
    const decoded = decodeHtmlEntities(original)
    return decoded !== original || hasKnownHtmlTags(decoded)
  }

  const changes = []
  for (const row of rows) {
    const headlineChanged = needsRepair(row.headline)
    const bodyChanged     = needsRepair(row.body_excerpt)
    if (!headlineChanged && !bodyChanged) continue
    changes.push({
      row,
      nextHeadline: headlineChanged ? clean(row.headline) : row.headline,
      nextBody:     bodyChanged     ? clean(row.body_excerpt) : row.body_excerpt,
      headlineChanged,
      bodyChanged,
    })
  }

  const scoped = LIMIT > 0 ? changes.slice(0, LIMIT) : changes

  console.log(`scanned ${rows.length} rows`)
  console.log(`rows needing a decode: ${changes.length}`)
  if (LIMIT > 0) console.log(`scoped to the first ${scoped.length} (--limit=${LIMIT})`)
  const bySource = {}
  for (const c of changes) {
    const k = c.row.data_source ?? '(null)'
    bySource[k] = (bySource[k] ?? 0) + 1
  }
  console.log('by data_source:')
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(24)}${v}`)
  }
  console.log(`\nmode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no writes)'}\n`)

  for (const c of scoped) {
    console.log(`── ${c.row.id}  [${c.row.data_source ?? 'null'}]`)
    if (c.headlineChanged) {
      const d = diffWindow(c.row.headline, c.nextHeadline)
      console.log(`   headline @${d.at} before: ${d.before}`)
      console.log(`   headline @${d.at} after : ${d.after}`)
    }
    if (c.bodyChanged) {
      const d = diffWindow(c.row.body_excerpt, c.nextBody)
      console.log(`   body @${d.at} before: ${d.before}`)
      console.log(`   body @${d.at} after : ${d.after}`)
    }
  }

  // Residual check. Entity-shaped text remaining after one decode pass is the
  // CORRECT result when the source double-escaped it: a publisher writing
  // "Nasdaq:&amp;nbsp;BCRX" is escaping the entity, and their own page shows the
  // literal "&nbsp;" too. Decoding twice would be guessing at intent and could
  // corrupt text that is legitimately escaped, so it stays at one pass.
  // Reported rather than hidden, so the decision is visible at review time.
  const residual = scoped.filter(c =>
    hasHtmlEntities(c.nextHeadline) || hasHtmlEntities(c.nextBody))
  if (residual.length > 0) {
    console.log(`\nNOTE: ${residual.length} row(s) still contain entity-shaped text after decoding.`)
    console.log('Expected: the source double-escaped these, so the literal text is faithful.')
    for (const c of residual.slice(0, 5)) {
      const found = `${c.nextHeadline ?? ''} ${c.nextBody ?? ''}`
        .match(/&[a-zA-Z#][a-zA-Z0-9#xX]*;/g) ?? []
      console.log(`  ${c.row.id}: ${[...new Set(found)].join(' ')}`)
    }
  }

  if (!APPLY) {
    console.log(`\nDry run complete. Nothing written. Re-run with --apply to write ${scoped.length} row(s).`)
    return
  }

  if (scoped.length === 0) {
    console.log('Nothing to write.')
    return
  }

  // ONE-SHOT GUARD.
  //
  // Decoding is not idempotent for text the source double-escaped. A publisher
  // writing "Nasdaq:&amp;nbsp;BCRX" correctly becomes "Nasdaq:&nbsp;BCRX" after
  // one pass, which is what their own page displays. Run again and that literal
  // "&nbsp;" decodes to a space, drifting one step further from the source on
  // every run. The script cannot tell an already-repaired row from a fresh one,
  // so it refuses to apply twice rather than quietly eroding the text.
  const priorSnapshots = (() => {
    try {
      return readdirSync(SNAPSHOT_DIR).filter(f => f.startsWith('entities-before-'))
    } catch { return [] }
  })()
  if (priorSnapshots.length > 0 && !FORCE) {
    console.error(`\nRefusing to apply: this cleanup has already run.`)
    console.error(`Found ${priorSnapshots.length} prior snapshot(s) in ${SNAPSHOT_DIR}:`)
    for (const f of priorSnapshots) console.error(`  ${f}`)
    console.error(`\nThe ${scoped.length} row(s) listed above are rows whose source double-escaped an`)
    console.error(`entity. They are already correct; decoding them again would replace the literal`)
    console.error(`entity text with whitespace and diverge from what the source published.`)
    console.error(`\nPass --force only if you have confirmed these rows genuinely still need repair.`)
    process.exitCode = 1
    return
  }

  // Snapshot the originals before writing, so this is reversible.
  mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const snapshotPath = `${SNAPSHOT_DIR}/entities-before-${stamp}.json`
  writeFileSync(snapshotPath, JSON.stringify(
    scoped.map(c => ({
      id: c.row.id,
      headline: c.row.headline,
      body_excerpt: c.row.body_excerpt,
    })), null, 2))
  console.log(`snapshot written: ${snapshotPath}`)

  let updated = 0
  let failed = 0
  for (const c of scoped) {
    const patch = {}
    if (c.headlineChanged) patch.headline = c.nextHeadline
    if (c.bodyChanged) patch.body_excerpt = c.nextBody
    const { error: upErr } = await supabase
      .from('company_signals')
      .update(patch)
      .eq('id', c.row.id)
    if (upErr) {
      failed++
      console.error(`  FAILED ${c.row.id}: ${upErr.message}`)
    } else {
      updated++
    }
  }
  console.log(`\nupdated ${updated} row(s), ${failed} failure(s)`)
  if (failed > 0) process.exitCode = 1
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
