/**
 * ContentColumn.tsx — White rounded card that floats on the navy background.
 * Matches Figma node 23:654 (file IXHI4HJFuZpw5hPMrv7DVb).
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
        marginTop: '12px',
        marginRight: '12px',
        marginBottom: '12px',
        height: 'calc(100vh - 24px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-1)',
        borderRadius: '32px',
        boxShadow: '0px 8px 12px 18px rgba(0,0,0,0.15), 0px 4px 4px 0px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
