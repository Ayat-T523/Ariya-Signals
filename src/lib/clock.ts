/**
 * clock.ts — the shared "now" for any window/quarter boundary computed
 * client-side (e.g. "this quarter" activity). Import this instead of calling
 * `new Date()` directly for a window cutoff, so there's one place to swap in
 * a fixed clock later (demos, testing) per docs/hygiene-check.md §5.
 */
export function now(): Date {
  return new Date()
}

/** Start of the calendar quarter containing `d` (defaults to now()). */
export function currentQuarterStart(d: Date = now()): Date {
  const quarter = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), quarter * 3, 1)
}

/** Whole days between `d` and now() -- for passing to day-windowed queries like getRecentSignals. */
export function daysSince(d: Date): number {
  return Math.max(1, Math.ceil((now().getTime() - d.getTime()) / 86_400_000))
}
