import { Tabs, TabsList, TabsTrigger } from '../animate-ui/components/radix/tabs'
import { TIME_HORIZONS, TIME_HORIZON_LABELS, type TimeHorizon } from '../../lib/timeHorizon'

/**
 * TimeHorizonSelector — the ONE shared Month/Quarter/Year control (Historical
 * evidence hydration, Step 1, 2026-08-24), rendered identically by
 * WarRoom.tsx and Portal.tsx next to their own "Recent evidence" header.
 * Same Tabs/TabsList/TabsTrigger primitive WarRoom.tsx's own worklist
 * Importance/Recency sort control already uses -- never a second, competing
 * segmented-control implementation.
 */
export default function TimeHorizonSelector({
  value, onChange,
}: {
  value: TimeHorizon
  onChange: (horizon: TimeHorizon) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as TimeHorizon)}>
      <TabsList aria-label="Evidence time horizon" style={{ height: '26px', padding: '2px' }}>
        {TIME_HORIZONS.map((horizon) => (
          <TabsTrigger key={horizon} value={horizon} style={{ fontSize: '12px', padding: '0 10px' }}>
            {TIME_HORIZON_LABELS[horizon]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
