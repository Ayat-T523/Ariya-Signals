import { useEffect, useRef, useState } from 'react'
import { getTherapeuticAreaById, getDiseaseAreaById } from '../../config/therapeutic-areas'
import {
  type SetupDraft,
  type CompanyEntry,
  resolveHomeAssetDisplay,
  addManualCompany,
  setSuggestedCompanies,
  toggleCompanySelection,
  isCompanySelected,
  isHomeCompany,
} from '../../config/setup-draft'
import { useDiscovery } from '../../hooks/useDiscovery'
import type { DiscoveryResult } from '../../lib/api/discovery'
import { Button } from '../../components/shadcn/ui/button'
import { Badge } from '../../components/shadcn/ui/badge'
import { Checkbox } from '../../components/shadcn/ui/checkbox'
import { Separator } from '../../components/shadcn/ui/separator'
import { Input } from '../../components/shadcn/ui/input'
import { Spinner } from '../../components/shadcn/ui/spinner'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from '../../components/shadcn/ui/empty'
import { Item, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemMedia, ItemGroup } from '../../components/shadcn/ui/item'
import { PlugZapIcon, PlusIcon, SearchIcon } from 'lucide-react'
import AddCompetitorDialog from './AddCompetitorDialog'
import CompanyEvidenceSheet from './CompanyEvidenceSheet'

const RELATIONSHIP_LABEL: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', unclear: 'Unclear' }

/**
 * Stage2Discover.tsx — "Find + select competitors" (Phase 15/16). Calls the
 * REAL discovery client (useDiscovery()/src/lib/api/discovery.ts) directly.
 * The unit rendered here is always a COMPANY (SuggestedCompanySuggestion),
 * never a raw candidate or a bare asset -- see setup-draft.ts's
 * suggestedCompanyToEntry, the one place that shape conversion happens.
 *
 * Selection happens HERE (Checkbox, Phase 16/20) -- Stage 3 only classifies
 * what was already selected. `needs_more_evidence` is never the dominant
 * visible text (Phase 17): a card leads with company name, relevant assets,
 * why Ariya suggested it, and its advisory assessment; candidate-status is
 * only a small badge inside "Review evidence".
 */
