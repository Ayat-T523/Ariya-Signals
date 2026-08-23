import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useConfig } from '../context/AppContext'
import { getTherapeuticAreaById } from '../config/therapeutic-areas'
import { getAssetById } from '../config/assets-config'
import { isLandscapeConfigurationSubmittable } from '../config/landscape-configuration'
import { resolveCanonicalIndicationId } from '../config/setup-draft'
import { useDiscovery } from '../hooks/useDiscovery'
import type { DiscoveredCandidate } from '../lib/api/discovery'
import { Button } from '../components/shadcn/ui/button'
import { Badge } from '../components/shadcn/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/shadcn/ui/card'
import { Input } from '../components/shadcn/ui/input'
import { Skeleton } from '../components/shadcn/ui/skeleton'
import EmptyState from '../components/ui/EmptyState'

/**
 * DiscoverCompetitors.tsx — "Discover competitors" (Frontend Step 4 of 7).
 *
 * Shows the configured landscape, then real backend discovery candidates via
 * POST /api/discovery/competitors (ariya-lightci-python's existing,
 * unmodified competitor discovery pipeline). Deliberately does NOT let the
 * user select/track a candidate or assign Direct/Indirect -- a candidate is
 * not a tracked competitor, and Ariya's own relationship assessment is
 * advisory only (labelled "Ariya assessment", never "Relationship"). See
 * this step's own PRODUCT AUTHORITY CONTRACT. User selection + Direct/
 * Indirect classification is Frontend Step 5's job, not this page's.
 *
 * No static suggestedCompetitors/discovered-candidates.json fallback exists
 * anywhere in this file -- an unavailable backend or an unsupported
 * (uncatalogued Home Asset) landscape both show an explicit state instead.
 */

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  presentable_candidate: 'Presentable candidate',
  needs_more_evidence: 'Needs more evidence',
  evidence_conflict: 'Evidence conflict',
  not_presentable_for_target: 'Not presentable for target',
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  direct: 'Direct',
  indirect: 'Indirect',
  unclear: 'Unclear',
}

