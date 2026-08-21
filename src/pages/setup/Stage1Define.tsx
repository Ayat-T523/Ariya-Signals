import { useState } from 'react'
import { THERAPEUTIC_AREAS } from '../../config/therapeutic-areas'
import {
  getDiseaseAreasForTherapeuticArea,
  getAssetsForDiseaseArea,
} from '../../config/landscape-configuration'
import {
  type SetupDraft,
  selectTherapeuticArea,
  selectDiseaseArea,
  attachManualDiseaseArea,
  selectKnownHomeAsset,
  attachManualHomeAsset,
  selectResolvedAsset,
  clearHomeAsset,
  confirmHomeCompany,
  resolveHomeAssetDisplay,
  needsHomeCompanyConfirmation,
  assetDiseaseAreaAgreement,
  isStage1Valid,
} from '../../config/setup-draft'
import { useAssetSearch } from '../../hooks/useAssetSearch'
import type { ResolvedAssetIdentity } from '../../lib/api/assetSearch'
import { Button } from '../../components/shadcn/ui/button'
import { Input } from '../../components/shadcn/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/shadcn/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/shadcn/ui/command'
import { Field, FieldLabel } from '../../components/shadcn/ui/field'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '../../components/shadcn/ui/empty'
import { Alert, AlertTitle, AlertDescription } from '../../components/shadcn/ui/alert'
import { Spinner } from '../../components/shadcn/ui/spinner'
import { CheckIcon, ChevronsUpDownIcon, PlugZapIcon, PlusIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react'
import AddAssetDialog from './AddAssetDialog'
import AddDiseaseAreaDialog from './AddDiseaseAreaDialog'

/**
 * Stage1Define.tsx — "Define your landscape" (Landscape category -> Disease
 * Area -> Home/Reference Asset). Landscape Input Resolution milestone:
 *
 *  - Category is now the full 22-entry grouped catalog (therapeutic-areas.ts)
 *    behind the same Popover+Command combobox pattern already used for Home
 *    Asset, grouped by categoryType (Phase 27's own justification for that
 *    pattern applies unchanged: shadcn has no separate first-class Combobox
 *    component, Popover+Command IS the documented composition).
 *  - Disease Area gets the same combobox, with known catalog entries first
 *    and a manual fallback that's always reachable, never a dead end.
 *  - Home Asset search now merges the local catalog (instant) with a
 *    debounced backend resolver (useAssetSearch/assetSearch.ts) — brand,
 *    INN, development code, or alias all converge on one identity server-
 *    side; this component only renders whatever it's handed, never
 *    reclassifies or fabricates a field.
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
  const [daOpen, setDaOpen] = useState(false)
  const [assetSearchOpen, setAssetSearchOpen] = useState(false)
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [addDiseaseAreaOpen, setAddDiseaseAreaOpen] = useState(false)
  const [companyInput, setCompanyInput] = useState('')
  const { state: assetSearchState, search: runAssetSearch, reset: resetAssetSearch } = useAssetSearch()

  const { therapeuticAreaId, diseaseAreaId, homeAssetId } = draft.landscapeConfiguration
  const diseaseAreas = therapeuticAreaId ? getDiseaseAreasForTherapeuticArea(therapeuticAreaId) : []
  const knownAssets = diseaseAreaId ? getAssetsForDiseaseArea(diseaseAreaId) : []
  const homeAssetDisplay = resolveHomeAssetDisplay(draft)
  const needsCompany = needsHomeCompanyConfirmation(draft)
  const mismatch = assetDiseaseAreaAgreement(draft)
  const valid = isStage1Valid(draft)

  const selectedTa = THERAPEUTIC_AREAS.find((ta) => ta.id === therapeuticAreaId)
  const selectedDa = diseaseAreas.find((da) => da.id === diseaseAreaId)
  const standardAreas = THERAPEUTIC_AREAS.filter((c) => c.categoryType === 'therapeutic_area')
  const crossCuttingAreas = THERAPEUTIC_AREAS.filter((c) => c.categoryType === 'cross_cutting')

  const knownAssetIds = new Set(knownAssets.map((a) => a.id))
  const searchResults: ResolvedAssetIdentity[] = assetSearchState.status === 'results'
    ? assetSearchState.results.filter((r) => !knownAssetIds.has(r.id))
    : []

  function handleSelectResolvedAsset(identity: ResolvedAssetIdentity) {
    onChange(selectResolvedAsset(draft, identity))
    setAssetSearchOpen(false)
    resetAssetSearch()
  }

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
        ) : draft.manualDiseaseArea && draft.manualDiseaseArea.id === diseaseAreaId ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 sm:w-96">
            <div className="flex-1">
              <p className="text-sm font-medium">{draft.manualDiseaseArea.name}</p>
              <p className="text-xs text-muted-foreground">Added manually</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAddDiseaseAreaOpen(true)}>Change</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:w-96">
            <Popover open={daOpen} onOpenChange={setDaOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={daOpen} className="w-full justify-between">
                  {selectedDa?.name ?? 'Search disease / indication…'}
                  <ChevronsUpDownIcon className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full max-h-[60vh] overflow-hidden p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search disease / indication…" />
                  <CommandList>
                    <CommandEmpty>
                      <div className="flex flex-col items-center gap-2 py-2">
                        <span className="text-sm text-muted-foreground">Not configured yet.</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setDaOpen(false); setAddDiseaseAreaOpen(true) }}
                        >
                          <PlusIcon /> Add disease area
                        </Button>
                      </div>
                    </CommandEmpty>
                    {diseaseAreas.length > 0 && (
                      <CommandGroup heading="Known disease areas">
                        {diseaseAreas.map((da) => (
                          <CommandItem
                            key={da.id}
                            value={da.name}
                            onSelect={() => { onChange(selectDiseaseArea(draft, da.id)); setDaOpen(false) }}
                          >
                            <CheckIcon className={diseaseAreaId === da.id ? 'opacity-100' : 'opacity-0'} />
                            {da.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setAddDiseaseAreaOpen(true)}>
              <PlusIcon /> Add disease area manually
            </Button>
          </div>
        )}
      </Field>

      <Field>
        <FieldLabel>Home / Reference Asset</FieldLabel>
        {!diseaseAreaId ? (
          <p className="text-sm text-muted-foreground italic">Select a Disease Area first.</p>
        ) : draft.manualAsset && draft.manualAsset.id === homeAssetId ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 sm:w-96">
            <div className="flex-1">
              <p className="text-sm font-medium">{draft.manualAsset.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {[draft.manualAsset.innName, draft.manualAsset.company].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAddAssetOpen(true)}>Change</Button>
          </div>
        ) : homeAssetDisplay && homeAssetId ? (
          <div className="flex flex-col gap-2 sm:w-96">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="flex-1">
                <p className="text-sm font-medium">{homeAssetDisplay.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {[homeAssetDisplay.innName, homeAssetDisplay.companyName].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onChange(clearHomeAsset(draft))}>Change</Button>
            </div>
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
                  This asset's own evidence doesn't confirm it for {selectedDa?.name ?? draft.manualDiseaseArea?.name}. Choose another asset, change the Disease Area, or continue only if you're confident this is correct.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <AssetSearchCombobox
            open={assetSearchOpen}
            onOpenChange={setAssetSearchOpen}
            knownAssets={knownAssets}
            homeAssetId={homeAssetId}
            searchState={assetSearchState}
            searchResults={searchResults}
            onSearchChange={runAssetSearch}
            onSelectKnown={(assetId) => { onChange(selectKnownHomeAsset(draft, assetId)); setAssetSearchOpen(false); resetAssetSearch() }}
            onSelectResolved={handleSelectResolvedAsset}
            onAddManual={() => { setAssetSearchOpen(false); setAddAssetOpen(true) }}
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

/**
 * Home Asset search combobox — merges local catalog matches (instant) with
 * a debounced backend resolver (Step 20). idle/searching/results/no_results/
 * error all render distinctly (Step 22); manual entry remains reachable
 * from every state, never hidden behind a successful search.
 */
function AssetSearchCombobox({
  open,
  onOpenChange,
  knownAssets,
  homeAssetId,
  searchState,
  searchResults,
  onSearchChange,
  onSelectKnown,
  onSelectResolved,
  onAddManual,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  knownAssets: { id: string; brandName: string; innName: string }[]
  homeAssetId: string | null
  searchState: ReturnType<typeof useAssetSearch>['state']
  searchResults: ResolvedAssetIdentity[]
  onSearchChange: (query: string) => void
  onSelectKnown: (assetId: string) => void
  onSelectResolved: (identity: ResolvedAssetIdentity) => void
  onAddManual: () => void
}) {
  if (knownAssets.length === 0) {
    return (
      <>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between sm:w-96">
              Search by brand / generic name / development code
              <ChevronsUpDownIcon className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <AssetSearchPopoverContent
            searchState={searchState} searchResults={searchResults} knownAssets={[]} homeAssetId={homeAssetId}
            onSearchChange={onSearchChange} onSelectKnown={onSelectKnown} onSelectResolved={onSelectResolved} onAddManual={onAddManual}
          />
        </Popover>
        {searchState.status === 'idle' && (
          <Empty className="mt-2 border">
            <EmptyHeader>
              <div className="mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <SearchXIcon className="size-4" />
              </div>
              <EmptyTitle>No matching configured assets</EmptyTitle>
              <EmptyDescription>Search for your home asset above, or add it manually.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={onAddManual}>
                <PlusIcon /> Add asset manually
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:w-96">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            Search by brand / generic name / development code
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <AssetSearchPopoverContent
          searchState={searchState} searchResults={searchResults} knownAssets={knownAssets} homeAssetId={homeAssetId}
          onSearchChange={onSearchChange} onSelectKnown={onSelectKnown} onSelectResolved={onSelectResolved} onAddManual={onAddManual}
        />
      </Popover>
      <Button variant="ghost" size="sm" className="self-start" onClick={onAddManual}>
        <PlusIcon /> Add another asset
      </Button>
    </div>
  )
}

function AssetSearchPopoverContent({
  searchState, searchResults, knownAssets, homeAssetId, onSearchChange, onSelectKnown, onSelectResolved, onAddManual,
}: {
  searchState: ReturnType<typeof useAssetSearch>['state']
  searchResults: ResolvedAssetIdentity[]
  knownAssets: { id: string; brandName: string; innName: string }[]
  homeAssetId: string | null
  onSearchChange: (query: string) => void
  onSelectKnown: (assetId: string) => void
  onSelectResolved: (identity: ResolvedAssetIdentity) => void
  onAddManual: () => void
}) {
  return (
    <PopoverContent className="w-full max-h-[60vh] overflow-hidden p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search by brand / generic name / development code…" onValueChange={onSearchChange} />
        <CommandList>
          {searchState.status === 'searching' && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Searching…
            </div>
          )}
          {searchState.status === 'error' && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <PlugZapIcon className="size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Asset search is currently unavailable.</p>
              <Button size="sm" variant="outline" onClick={onAddManual}><PlusIcon /> Add asset manually</Button>
            </div>
          )}
          {searchState.status === 'no_results' && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">No verified asset found.</p>
              <Button size="sm" variant="outline" onClick={onAddManual}><PlusIcon /> Add asset manually</Button>
            </div>
          )}
          {(searchState.status === 'idle' || searchState.status === 'results') && knownAssets.length === 0 && searchResults.length === 0 && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-2">
                <span className="text-sm text-muted-foreground">Type to search, or add it directly.</span>
                <Button size="sm" variant="outline" onClick={onAddManual}><PlusIcon /> Add asset manually</Button>
              </div>
            </CommandEmpty>
          )}
          {knownAssets.length > 0 && (
            <CommandGroup heading="Known results">
              {knownAssets.map((asset) => (
                <CommandItem
                  key={asset.id}
                  value={`known-${asset.id}`}
                  onSelect={() => onSelectKnown(asset.id)}
                >
                  <CheckIcon className={homeAssetId === asset.id ? 'opacity-100' : 'opacity-0'} />
                  <div className="flex flex-col">
                    <span>{asset.brandName}</span>
                    <span className="text-xs text-muted-foreground">{asset.innName}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {searchResults.length > 0 && (
            <CommandGroup heading="Search results">
              {searchResults.map((identity) => (
                <CommandItem
                  key={identity.id}
                  value={`resolved-${identity.id}`}
                  onSelect={() => onSelectResolved(identity)}
                >
                  <CheckIcon className={homeAssetId === identity.id ? 'opacity-100' : 'opacity-0'} />
                  <div className="flex flex-col">
                    <span>{identity.preferredName}</span>
                    <span className="text-xs text-muted-foreground">
                      {[identity.innNames[0], identity.ownerCompanies[0]].filter(Boolean).join(' · ') || 'Development asset'}
                    </span>
                    {identity.indicationContexts[0] && (
                      <span className="text-xs text-muted-foreground italic">{identity.indicationContexts[0]}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {(searchState.status === 'results' || knownAssets.length > 0) && (
            <div className="border-t p-1.5">
              <Button size="sm" variant="ghost" className="w-full justify-start" onClick={onAddManual}>
                <PlusIcon /> Can't find it? Add asset manually
              </Button>
            </div>
          )}
        </CommandList>
      </Command>
    </PopoverContent>
  )
}
