import { useEffect, useMemo, useRef, useState } from 'react'
import { THERAPEUTIC_AREAS } from '../../config/therapeutic-areas'
import { getAssetsForDiseaseArea, getAssetsForResolvedDiseaseArea } from '../../config/landscape-configuration'
import {
  type SetupDraft,
  selectTherapeuticArea,
  selectResolvedDiseaseArea,
  clearDiseaseArea,
  attachManualDiseaseArea,
  selectKnownHomeAsset,
  attachManualHomeAsset,
  selectResolvedAsset,
  clearHomeAsset,
  confirmHomeCompany,
  resolveHomeAssetDisplay,
  resolveDiseaseAreaDisplay,
  needsHomeCompanyConfirmation,
  assetDiseaseAreaAgreement,
  isStage1Valid,
} from '../../config/setup-draft'
import { useAssetSearch } from '../../hooks/useAssetSearch'
import { useDiseaseSearch } from '../../hooks/useDiseaseSearch'
import type { ResolvedAssetIdentity } from '../../lib/api/assetSearch'
import type { ResolvedDiseaseArea } from '../../lib/api/diseaseSearch'
import type { AssetConfig } from '../../config/assets-config'
import { Button } from '../../components/shadcn/ui/button'
import { Input } from '../../components/shadcn/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/shadcn/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/shadcn/ui/command'
import { Field, FieldLabel } from '../../components/shadcn/ui/field'
import { Alert, AlertTitle, AlertDescription } from '../../components/shadcn/ui/alert'
import { Spinner } from '../../components/shadcn/ui/spinner'
import { CheckIcon, ChevronsUpDownIcon, PlugZapIcon, PlusIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react'
import AddAssetDialog from './AddAssetDialog'
import AddDiseaseAreaDialog from './AddDiseaseAreaDialog'

/**
 * Stage1Define.tsx — "Define your landscape" (Landscape category -> Disease
 * Area -> Home/Reference Asset). Root-Cause Recon implementation:
 *
 * The category combobox stays a Popover+Command trigger (a genuine
 * SELECT-shaped interaction is correct there — 22 fixed options, no free-
 * text identity to resolve). Disease Area and Home Asset are DIFFERENT:
 * both need a real search+dropdown, and the recon found the previous
 * Button-as-trigger version of that pattern reads as a Select even though
 * it composes Popover+Command correctly. Fixed here by making the visible
 * closed-state control an actual <Input> (via InlineSearchField below) —
 * typing is possible immediately, no click-to-reveal-a-textbox step, and
 * the results list is a normal in-flow element under the input (never a
 * Popover), which also sidesteps the shouldFilter={false}-disables-local-
 * filtering bug: local and remote results are merged and ranked together
 * in ONE array before render, so there is no second, separately-filtered
 * group for that prop to break.
 */
export default function Stage1Define({
  draft,
  onChange,
  onContinue,
}: {
  draft: SetupDraft
  onChange: (draft: SetupDraft) => void
  onContinue: () => void
}) {
  const [taOpen, setTaOpen] = useState(false)
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [addDiseaseAreaOpen, setAddDiseaseAreaOpen] = useState(false)
  const [companyInput, setCompanyInput] = useState('')

  const { therapeuticAreaId, diseaseAreaId, homeAssetId } = draft.landscapeConfiguration
  const homeAssetDisplay = resolveHomeAssetDisplay(draft)
  const diseaseAreaDisplay = resolveDiseaseAreaDisplay(draft)
  const needsCompany = needsHomeCompanyConfirmation(draft)
  const mismatch = assetDiseaseAreaAgreement(draft)
  const valid = isStage1Valid(draft)

  const selectedTa = THERAPEUTIC_AREAS.find((ta) => ta.id === therapeuticAreaId)
  const standardAreas = THERAPEUTIC_AREAS.filter((c) => c.categoryType === 'therapeutic_area')
  const crossCuttingAreas = THERAPEUTIC_AREAS.filter((c) => c.categoryType === 'cross_cutting')

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel>Landscape Category</FieldLabel>
        <Popover open={taOpen} onOpenChange={setTaOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={taOpen} className="w-full justify-between sm:w-96">
              {selectedTa?.name ?? 'Search category…'}
              <ChevronsUpDownIcon className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full max-h-[60vh] overflow-hidden p-0" align="start">
            <Command>
              <CommandInput placeholder="Search category…" />
              <CommandList>
                <CommandEmpty>No category matches.</CommandEmpty>
                <CommandGroup heading="Therapeutic Areas">
                  {standardAreas.map((ta) => (
                    <CommandItem
                      key={ta.id}
                      value={ta.name}
                      onSelect={() => { onChange(selectTherapeuticArea(draft, ta.id)); setTaOpen(false) }}
                    >
                      <CheckIcon className={therapeuticAreaId === ta.id ? 'opacity-100' : 'opacity-0'} />
                      {ta.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="Special / Cross-Cutting">
                  {crossCuttingAreas.map((ta) => (
                    <CommandItem
                      key={ta.id}
                      value={ta.name}
                      onSelect={() => { onChange(selectTherapeuticArea(draft, ta.id)); setTaOpen(false) }}
                    >
                      <CheckIcon className={therapeuticAreaId === ta.id ? 'opacity-100' : 'opacity-0'} />
                      {ta.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </Field>

      <Field>
        <FieldLabel>Disease Area</FieldLabel>
        {!therapeuticAreaId ? (
          <p className="text-sm text-muted-foreground italic">Select a Landscape Category first.</p>
        ) : diseaseAreaDisplay ? (
          <SelectedSummaryCard
            title={diseaseAreaDisplay.name}
            subtitle={diseaseAreaDisplay.source === 'manual' ? 'Added manually' : diseaseAreaDisplay.aliases?.slice(0, 3).join(', ')}
            onChange={() => onChange(clearDiseaseArea(draft))}
          />
        ) : (
          <DiseaseAreaSearchField
            therapeuticAreaId={therapeuticAreaId}
            homeAssetId={homeAssetId}
            onSelect={(resolved) => onChange(selectResolvedDiseaseArea(draft, resolved))}
            onAddManual={() => setAddDiseaseAreaOpen(true)}
          />
        )}
      </Field>

      <Field>
        <FieldLabel>Home / Reference Asset</FieldLabel>
        {!diseaseAreaId ? (
          <p className="text-sm text-muted-foreground italic">Select a Disease Area first.</p>
        ) : draft.manualAsset && draft.manualAsset.id === homeAssetId ? (
          <SelectedSummaryCard
            title={draft.manualAsset.displayName}
            subtitle={[draft.manualAsset.innName, draft.manualAsset.company].filter(Boolean).join(' · ')}
            onChange={() => setAddAssetOpen(true)}
          />
        ) : homeAssetDisplay && homeAssetId ? (
          <div className="flex flex-col gap-2 sm:w-96">
            <SelectedSummaryCard
              title={homeAssetDisplay.displayName}
              subtitle={[homeAssetDisplay.innName, homeAssetDisplay.companyName].filter(Boolean).join(' · ')}
              onChange={() => onChange(clearHomeAsset(draft))}
            />
            {(homeAssetDisplay.mechanismOfAction?.length || homeAssetDisplay.indicationContexts?.length || homeAssetDisplay.aliases?.length) ? (
              <div className="rounded-lg border p-3 text-xs">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Asset context</p>
                {homeAssetDisplay.mechanismOfAction && homeAssetDisplay.mechanismOfAction.length > 0 && (
                  <p className="mb-1"><span className="font-medium">Mechanism:</span> {homeAssetDisplay.mechanismOfAction.join(', ')}</p>
                )}
                {homeAssetDisplay.indicationContexts && homeAssetDisplay.indicationContexts.length > 0 && (
                  <p className="mb-1"><span className="font-medium">Relevant context:</span> {homeAssetDisplay.indicationContexts.slice(0, 3).join('; ')}</p>
                )}
                {homeAssetDisplay.aliases && homeAssetDisplay.aliases.length > 0 && (
                  <p><span className="font-medium">Known aliases:</span> {homeAssetDisplay.aliases.slice(0, 6).join(', ')}</p>
                )}
              </div>
            ) : null}
            {mismatch === 'mismatch' && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Asset not verified for this Disease Area</AlertTitle>
                <AlertDescription>
                  This asset's own evidence doesn't confirm it for {diseaseAreaDisplay?.name}. Choose another asset, change the Disease Area, or continue only if you're confident this is correct.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <AssetSearchField
            diseaseAreaId={diseaseAreaId}
            diseaseAreaName={diseaseAreaDisplay?.name}
            diseaseAreaAliases={diseaseAreaDisplay?.aliases}
            homeAssetId={homeAssetId}
            onSelectKnown={(assetId) => onChange(selectKnownHomeAsset(draft, assetId))}
            onSelectResolved={(identity) => onChange(selectResolvedAsset(draft, identity))}
            onAddManual={() => setAddAssetOpen(true)}
          />
        )}
      </Field>

      {needsCompany && homeAssetDisplay && (
        <Field>
          <FieldLabel>Company for {homeAssetDisplay.displayName} *</FieldLabel>
          <p className="mb-1.5 text-xs text-muted-foreground">
            Company not yet verified. Confirm it so Ariya can exclude your own company from competitor suggestions later.
          </p>
          <div className="flex gap-2 sm:w-96">
            <Input value={companyInput} onChange={(e) => setCompanyInput(e.target.value)} placeholder="e.g. KalVista Pharmaceuticals" />
            <Button
              variant="outline"
              disabled={!companyInput.trim()}
              onClick={() => { onChange(confirmHomeCompany(draft, companyInput)); setCompanyInput('') }}
            >
              Confirm
            </Button>
          </div>
        </Field>
      )}

      <AddDiseaseAreaDialog
        open={addDiseaseAreaOpen}
        onOpenChange={setAddDiseaseAreaOpen}
        onAdd={(name) => onChange(attachManualDiseaseArea(draft, name))}
      />
      <AddAssetDialog
        open={addAssetOpen}
        onOpenChange={setAddAssetOpen}
        onAdd={(input) => onChange(attachManualHomeAsset(draft, input))}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={onContinue} disabled={!valid}>Continue</Button>
      </div>
    </div>
  )
}

function SelectedSummaryCard({ title, subtitle, onChange }: { title: string; subtitle?: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 sm:w-96">
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>Change</Button>
    </div>
  )
}

// ── Deterministic ranking (Part B4) — exact match beats prefix beats
// substring; a primary field (brand/INN/dev-code/preferred name) always
// outranks the same quality of match on a mere alias. No fuzzy/edit-
// distance/embeddings anywhere in this function. ──────────────────────────
function scoreMatch(query: string, primaryFields: string[], aliasFields: string[] = []): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  let best = 0
  for (const f of primaryFields) {
    const fl = f.toLowerCase()
    if (fl === q) return 4
    if (fl.startsWith(q)) best = Math.max(best, 3)
    else if (fl.includes(q)) best = Math.max(best, 2)
  }
  for (const f of aliasFields) {
    const fl = f.toLowerCase()
    // An exact alias match ("HAE" for hereditary angioedema) is a strong,
    // deliberate identity match -- it must outrank a merely coincidental
    // prefix hit on some OTHER entry's primary name (e.g. "haemophilus
    // infectious disease" also starting with "hae"), so it sits just
    // below a primary-field exact match, not tied with a primary prefix.
    if (fl === q) best = Math.max(best, 3.5)
    else if (fl.includes(q)) best = Math.max(best, 1)
  }
  return best
}

/**
 * Disease Area search field — Root-Cause Recon implementation, Part A4.
 * Always-visible <Input> (never a hidden-until-clicked Button), curated
 * suggestions for the selected category shown immediately on focus with
 * no query, local+remote merged into ONE ranked list once typing starts.
 */
function DiseaseAreaSearchField({
  therapeuticAreaId, homeAssetId, onSelect, onAddManual,
}: {
  therapeuticAreaId: string
  homeAssetId: string | null
  onSelect: (resolved: ResolvedDiseaseArea) => void
  onAddManual: () => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const { state, search, reset } = useDiseaseSearch()
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQueryChange(value: string) {
    setQuery(value)
    if (value.trim()) search(value, therapeuticAreaId)
    else reset()
  }

  const results: ResolvedDiseaseArea[] = state.status === 'results' ? state.results : []
  const ranked = useMemo(() => {
    if (!query.trim()) return results
    // Descending sort directly -- NOT an ascending sort + .reverse(), which
    // would flip the relative order of tied entries (e.g. a curated exact-
    // alias match and an unrelated live prefix match scoring equally) and
    // silently undo the backend's own curated-first ordering for ties.
    return [...results].sort((a, b) => scoreMatch(query, [b.preferredName], b.aliases) - scoreMatch(query, [a.preferredName], a.aliases))
  }, [results, query])

  const open = focused
  void homeAssetId

  return (
    <div className="relative sm:w-96">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current)
            setFocused(true)
            // Part B2: curated suggestions for this category appear as
            // soon as the field opens, even before the user types anything.
            if (!query.trim() && state.status === 'idle') search('', therapeuticAreaId)
          }}
          onBlur={() => { blurTimeout.current = setTimeout(() => setFocused(false), 150) }}
          placeholder="Search disease / indication…"
          className="pl-8"
        />
      </div>
      {open && (
        <div className="mt-1.5 overflow-hidden rounded-lg border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandList className="max-h-[min(50vh,20rem)]">
              {state.status === 'searching' && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Searching…
                </div>
              )}
              {state.status === 'error' && (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <PlugZapIcon className="size-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Disease search is currently unavailable.</p>
                </div>
              )}
              {!query.trim() && ranked.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">Type to search, or add it directly.</p>
              )}
              {query.trim() && state.status === 'no_results' && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">No verified disease area found for "{query}".</p>
              )}
              {ranked.length > 0 && (
                <CommandGroup heading={query.trim() ? undefined : 'Common in this category'}>
                  {ranked.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={() => { onSelect(r); setQuery(''); reset(); setFocused(false) }}
                    >
                      <div className="flex flex-col">
                        <span>{r.preferredName}</span>
                        {r.aliases.length > 0 && <span className="text-xs text-muted-foreground">{r.aliases.slice(0, 3).join(', ')}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <div className="border-t p-1.5">
                <Button
                  size="sm" variant="ghost" className="w-full justify-start"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onAddManual}
                >
                  <PlusIcon /> Can't find it? Add disease area manually
                </Button>
              </div>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}

interface AssetOption {
  key: string
  kind: 'known' | 'resolved'
  primaryLabel: string
  secondaryLabel: string
  contextLabel?: string
  score: number
  known?: AssetConfig
  resolved?: ResolvedAssetIdentity
}

/**
 * Home Asset search field — Root-Cause Recon implementation, Part B.
 * Fixes the recon's three exact defects: (1) the closed-state control is
 * a real <Input>, not a Button-styled-as-Select; (2) local known assets
 * and backend results are merged into ONE array before render (so there
 * is no separate unfiltered group for shouldFilter to break); (3) that
 * merged array is deterministically ranked (Part B4), not two stacked,
 * unranked groups.
 */
function AssetSearchField({
  diseaseAreaId, diseaseAreaName, diseaseAreaAliases, homeAssetId, onSelectKnown, onSelectResolved, onAddManual,
}: {
  diseaseAreaId: string
  /** Root-Cause Recon implementation, Part A/B: a resolvedDiseaseArea's own name/aliases, used to bridge to ASSETS_CONFIG's legacy diseaseAreaId when diseaseAreaId itself is a MONDO id ASSETS_CONFIG doesn't carry. Undefined for a manual Disease Area (no bridge possible, and none needed). */
  diseaseAreaName?: string
  diseaseAreaAliases?: string[]
  homeAssetId: string | null
  onSelectKnown: (assetId: string) => void
  onSelectResolved: (identity: ResolvedAssetIdentity) => void
  onAddManual: () => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const { state, search, searchByIndication, reset } = useAssetSearch()
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const knownAssets = useMemo(() => {
    const byId = getAssetsForDiseaseArea(diseaseAreaId)
    const byName = diseaseAreaName ? getAssetsForResolvedDiseaseArea(diseaseAreaName, diseaseAreaAliases) : []
    const seen = new Set<string>()
    return [...byId, ...byName].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
  }, [diseaseAreaId, diseaseAreaName, diseaseAreaAliases])

  // Targeted Implementation 1 — Ariya searches automatically as soon as a
  // Disease Area is resolved, never waiting for the user to type or even
  // focus this field (that's the whole point: the user should not need to
  // already know a drug name). diseaseAreaName is resolveDiseaseAreaDisplay()'s
  // own display name (see Stage1Define's own call site below) -- already
  // correct for a catalog, MONDO-resolved, OR manually-entered Disease
  // Area alike, so this works for all three without a separate code path.
  // Guarded on an empty query so a request already in flight from typing
  // is never clobbered by this effect re-running for an unrelated reason.
  useEffect(() => {
    if (diseaseAreaName && !query.trim()) searchByIndication(diseaseAreaName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diseaseAreaName])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (value.trim()) search(value)
    else reset()
  }

  const backendResults: ResolvedAssetIdentity[] = state.status === 'results' ? state.results : []

  const merged: AssetOption[] = useMemo(() => {
    const knownIds = new Set(knownAssets.map((a) => a.id))
    const q = query.trim()
    const knownOptions: AssetOption[] = knownAssets
      .map((a) => ({
        key: `known-${a.id}`,
        kind: 'known' as const,
        primaryLabel: a.brandName,
        secondaryLabel: a.innName,
        score: q ? scoreMatch(q, [a.brandName, a.innName]) : 1,
        known: a,
      }))
      .filter((o) => !q || o.score > 0)
    const resolvedOptions: AssetOption[] = backendResults
      .filter((r) => !knownIds.has(r.id))
      .map((r) => ({
        key: `resolved-${r.id}`,
        kind: 'resolved' as const,
        primaryLabel: r.preferredName,
        secondaryLabel: [r.innNames[0], r.ownerCompanies[0]].filter(Boolean).join(' · ') || 'Development asset',
        contextLabel: r.indicationContexts[0],
        score: q ? scoreMatch(q, [r.preferredName, ...r.brandNames, ...r.innNames, ...r.developmentCodes], r.aliases) : 0.5,
        resolved: r,
      }))
    return [...knownOptions, ...resolvedOptions].sort((a, b) => b.score - a.score)
  }, [knownAssets, backendResults, query])

  const open = focused

  return (
    <div className="relative sm:w-96">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => { if (blurTimeout.current) clearTimeout(blurTimeout.current); setFocused(true) }}
          onBlur={() => { blurTimeout.current = setTimeout(() => setFocused(false), 150) }}
          placeholder="Search or select an asset…"
          className="pl-8"
        />
      </div>
      {open && (
        <div className="mt-1.5 overflow-hidden rounded-lg border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandList className="max-h-[min(50vh,20rem)]">
              {state.status === 'searching' && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Searching…
                </div>
              )}
              {state.status === 'error' && (
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <PlugZapIcon className="size-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Asset search is currently unavailable.</p>
                </div>
              )}
              {!query.trim() && merged.length === 0 && (state.status === 'idle' || state.status === 'no_results') && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">No known assets for this Disease Area yet. Search by brand, INN, or development code.</p>
              )}
              {query.trim() && state.status === 'no_results' && merged.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">No verified asset found for "{query}".</p>
              )}
              {merged.length > 0 && (
                <CommandGroup heading={query.trim() ? undefined : 'Known / relevant assets'}>
                  {merged.map((o) => (
                    <CommandItem
                      key={o.key}
                      value={o.key}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={() => {
                        if (o.kind === 'known' && o.known) onSelectKnown(o.known.id)
                        else if (o.resolved) onSelectResolved(o.resolved)
                        setQuery(''); reset(); setFocused(false)
                      }}
                    >
                      <CheckIcon className={homeAssetId === (o.known?.id ?? o.resolved?.id) ? 'opacity-100' : 'opacity-0'} />
                      <div className="flex flex-col">
                        <span>{o.primaryLabel}</span>
                        <span className="text-xs text-muted-foreground">{o.secondaryLabel}</span>
                        {o.contextLabel && <span className="text-xs text-muted-foreground italic">{o.contextLabel}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <div className="border-t p-1.5">
                <Button
                  size="sm" variant="ghost" className="w-full justify-start"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onAddManual}
                >
                  <PlusIcon /> Can't find it? Add asset manually
                </Button>
              </div>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}
