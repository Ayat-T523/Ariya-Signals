/**
 * Returns a relative string ("2 days ago") for recent dates,
 * or an absolute date ("Mar 14, 2026") for older ones.
 * Threshold: switch to absolute after 30 days.
 *
 * Per §8: "all dates displayed relative when recent, absolute when older."
 */
import { DEMO } from '../config/demo-config'

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = new Date(DEMO.snapshotDate)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1)   return 'Just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 2)   return 'Yesterday'
  if (diffDays < 7)   return `${diffDays} days ago`
  if (diffDays < 14)  return '1 week ago'
  if (diffDays < 30)  return `${Math.floor(diffDays / 7)} weeks ago`

  // Older → absolute
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Short absolute date: "Apr 20, 2026" */
export function formatDateAbs(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/**
 * Absolute date rendered only as precisely as it is known (§4.6 / date_precision).
 *
 * Many publication dates are year-only at the source. Those are stored as
 * YYYY-01-01 so recency scoring works, but rendering them as "Jan 1, 2026" would
 * assert a day the source never gave. Show what is actually known.
 */
export function formatDateAtPrecision(
  dateStr: string | null | undefined,
  precision: 'day' | 'month' | 'year' | null | undefined,
): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  if (precision === 'year')  return String(d.getUTCFullYear())
  if (precision === 'month') return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
