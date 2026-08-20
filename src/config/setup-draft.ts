/**
 * setup-draft.ts — staged landscape setup draft model.
 *
 * Pure (no React, no network) so it's testable in isolation -- see
 * setup-draft.test.ts. SetupPage.tsx wires it into state/persistence.
 *
 * Three distinct concepts, kept distinct on purpose:
 *   LandscapeConfiguration  -- what market/home asset is being analysed
 *                               (src/config/landscape-configuration.ts, unchanged)
 *   SetupDraft               -- THIS module: in-progress setup state (manual
 *                               asset identity, candidates, selections) --
 *                               discarded once setup completes
 *   TrackedCompetitor        -- the final, persisted user landscape (see
 *                               AppContext.tsx) -- what setup PRODUCES
 *
 * A manually-added asset/competitor is never pretended to be a fully
 * resolved catalog AssetConfig or a rich static Competitor -- both carry an
 * explicit `source` field and only the fields a user can actually supply.
 */
import {
  type LandscapeConfiguration,
  EMPTY_LANDSCAPE_CONFIGURATION,
  applyTherapeuticAreaSelection,
  applyDiseaseAreaSelection,
  isLandscapeConfigurationConsistent,
} from './landscape-configuration'
import { getAssetById, type AssetConfig } from './assets-config'
import type { DiscoveredCandidate } from '../lib/api/discovery'

export type SetupStage = 'define' | 'discover' | 'configure'

export type CandidateSource = 'discovered' | 'manual'
export type UserRelationship = 'direct' | 'indirect'
/** Ariya's own advisory read -- never a user classification. */
export type AdvisoryRelationship = 'direct' | 'indirect' | 'unclear'

export interface ManualAssetIdentity {
  source: 'manual'
  id: string
  displayName: string
  innName: string | null
  company: string | null
  diseaseAreaId: string
  therapeuticAreaId: string
}

export interface CandidateEntry {
  id: string
  source: CandidateSource
  displayName: string
  companyName: string | null
  innName: string | null
  /** Advisory only -- null for every manual candidate, never fabricated for a discovered one. */
  ariyaAssessment: AdvisoryRelationship | null
  evidenceStatus: 'not_evaluated' | 'evidence_available'
  evidenceSummary: string | null
  sourceReferences: string[]
  /**
   * The full real backend record for a discovered candidate -- candidate
   * status, evidence gaps, unresolved questions, verified domains,
   * provenance, etc. undefined for manual candidates (there is no backend
   * record) and never fabricated. CandidateEvidenceSheet reads this for the
   * richer detail view; the fields above stay the simple, always-present
   * shape the candidate list itself renders.
   */
  discovered?: DiscoveredCandidate
}

export interface SelectedCompetitorDraft {
  candidateId: string
  /** null = explicitly selected but not yet classified -- never defaulted from ariyaAssessment. */
  userRelationship: UserRelationship | null
}

export interface SetupDraft {
  stage: SetupStage
  landscapeConfiguration: LandscapeConfiguration
  manualAsset: ManualAssetIdentity | null
  candidates: CandidateEntry[]
  selections: SelectedCompetitorDraft[]
}

export function createEmptySetupDraft(landscapeConfiguration?: LandscapeConfiguration): SetupDraft {
  return {
    stage: 'define',
    landscapeConfiguration: landscapeConfiguration ?? { ...EMPTY_LANDSCAPE_CONFIGURATION },
    manualAsset: null,
    candidates: [],
    selections: [],
  }
}

/** Stable local id -- not a synthesized "authoritative" identity, just enough to key React lists and localStorage. */
export function createLocalId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

// ── Stage 1: landscape + home asset ─────────────────────────────────────────

export function selectTherapeuticArea(draft: SetupDraft, therapeuticAreaId: string): SetupDraft {
  const nextConfig = applyTherapeuticAreaSelection(draft.landscapeConfiguration, therapeuticAreaId)
  if (nextConfig === draft.landscapeConfiguration) return draft
  return { ...draft, landscapeConfiguration: nextConfig, manualAsset: null }
}

export function selectDiseaseArea(draft: SetupDraft, diseaseAreaId: string): SetupDraft {
  const nextConfig = applyDiseaseAreaSelection(draft.landscapeConfiguration, diseaseAreaId)
  if (nextConfig === draft.landscapeConfiguration) return draft
  return { ...draft, landscapeConfiguration: nextConfig, manualAsset: null }
}

/** Selecting a catalogued Home Asset -- refuses silently if it doesn't belong to the selected Disease Area, same discipline as applyHomeAssetSelection. */
export function selectKnownHomeAsset(draft: SetupDraft, assetId: string): SetupDraft {
  const asset = getAssetById(assetId)
  if (!asset || asset.diseaseAreaId !== draft.landscapeConfiguration.diseaseAreaId) return draft
  return {
    ...draft,
    landscapeConfiguration: { ...draft.landscapeConfiguration, homeAssetId: assetId },
    manualAsset: null,
  }
}

