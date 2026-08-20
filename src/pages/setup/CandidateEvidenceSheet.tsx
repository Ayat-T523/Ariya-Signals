import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../components/shadcn/ui/sheet'
import { Badge } from '../../components/shadcn/ui/badge'
import { Separator } from '../../components/shadcn/ui/separator'
import type { CandidateEntry } from '../../config/setup-draft'

const RELATIONSHIP_LABEL: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', unclear: 'Unclear' }

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  presentable_candidate: 'Presentable candidate',
  needs_more_evidence: 'Needs more evidence',
  evidence_conflict: 'Evidence conflict',
  not_presentable_for_target: 'Not presentable for target',
}

/**
 * CandidateEvidenceSheet.tsx — Stage 2.6. Only renders fields genuinely
 * present on the candidate object -- no fabricated evidence. A discovered
 * candidate's `discovered` field (the real backend DiscoveredCandidate, see
 * setup-draft.ts's discoveredCandidateToEntry) supplies candidate status,
 * evidence gaps, unresolved questions, and verified domains; a manual
 * candidate has none of that and shows only its own plain identity fields.
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{candidate.source === 'discovered' ? 'Discovered by Ariya' : 'Added manually'}</Badge>
                {candidate.discovered && (
                  <Badge variant={candidate.discovered.candidateStatus === 'presentable_candidate' ? 'default' : 'secondary'}>
                    {CANDIDATE_STATUS_LABEL[candidate.discovered.candidateStatus] ?? candidate.discovered.candidateStatus}
                  </Badge>
                )}
              </div>

              {candidate.discovered?.organizationName && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Organization</p>
                  <p className="text-sm">
                    {candidate.discovered.organizationName}
                    {candidate.discovered.organizationSourceStatus === 'verified_official_company_source' && ' · verified source'}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {candidate.discovered ? 'Rationale' : 'Evidence'}
                </p>
                {candidate.evidenceStatus === 'not_evaluated' ? (
                  <p className="text-sm text-muted-foreground">Evidence not yet evaluated.</p>
                ) : candidate.evidenceSummary ? (
                  <p className="text-sm">{candidate.evidenceSummary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No evidence summary available.</p>
                )}
              </div>

              {candidate.discovered && candidate.discovered.evidenceGaps.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Evidence gaps</p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.discovered.evidenceGaps.map((gap) => (
                      <Badge key={gap} variant="outline">{gap.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {candidate.discovered && candidate.discovered.reasonDetail.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reason detail</p>
                  <ul className="ml-4 list-disc text-sm text-muted-foreground">
                    {candidate.discovered.reasonDetail.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}

              {candidate.discovered && candidate.discovered.unresolvedQuestions.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Unresolved questions</p>
                  <ul className="ml-4 list-disc text-sm text-muted-foreground">
                    {candidate.discovered.unresolvedQuestions.map((q) => <li key={q}>{q}</li>)}
                  </ul>
                </div>
              )}

              {candidate.discovered && candidate.discovered.verifiedDomains.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Verified domains</p>
                  <p className="text-sm text-muted-foreground">{candidate.discovered.verifiedDomains.join(', ')}</p>
                </div>
              )}

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
