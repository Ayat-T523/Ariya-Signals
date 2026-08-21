import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../components/shadcn/ui/sheet'
import { Badge } from '../../components/shadcn/ui/badge'
import { Separator } from '../../components/shadcn/ui/separator'
import type { CompanyEntry } from '../../config/setup-draft'

const RELATIONSHIP_LABEL: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', unclear: 'Unclear' }

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  presentable_candidate: 'Presentable candidate',
  needs_more_evidence: 'Needs more evidence',
  evidence_conflict: 'Evidence conflict',
  not_presentable_for_target: 'Not presentable for target',
}

/**
 * CompanyEvidenceSheet.tsx — Phase 18. Company is the top-level context;
 * relevant assets nest underneath it. Only renders fields genuinely present
 * -- no fabricated evidence. A manual competitor has no `whySuggested`/
 * `relevantAssets[].candidateStatus` (no backend record exists), so those
 * sections simply don't render for it.
 *
 * Viewport-safe: the Sheet primitive already spans full height
 * (data-[side=right]:h-full, inset-y-0) with a fixed-position overlay; the
 * body below is the only scrollable region, header stays put.
 */
export default function CompanyEvidenceSheet({
  company,
  open,
  onOpenChange,
}: {
  company: CompanyEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <SheetTitle>{company?.companyName ?? 'Company'}</SheetTitle>
          <SheetDescription>{company?.source === 'manual' ? 'Added manually' : 'Discovered by Ariya'}</SheetDescription>
        </SheetHeader>

        {company && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex flex-col gap-4">
              {company.whySuggested && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Why Ariya suggested this company</p>
                  <p className="text-sm">{company.whySuggested}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Relevant asset{company.relevantAssets.length !== 1 ? 's' : ''}
                </p>
                {company.relevantAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No specific asset recorded.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {company.relevantAssets.map((asset) => (
                      <div key={asset.identityKey} className="rounded-lg border p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{asset.identityKey}</p>
                          {asset.candidateStatus && (
                            <Badge variant={asset.candidateStatus === 'presentable_candidate' ? 'default' : 'outline'}>
                              {CANDIDATE_STATUS_LABEL[asset.candidateStatus] ?? asset.candidateStatus}
                            </Badge>
                          )}
                        </div>
                        {asset.detail && <p className="text-xs text-muted-foreground">{asset.detail}</p>}
                        {asset.evidenceGaps.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {asset.evidenceGaps.map((gap) => (
                              <Badge key={gap} variant="outline" className="text-xs">{gap.replace(/_/g, ' ')}</Badge>
                            ))}
                          </div>
                        )}
                        {asset.unresolvedQuestions.length > 0 && (
                          <ul className="mt-1.5 ml-4 list-disc text-xs text-muted-foreground">
                            {asset.unresolvedQuestions.map((q) => <li key={q}>{q}</li>)}
                          </ul>
                        )}
                        {asset.sourceReferences.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {asset.sourceReferences.map((ref) => (
                              <a key={ref} href={ref} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                                Source ↗
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {company.verifiedDomains.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Verified domains</p>
                    <p className="text-sm text-muted-foreground">{company.verifiedDomains.join(', ')}</p>
                  </div>
                </>
              )}

              {company.ariyaAssessment && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ariya assessment</p>
                    <p className="text-sm font-medium">Likely {RELATIONSHIP_LABEL[company.ariyaAssessment]}</p>
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
