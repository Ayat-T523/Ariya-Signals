/**
 * Lexicon expansion — joining the config landscape to live asset_lexicon synonyms.
 *
 * TWO DIFFERENT KINDS OF LIST, AND WHY THEY MUST NOT BE SWAPPED
 *
 * `ASSETS_CONFIG[].lexiconInns` is a *landscape* list: every drug the user wants
 * signals about (their own asset plus its competitors, INNs and brand names
 * mixed). For the HAE landscape that is 17 terms.
 *
 * `asset_lexicon.synonyms` is a *per-drug* list: the alternate names of one
 * single drug. For berotralstat that is 3 terms (BEROTRALSTAT, BCX-7353,
 * Bcx7353).
 *
 * These are not interchangeable. Substituting the per-drug list for the
 * landscape list narrowed relevance matching from 153 of 287 live signals to 40,
 * silently dropping EMA authorisations for competitor drugs and every
 * competitor press release. The DB list is not a better version of the config
 * list; it answers a different question.
 *
 * So the live data *expands* the landscape rather than replacing it: keep every
 * config term, and add the synonyms of the landscape drugs the lexicon knows
 * about. The result is a strict superset of the config list, which is what makes
 * this safe — turning the live lexicon on can only ever add matches, never
 * remove one.
 *
 * Deterministic throughout: set union over exact, case-normalised terms. No
 * inference, no scoring, no guessing at names the sources did not supply.
 *
 * Ported from origin/claude/ariya-lightci-two-step-eckocz's
 * src/lib/deterministic/lexicon.ts during the identity/persistence foundation
 * reconciliation. Placed outside lib/deterministic/ on purpose: this module is
 * self-contained (no dependency on the importance/provenance/threading engine),
 * and that whole engine is explicitly deferred to the later WarRoom/Portal
 * reconciliation phase — this file's inclusion should not be read as adopting it.
 */

/**
 * One asset_lexicon row.
 *
 * The three matchable fields are inn, brand_name and synonyms, which is exactly
 * what the ingest resolver matches on. Frontend relevance matching and ingest
 * attribution must draw on the same terms, or a signal can be attributed to an
 * asset at ingest and then judged irrelevant to that same asset in the UI.
 */
export interface LexiconRow {
  inn: string
  brand_name?: string | null
  synonyms: string[] | null
  /** Owning company slug, matching competitors.json ids. Null for an own asset. */
  competitor_id?: string | null
}

/**
 * Whether a lexicon row belongs to the given landscape.
 *
 * A row is in scope when its INN or any of its synonyms matches a landscape
 * term. Matching is case-insensitive and allows a landscape term to match one
 * word of a multi-word INN, because config lists two-word INNs as separate
 * terms: the landscape carries 'lonvoguran' and 'ziclumeran' while the lexicon
 * row is 'lonvoguran ziclumeran'. Without that, Intellia's asset would be out
 * of scope and its NTLA-2002 publications unreachable.
 *
 * Scoping matters because the lexicon is shared reference data. Today every row
 * is an HAE drug, so unioning the whole table would look identical; the moment a
 * second therapeutic area is seeded, unscoped expansion would pull unrelated
 * drugs into a user's feed.
 */
function rowInLandscape(row: LexiconRow, landscapeTerms: Set<string>): boolean {
  const candidates = [row.inn, row.brand_name, ...(row.synonyms ?? [])].filter(Boolean) as string[]
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase()
    if (landscapeTerms.has(lower)) return true
    // Multi-word INN: in scope if any single word is a landscape term.
    if (lower.includes(' ') && lower.split(/\s+/).some(word => landscapeTerms.has(word))) {
      return true
    }
  }
  return false
}

/**
 * The config landscape expanded with live synonyms for the drugs in it.
 *
 * Returns a de-duplicated, lower-cased list. Always a superset of
 * `configInns` — including when `rows` is empty or null, which is what lets the
 * caller use this unconditionally instead of branching on whether the fetch
 * succeeded.
 */
export function expandLexiconInns(
  configInns: readonly string[],
  rows: readonly LexiconRow[] | null | undefined,
): string[] {
  const landscape = new Set(configInns.map(term => term.toLowerCase()))
  if (!rows || rows.length === 0) return [...landscape]

  const expanded = new Set(landscape)
  for (const row of rows) {
    if (!rowInLandscape(row, landscape)) continue
    // inn + brand_name + synonyms, matching the ingest resolver exactly. Omitting
    // brand_name here left 'Ekterly' (sebetralstat) unreachable even though
    // ingest attributes on it.
    expanded.add(row.inn.toLowerCase())
    if (row.brand_name) expanded.add(row.brand_name.toLowerCase())
    for (const synonym of row.synonyms ?? []) expanded.add(synonym.toLowerCase())
  }
  return [...expanded]
}

/**
 * True when `expanded` still contains every term in `configInns`.
 *
 * Exported so the superset guarantee is checkable rather than asserted in a
 * comment: a future change to expansion that starts dropping config terms is a
 * silent narrowing of the feed, which is exactly the defect this module exists
 * to prevent.
 */
export function isSupersetOfConfig(
  configInns: readonly string[],
  expanded: readonly string[],
): boolean {
  const have = new Set(expanded.map(term => term.toLowerCase()))
  return configInns.every(term => have.has(term.toLowerCase()))
}
