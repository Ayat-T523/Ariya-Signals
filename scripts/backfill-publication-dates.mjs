/**
 * backfill-publication-dates.mjs — recover year-only publication dates.
 *
 * 17 publications have date = NULL because PubMed reports their pubdate as a bare
 * year ("2026"), and parseSignalDate correctly refuses to invent a month and day.
 * The cost is that D11 reads recency off `date`, so a 2026 paper scores zero
 * recency and ranks as if it were ancient.
 *
 * This reads the year back from PubMed (the authoritative source, via the PMID in
 * source_url) and stores it as YYYY-01-01 with date_precision = 'year'. The
 * precision travels with the value, so nothing is fabricated: the UI renders
 * "2026" rather than "1 January 2026", and recency can use the year.
 *
 * SAFETY:
 *   - DRY-RUN by default; --apply writes.
 *   - Only date and date_precision are written, and only on rows where date IS NULL.
 *   - A row whose source reports a full date is stored with precision 'day'.
 *   - A row PubMed has no date for is left NULL. Nothing is guessed.
 *   - Requires the 20260727_company_signals_date_precision migration.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-publication-dates.mjs           # dry-run
 *   node --env-file=.env.local scripts/backfill-publication-dates.mjs --apply
 */

import { createSupabaseClient, parseSignalDate } from './lib/signal-gate.mjs'

const APPLY = process.argv.includes('--apply')
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'

const pmidOf = (url) => (url ?? '').match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)?.[1] ?? null

/**
 * Resolve a raw PubMed pubdate into a date plus how precisely it is known.
 * "2024 Mar 15" -> day, "2024 Mar" -> month, "2024" -> year.
 */
function resolveDate(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const full = parseSignalDate(s)
  if (full) {
    // parseSignalDate fills day 01 for a "YYYY Month" input, so distinguish the two.
    return /^\d{4}\s+[a-z]+\.?\s+\d{1,2}/i.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s)
      ? { date: full, precision: 'day' }
      : { date: full, precision: 'month' }
  }
  const year = s.match(/^(\d{4})$/)?.[1]
  return year ? { date: `${year}-01-01`, precision: 'year' } : null
}

async function main() {
  console.log(`\n── Backfill publication dates (${APPLY ? 'APPLY — WILL WRITE' : 'DRY-RUN — no writes'}) ──\n`)
  const supabase = createSupabaseClient()

  const { data: rows, error } = await supabase
    .from('company_signals')
    .select('id, headline, source_url, data_source')
    .is('date', null)
  if (error) { console.error(error.message); process.exit(1) }

  const withPmid = rows.map(r => ({ ...r, pmid: pmidOf(r.source_url) })).filter(r => r.pmid)
  console.log(`undated rows: ${rows.length} | with a resolvable PMID: ${withPmid.length}`)
  if (!withPmid.length) { console.log('\nNothing to recover.\n'); return }

  const url = `${EUTILS}?db=pubmed&id=${withPmid.map(r => r.pmid).join(',')}&retmode=json`
    + `&tool=ariya-signals&email=ayat.tayebulla@phamax.ch`
  const summary = (await fetch(url).then(r => r.json())).result ?? {}

  const proposals = []
  const unresolved = []
  for (const r of withPmid) {
    const raw = summary[r.pmid]?.pubdate ?? summary[r.pmid]?.epubdate ?? null
    const resolved = resolveDate(raw)
    if (resolved) proposals.push({ ...r, raw, ...resolved })
    else unresolved.push({ ...r, raw })
  }

  const byPrecision = {}
  for (const p of proposals) byPrecision[p.precision] = (byPrecision[p.precision] ?? 0) + 1
  console.log(`recoverable: ${proposals.length} | by precision: ${JSON.stringify(byPrecision)}`)
  console.log(`left NULL (no date at source): ${unresolved.length}`)

  console.log('\nproposed:')
  for (const p of proposals) {
    console.log(`  ${p.pmid}  "${p.raw}" -> ${p.date} (${p.precision})  ${String(p.headline).replace(/\s+/g, ' ').slice(0, 44)}`)
  }
  for (const u of unresolved) console.log(`  ${u.pmid}  "${u.raw}" -> left NULL`)

  if (!APPLY) { console.log('\n── DRY-RUN complete. No writes. Re-run with --apply. ──\n'); return }

  console.log('\n── Applying ──')
  // Group by (date, precision) so each distinct value is one update.
  const groups = new Map()
  for (const p of proposals) {
    const k = `${p.date}|${p.precision}`
    if (!groups.has(k)) groups.set(k, { date: p.date, precision: p.precision, ids: [] })
    groups.get(k).ids.push(p.id)
  }
  let updated = 0
  for (const g of groups.values()) {
    const { error: e } = await supabase
      .from('company_signals')
      .update({ date: g.date, date_precision: g.precision })
      .in('id', g.ids)
    if (e) console.error(`  ❌  ${g.date}: ${e.message}`)
    else { updated += g.ids.length; console.log(`  ✅  ${g.date} (${g.precision}): ${g.ids.length}`) }
  }
  console.log(`\n── Applied: ${updated} dates recovered. ${unresolved.length} left NULL. ──\n`)
}
main().catch(e => { console.error(e); process.exit(1) })
