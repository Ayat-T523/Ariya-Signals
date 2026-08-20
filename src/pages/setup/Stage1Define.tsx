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
  selectKnownHomeAsset,
  attachManualHomeAsset,
  resolveHomeAssetDisplay,
  isStage1Valid,
} from '../../config/setup-draft'
import { Button } from '../../components/shadcn/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/shadcn/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/shadcn/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/shadcn/ui/command'
import { Field, FieldLabel } from '../../components/shadcn/ui/field'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '../../components/shadcn/ui/empty'
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import AddAssetDialog from './AddAssetDialog'

/**
 * Stage1Define.tsx — "Define your landscape" (Therapeutic Area -> Disease
 * Area -> Home/Reference Asset). The local catalog (assets-config.ts) is
 * treated as a known/seed source only, never the authority over what asset
 * a user can configure -- see attachManualHomeAsset in setup-draft.ts for
 * the manual fallback this stage always offers.
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
  const [assetSearchOpen, setAssetSearchOpen] = useState(false)
  const [addAssetOpen, setAddAssetOpen] = useState(false)

  const { therapeuticAreaId, diseaseAreaId, homeAssetId } = draft.landscapeConfiguration
  const diseaseAreas = therapeuticAreaId ? getDiseaseAreasForTherapeuticArea(therapeuticAreaId) : []
  const knownAssets = diseaseAreaId ? getAssetsForDiseaseArea(diseaseAreaId) : []
  const homeAssetDisplay = resolveHomeAssetDisplay(draft)
  const valid = isStage1Valid(draft)

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel>Therapeutic Area</FieldLabel>
        <Select
          value={therapeuticAreaId ?? undefined}
          onValueChange={(id) => onChange(selectTherapeuticArea(draft, id))}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Select a Therapeutic Area" />
          </SelectTrigger>
          <SelectContent>
            {THERAPEUTIC_AREAS.map((ta) => (
              <SelectItem key={ta.id} value={ta.id}>{ta.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>Disease Area</FieldLabel>
        {!therapeuticAreaId ? (
          <p className="text-sm text-muted-foreground italic">Select a Therapeutic Area first.</p>
        ) : (
          <Select
            value={diseaseAreaId ?? undefined}
            onValueChange={(id) => onChange(selectDiseaseArea(draft, id))}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Select a Disease Area" />
            </SelectTrigger>
            <SelectContent>
              {diseaseAreas.map((da) => (
                <SelectItem key={da.id} value={da.id}>{da.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field>
        <FieldLabel>Home / Reference Asset</FieldLabel>
        {!diseaseAreaId ? (
          <p className="text-sm text-muted-foreground italic">Select a Disease Area first.</p>
        ) : draft.manualAsset && draft.manualAsset.id === homeAssetId ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 sm:w-80">
            <div className="flex-1">
              <p className="text-sm font-medium">{draft.manualAsset.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {[draft.manualAsset.innName, draft.manualAsset.company].filter(Boolean).join(' · ') || 'Added manually'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAddAssetOpen(true)}>Change</Button>
          </div>
        ) : knownAssets.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMediaIcon />
              <EmptyTitle>No matching configured assets</EmptyTitle>
              <EmptyDescription>
                Search for your home asset, or add it manually — Ariya will resolve it later.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => setAddAssetOpen(true)}>
                <PlusIcon /> Add asset
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2 sm:w-80">
            <Popover open={assetSearchOpen} onOpenChange={setAssetSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={assetSearchOpen} className="w-full justify-between">
                  {homeAssetDisplay ? homeAssetDisplay.displayName : 'Search by brand / generic name'}
                  <ChevronsUpDownIcon className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by brand / generic name…" />
                  <CommandList>
                    <CommandEmpty>
                      <div className="flex flex-col items-center gap-2 py-2">
                        <span className="text-sm text-muted-foreground">Can't find it?</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setAssetSearchOpen(false); setAddAssetOpen(true) }}
                        >
                          <PlusIcon /> Add another asset
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup heading="Known results">
                      {knownAssets.map((asset) => (
                        <CommandItem
                          key={asset.id}
                          value={`${asset.brandName} ${asset.innName}`}
                          onSelect={() => { onChange(selectKnownHomeAsset(draft, asset.id)); setAssetSearchOpen(false) }}
                        >
                          <CheckIcon className={homeAssetId === asset.id ? 'opacity-100' : 'opacity-0'} />
                          <div className="flex flex-col">
                            <span>{asset.brandName}</span>
                            <span className="text-xs text-muted-foreground">{asset.innName}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setAddAssetOpen(true)}>
              <PlusIcon /> Add another asset
            </Button>
          </div>
        )}
      </Field>

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

function EmptyMediaIcon() {
  return (
    <div className="mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
      <SearchXIcon className="size-4" />
    </div>
  )
}