/** A manually entered asset is explicitly attached to the CURRENTLY selected TA/DA -- never guessed. Refuses if TA/DA aren't both selected yet. */
export function attachManualHomeAsset(
  draft: SetupDraft,
  input: { displayName: string; innName?: string | null; company?: string | null },
): SetupDraft {
  const { therapeuticAreaId, diseaseAreaId } = draft.landscapeConfiguration
  if (!therapeuticAreaId || !diseaseAreaId || !input.displayName.trim()) return draft

  const manualAsset: ManualAssetIdentity = {
    source: 'manual',
    id: createLocalId('manual-asset'),
    displayName: input.displayName.trim(),
    innName: input.innName?.trim() || null,
    company: input.company?.trim() || null,
    diseaseAreaId,
    therapeuticAreaId,
  }
  return {
    ...draft,
    manualAsset,
    landscapeConfiguration: { ...draft.landscapeConfiguration, homeAssetId: manualAsset.id },
  }
}

/** Resolves the Home Asset identity for display, whichever source it came from. Null when nothing is selected yet. */
export function resolveHomeAssetDisplay(draft: SetupDraft): { displayName: string; innName: string | null; company: string | null } | null {
  if (draft.manualAsset && draft.manualAsset.id === draft.landscapeConfiguration.homeAssetId) {
    return { displayName: draft.manualAsset.displayName, innName: draft.manualAsset.innName, company: draft.manualAsset.company }
  }
  const asset: AssetConfig | undefined = draft.landscapeConfiguration.homeAssetId
    ? getAssetById(draft.landscapeConfiguration.homeAssetId)
    : undefined
  if (asset) return { displayName: asset.brandName, innName: asset.innName, company: null }
  return null
}

export function isStage1Valid(draft: SetupDraft): boolean {
  const { therapeuticAreaId, diseaseAreaId, homeAssetId } = draft.landscapeConfiguration
  if (!therapeuticAreaId || !diseaseAreaId || !homeAssetId) return false
  if (!isLandscapeConfigurationConsistent(draft.landscapeConfiguration)) return false
  // A manual asset must genuinely be attached to this exact draft's TA/DA -- never trusted merely because homeAssetId matches.
  if (draft.manualAsset) {
    return draft.manualAsset.id === homeAssetId
      && draft.manualAsset.diseaseAreaId === diseaseAreaId
      && draft.manualAsset.therapeuticAreaId === therapeuticAreaId
  }
  return !!getAssetById(homeAssetId)
}

// ── Stage 2: candidates (discovered + manual) ───────────────────────────────

export function addManualCandidate(
  draft: SetupDraft,
  input: { companyName: string; assetName?: string | null; innName?: string | null },
): SetupDraft {
  if (!input.companyName.trim()) return draft
  const candidate: CandidateEntry = {
    id: createLocalId('manual-candidate'),
    source: 'manual',
    displayName: input.assetName?.trim() || input.companyName.trim(),
    companyName: input.companyName.trim(),
    innName: input.innName?.trim() || null,
    ariyaAssessment: null,
    evidenceStatus: 'not_evaluated',
    evidenceSummary: null,
    sourceReferences: [],
  }
  return { ...draft, candidates: [...draft.candidates, candidate] }
}

/**
 * Maps a real backend DiscoveredCandidate (src/lib/api/discovery.ts) into
 * this module's CandidateEntry -- the one place that shape conversion
 * happens, so Stage2Discover.tsx never duplicates it. `identityKey` is
 * already a stable, deterministic identity (see discovery.ts's own docstring
 * on why it's a real name, not a synthesized id), reused directly as the
 * CandidateEntry id so re-running discovery doesn't fabricate new identities
 * for the same real candidate. evidenceStatus is 'evidence_available' for
 * every discovered candidate -- the backend evaluated it, regardless of how
 * strong the resulting candidate_status is; 'not_evaluated' is reserved for
 * genuinely manual, backend-untouched entries.
 */
export function discoveredCandidateToEntry(dc: DiscoveredCandidate): CandidateEntry {
  return {
    id: dc.identityKey,
    source: 'discovered',
    displayName: dc.identityKey,
    companyName: dc.organizationName,
    innName: null,
    ariyaAssessment: dc.aiProposedRelationship,
    evidenceStatus: 'evidence_available',
    evidenceSummary: dc.finalRationale,
    sourceReferences: dc.sourceReferences,
    discovered: dc,
  }
}

/**
 * Merges real discovery results into the draft. Never overwrites a manual
 * candidate -- but a manual entry whose company/asset name exactly matches
 * (case-insensitive, trimmed) a freshly discovered identity is dropped in
 * favor of the richer discovered record, rather than showing the same real
 * competitor twice. Deliberately exact-match only -- no fuzzy entity
 * resolution (a near-miss stays as two separate, honest entries rather than
 * a guessed merge).
 */
