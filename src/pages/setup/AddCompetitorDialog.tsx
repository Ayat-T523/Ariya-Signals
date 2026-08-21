import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/shadcn/ui/dialog'
import { Button } from '../../components/shadcn/ui/button'
import { Input } from '../../components/shadcn/ui/input'
import { Field, FieldLabel, FieldGroup } from '../../components/shadcn/ui/field'

/**
 * AddCompetitorDialog.tsx — Phase 19. Company-rooted: the required identity
 * is the COMPANY, never an asset -- an optional relevant asset/INN nests
 * underneath it (see setup-draft.ts's addManualCompany). Identity only --
 * never requests evidence/intelligence from the user. Enters the draft with
 * evidenceStatus: 'not_evaluated' and no fabricated Ariya assessment.
 *
 * Phase 22: blocks adding the resolved home company as a competitor,
 * checked via `isHomeCompany` (resolved identity, never case-sensitive
 * string equality -- see setup-draft.ts's isHomeCompany/normalizeCompanyName).
 */
export default function AddCompetitorDialog({
  open,
  onOpenChange,
  onAdd,
  isHomeCompany,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (input: { companyName: string; assetName: string | null; innName: string | null }) => void
  isHomeCompany: (companyName: string) => boolean
}) {
  const [companyName, setCompanyName] = useState('')
  const [assetName, setAssetName] = useState('')
  const [innName, setInnName] = useState('')

  function reset() {
    setCompanyName('')
    setAssetName('')
    setInnName('')
  }

  const blockedAsHomeCompany = companyName.trim() !== '' && isHomeCompany(companyName)

  function handleAdd() {
    if (!companyName.trim() || blockedAsHomeCompany) return
    onAdd({ companyName, assetName: assetName || null, innName: innName || null })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add competitor manually</DialogTitle>
          <DialogDescription>
            Not in Ariya's discovered candidates? Add it directly — you'll still classify it in the next step.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="manual-competitor-company">Company name *</FieldLabel>
              <Input
                id="manual-competitor-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. BioCryst Pharmaceuticals"
                autoFocus
              />
              {blockedAsHomeCompany && (
                <p className="text-xs text-destructive">
                  {companyName.trim()} is the company associated with your home asset and cannot be added as a competitor in this landscape.
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-competitor-asset">Asset / product</FieldLabel>
              <Input
                id="manual-competitor-asset"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. Orladeyo"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-competitor-inn">Generic name / INN</FieldLabel>
              <Input
                id="manual-competitor-inn"
                value={innName}
                onChange={(e) => setInnName(e.target.value)}
                placeholder="e.g. berotralstat"
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!companyName.trim() || blockedAsHomeCompany}>Add competitor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
