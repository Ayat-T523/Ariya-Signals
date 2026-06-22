import { ExternalLink } from 'lucide-react'

export interface ProvenanceChipProps {
  sourceLabel: string
  sourceUrl?:  string | null
  date?:       string | null
  /** When true renders with green "live data" styling instead of the default muted gray. */
  isLive?:     boolean
}

function relDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days < 31)  return `${days}d ago`
  const mo = Math.floor(days / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}yr ago`
}

export default function ProvenanceChip({ sourceLabel, sourceUrl, date, isLive }: ProvenanceChipProps) {
  const dateStr = relDate(date)

  const inner = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      fontSize: '11px',
      fontWeight: 500,
      fontFamily: 'Inter, sans-serif',
      color: isLive ? '#065F46' : 'rgba(5,10,68,0.50)',
      padding: '2px 7px',
      borderRadius: '4px',
      background: isLive ? 'rgba(16,185,129,0.12)' : 'rgba(5,10,68,0.04)',
      border: isLive ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(5,10,68,0.09)',
      whiteSpace: 'nowrap',
      lineHeight: '1.4',
      textDecoration: 'none',
    }}>
      {sourceLabel}
      {dateStr && (
        <span style={{ color: 'rgba(5,10,68,0.30)' }}>&nbsp;·&nbsp;{dateStr}</span>
      )}
      {sourceUrl && (
        <ExternalLink size={9} strokeWidth={2} style={{ flexShrink: 0, marginLeft: '2px' }} />
      )}
    </span>
  )

  if (sourceUrl) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', textDecoration: 'none' }}
      >
        {inner}
      </a>
    )
  }

  return inner
}
