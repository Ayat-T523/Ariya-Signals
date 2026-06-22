import { useEffect, useState } from 'react'
import { getAllAssets, getTrialsByAssetIds, findAssetByCode } from '../lib/db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GanttBar {
  startOffset: number
  widthPct:    number
  phase:       'phase1' | 'phase2' | 'phase3'
  label:       string
  isLive:      boolean
}

export interface GanttMilestone {
  type:   string
  label:  string
  offset: number
}

export interface GanttTask {
  TaskID:         number
  TaskName:       string
  CompetitorId:   string
  CompetitorName: string
  StartDate:      Date
  EndDate:        Date
  Bars:           GanttBar[]
  Milestones:     GanttMilestone[]
  HasLiveData:    boolean
}

// ── Internal input shapes ─────────────────────────────────────────────────────

interface BarInput {
  sy: number; sq: number; ey: number; eq: number
  label: string; phase: string
}

interface MilestoneInput {
  y: number; q: number; type: string; label: string
}

interface RowInput {
  competitorId: string
  drugLabel:    string
  bars:         BarInput[]
  milestones:   MilestoneInput[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function quarterToDate(year: number, q: number): Date {
  return new Date(year, (q - 1) * 3, 1)
}

function cleanDrugCode(label: string): string {
  return label.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase()
}

// Brand names that don't match INNs directly in the assets table
const BRAND_TO_INN: Record<string, string> = {
  orladeyo: 'berotralstat',
  andembry: 'garadacimab',
}

function buildTask(
  row:            RowInput,
  id:             number,
  competitorName: string,
  liveOverrides?: Map<string, { startDate: Date; endDate: Date }>,
): GanttTask {
  const enrichedBars = row.bars.map(bar => {
    const phaseKey = bar.phase.toUpperCase()
    const live     = liveOverrides?.get(phaseKey)
    return {
      phase:  bar.phase as GanttBar['phase'],
      label:  bar.label,
      _start: live ? live.startDate : quarterToDate(bar.sy, bar.sq),
      _end:   live ? live.endDate   : quarterToDate(bar.ey, bar.eq),
      isLive: !!live,
    }
  })

  const allDates = [
    ...enrichedBars.flatMap(b => [b._start, b._end]),
    ...row.milestones.map(m => quarterToDate(m.y, m.q)),
  ]
  const startMs = Math.min(...allDates.map(d => d.getTime()))
  const endMs   = Math.max(...allDates.map(d => d.getTime()))
  const totalMs = Math.max(endMs - startMs, 1)

  return {
    TaskID:         id,
    TaskName:       row.drugLabel,
    CompetitorId:   row.competitorId,
    CompetitorName: competitorName,
    StartDate:      new Date(startMs),
    EndDate:        new Date(endMs),
    Bars: enrichedBars.map(b => ({
      phase:       b.phase,
      label:       b.label,
      isLive:      b.isLive,
      startOffset: ((b._start.getTime() - startMs) / totalMs) * 100,
      widthPct:    Math.max(1, ((b._end.getTime() - b._start.getTime()) / totalMs) * 100),
    })),
    Milestones: row.milestones.map(m => ({
      type:   m.type,
      label:  m.label,
      offset: ((quarterToDate(m.y, m.q).getTime() - startMs) / totalMs) * 100,
    })),
    HasLiveData: enrichedBars.some(b => b.isLive),
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTimelineData(
  baseRows:        RowInput[],
  competitorNames: Map<string, string>,
): GanttTask[] {
  const [tasks, setTasks] = useState<GanttTask[]>(() =>
    baseRows.map((row, i) =>
      buildTask(row, i + 1, competitorNames.get(row.competitorId) ?? row.competitorId)
    )
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      const allAssets = await getAllAssets()
      if (cancelled || !allAssets.length) return

      // Match drug labels to Supabase assets
      const drugCodes = [...new Set(baseRows.map(r => cleanDrugCode(r.drugLabel)))]
      const assetMap  = new Map<string, typeof allAssets[0]>()
      for (const code of drugCodes) {
        const resolved = BRAND_TO_INN[code] ?? code
        const asset    = findAssetByCode(resolved, allAssets)
        if (asset) assetMap.set(code, asset)
      }

      const assetIds = [...new Set([...assetMap.values()].map(a => a.id))]
      if (!assetIds.length) return

      const trials = await getTrialsByAssetIds(assetIds)
      if (cancelled) return

      // Group trials: asset_id → phase → best trial (prefer RECRUITING)
      const trialsByAssetPhase = new Map<string, Map<string, typeof trials[0]>>()
      for (const t of trials) {
        if (!trialsByAssetPhase.has(t.asset_id))
          trialsByAssetPhase.set(t.asset_id, new Map())
        const phaseMap = trialsByAssetPhase.get(t.asset_id)!
        const phase    = t.phase ?? 'UNKNOWN'
        const existing = phaseMap.get(phase)
        if (!existing || (t.status === 'RECRUITING' && existing.status !== 'RECRUITING')) {
          phaseMap.set(phase, t)
        }
      }

      const enriched = baseRows.map((row, i) => {
        const code  = cleanDrugCode(row.drugLabel)
        const asset = assetMap.get(code)
        const name  = competitorNames.get(row.competitorId) ?? row.competitorId
        if (!asset) return buildTask(row, i + 1, name)

        const phaseMap = trialsByAssetPhase.get(asset.id)
        if (!phaseMap) return buildTask(row, i + 1, name)

        const liveOverrides = new Map<string, { startDate: Date; endDate: Date }>()
        for (const bar of row.bars) {
          const phaseKey = bar.phase.toUpperCase()
          const trial    = phaseMap.get(phaseKey)
          if (trial?.start_date) {
            liveOverrides.set(phaseKey, {
              startDate: new Date(trial.start_date),
              endDate:   trial.completion_date
                ? new Date(trial.completion_date)
                : quarterToDate(bar.ey, bar.eq),
            })
          }
        }

        return buildTask(row, i + 1, name, liveOverrides.size ? liveOverrides : undefined)
      })

      setTasks(enriched)
    }

    load()
    return () => { cancelled = true }
  }, [])

  return tasks
}

// ── Public types for the custom pixel-based Gantt ─────────────────────────────

export interface TimelineBarDef {
  sy: number; sq: number; ey: number; eq: number
  label: string; phase: string; _live?: boolean
}

export interface TimelineMilestoneDef {
  y: number; q: number; type: string; label: string
}

export interface TimelineRowDef {
  competitorId: string
  drugLabel:    string
  bars:         TimelineBarDef[]
  milestones:   TimelineMilestoneDef[]
}

// ── useEnrichedTimelineRows ───────────────────────────────────────────────────
// Enriches TIMELINE_ROWS bar dates with live ClinicalTrials.gov data where
// available, keeping the same row/bar structure used by the custom Gantt.

export function useEnrichedTimelineRows(
  baseRows: TimelineRowDef[],
): { rows: TimelineRowDef[]; hasAnyLive: boolean } {
  const [state, setState] = useState<{ rows: TimelineRowDef[]; hasAnyLive: boolean }>({
    rows: baseRows, hasAnyLive: false,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const allAssets = await getAllAssets()
      if (cancelled || !allAssets.length) return

      const drugCodes = [...new Set(baseRows.map(r => cleanDrugCode(r.drugLabel)))]
      const assetMap  = new Map<string, typeof allAssets[0]>()
      for (const code of drugCodes) {
        const resolved = BRAND_TO_INN[code] ?? code
        const asset    = findAssetByCode(resolved, allAssets)
        if (asset) assetMap.set(code, asset)
      }

      const assetIds = [...new Set([...assetMap.values()].map(a => a.id))]
      if (!assetIds.length) return

      const trials = await getTrialsByAssetIds(assetIds)
      if (cancelled) return

      const trialsByAssetPhase = new Map<string, Map<string, typeof trials[0]>>()
      for (const t of trials) {
        if (!trialsByAssetPhase.has(t.asset_id))
          trialsByAssetPhase.set(t.asset_id, new Map())
        const phaseMap = trialsByAssetPhase.get(t.asset_id)!
        const phase    = t.phase ?? 'UNKNOWN'
        const existing = phaseMap.get(phase)
        if (!existing || (t.status === 'RECRUITING' && existing.status !== 'RECRUITING'))
          phaseMap.set(phase, t)
      }

      let hasAnyLive = false
      const enriched: TimelineRowDef[] = baseRows.map(row => {
        const code  = cleanDrugCode(row.drugLabel)
        const asset = assetMap.get(code)
        if (!asset) return row

        const phaseMap = trialsByAssetPhase.get(asset.id)
        if (!phaseMap) return row

        const enrichedBars: TimelineBarDef[] = row.bars.map(bar => {
          const trial = phaseMap.get(bar.phase.toUpperCase())
          if (!trial?.start_date) return bar

          const start = new Date(trial.start_date)
          const end   = trial.completion_date ? new Date(trial.completion_date) : null
          hasAnyLive  = true
          return {
            ...bar,
            sy: start.getFullYear(),
            sq: Math.ceil((start.getMonth() + 1) / 3),
            ey: end ? end.getFullYear()                    : bar.ey,
            eq: end ? Math.ceil((end.getMonth() + 1) / 3) : bar.eq,
            _live: true,
          }
        })

        return { ...row, bars: enrichedBars }
      })

      setState({ rows: enriched, hasAnyLive })
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}
