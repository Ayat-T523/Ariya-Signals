/**
 * Month × competitor catalyst heatmap. Landscape-scoped by construction (one
 * row per watched competitor, CAL_COMPS), so per the IA reference doc this
 * belongs under War Room's "what is coming" zone, not Entity view (which is
 * scoped to one competitor) or Intelligence Feed (which the IA doc never
 * names for catalysts).
 *
 * Extracted from Portal.tsx, where it was built and then left unused while
 * its placement was an open question. All data below is derived from the
 * static events.json / competitors.json catalogue, no hardcoded dates.
 */
import { eventsData, competitorsData } from '../../data/kalvista'

// ─── Key Catalysts Calendar — data ───────────────────────────────────────────

export const MONTHS_LABELS = [
  'Jan 26','Feb 26','Mar 26','Apr 26','May 26','Jun 26',
  'Jul 26','Aug 26','Sep 26','Oct 26','Nov 26','Dec 26',
]

// ── Calendar helpers — derived from events.json; no hardcoded dates ──────────

const _MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const _mi = (iso: string) => new Date(iso).getMonth()

function _dateRange(s: string, e?: string | null): string {
  const d = new Date(s); const mo = d.getMonth(); const sd = d.getDate()
  return e ? `${_MO[mo]} ${sd}–${new Date(e).getDate()}` : `${_MO[mo]} ${sd}`
}

function _confShortName(title: string): string {
  const parts = title.split(' ')
  return (parts[1] === 'Global' || parts[1] === 'Americas') ? `${parts[0]} ${parts[1]}` : parts[0]
}

function _earningsLabels(title: string): string[] {
  if (/all three/i.test(title)) return ['Q3 Earnings', '(All 3 cos.)']
  const m = title.match(/^(\w+)\s+(Q\d)\s+(FY)?(\d{4})?/)
  if (!m) return [title.split(' ').slice(0, 2).join(' ')]
  const fy = (m[3] && m[4]) ? ` FY${String(m[4]).slice(2)}` : ''
  return [`${m[1]} ${m[2]}${fy}`]
}

const CONF_DATA: Record<number, string[]> = {}
;(eventsData as any[])
  .filter(e => e.type === 'conference' && String(e.date).startsWith('2026') && e.sourceType !== 'illustrative')
  .forEach(e => {
    const mi = _mi(e.date)
    CONF_DATA[mi] = [_confShortName(e.title), _dateRange(e.date, e.endDate), (e.location as string)?.split(',')[0] ?? '']
  })

const IR_DATA: Record<number, string[]> = {}
;(eventsData as any[])
  .filter(e => (e.type === 'earnings' || e.type === 'investor') && String(e.date).startsWith('2026') && e.sourceType !== 'illustrative')
  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
  .forEach(e => {
    const mi = _mi(e.date)
    const labels = e.type === 'investor' ? ['Pharvaris', 'Inv. R&D Day'] : _earningsLabels(e.title)
    IR_DATA[mi] = [...(IR_DATA[mi] ?? []), ...labels]
  })

export type CalCellVariant = 'default' | 'yellow' | 'blue' | 'purple'
export interface CalCell { lines: string[]; v: CalCellVariant }

const _CELL_PRI: Record<CalCellVariant, number> = { purple: 4, blue: 3, yellow: 2, default: 1 }

function _calCell(e: any): CalCell | null {
  if (e.type === 'conference')
    return { lines: [_confShortName(e.title), _dateRange(e.date, e.endDate)], v: 'default' }
  if (e.type === 'earnings')
    return { lines: _earningsLabels(e.title), v: 'default' }
  if (e.type === 'investor')
    return { lines: ['Investor', 'R&D Day'], v: 'default' }
  return null
}

const CAL_CELLS: Record<string, Record<number, CalCell>> = {}
;(eventsData as any[])
  .filter(e => String(e.date).startsWith('2026') && e.sourceType !== 'illustrative')
  .forEach(e => {
    const mi = _mi(e.date)
    const cell = _calCell(e)
    if (!cell) return
    for (const id of (e.attendingCompetitors as string[]) ?? []) {
      if (!CAL_CELLS[id]) CAL_CELLS[id] = {}
      const cur = CAL_CELLS[id][mi]
      if (!cur || _CELL_PRI[cell.v] > _CELL_PRI[cur.v]) CAL_CELLS[id][mi] = cell
    }
  })

const CAL_ASSET: Record<string, string> = Object.fromEntries(
  (competitorsData as any[]).map(c => [
    c.id,
    (c.marketedProducts?.[0]?.name ?? c.pipeline?.[0]?.name ?? '').split(' (')[0],
  ])
)

const CELL_STYLE: Record<CalCellVariant, { bg: string; color: string }> = {
  default: { bg: 'rgba(16,34,74,0.07)',  color: 'rgba(16,34,74,0.78)' },
  yellow:  { bg: 'rgba(250,174,54,0.22)', color: '#8C5500'           },
  blue:    { bg: 'rgba(42,118,244,0.14)', color: '#2A76F4'           },
  purple:  { bg: 'rgba(139,92,246,0.14)', color: '#5B21B6'           },
}

export const CAL_COMPS = ['takeda','biocryst','pharvaris','csl-behring','ionis']

const COL_W   = 86
const FIRST_W = 92
const MO_H    = 32
const CONF_H  = 66
const IR_H    = 66

