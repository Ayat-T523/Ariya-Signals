/**
 * ContentColumn.tsx — Clean Clinical: flat, edge-to-edge content column.
 *
 * Predates InForm -- was a "white rounded card floating on a navy background"
 * (margin + 32px radius + heavy drop shadow), which made sense when the
 * shell background was navy. Under Clean Clinical the shell is flat white
 * and content fills the column right up to the nav's own 1px border, so
 * none of that survives: no margin, no radius, no shadow (see DESIGN.md's
 * "one material layer" / --r-flat-content).
 *
 * Rules:
 *   - No raw hex (RGBA exempt)
 *   - All colours via CSS vars
 */

import { type ReactNode } from 'react'

interface ContentColumnProps {
  children: ReactNode
}

export default function ContentColumn({ children }: ContentColumnProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--white)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
