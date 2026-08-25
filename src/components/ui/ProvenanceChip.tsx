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

/**
 * Ariya Signals styling (per docs/design/component-references/ProvenanceChip.html):
 * flat tinted tag -- never neumorphic, never glass, never pill -- so it reads as
 * metadata on the host card, not a surface of its own. Live = sage/approved
 * (clickable, underlines on hover); illustrative = amber/urgent (never clickable,
 * there's no source to jump to).
 */
export default function ProvenanceChip({ sourceLabel, sourceUrl, date, isLive }: ProvenanceChipProps) {
  const dateStr = relDate(date)

  const inner = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: 'var(--t-caption)',
      fontWeight: 600,
      fontFamily: 'var(--font-ui)',
      color: isLive ? 'var(--sage-600)' : 'var(--amber-800)',
      padding: '4px 9px',
      borderRadius: 'var(--r-sm)',
      background: isLive ? 'var(--sage-050)' : 'var(--amber-050)',
      whiteSpace: 'nowrap',
      lineHeight: '1',
      textDecoration: 'none',
    }}>
      <span aria-hidden="true" style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: isLive ? 'var(--sage-600)' : 'var(--amber-600)',
      }} />
      {sourceLabel}
      {dateStr && (
        <span style={{ opacity: 0.75, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>&nbsp;·&nbsp;{dateStr}</span>
      )}
      {sourceUrl && (
        <ExternalLink size={11} strokeWidth={2} style={{ flexShrink: 0, marginLeft: '-1px', opacity: 0.8 }} />
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