function CCell({ cell }: { cell: CalCell | undefined }) {
  if (!cell) return null
  const s = CELL_STYLE[cell.v]
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', gap: '2px',
      padding: '5px 7px', borderRadius: '6px',
      background: s.bg, maxWidth: `${COL_W - 8}px`,
    }}>
      {cell.lines.map((ln, i) => (
        <span key={i} style={{
          display: 'block',
          fontSize: i === 0 ? '11px' : '10px',
          fontWeight: i === 0 ? 600 : 400,
          color: s.color, lineHeight: '1.3',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{ln}</span>
      ))}
    </div>
  )
}

export function KeyCatalystsCalendar({ count, liveTrialCells }: { count: number; liveTrialCells: Record<string, Record<number, CalCell>> }) {
  const BG       = 'var(--bg-1)'
  const DIV_H    = '1px solid rgba(16,34,74,0.07)'
  const DIV_V    = '1px solid rgba(16,34,74,0.05)'
  const DIV_FC   = '1px solid rgba(16,34,74,0.10)'
  const THICK    = '2px solid rgba(16,34,74,0.10)'
  const N        = MONTHS_LABELS.length

  return (
    <div style={{ background: BG, border: '1.8px solid rgba(210,226,255,1)', borderRadius: '16px', padding: '16px' }}>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(16,34,74,0.85)' }}>Key catalysts</span>
          <span style={{ fontSize: '12px', color: 'rgba(16,34,74,0.60)' }}>{count} events</span>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(16,34,74,0.60)' }}>
          Conference dates: official congress sites · Earnings dates: company IR · Milestones: ClinicalTrials.gov (live)
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: `${FIRST_W + COL_W * N}px` }}>
          <colgroup>
            <col style={{ width: FIRST_W }} />
            {MONTHS_LABELS.map((_, i) => <col key={i} style={{ width: COL_W }} />)}
          </colgroup>
          <thead>
            {/* Month headers */}
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 5, background: BG, height: MO_H, padding: 0, borderBottom: DIV_H, borderRight: DIV_FC }} />
              {MONTHS_LABELS.map((mo, i) => (
                <th key={mo} style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: 'rgba(16,34,74,0.03)',
                  height: MO_H, padding: '0 8px', textAlign: 'center',
                  fontSize: '12px', fontWeight: 600, color: 'rgba(16,34,74,0.60)',
                  borderBottom: DIV_H, borderRight: i < N - 1 ? DIV_V : 'none',
                  whiteSpace: 'nowrap',
                }}>{mo}</th>
              ))}
            </tr>
            {/* Conferences */}
            <tr>
              <th style={{ position: 'sticky', top: MO_H, left: 0, zIndex: 5, background: BG, height: CONF_H, padding: '0 8px', textAlign: 'left', borderBottom: DIV_H, borderRight: DIV_FC, verticalAlign: 'middle' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(16,34,74,0.60)' }}>Conferences</span>
              </th>
              {MONTHS_LABELS.map((_, i) => {
                const d = CONF_DATA[i]
                return (
                  <td key={i} style={{ position: 'sticky', top: MO_H, zIndex: 1, background: BG, height: CONF_H, padding: '6px 8px', verticalAlign: 'middle', borderBottom: DIV_H, borderRight: i < N - 1 ? DIV_V : 'none' }}>
                    {d && d.map((ln, li) => (
                      <div key={li} style={{ fontSize: '12px', fontWeight: li === 0 ? 600 : 400, color: li === 0 ? 'rgba(16,34,74,0.80)' : 'rgba(16,34,74,0.40)', lineHeight: '1.5' }}>{ln}</div>
                    ))}
                  </td>
                )
              })}
            </tr>
            {/* IR Events */}
            <tr>
              <th style={{ position: 'sticky', top: MO_H + CONF_H, left: 0, zIndex: 5, background: BG, height: IR_H, padding: '0 8px', textAlign: 'left', borderBottom: THICK, borderRight: DIV_FC, verticalAlign: 'middle' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(16,34,74,0.60)' }}>IR Events</span>
              </th>
              {MONTHS_LABELS.map((_, i) => {
                const d = IR_DATA[i]
                return (
                  <td key={i} style={{ position: 'sticky', top: MO_H + CONF_H, zIndex: 1, background: BG, height: IR_H, padding: '6px 8px', verticalAlign: 'middle', borderBottom: THICK, borderRight: i < N - 1 ? DIV_V : 'none' }}>
                    {d && d.map((ln, li) => (
                      <div key={li} style={{ fontSize: '12px', fontWeight: li === 0 ? 600 : 400, color: li === 0 ? 'rgba(16,34,74,0.80)' : 'rgba(16,34,74,0.40)', lineHeight: '1.5' }}>{ln}</div>
                    ))}
                  </td>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {CAL_COMPS.map((id, ri) => {
              const comp = competitorsData.find((c) => c.id === id)
              if (!comp) return null
              const cells: Record<number, CalCell> = { ...(CAL_CELLS[id] || {}), ...(liveTrialCells[id] || {}) }
              const isLast = ri === CAL_COMPS.length - 1
              return (
                <tr key={id}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: BG, padding: '8px', verticalAlign: 'middle', borderBottom: isLast ? 'none' : DIV_H, borderRight: DIV_FC }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'rgba(16,34,74,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.name}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'rgba(16,34,74,0.60)', fontStyle: 'italic' }}>{CAL_ASSET[id]}</p>
                  </td>
                  {MONTHS_LABELS.map((_, mi) => (
                    <td key={mi} style={{ padding: '4px 5px', verticalAlign: 'middle', borderBottom: isLast ? 'none' : DIV_H, borderRight: mi < N - 1 ? DIV_V : 'none' }}>
                      <CCell cell={cells[mi]} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
