import { useEffect, useRef, useState } from 'react'
import { getTherapeuticAreaById, getDiseaseAreaById } from '../../config/therapeutic-areas'
import {
  type SetupDraft,
  type CandidateEntry,
  resolveHomeAssetDisplay,
  addManualCandidate,
  setDiscoveredCandidates,
} from '../../config/setup-draft'
import { useDiscovery } from '../../hooks/useDiscovery'
import type { DiscoveryResult } from '../../lib/api/discovery'
import { Button } from '../../components/shadcn/ui/button'
import { Badge } from '../../components/shadcn/ui/badge'
import { Separator } from '../../components/shadcn/ui/separator'
import { Input } from '../../components/shadcn/ui/input'
import { Spinner } from '../../components/shadcn/ui/spinner'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from '../../components/shadcn/ui/empty'
import { Item, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemGroup } from '../../components/shadcn/ui/item'
import { PlugZapIcon, PlusIcon, SearchIcon } from 'lucide-react'
import AddCompetitorDialog from './AddCompetitorDialog'
import CandidateEvidenceSheet from './CandidateEvidenceSheet'

/**
 * Stage2Discover.tsx — "Find competitors". Calls the REAL discovery client
 * (useDiscovery()/src/lib/api/discovery.ts, from commit b45033c) directly --
 * there is no separate "setup discovery adapter" anymore (see this
 * migration's own checkpoint, section I, for why the temporary
 * discoveryAdapter.ts was removed rather than kept as a second discovery
 * architecture). idle/loading/success/empty/error all come straight from
 * useDiscovery()'s own state machine. An unreachable/erroring backend never
 * falls back to suggestedCompetitors, discovered-candidates.json, or any
 * static HAE list -- manual competitor addition remains the only fallback.
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
  const [reviewing, setReviewing] = useState<CandidateEntry | null>(null)
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
    // Manual asset identity and Disease Area's own canonical name -- the
    // exact same request mapping /competitors/discover already uses. No
    // Therapeutic Area is sent: the backend has no such concept (see
    // discovery.ts's own DiscoveryRequest docstring).
    run({ homeAsset: homeAsset.displayName, indication: diseaseArea.name })
  }

  // Attempt discovery once per stage visit -- never silently, never
  // repeatedly on every render. Skipped when resuming a draft that already
  // has candidates (manual entries from a prior visit) -- a resumed error
  // re-check must never hide what the user already added.
  useEffect(() => {
    if (draft.candidates.length === 0) runDiscovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Merge a genuinely new discovery result into the draft exactly once --
  // guarded by object identity so this never loops (state.result only
  // changes reference when useDiscovery() completes a fresh request).
  useEffect(() => {
    if (
      (state.status === 'success' || state.status === 'empty') &&
      state.result !== lastMergedResultRef.current
    ) {
      lastMergedResultRef.current = state.result
      onChange(setDiscoveredCandidates(draft, state.result.candidates))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const hasCandidates = draft.candidates.length > 0

  const filtered = draft.candidates.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return c.displayName.toLowerCase().includes(q) || (c.companyName ?? '').toLowerCase().includes(q)
  })

  // Adding a competitor manually always surfaces the candidate list -- an
  // error/loading discovery phase must never hide a manually added entry.
  function handleAddManualCandidate(input: { companyName: string; assetName: string | null; innName: string | null }) {
    onChange(addManualCandidate(draft, input))
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
        {homeAsset?.company && <span className="text-xs text-muted-foreground">· {homeAsset.company}</span>}
      </div>

      {/* ── Loading ── */}
      {state.status === 'loading' && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Spinner className="size-5" /></EmptyMedia>
            <EmptyTitle>Ariya is analysing the competitive landscape</EmptyTitle>
            <EmptyDescription>Searching companies and assets · Evaluating evidence · Building candidate landscape</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* ── Error/unavailable -- only blocks the whole stage while there's nothing else to show ── */}
      {state.status === 'error' && !hasCandidates && (
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

      {/* ── Candidate list (search) -- shown whenever there's anything to show, independent of discovery phase ── */}
      {state.status !== 'loading' && hasCandidates && (
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
                placeholder="Search candidates…"
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={() => setAddOpen(true)} className="ml-auto">
              <PlusIcon /> Add competitor manually
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No candidates match "{query}".</p>
          ) : (
            <ItemGroup>
              {filtered.map((candidate) => (
                <Item key={candidate.id} variant="outline">
                  <ItemContent>
                    <ItemTitle>
                      {candidate.companyName && candidate.companyName !== candidate.displayName
                        ? `${candidate.companyName} — ${candidate.displayName}`
                        : candidate.displayName}
                    </ItemTitle>
                    <ItemDescription>
                      {candidate.source === 'manual' ? (
                        <>Added manually · Evidence not yet evaluated</>
                      ) : (
                        <>
                          {candidate.discovered?.candidateStatus.replace(/_/g, ' ') ?? 'Evidence available'}
                          {candidate.ariyaAssessment ? ` · Ariya assessment: Likely ${candidate.ariyaAssessment}` : ''}
                        </>
                      )}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button variant="ghost" size="sm" onClick={() => setReviewing(candidate)}>Review →</Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>
      )}

      {/* No candidates at all yet, but discovery hasn't failed (e.g. a fresh idle state with nothing added) */}
      {state.status === 'idle' && !hasCandidates && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No competitors yet</EmptyTitle>
            <EmptyDescription>Add a known competitor manually to continue.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAddOpen(true)}><PlusIcon /> Add competitor</Button>
          </EmptyContent>
        </Empty>
      )}

      <AddCompetitorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={handleAddManualCandidate}
      />
      <CandidateEvidenceSheet candidate={reviewing} open={!!reviewing} onOpenChange={(open) => { if (!open) setReviewing(null) }} />

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </div>
  )
}