export function setDiscoveredCandidates(draft: SetupDraft, discovered: DiscoveredCandidate[]): SetupDraft {
  const discoveredEntries = discovered.map(discoveredCandidateToEntry)
  const discoveredNames = new Set(discoveredEntries.map((c) => c.displayName.trim().toLowerCase()))
  const manualOnly = draft.candidates.filter(
    (c) => c.source === 'manual' && !discoveredNames.has(c.displayName.trim().toLowerCase()),
  )
  return { ...draft, candidates: [...discoveredEntries, ...manualOnly] }
}

// ── Stage 3: selection + user classification ────────────────────────────────

export function toggleCandidateSelection(draft: SetupDraft, candidateId: string): SetupDraft {
  const exists = draft.selections.some((s) => s.candidateId === candidateId)
  const selections = exists
    ? draft.selections.filter((s) => s.candidateId !== candidateId)
    : [...draft.selections, { candidateId, userRelationship: null }]
  return { ...draft, selections }
}

export function isCandidateSelected(draft: SetupDraft, candidateId: string): boolean {
  return draft.selections.some((s) => s.candidateId === candidateId)
}

export function setCandidateRelationship(draft: SetupDraft, candidateId: string, relationship: UserRelationship): SetupDraft {
  return {
    ...draft,
    selections: draft.selections.map((s) => (s.candidateId === candidateId ? { ...s, userRelationship: relationship } : s)),
  }
}

export function isStage3Valid(draft: SetupDraft): boolean {
  if (draft.selections.length === 0) return false
  return draft.selections.every((s) => s.userRelationship !== null)
}

export function reviewCounts(draft: SetupDraft): { total: number; direct: number; indirect: number } {
  const direct = draft.selections.filter((s) => s.userRelationship === 'direct').length
  const indirect = draft.selections.filter((s) => s.userRelationship === 'indirect').length
  return { total: draft.selections.length, direct, indirect }
}

// ── Final output: TrackedCompetitor (Stage 3.7/3.8) ─────────────────────────
//
// Kept structurally separate from SetupDraft's own CandidateEntry/
// SelectedCompetitorDraft (provisional, in-progress) and from the legacy
// rich static Competitor type (src/data/competitors.json) -- a tracked
// competitor here only ever carries fields a user or Ariya's advisory read
// actually supplied, never a fabricated profile.

export interface TrackedCompetitor {
  id: string
  source: CandidateSource
  displayName: string
  companyName: string | null
  innName: string | null
  userRelationship: UserRelationship
  ariyaAssessment: AdvisoryRelationship | null
  evidenceStatus: 'not_evaluated' | 'evidence_available'
}

/** Only classified selections become tracked competitors -- isStage3Valid() is the real gate; this is just the projection. */
export function draftToTrackedCompetitors(draft: SetupDraft): TrackedCompetitor[] {
  const byId = new Map(draft.candidates.map((c) => [c.id, c]))
  const result: TrackedCompetitor[] = []
  for (const selection of draft.selections) {
    if (!selection.userRelationship) continue
    const candidate = byId.get(selection.candidateId)
    if (!candidate) continue
    result.push({
      id: candidate.id,
      source: candidate.source,
      displayName: candidate.displayName,
      companyName: candidate.companyName,
      innName: candidate.innName,
      userRelationship: selection.userRelationship,
      ariyaAssessment: candidate.ariyaAssessment,
      evidenceStatus: candidate.evidenceStatus,
    })
  }
  return result
}

// ── Cross-landscape staleness (NAV 2) ───────────────────────────────────────

/** True when the draft has Stage 2/3 data that a landscape change would strand. */
export function hasDownstreamData(draft: SetupDraft): boolean {
  return draft.candidates.length > 0 || draft.selections.length > 0
}

/** Clears everything downstream of Stage 1 -- used only after explicit user confirmation (NAV 2). */
export function clearDownstreamData(draft: SetupDraft): SetupDraft {
  return { ...draft, candidates: [], selections: [] }
}

// ── Persistence (NAV 3) ──────────────────────────────────────────────────────

export const SETUP_DRAFT_STORAGE_KEY = 'ariya-setup-draft'

export function saveSetupDraft(draft: SetupDraft): void {
  try {
    localStorage.setItem(SETUP_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch { /* best-effort */ }
}

export function loadSetupDraft(): SetupDraft | null {
  try {
    const raw = localStorage.getItem(SETUP_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SetupDraft
    if (!parsed || typeof parsed !== 'object' || !parsed.landscapeConfiguration) return null
    return parsed
  } catch { return null }
}

export function clearSetupDraft(): void {
  try { localStorage.removeItem(SETUP_DRAFT_STORAGE_KEY) } catch { /* noop */ }
}
