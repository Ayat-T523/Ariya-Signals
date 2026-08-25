// Signals — Feed Filter Bar (per docs/design/component-references/
// Feed Filter Bar.html): glass chrome (R5) holding a pressed search field,
// quick tabs, the reused FilterDropdown for facets, and a sort toggle.
// Applied facet chips render as their own row so the feed's current scope
// is never a mystery.
import { Search, X } from 'lucide-react'
import FilterDropdown from '../ui/FilterDropdown'

export type FeedTab = 'All' | 'Unread' | 'High'
export type SortMode = 'importance' | 'recency'

export interface FacetOption { value: string; label: string; count: number }
export interface AppliedChip { key: string; value: string; label: string }

export interface FeedFilterBarProps {
  query: string
  onQueryChange: (v: string) => void
  tab: FeedTab
  onTabChange: (v: FeedTab) => void
  sortMode: SortMode
  onSortModeChange: (v: SortMode) => void
  facetLabel?: string
  facetOptions?: FacetOption[]
  facetApplied?: Set<string>
  onFacetApply?: (v: Set<string>) => void
  appliedChips?: AppliedChip[]
  onRemoveChip?: (key: string, value: string) => void
  onClearAll?: () => void
}

export function FeedFilterBar({
  query, onQueryChange, tab, onTabChange, sortMode, onSortModeChange,
  facetLabel, facetOptions, facetApplied, onFacetApply,
  appliedChips, onRemoveChip, onClearAll,
}: FeedFilterBarProps) {
  return (
    <div className="feed-filter-bar">
      <div className="ffb-search">
        <Search size={15} aria-hidden="true" />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Filter signals…"
          aria-label="Filter signals"
        />
      </div>

      <div className="ffb-tabs" role="tablist" aria-label="Feed filter">
        {(['All', 'Unread', 'High'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => onTabChange(t)}>
            {t}
          </button>
        ))}
      </div>

      {facetOptions && facetOptions.length > 0 && onFacetApply && (
        <FilterDropdown label={facetLabel ?? 'Filter'} options={facetOptions} applied={facetApplied ?? new Set()} onApply={onFacetApply} />
      )}

      <div className="ffb-tabs" role="tablist" aria-label="Sort">
        {(['importance', 'recency'] as const).map(s => (
          <button key={s} type="button" role="tab" aria-selected={sortMode === s} className={sortMode === s ? 'active' : ''} onClick={() => onSortModeChange(s)}>
            {s === 'importance' ? 'Importance' : 'Recency'}
          </button>
        ))}
      </div>

      {appliedChips && appliedChips.length > 0 && (
        <div className="ffb-chips">
          {appliedChips.map(c => (
            <span className="ffb-chip" key={`${c.key}-${c.value}`}>
              {c.label}
              {onRemoveChip && (
                <button type="button" aria-label={`Remove ${c.label}`} onClick={() => onRemoveChip(c.key, c.value)}>
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
          {appliedChips.length >= 2 && onClearAll && (
            <button type="button" className="ffb-clear-all" onClick={onClearAll}>Clear all</button>
          )}
        </div>
      )}
    </div>
  )
}
