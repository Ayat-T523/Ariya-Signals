import { useEffect, useRef, useState } from 'react'
import { getTherapeuticAreaById } from '../../config/therapeutic-areas'
import {
  type SetupDraft,
  type CompanyEntry,
  resolveHomeAssetDisplay,
  resolveDiseaseAreaDisplay,
  resolveCanonicalIndicationId,
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
import { PlugZapIcon, PlusIcon, SearchIcon, SearchXIcon } from 'lucide-react'
import AddCompetitorDialog from './AddCompetitorDialog'
import CompanyEvidenceSheet from './CompanyEvidenceSheet'

const RELATIONSHIP_LABEL: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', unclear: 'Unclear' }

const MAX_VISIBLE_ASSET_BADGES = 3

/**
 * Stage2Discover.tsx — "Find + select competitors" (Phase 15/16). Calls the
 * REAL discovery client (useDiscovery()/src/lib/api/discovery.ts) directly.
 * The unit rendered here is always a COMPANY (SuggestedCompanySuggestion),
 * never a raw candidate or a bare asset -- see setup-draft.ts's
 * suggestedCompanyToEntry, the one place that shape conversion happens.
 *
 * Selection happens HERE (Checkbox, Phase 16/20) -- Stage 3 only classifies
 * what was already selected. The persistent selection footer lives in
 * SetupPage.tsx (Root-Cause Recon implementation, Part D), not here --
 * this component only renders the company list and reserves bottom padding
 * (Part D2) so that fixed footer never covers the last row.
 *
 * Card hierarchy (Root-Cause Recon implementation, Part C): company name,
 * relevant assets as capped badges (never comma-joined prose), a concise
 * relevance signal ONLY when a genuinely non-redundant fact is available
 * (never filler text), Ariya's advisory assessment, evidence action. The
 * old `why_suggested` sentence is retired from this card entirely -- it
 * restates the same asset names the badges already show -- and remains
 * available only as evidence/diagnostic context in CompanyEvidenceSheet.
 */
export default function Stage2Discover({
  draft,
  onChange,
  onBack,
}: {
  draft: SetupDraft
  onChange: (draft: SetupDraft) => void
  onBack: () => void
}) {
  const { state, run } = useDiscovery()
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [reviewing, setReviewing] = useState<CompanyEntry | null>(null)
  const lastMergedResultRef = useRef<DiscoveryResult | null>(null)

  const therapeuticArea = draft.landscapeConfiguration.therapeuticAreaId
    ? getTherapeuticAreaById(draft.landscapeConfiguration.therapeuticAreaId)
    : undefined
  // Root-Cause Recon implementation, Part A: a Disease Area selected via
  // the new canonical search carries a MONDO id the OLD static catalog
  // (therapeutic-areas.ts's own DISEASE_AREAS) never has -- resolving via
  // resolveDiseaseAreaDisplay (manual/resolved/catalog, in that priority
  // order) is the same 3-tier lookup Stage1Define.tsx already uses, so
  // discovery keeps working regardless of which source the Disease Area
  // came from.
  const diseaseArea = resolveDiseaseAreaDisplay(draft)
  const homeAsset = resolveHomeAssetDisplay(draft)

  function runDiscovery() {
    if (!diseaseArea || !homeAsset) return
    // Home company travels with the request (Phase 3/6) so the backend can
    // deterministically exclude it -- never resolved by asking an AI model
    // whether the home company competes with itself.
    //
    // Canonical Disease Area identity regression fix: this is the PRIMARY,
    // mandatory onboarding discovery request (every user without a
    // completed setup is routed to /setup -> SetupPage -> here) -- it must
    // send the SAME canonical `indicationId` DiscoverCompetitors.tsx/
    // WarRoom.tsx/Portal.tsx already use, via the ONE shared
    // resolveCanonicalIndicationId() implementation, so durable evidence
    // persisted from a real onboarding run is actually findable later.
    // Read from `draft` directly (not useApp()) because this runs BEFORE
    // completeSetup() has persisted anything to AppContext -- draft's own
    // landscapeConfiguration.diseaseAreaId/resolvedDiseaseArea are the
    // exact same shape resolveCanonicalIndicationId() already expects.
    const canonicalIndicationId = resolveCanonicalIndicationId(draft.landscapeConfiguration.diseaseAreaId, draft.resolvedDiseaseArea)
    run({
      homeAsset: homeAsset.displayName, indication: diseaseArea.name, homeCompany: homeAsset.companyName,
      indicationId: canonicalIndicationId,
    })
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
    // Part D2: bottom padding reserved so the fixed selection footer
    // (SetupPage.tsx) never covers the last company row.
    <div className="flex flex-col gap-6 pb-24">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>← Back</Button>
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

      {/* ── Error/unavailable -- only blocks the whole stage while there's nothing else to show ──
          Targeted Implementation 5: Retry is the PRIMARY recovery action (default/filled variant,
          first), manual Add is the SECONDARY fallback (outline variant, second) -- previously
          reversed, which visually prioritized the manual fallback over recovering the real
          recommendation flow. */}
      {state.status === 'error' && !hasCompanies && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><PlugZapIcon className="size-4" /></EmptyMedia>
            <EmptyTitle>Competitor discovery is currently unavailable</EmptyTitle>
            <EmptyDescription>{state.message}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runDiscovery}>Retry</Button>
              <Button variant="outline" onClick={() => setAddOpen(true)}><PlusIcon /> Add competitor manually</Button>
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies…"
                className="pl-8"
              />
            </div>
            {/* Targeted Implementation 5: secondary (outline) fallback next to the
                primary results list -- Ariya's recommendations remain the dominant
                content; this never competes visually with them. */}
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
                const visibleAssets = company.relevantAssets.slice(0, MAX_VISIBLE_ASSET_BADGES)
                const overflowCount = company.relevantAssets.length - visibleAssets.length
                // Part C4: only a genuinely new, non-redundant fact -- never
                // filler restating what the badges/Ariya-assessment badge
                // already show. verifiedDomains is real evidence (STEP 9's
                // own official-source verification), not a guess.
                const verifiedIdentity = company.source !== 'manual' && company.verifiedDomains.length > 0
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
                      {visibleAssets.length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {visibleAssets.map((a) => (
                            <Badge key={a.identityKey} variant="secondary" className="text-xs font-normal">{a.identityKey}</Badge>
                          ))}
                          {overflowCount > 0 && (
                            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">+{overflowCount}</Badge>
                          )}
                        </div>
                      ) : (
                        <ItemDescription>
                          {company.source === 'manual' ? 'No specific asset recorded' : 'Relevant asset not identified'}
                        </ItemDescription>
                      )}
                      {verifiedIdentity && (
                        <p className="mt-1 text-xs text-muted-foreground">Verified company identity</p>
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

      {/* ── NOT YET ATTEMPTED -- Targeted Implementation 5 ──
          Discovery genuinely has not run/completed yet (distinct from EMPTY
          below, where it HAS completed and found nothing). Neutral wording
          only -- never implies a search already happened and found zero
          results. Auto-starts on mount (see the effect above), so this is
          normally a very brief flash; manual Add stays a secondary
          (outline) fallback here, never the dominant action. */}
      {state.status === 'idle' && !hasCompanies && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchIcon className="size-4" /></EmptyMedia>
            <EmptyTitle>Competitor discovery hasn't started yet</EmptyTitle>
            <EmptyDescription>Ariya will search for relevant competitor companies for this landscape.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => setAddOpen(true)}><PlusIcon /> Add competitor manually</Button>
          </EmptyContent>
        </Empty>
      )}

      {/* ── EMPTY -- Targeted Implementation 5 ──
          Discovery genuinely completed successfully with zero suggested
          companies (state.status === 'empty') and there are no manually
          added companies either -- previously this exact combination
          rendered NOTHING (a blank page): it matched none of idle/error/
          "has companies" branches. Distinct from NOT YET ATTEMPTED above --
          this explicitly communicates automatic discovery WAS attempted
          first. Manual Add is the appropriate primary action here (there is
          no competing Ariya recommendation list to stay secondary to). */}
      {state.status === 'empty' && !hasCompanies && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchXIcon className="size-4" /></EmptyMedia>
            <EmptyTitle>Ariya didn't find suitable competitor recommendations</EmptyTitle>
            <EmptyDescription>Automatic discovery completed for this landscape but found no companies to suggest. Add a known competitor manually to continue.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAddOpen(true)}><PlusIcon /> Add competitor manually</Button>
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
    </div>
  )
}
