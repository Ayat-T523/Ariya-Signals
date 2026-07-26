import { FileX } from 'lucide-react'

/** Per §7.6: every list/table/tab has a designed empty state. */
export default function EmptyState({ message = 'No data available.' }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 gap-3"
      style={{ color: 'var(--ink-600)' }}
    >
      <FileX size={28} strokeWidth={1.5} />
      <p style={{ fontSize: '14px', margin: 0 }}>{message}</p>
    </div>
  )
}
