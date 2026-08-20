import { useEffect, useState } from 'react'
import { getTherapeuticAreaById, getDiseaseAreaById } from '../../config/therapeutic-areas'
import {
  type SetupDraft,
  type CandidateEntry,
  resolveHomeAssetDisplay,
  addManualCandidate,
} from '../../config/setup-draft'
import { discoverCompetitors } from '../../lib/api/discoveryAdapter'
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

type DiscoveryPhase = 'idle' | 'loading' | 'unavailable'

/**
 * Stage2Discover.tsx — "Find competitors". Discovery is NOT connected yet
 * (see src/lib/api/discoveryAdapter.ts) -- this stage always reaches the
 * explicit "not connected" state, never fake/static candidates. Manual
 * competitor addition works fully so the whole flow is exercisable now.
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
  const [phase, setPhase] = useState<DiscoveryPhase>('idle')
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [reviewing, setReviewing] = useState<CandidateEntry | null>(null)

  const therapeuticArea = draft.landscapeConfiguration.therapeuticAreaId
    ? getTherapeuticAreaById(draft.landscapeConfiguration.therapeuticAreaId)
    : undefined
  const diseaseArea = draft.landscapeConfiguration.diseaseAreaId
    ? getDiseaseAreaById(draft.landscapeConfiguration.diseaseAreaId)
    : undefined
  const homeAsset = resolveHomeAssetDisplay(draft)

  function runDiscovery() {
    if (!diseaseArea || !homeAsset) return
    setPhase('loading')
    discoverCompetitors({ homeAssetDisplayName: homeAsset.displayName, diseaseAreaName: diseaseArea.name }).then((outcome) => {
      if (outcome.status === 'success') {
        onChange({ ...draft, candidates: [...outcome.candidates, ...draft.candidates.filter((c) => c.source === 'manual')] })
        setPhase('idle')
      } else {
        setPhase('unavailable')
      }
    })
  }

  // Attempt discovery once per stage visit -- never silently, never repeatedly
  // on every render. Skipped when resuming a draft that already has
  // candidates (manual entries from a prior visit) -- a resumed "unavailable"
  // re-check must never hide what the user already added.
  useEffect(() => {
    if (draft.candidates.length === 0) runDiscovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasCandidates = draft.candidates.length > 0

  const filtered = draft.candidates.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return c.displayName.toLowerCase().includes(q) || (c.companyName ?? '').toLowerCase().includes(q)
  })

  // Adding a competitor manually always surfaces the candidate list -- an
  // "unavailable" discovery phase must never hide a manually added entry.
  function handleAddManualCandidate(input: { companyName: string; assetName: string | null; innName: string | null }) {
    onChange(addManualCandidate(draft, input))
    setPhase('idle')
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

      {/* ── Stage 2.3 loading ── */}
      {phase === 'loading' && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Spinner className="size-5" /></EmptyMedia>
            <EmptyTitle>Ariya is analysing the competitive landscape</EmptyTitle>
            <EmptyDescription>Searching companies and assets · Evaluating evidence · Building candidate landscape</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* ── Stage 2.4 not-connected state -- only blocks the whole stage while there's nothing else to show ── */}
      {phase === 'unavailable' && !hasCandidates && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><PlugZapIcon className="size-4" /></EmptyMedia>
            <EmptyTitle>Competitor discovery isn't connected yet</EmptyTitle>
            <EmptyDescription>
              You can add known competitors manually, or retry once the Ariya discovery service is available.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button variant="outline" onClick={runDiscovery}>Retry</Button>
              <Button onClick={() => setAddOpen(true)}><PlusIcon /> Add competitor</Button>
            </div>
          </EmptyContent>
        </Empty>
      )}

      {/* ── Stage 2.5 candidate list (Stage 2.9 search) -- shown whenever there's anything to show, independent of discovery phase ── */}
      {phase !== 'loading' && hasCandidates && (
        <div className="flex flex-col gap-3">
          {phase === 'unavailable' && (
            <p className="text-xs text-muted-foreground">Discovery isn't connected yet — showing manually added competitors.</p>
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
                      ) : candidate.evidenceStatus === 'evidence_available' ? (
                        <>Evidence available{candidate.ariyaAssessment ? ` · Ariya assessment: Likely ${candidate.ariyaAssessment}` : ''}</>
                      ) : (
                        <>Evidence not yet evaluated</>
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
      {phase === 'idle' && !hasCandidates && (
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