function CandidateCard({ candidate }: { candidate: DiscoveredCandidate }) {
  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <CardTitle>{candidate.identityKey}</CardTitle>
          <Badge variant={candidate.candidateStatus === 'presentable_candidate' ? 'default' : 'outline'}>
            {CANDIDATE_STATUS_LABEL[candidate.candidateStatus] ?? candidate.candidateStatus}
          </Badge>
        </div>
        {candidate.organizationName && (
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--ink-600)' }}>
            {candidate.organizationName}
            {candidate.organizationSourceStatus === 'verified_official_company_source' && ' · verified source'}
          </p>
        )}
      </CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {candidate.aiProposedRelationship && (
          <div style={{ fontSize: '13px' }}>
            <span style={{ fontWeight: 700, color: 'var(--ink-600)' }}>Ariya assessment</span>
            {' / '}
            <span>Likely {RELATIONSHIP_LABEL[candidate.aiProposedRelationship] ?? candidate.aiProposedRelationship}</span>
          </div>
        )}
        {candidate.finalRationale && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-600)' }}>{candidate.finalRationale}</p>
        )}
        {candidate.evidenceGaps.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {candidate.evidenceGaps.map((gap) => (
              <Badge key={gap} variant="outline">{gap.replace(/_/g, ' ')}</Badge>
            ))}
          </div>
        )}
        {candidate.unresolvedQuestions.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--ink-600)' }}>
            {candidate.unresolvedQuestions.map((q) => <li key={q}>{q}</li>)}
          </ul>
        )}
        {candidate.sourceReferences.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
            {candidate.sourceReferences.map((ref) => (
              <a key={ref} href={ref} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600, #1a56db)' }}>
                Source ↗
              </a>
            ))}
          </div>
        )}
        {candidate.detail && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-600)', fontStyle: 'italic' }}>{candidate.detail}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function DiscoverCompetitors() {
  const { landscapeConfiguration, resolvedDiseaseArea } = useApp()
  // Targeted Implementation 2: resolves the SAME manual/MONDO/catalog
  // Disease Area source AppContext/AppSidebar already use (via
  // useConfig().diseaseAreaDisplay) instead of independently assuming
  // diseaseAreaId always belongs to the legacy static DISEASE_AREAS catalog
  // -- Recon 2's confirmed gap for this page.
  const { diseaseAreaDisplay } = useConfig()
  const { state, run, reset } = useDiscovery()
  const [query, setQuery] = useState('')

  const therapeuticArea = landscapeConfiguration.therapeuticAreaId
    ? getTherapeuticAreaById(landscapeConfiguration.therapeuticAreaId)
    : undefined
  const diseaseArea = diseaseAreaDisplay
  const homeAsset = landscapeConfiguration.homeAssetId
    ? getAssetById(landscapeConfiguration.homeAssetId)
    : undefined

  // The canonical Disease Area id (a real MONDO term), forwarded ADDITIVELY
  // for durable persistence identity only -- see DiscoveryRequest.indicationId's
  // own docstring. resolveCanonicalIndicationId() is the ONE shared
  // implementation WarRoom.tsx/Portal.tsx also call, so the write and read
  // sides can never independently drift onto different notions of "the id"
  // -- see that function's own docstring for why it reads `sourceId`, never
  // `resolvedDiseaseArea.id` itself.
  const canonicalIndicationId = resolveCanonicalIndicationId(landscapeConfiguration.diseaseAreaId, resolvedDiseaseArea)

  // "Unsupported configuration" per this step's own contract: the frontend
  // can only build a discovery request when it has a catalogued Home Asset
  // with a real brand name (e.g. gMG has a Disease Area entry but, today, no
  // AssetConfig entry for RYSTIGGO/ZILBRYSQ -- see therapeutic-areas.ts's own
  // GAP FLAGGED note). Never invented here.
  const isSupported = isLandscapeConfigurationSubmittable(landscapeConfiguration) && !!homeAsset && !!diseaseArea

  const candidates = state.status === 'success' || state.status === 'empty' ? state.result.candidates : []
  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) =>
      c.identityKey.toLowerCase().includes(q) || (c.organizationName ?? '').toLowerCase().includes(q)
    )
  }, [candidates, query])

  function handleDiscover() {
    if (!homeAsset || !diseaseArea) return
    run({ homeAsset: homeAsset.brandName, indication: diseaseArea.name, indicationId: canonicalIndicationId })
  }

  return (
    <div style={{ padding: '20px 36px 36px', maxWidth: '840px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Discover competitors</h1>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--ink-600)' }}>
        Real candidates from Ariya's competitor discovery pipeline. A candidate is not yet a tracked competitor.
      </p>

      {/* ── Configured landscape ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
        padding: '12px 14px', borderRadius: '10px', marginBottom: '20px',
        background: 'rgba(5,10,68,0.03)', border: '1px solid rgba(210,226,255,1)',
      }}>
        <Badge variant="secondary">{therapeuticArea?.name ?? 'Therapeutic Area not set'}</Badge>
        <span style={{ color: 'var(--ink-600)' }}>→</span>
        <Badge variant="secondary">{diseaseArea?.name ?? 'Disease Area not set'}</Badge>
        <span style={{ color: 'var(--ink-600)' }}>→</span>
        <Badge variant="secondary">{homeAsset?.brandName ?? 'Home Asset not set'}</Badge>
      </div>

      {!isSupported && (
        <EmptyState message="This landscape isn't configured for competitor discovery yet — no catalogued Home Asset is available for this Disease Area. Choose a different landscape from Settings." />
      )}

      {isSupported && state.status === 'idle' && (
        <Button onClick={handleDiscover}>Discover competitors</Button>
      )}

      {isSupported && state.status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: '96px', borderRadius: '12px' }} />)}
        </div>
      )}

      {isSupported && state.status === 'error' && (
        <div>
          <EmptyState message="Competitor discovery is currently unavailable." />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="outline" onClick={handleDiscover}>Retry</Button>
          </div>
        </div>
      )}

      {isSupported && state.status === 'empty' && (
        <div>
          <EmptyState message="No candidates found for this landscape yet." />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="outline" onClick={handleDiscover}>Run again</Button>
          </div>
        </div>
      )}

      {isSupported && (state.status === 'success' || state.status === 'empty') && candidates.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '10px', margin: '4px 0 16px' }}>
            <Input
              placeholder="Search candidates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: '320px' }}
            />
            <Button variant="ghost" onClick={reset}>Clear</Button>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--ink-600)' }}>
            Showing {filteredCandidates.length} of {candidates.length} candidates.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredCandidates.map((c) => <CandidateCard key={c.identityKey} candidate={c} />)}
          </div>
        </>
      )}

      <p style={{ marginTop: '28px' }}>
        <Link to="/competitors" style={{ fontSize: '13px', color: 'var(--ink-600)' }}>← Back to Competitors</Link>
      </p>
    </div>
  )
}
