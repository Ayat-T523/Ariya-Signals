// InForm component library — shared types.
// Kept intentionally close to what src/lib/signalMapping.ts / src/lib/db already
// produce, so a later phase can wire these to mapSignal() output without
// reshaping props here.

export type Severity = 'high' | 'medium' | 'low'

export interface Signal {
  id: string
  competitor: string
  competitorId?: string
  type: string
  severity: Severity
  headline: string
  source: string
  sourceUrl?: string | null
  time: string
  excerpt?: string
  why?: string
  unread?: boolean
}

export type DeltaTone = 'up' | 'down' | 'flat'

export interface KpiDatum {
  label: string
  value: string | number
  delta?: string
  deltaTone?: DeltaTone
  caption?: string
  breakdown?: { label: string; color: string }[]
  sparkline?: number[]
  link?: string
  linkTo?: string
  isEmpty?: boolean
  isError?: boolean
  errorNote?: string
}

export interface WeatherRow {
  competitor: string
  competitorId?: string
  count: number
  severity: Severity
  summary: string
}

export type WeatherState = 'clearing' | 'stable' | 'pressure' | 'storm'
