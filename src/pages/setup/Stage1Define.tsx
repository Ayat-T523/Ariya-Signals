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
  confirmHomeCompany,
  resolveHomeAssetDisplay,
  needsHomeCompanyConfirmation,
  isStage1Valid,
} from '../../config/setup-draft'
import { Button } from '../../components/shadcn/ui/button'
import { Input } from '../../components/shadcn/ui/input'
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
 *
 * Phase 27 taxonomy note: Therapeutic Area / Disease Area come from
 * src/config/therapeutic-areas.ts, the only such catalog anywhere in either
 * repo -- there is no approved "core 20" (or any other numbered/named)
 * taxonomy document in this project (searched both repos, docs/, and every
 * sibling directory; see this milestone's own checkpoint, section P/Q for
 * the full search record). Today that catalog holds 2 Therapeutic Areas
 * (Immunology, Neurology) and 4 Disease Areas (HAE, PNH, PBC, gMG) -- every
 * one backed by a real asset in assets-config.ts or a real gMG asset
 * reachable via manual entry, never a placeholder. This stage does not
 * invent more; it upgrades the CONTROL for both fields to the same
 * documented shadcn Popover+Command combobox pattern Home Asset already
 * uses (shadcn's registry has no separate first-class "Combobox" component
 * -- Popover+Command composition IS the official documented pattern for
 * this interaction), so the selector is real, searchable, and ready for a
 * larger catalog without another rewrite when one exists.
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
  const [companyInput, setCompanyInput] = useState('')

  const { therapeuticAreaId, diseaseAreaId, homeAssetId } = draft.landscapeConfiguration
  const diseaseAreas = therapeuticAreaId ? getDiseaseAreasForTherapeuticArea(therapeuticAreaId) : []
  const knownAssets = diseaseAreaId ? getAssetsForDiseaseArea(diseaseAreaId) : []
  const homeAssetDisplay = resolveHomeAssetDisplay(draft)
  const needsCompany = needsHomeCompanyConfirmation(draft)
  const valid = isStage1Valid(draft)

  const selectedTa = THERAPEUTIC_AREAS.find((ta) => ta.id === therapeuticAreaId)
  const selectedDa = diseaseAreas.find((da) => da.id === diseaseAreaId)

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel>Therapeutic Area</FieldLabel>
        <Popover open={taOpen} onOpenChange={setTaOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={taOpen} className="w-full justify-between sm:w-80">
              {selectedTa?.name ?? 'Search therapeutic areas…'}
              <ChevronsUpDownIcon className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search therapeutic areas…" />
              <CommandList>
                <CommandEmpty>No therapeutic area matches.</CommandEmpty>
                <CommandGroup>
                  {THERAPEUTIC_AREAS.map((ta) => (
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
          <p className="text-sm text-muted-foreground italic">Select a Therapeutic Area first.</p>
        ) : (
          <Popover open={daOpen} onOpenChange={setDaOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={daOpen} className="w-full justify-between sm:w-80">
                {selectedDa?.name ?? 'Search disease areas…'}
                <ChevronsUpDownIcon className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search disease areas…" />
                <CommandList>
                  <CommandEmpty>No disease area matches.</CommandEmpty>
                  <CommandGroup>
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
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
                {[draft.manualAsset.innName, draft.manualAsset.company].filter(Boolean).join(' · ')}
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

      {needsCompany && homeAssetDisplay && (
        <Field>
          <FieldLabel>Company for {homeAssetDisplay.displayName} *</FieldLabel>
          <p className="mb-1.5 text-xs text-muted-foreground">
            Ariya's catalog doesn't have a confirmed company for this asset yet. Confirm it so Ariya can exclude your own company from competitor suggestions later.
          </p>
          <div className="flex gap-2 sm:w-80">
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
