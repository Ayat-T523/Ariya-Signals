import type { DbTrial } from './db'

// ── Gantt helpers (extracted from useCompetitorSupabase.ts) ───────────────────

// Convert an ISO date string (YYYY-MM-DD or YYYY-MM) to { y, q }.
export function isoToYQ(iso: string | null | undefined): { y: number; q: number } | null {
  if (!iso) return null
  const normalized = iso.length === 7 ? iso + '-01' : iso
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return null
  return { y: d.getFullYear(), q: Math.ceil((d.getMonth() + 1) / 3) }
}

// Map a ClinicalTrials.gov phase string to a Gantt phase key.
// LOSSY: PHASE1_PHASE2 → 'phase2' (highest phase wins — shows competitive ceiling).
export function trialPhaseToKey(phase: string | null): 'phase1' | 'phase2' | 'phase3' {
  const p = (phase ?? '').replace(/\s/g, '').toUpperCase()
  if (p.includes('3') || p.includes('III')) return 'phase3'
  if (p.includes('2') || p.includes('II'))  return 'phase2'
  return 'phase1'
}

export const GANTT_SKIP_STATUSES = new Set([
  'WITHDRAWN', 'TERMINATED', 'UNKNOWN_STATUS', 'WITHHELD',
])

// ── Calendar cell builder ─────────────────────────────────────────────────────

export interface TrialCellEntry { lines: string[]; v: 'blue' }

function shortTrialLabel(title: string | null): string {
  if (!title) return 'Trial'
  return title.replace(/\bNCT\d+\b/gi, '').trim().split(/\s+/).slice(0, 3).join(' ')
}

function calPhaseLabel(phase: string | null): string {
  const p = (phase ?? '').toUpperCase()
  if (p.includes('3') || p.includes('III')) return 'Ph. III'
  if (p.includes('2') || p.includes('II'))  return 'Ph. II'
  if (p.includes('1') || p.includes('I'))   return 'Ph. I'
  return 'Trial'
}

const PHASE_RANK: Record<string, number> = { phase3: 3, phase2: 2, phase1: 1 }

/**
 * Build calendar cells from live trial data, indexed by [company_id][month (0–11)].
 * One cell per competitor per month; the highest-phase non-skipped trial with a
 * start_date in `year` wins when multiple trials share a month.
 */
export function trialsToCalendarCells(
  trials: DbTrial[],
  year: number,
): Record<string, Record<number, TrialCellEntry>> {
  const ranked: Record<string, Record<number, { cell: TrialCellEntry; rank: number }>> = {}

  for (const t of trials) {
    const id = t.company_id
    if (!id || !t.start_date) continue
    const status = (t.status ?? '').toUpperCase().replace(/\s+/g, '_')
    if (GANTT_SKIP_STATUSES.has(status)) continue
    if (!t.start_date.startsWith(String(year))) continue

    const month = new Date(t.start_date).getMonth()
    const phaseKey = trialPhaseToKey(t.phase)
    const rank = PHASE_RANK[phaseKey] ?? 1
    const existing = ranked[id]?.[month]

    if (!existing || rank > existing.rank) {
      if (!ranked[id]) ranked[id] = {}
      ranked[id][month] = {
        cell: { lines: [shortTrialLabel(t.title), calPhaseLabel(t.phase)], v: 'blue' },
        rank,
      }
    }
  }

  const result: Record<string, Record<number, TrialCellEntry>> = {}
  for (const [compId, months] of Object.entries(ranked)) {
    result[compId] = {}
    for (const [mi, { cell }] of Object.entries(months)) {
      result[compId][Number(mi)] = cell
    }
  }
  return result
}