export default function Stage2Discover({
  draft,
  onChange,
  onBack,
  onContinue,
}: {
  draft: SetupDraft
  onChange: (draft: SetupDraft) => void
  onBack: () => void
  onContinue: () => void
}) {
  const { state, run } = useDiscovery()
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [reviewing, setReviewing] = useState<CompanyEntry | null>(null)
  const lastMergedResultRef = useRef<DiscoveryResult | null>(null)

  const therapeuticArea = draft.landscapeConfiguration.therapeuticAreaId
    ? getTherapeuticAreaById(draft.landscapeConfiguration.therapeuticAreaId)
    : undefined
  const diseaseArea = draft.landscapeConfiguration.diseaseAreaId
    ? getDiseaseAreaById(draft.landscapeConfiguration.diseaseAreaId)
    : undefined
  const homeAsset = resolveHomeAssetDisplay(draft)

  function runDiscovery() {
    if (!diseaseArea || !homeAsset) return
    // Home company travels with the request (Phase 3/6) so the backend can
    // deterministically exclude it -- never resolved by asking an AI model
    // whether the home company competes with itself.
    run({ homeAsset: homeAsset.displayName, indication: diseaseArea.name, homeCompany: homeAsset.companyName })
  }

  // Attempt discovery once per stage visit -- skipped when resuming a draft
  // that already has companies (manual entries from a prior visit).
  useEffect(() => {
    if (draft.companies.length === 0) runDiscovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Merge a genuinely new discovery result into the draft exactly once --
  // guarded by object identity so this never loops.
  useEffect(() => {
    if (
      (state.status === 'success' || state.status === 'empty') &&
      state.result !== lastMergedResultRef.current
    ) {
      lastMergedResultRef.current = state.result
      onChange(setSuggestedCompanies(draft, state.result.suggestedCompanies))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const hasCompanies = draft.companies.length > 0

  const filtered = draft.companies.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    if (c.companyName.toLowerCase().includes(q)) return true
    return c.relevantAssets.some((a) => a.identityKey.toLowerCase().includes(q))
  })

  function handleAddManualCompany(input: { companyName: string; assetName: string | null; innName: string | null }) {
    onChange(addManualCompany(draft, input))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Stage 2.1 summary header ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
        <Badge variant="secondary">{therapeuticArea?.name ?? '—'}</Badge>
        <span className="text-muted-foreground">/</span>
        <Badge variant="secondary">{diseaseArea?.name ?? '—'}</Badge>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-xs text-muted-foreground">Home asset</span>
        <Badge>{homeAsset?.displayName ?? '—'}</Badge>
        {homeAsset?.innName && <span className="text-xs text-muted-foreground italic">{homeAsset.innName}</span>}
        {homeAsset?.companyName && <span className="text-xs text-muted-foreground">· {homeAsset.companyName}</span>}
      </div>

      {/* ── Loading ── */}
      {state.status === 'loading' && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Spinner className="size-5" /></EmptyMedia>
            <EmptyTitle>Ariya is analysing the competitive landscape</EmptyTitle>
            <EmptyDescription>Searching companies and assets · Evaluating evidence · Resolving competitor companies</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* ── Error/unavailable -- only blocks the whole stage while there's nothing else to show ── */}
      {state.status === 'error' && !hasCompanies && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><PlugZapIcon className="size-4" /></EmptyMedia>
            <EmptyTitle>Competitor discovery is currently unavailable</EmptyTitle>
            <EmptyDescription>{state.message}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button variant="outline" onClick={runDiscovery}>Retry</Button>
              <Button onClick={() => setAddOpen(true)}><PlusIcon /> Add competitor</Button>
            </div>
          </EmptyContent>
        </Empty>
      )}

      {/* ── Company list (search) -- shown whenever there's anything to show, independent of discovery phase ── */}
      {state.status !== 'loading' && hasCompanies && (
        <div className="flex flex-col gap-3">
          {state.status === 'error' && (
            <p className="text-xs text-muted-foreground">Discovery is currently unavailable — showing manually added competitors.</p>
          )}
          <div className="flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies…"
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={() => setAddOpen(true)} className="ml-auto">
              <PlusIcon /> Add competitor manually
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No companies match "{query}".</p>
          ) : (
            <ItemGroup>
              {filtered.map((company) => {
                const selected = isCompanySelected(draft, company.id)
                return (
                  <Item key={company.id} variant={selected ? 'outline' : 'muted'}>
                    <ItemMedia>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onChange(toggleCompanySelection(draft, company.id))}
                        aria-label={`Select ${company.companyName}`}
                      />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{company.companyName}</ItemTitle>
                      <ItemDescription>
                        {company.relevantAssets.length > 0
                          ? company.relevantAssets.map((a) => a.identityKey).join(', ')
                          : company.source === 'manual' ? 'No specific asset recorded' : 'Relevant asset not identified'}
                      </ItemDescription>
                      {company.whySuggested && (
                        <p className="mt-1 text-xs text-muted-foreground">{company.whySuggested}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {company.source === 'manual' ? (
                          <Badge variant="outline" className="text-xs">Added manually</Badge>
                        ) : company.ariyaAssessment ? (
                          <Badge variant="outline" className="text-xs">Ariya assessment: Likely {RELATIONSHIP_LABEL[company.ariyaAssessment]}</Badge>
                        ) : null}
                      </div>
                    </ItemContent>
                    <ItemActions>
                      <Button variant="ghost" size="sm" onClick={() => setReviewing(company)}>Review evidence →</Button>
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          )}
        </div>
      )}

      {/* No companies at all yet, but discovery hasn't failed */}
      {state.status === 'idle' && !hasCompanies && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No competitor companies yet</EmptyTitle>
            <EmptyDescription>Add a known competitor company manually to continue.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAddOpen(true)}><PlusIcon /> Add competitor</Button>
          </EmptyContent>
        </Empty>
      )}

      {(state.status === 'success' || state.status === 'empty') && hasCompanies && draft.companies.every((c) => c.source === 'manual') && (
        <p className="text-xs text-muted-foreground">Ariya didn't surface any additional companies for this landscape — showing manually added competitors.</p>
      )}

      <AddCompetitorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={handleAddManualCompany}
        isHomeCompany={(companyName) => isHomeCompany(draft, companyName)}
      />
      <CompanyEvidenceSheet company={reviewing} open={!!reviewing} onOpenChange={(open) => { if (!open) setReviewing(null) }} />

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onContinue} disabled={draft.selections.length === 0}>Continue</Button>
      </div>
    </div>
  )
}
