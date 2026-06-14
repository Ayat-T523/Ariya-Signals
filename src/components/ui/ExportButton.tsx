import { Download } from 'lucide-react'

interface Props {
  label?: string
}

export function ExportButton({ label = 'Export PDF' }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => window.print()}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 14px',
        fontSize: '13px', fontWeight: 500,
        fontFamily: 'Satoshi, sans-serif',
        color: 'rgba(5,10,68,0.45)',
        background: 'rgba(5,10,68,0.05)',
        border: '1px solid rgba(5,10,68,0.10)',
        borderRadius: '9999px',
        flexShrink: 0,
        userSelect: 'none',
        cursor: 'pointer',
      }}
    >
      <Download size={13} strokeWidth={1.5} />
      {label}
    </button>
  )
}
