import { getTherapeuticAreaById, getDiseaseAreaById } from '../../config/therapeutic-areas'
import {
  type SetupDraft,
  type UserRelationship,
  resolveHomeAssetDisplay,
  setCompanyRelationship,
  isStage3Valid,
  reviewCounts,
} from '../../config/setup-draft'
import { Button } from '../../components/shadcn/ui/button'
import { Badge } from '../../components/shadcn/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '../../components/shadcn/ui/toggle-group'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn/ui/card'
import { Separator } from '../../components/shadcn/ui/separator'
import { Item, ItemContent, ItemTitle, ItemDescription, ItemGroup } from '../../components/shadcn/ui/item'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '../../components/shadcn/ui/empty'

const RELATIONSHIP_LABEL: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', unclear: 'Unclear' }

/**
 * Stage3Configure.tsx — "Classify + review" (Phase 15/20 fixed decision).
 * Selection already happened in Stage 2 -- this stage operates ONLY on
 * draft.selections (the companies the user already checked) and has no
 * Checkbox of its own. Ariya's advisory read ("Ariya assessment / Likely
 * Direct") and the user's own classification remain two separate, never-
 * merged concepts: Direct/Indirect always starts EMPTY here, never
 * defaulted from ariyaAssessment.
 */
export default function Stage3Configure({
  draft,
  onChange,
  onBack,
  onEnterAriya,
  onStartTour,
}: {
  draft: SetupDraft
  onChange: (draft: SetupDraft) => void
  onBack: () => void
  onEnterAriya: () => void
  onStartTour: () => void
}) {
  const therapeuticArea = draft.landscapeConfiguration.therapeuticAreaId
    ? getTherapeuticAreaById(draft.landscapeConfiguration.therapeuticAreaId)
    : undefined
  const diseaseArea = draft.landscapeConfiguration.diseaseAreaId
    ? getDiseaseAreaById(draft.landscapeConfiguration.diseaseAreaId)
    : undefined
  const homeAsset = resolveHomeAssetDisplay(draft)

  const valid = isStage3Valid(draft)
  const counts = reviewCounts(draft)
  const hasUnclassifiedSelection = draft.selections.some((s) => s.userRelationship === null)

  const byId = new Map(draft.companies.map((c) => [c.id, c]))
  const selectedCompanies = draft.selections
    .map((s) => ({ selection: s, company: byId.get(s.companyId) }))
    .filter((entry): entry is { selection: (typeof draft.selections)[number]; company: (typeof draft.companies)[number] } => !!entry.company)

  if (selectedCompanies.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No competitors selected yet</EmptyTitle>
            <EmptyDescription>Go back to Find + select competitors and choose at least one before continuing.</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <div className="flex justify-start pt-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ItemGroup>
        {selectedCompanies.map(({ selection, company }) => (
          <Item key={company.id} variant="outline">
            <ItemContent>
              <ItemTitle>{company.companyName}</ItemTitle>
              <ItemDescription>
                {company.relevantAssets.length > 0
                  ? company.relevantAssets.map((a) => a.identityKey).join(', ')
                  : company.source === 'manual' ? 'Added manually' : 'Relevant asset not identified'}
              </ItemDescription>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {company.ariyaAssessment
                  ? `Ariya assessment / Likely ${RELATIONSHIP_LABEL[company.ariyaAssessment]}`
                  : 'No Ariya assessment available'}
              </p>

              <div className="mt-2 flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Your classification *</p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={selection.userRelationship ?? undefined}
                  onValueChange={(value) => { if (value) onChange(setCompanyRelationship(draft, company.id, value as UserRelationship)) }}
                >
                  <ToggleGroupItem value="direct">Direct</ToggleGroupItem>
                  <ToggleGroupItem value="indirect">Indirect</ToggleGroupItem>
                </ToggleGroup>
                {!selection.userRelationship && (
                  <p className="text-xs text-destructive">Choose Direct or Indirect to include this competitor.</p>
                )}
              </div>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>

      {/* ── Stage 3.5 review summary ── */}
      <Card>
        <CardHeader>
          <CardTitle>Your landscape</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryField label="Therapeutic Area" value={therapeuticArea?.name ?? '—'} />
            <SummaryField label="Disease Area" value={diseaseArea?.name ?? '—'} />
            <SummaryField label="Home Asset" value={homeAsset?.displayName ?? '—'} />
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{counts.total} selected</Badge>
            {counts.direct > 0 && <Badge>{counts.direct} Direct</Badge>}
            {counts.indirect > 0 && <Badge variant="outline">{counts.indirect} Indirect</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 pt-2 sm:flex-row sm:items-center">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onStartTour}>Start tour</Button>
          <Button onClick={onEnterAriya} disabled={!valid}>Enter Ariya</Button>
        </div>
      </div>
      {!valid && hasUnclassifiedSelection && (
        <p className="text-right text-xs text-muted-foreground">Every selected competitor needs a Direct/Indirect classification.</p>
      )}
    </div>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
