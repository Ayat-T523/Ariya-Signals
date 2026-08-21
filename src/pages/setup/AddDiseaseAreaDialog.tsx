import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/shadcn/ui/dialog'
import { Button } from '../../components/shadcn/ui/button'
import { Input } from '../../components/shadcn/ui/input'
import { Field, FieldLabel, FieldGroup } from '../../components/shadcn/ui/field'

/**
 * AddDiseaseAreaDialog.tsx — Landscape Input Resolution milestone, Step
 * 5/24. Fallback for a category with no configured Disease Area catalog
 * entry (most of the 22 categories, honestly, in this milestone's scope) --
 * never a dead end. Minimal on purpose: only the name a user can actually
 * supply, no fabricated disease metadata.
 */
export default function AddDiseaseAreaDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string) => void
}) {
  const [name, setName] = useState('')

  function reset() {
    setName('')
  }

  function handleAdd() {
    if (!name.trim()) return
    onAdd(name)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add disease / indication</DialogTitle>
          <DialogDescription>
            Not in Ariya's configured catalog yet? Add it directly — you can still continue setup.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="manual-disease-area-name">Disease / indication name *</FieldLabel>
              <Input
                id="manual-disease-area-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Generalized Myasthenia Gravis"
                autoFocus
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>Add disease area</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
