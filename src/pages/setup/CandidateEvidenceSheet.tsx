import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../components/shadcn/ui/sheet'
import { Badge } from '../../components/shadcn/ui/badge'
import { Separator } from '../../components/shadcn/ui/separator'
import type { CandidateEntry } from '../../config/setup-draft'

const RELATIONSHIP_LABEL: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', unclear: 'Unclear' }

/**
 * CandidateEvidenceSheet.tsx — Stage 2.6. Container/interaction built now;
 * only renders fields genuinely present on the candidate object -- no
 * fabricated evidence. Until the discovery seam is connected, every
 * candidate reaching this sheet is a manual one (evidence-not-evaluated).
 *
 * Viewport-safe: the Sheet primitive already spans full height
 * (data-[side=right]:h-full, inset-y-0) with a fixed-position overlay; the
 * body below is the only scrollable region, header stays put.
 */
export default function CandidateEvidenceSheet({
  candidate,
  open,
  onOpenChange,
}: {
  candidate: CandidateEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle>{candidate?.displayName ?? 'Candidate'}</SheetTitle>
          {candidate?.companyName && <SheetDescription>{candidate.companyName}</SheetDescription>}
        </SheetHeader>

        {candidate && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Source</p>
                <Badge variant="outline">{candidate.source === 'discovered' ? 'Discovered by Ariya' : 'Added manually'}</Badge>
              </div>

              <Separator />

              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Evidence</p>
                {candidate.evidenceStatus === 'not_evaluated' ? (
                  <p className="text-sm text-muted-foreground">Evidence not yet evaluated.</p>
                ) : candidate.evidenceSummary ? (
                  <p className="text-sm">{candidate.evidenceSummary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No evidence summary available.</p>
                )}
              </div>

              {candidate.sourceReferences.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sources / provenance</p>
                    <div className="flex flex-col gap-1">
                      {candidate.sourceReferences.map((ref) => (
                        <a key={ref} href={ref} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                          {ref}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {candidate.ariyaAssessment && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ariya assessment</p>
                    <p className="text-sm font-medium">Likely {RELATIONSHIP_LABEL[candidate.ariyaAssessment]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Assessment is advisory — it does not set your Direct/Indirect classification.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
