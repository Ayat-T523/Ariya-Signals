/**
 * Deterministic threading — Part C (backend spec §4.4).
 *
 * The LOCKED rules, implemented literally:
 *
 *   - Two signals thread if and only if they resolve, via the lexicon, to the
 *     same non-null canonical asset_id.
 *   - A shared non-null accession_number threads two signals only when they
 *     share the same asset home, or both have none.
 *   - Asset resolution WINS over accession for placement, so a corporate signal
 *     is never pulled into an asset thread.
 *   - A thread needs two or more signals.
 *   - Order signals by arc position (trial, evidence, regulatory, commercial,
 *     ip, deal, personnel) then date.
 *   - Narrate only the link the data supports, and stay silent otherwise.
 *
 * Note this uses the §4.5 arc DISPLAY order (via compareByArcThenDate), which is
 * deliberately different from the §4.2 importance weighting. Sequencing a thread
 * and ranking a feed are two different jobs.
 *
 * Everything here is a pure function of the rows handed in. Nothing is inferred,
 * and an unresolvable signal is left out of threads rather than placed by guess.
 */

import { compareByArcThenDate, arcOf, themeOf, type Arc, type Theme } from './facets'

/** Minimum shape a signal needs to be threaded. */
export interface ThreadableSignal {
  id?: string
  asset_id?: string | null
  inn?: string | null
  accession_number?: string | null
  signal_type?: string | null
  date?: string | null
  competitor_id?: string | null
  headline?: string | null
}

export interface Thread<T extends ThreadableSignal = ThreadableSignal> {
  /** Canonical asset UUID this thread is keyed on. Never null. */
  assetId: string
  /** INN carried by the thread's signals, when they carry one. */
  inn: string | null
  /** Signals in §4.5 arc order, then date. */
  signals: T[]
  /** Distinct competitors whose feeds contributed. */
  competitorIds: string[]
  /** Arcs present, in display order. */
  arcs: Arc[]
  /** Themes present — the browse facet (§4.3). */
  themes: Theme[]
  /** Earliest and latest dated signal, or null when nothing is dated. */
  firstDate: string | null
  lastDate: string | null
}

/** A thread needs two or more signals (§4.4). */
export const MIN_THREAD_SIZE = 2

/**
 * Group signals into asset threads.
 *
 * Signals with no asset_id are never threaded: they belong at competitor level in
 * the Corporate bucket (§3.2 orphan rule). Assets with a single signal do not
 * form a thread.
 *
 * Threads are returned most-recently-active first, which is a presentation
 * convenience and carries no judgment.
 */
export function buildThreads<T extends ThreadableSignal>(signals: T[]): Thread<T>[] {
  const byAsset = new Map<string, T[]>()
  for (const s of signals) {
    // Asset resolution wins: no asset_id means no thread, whatever else the row
    // shares with another row.
    if (!s.asset_id) continue
    const bucket = byAsset.get(s.asset_id)
    if (bucket) bucket.push(s)
    else byAsset.set(s.asset_id, [s])
  }

  const threads: Thread<T>[] = []
  for (const [assetId, rows] of byAsset) {
    if (rows.length < MIN_THREAD_SIZE) continue
    const ordered = [...rows].sort(compareByArcThenDate)
    const dates = rows.map(r => r.date).filter((d): d is string => !!d).sort()
    const arcs: Arc[] = []
    for (const r of ordered) {
      const a = arcOf(r.signal_type)
      if (a && !arcs.includes(a)) arcs.push(a)
    }
    const themes: Theme[] = []
    for (const r of ordered) {
      const t = themeOf(r.signal_type)
      if (t && !themes.includes(t)) themes.push(t)
    }
    threads.push({
      assetId,
      inn: rows.find(r => r.inn)?.inn ?? null,
      signals: ordered,
      competitorIds: [...new Set(rows.map(r => r.competitor_id).filter((c): c is string => !!c))],
      arcs,
      themes,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
    })
  }

  return threads.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
}

/**
 * True when two signals belong in the same thread, per §4.4.
 *
 * Exported because the rule is easier to trust when it can be checked directly
 * on a pair. `buildThreads` groups by asset and is the normal entry point.
 */
export function signalsThread(a: ThreadableSignal, b: ThreadableSignal): boolean {
  // Same non-null asset: threads.
  if (a.asset_id && b.asset_id) return a.asset_id === b.asset_id
  // A shared accession threads only when both have no asset home. If exactly one
  // side has an asset, asset resolution wins and they do not thread — this is
  // what stops a corporate signal being pulled into an asset thread.
  if (!a.asset_id && !b.asset_id) {
    return !!a.accession_number && a.accession_number === b.accession_number
  }
  return false
}

/**
 * Structural description of a thread. Counts, span, and the arcs present —
 * all facts on the page already.
 *
 * Deliberately says nothing about what the sequence means: interpretation is the
 * paid tier's job (§1 boundary), and §4.4 allows narrating only the link the data
 * supports. Returns null when there is nothing factual to add.
 */
export function describeThread(thread: Thread): string | null {
  const n = thread.signals.length
  if (n < MIN_THREAD_SIZE) return null
  const subject = thread.inn ?? 'this asset'
  const span =
    thread.firstDate && thread.lastDate && thread.firstDate !== thread.lastDate
      ? `, ${thread.firstDate} to ${thread.lastDate}`
      : thread.lastDate
        ? `, ${thread.lastDate}`
        : ''
  const sources =
    thread.competitorIds.length > 1
      ? ` across ${thread.competitorIds.length} competitor feeds`
      : ''
  return `${n} signals on ${subject}${span}${sources}.`
}
