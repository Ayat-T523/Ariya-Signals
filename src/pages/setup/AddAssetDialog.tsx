import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/shadcn/ui/dialog'
import { Button } from '../../components/shadcn/ui/button'
import { Input } from '../../components/shadcn/ui/input'
import { Field, FieldLabel, FieldGroup } from '../../components/shadcn/ui/field'

/**
 * AddAssetDialog.tsx — Stage 1.6/1.7. Identity only, never clinical/strategic
 * metadata (mechanism, phase, competitors, lexicon, evidence, posture) --
 * Ariya provides intelligence later, the user only provides identity here.
 *
 * Viewport-safe per this phase's overlay rule even though this form is
 * short today -- same structural contract as every other dialog in this
 * flow, so it never needs revisiting if fields are added later.
 */
export default function AddAssetDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (input: { displayName: string; innName: string | null; company: string | null }) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [innName, setInnName] = useState('')
  const [company, setCompany] = useState('')

  function reset() {
    setDisplayName('')
    setInnName('')
    setCompany('')
  }

  function handleAdd() {
    if (!displayName.trim()) return
    onAdd({ displayName, innName: innName || null, company: company || null })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add home asset</DialogTitle>
          <DialogDescription>
            The local catalog doesn't have this asset yet. Give Ariya its identity — intelligence comes later.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="manual-asset-name">Asset / brand name *</FieldLabel>
              <Input
                id="manual-asset-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ekterly"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-asset-inn">Generic name / INN</FieldLabel>
              <Input
                id="manual-asset-inn"
                value={innName}
                onChange={(e) => setInnName(e.target.value)}
                placeholder="e.g. sebetralstat"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-asset-company">Company</FieldLabel>
              <Input
                id="manual-asset-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. KalVista Pharmaceuticals"
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!displayName.trim()}>Add asset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
