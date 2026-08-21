/**
 * setup-draft.ts — staged landscape setup draft model (company-rooted).
 *
 * Pure (no React, no network) so it's testable in isolation -- see
 * setup-draft.test.ts. SetupPage.tsx wires it into state/persistence.
 *
 * PRODUCT CONTRACT (fixed decision): a competitor in Ariya is a COMPANY.
 * Assets and populations are supporting evidence for why a company is
 * relevant, never top-level competitors themselves. The backend's own
 * competitor_promotion.py already enforces this at the API boundary
 * (raw CT.gov intervention-name candidates -> company-rooted
 * SuggestedCompanySuggestion); this module carries that same shape through
 * the setup draft so the frontend never re-flattens it back into an
 * asset-rooted list.
 *
 * Four distinct concepts, kept distinct on purpose:
 *   LandscapeConfiguration  -- what market/home asset is being analysed
 *                               (src/config/landscape-configuration.ts, unchanged)
 *   SetupDraft               -- THIS module: in-progress setup state (manual
 *                               asset identity, company suggestions,
 *                               selection+classification) -- discarded once
 *                               setup completes
 *   CompanyEntry             -- one company-rooted suggestion or manual
 *                               competitor, with its relevant assets nested
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
  getAssetsForResolvedDiseaseArea,
} from './landscape-configuration'
import { getAssetById, type AssetConfig } from './assets-config'
import { getDiseaseAreaById } from './therapeutic-areas'
import type { SuggestedCompanySuggestion } from '../lib/api/discovery'
import type { ResolvedAssetIdentity } from '../lib/api/assetSearch'
import type { ResolvedDiseaseArea } from '../lib/api/diseaseSearch'

export type SetupStage = 'define' | 'discover' | 'configure'

export type CompanySource = 'discovered' | 'manual'
export type UserRelationship = 'direct' | 'indirect'
/** Ariya's own advisory read -- never a user classification. */
export type AdvisoryRelationship = 'direct' | 'indirect' | 'unclear'

export interface ManualAssetIdentity {
  source: 'manual'
  id: string
  displayName: string
  innName: string | null
  /** REQUIRED (Phase 6): without a resolved company, home-company exclusion cannot work -- see attachManualHomeAsset. */
  company: string
  diseaseAreaId: string
  therapeuticAreaId: string
  /** Optional user-supplied development code/alias (Landscape Input Resolution milestone, Step 23) -- preserved verbatim, never fabricated. */
  developmentCode: string | null
}

/**
 * A user-entered Disease Area for a category with no configured catalog
 * entry (Landscape Input Resolution milestone, Step 5/24). Minimal on
 * purpose -- no fabricated disease metadata, just the name and which
 * category it was added under.
 */
export interface ManualDiseaseArea {
  source: 'manual'
  id: string
  name: string
  therapeuticAreaId: string
}

export interface RelevantAssetEntry {
  identityKey: string
  candidateStatus: string | null
  evidenceGaps: string[]
  sourceReferences: string[]
  reasonDetail: string[]
  unresolvedQuestions: string[]
  detail: string | null
  /** Root-Cause Recon implementation, Part E4 -- the original CT.gov-declared sponsor (e.g. "Shire"), preserved only when the company's current identity (e.g. "Takeda") differs from it. Null otherwise -- never fabricated. */
  historicalOrganizationName: string | null
}

export interface CompanyEntry {
  /** Stable identity: the backend's own company_key for a discovered suggestion, or a local id for a manual competitor. */
  id: string
  source: CompanySource
  companyName: string
  relevantAssets: RelevantAssetEntry[]
  /** Advisory only -- null for every manual entry, never fabricated for a discovered one. */
  ariyaAssessment: AdvisoryRelationship | null
  evidenceStatus: 'not_evaluated' | 'evidence_available'
  evidenceRefs: string[]
  verifiedDomains: string[]
  /** Why Ariya suggested this company -- null for a manual entry (the user added it, not Ariya). */
  whySuggested: string | null
}

export interface SelectedCompanyDraft {
  companyId: string
  /** null = explicitly selected but not yet classified -- never defaulted from ariyaAssessment. */
  userRelationship: UserRelationship | null
}

export interface SetupDraft {
  stage: SetupStage
  landscapeConfiguration: LandscapeConfiguration
  manualAsset: ManualAssetIdentity | null
  /** A user-entered Disease Area (Step 5/24) -- mutually exclusive with a catalogued diseaseAreaId, same discipline as manualAsset/homeAssetId. */
  manualDiseaseArea: ManualDiseaseArea | null
  /** The Disease Area identity selected from Disease Area search (Root-Cause Recon implementation, Part A) -- backend-resolved (curated or live MONDO), distinct from both a catalog DiseaseArea match and a fully manual entry. */
  resolvedDiseaseArea: ResolvedDiseaseArea | null
  /** The asset identity selected from Home Asset search (Step 20/28) -- backend-resolved (known_catalog or clinicaltrials_gov), distinct from both a catalog AssetConfig match and a fully manual entry. */
  resolvedAsset: ResolvedAssetIdentity | null
  /**
   * A user-confirmed company for a KNOWN catalog asset OR a resolvedAsset
   * that has no owner company recorded (Phase 6 / Step 13's "honest data
   * gap" case -- distinct from a fully manual asset, which carries its own
   * `company` directly on ManualAssetIdentity). Cleared whenever the Home
   * Asset selection changes.
   */
  homeCompanyOverride: string | null
  companies: CompanyEntry[]
  selections: SelectedCompanyDraft[]
}

export function createEmptySetupDraft(landscapeConfiguration?: LandscapeConfiguration): SetupDraft {
  return {
    stage: 'define',
    landscapeConfiguration: landscapeConfiguration ?? { ...EMPTY_LANDSCAPE_CONFIGURATION },
    manualAsset: null,
    manualDiseaseArea: null,
    resolvedDiseaseArea: null,
    resolvedAsset: null,
    homeCompanyOverride: null,
    companies: [],
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
  return {
    ...draft, landscapeConfiguration: nextConfig,
    manualAsset: null, manualDiseaseArea: null, resolvedDiseaseArea: null, resolvedAsset: null, homeCompanyOverride: null,
  }
}

export function selectDiseaseArea(draft: SetupDraft, diseaseAreaId: string): SetupDraft {
  const nextConfig = applyDiseaseAreaSelection(draft.landscapeConfiguration, diseaseAreaId)
  if (nextConfig === draft.landscapeConfiguration) return draft
  return {
    ...draft, landscapeConfiguration: nextConfig,
    manualAsset: null, manualDiseaseArea: null, resolvedDiseaseArea: null, resolvedAsset: null, homeCompanyOverride: null,
  }
}

/**
 * A user-entered Disease Area for the CURRENTLY selected category (Step
 * 5/24) -- never a dead end when the catalog has nothing configured.
 * Refuses if no category is selected yet, or the name is blank.
 */
export function attachManualDiseaseArea(draft: SetupDraft, name: string): SetupDraft {
  const { therapeuticAreaId } = draft.landscapeConfiguration
  if (!therapeuticAreaId || !name.trim()) return draft
  const manualDiseaseArea: ManualDiseaseArea = {
    source: 'manual', id: createLocalId('manual-disease-area'), name: name.trim(), therapeuticAreaId,
  }
  return {
    ...draft,
    manualDiseaseArea,
    resolvedDiseaseArea: null,
    manualAsset: null, resolvedAsset: null, homeCompanyOverride: null,
    landscapeConfiguration: { ...draft.landscapeConfiguration, diseaseAreaId: manualDiseaseArea.id, homeAssetId: null },
  }
}

/**
 * Attaches a Disease Area search result (Root-Cause Recon implementation,
 * Part A4) -- the backend already did the real identity resolution
 * (curated or live MONDO); this just adopts it as the draft's Disease
 * Area, the same way selectDiseaseArea adopts a static catalog entry.
 * Clears any previously selected Home Asset -- a Disease Area change
 * invalidates whatever asset was selected under the old one.
 */
export function selectResolvedDiseaseArea(draft: SetupDraft, resolved: ResolvedDiseaseArea): SetupDraft {
  const { therapeuticAreaId } = draft.landscapeConfiguration
  if (!therapeuticAreaId) return draft
  return {
    ...draft,
    resolvedDiseaseArea: resolved,
    manualDiseaseArea: null,
    manualAsset: null, resolvedAsset: null, homeCompanyOverride: null,
    landscapeConfiguration: { ...draft.landscapeConfiguration, diseaseAreaId: resolved.id, homeAssetId: null },
  }
}

/** Clears the currently selected Disease Area (manual/resolved/catalog) so Stage 1 falls back to the search UI -- the "Change" action. Also clears the Home Asset, which can no longer be valid once the Disease Area changes. Never touches the category. */
export function clearDiseaseArea(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    manualDiseaseArea: null,
    resolvedDiseaseArea: null,
    manualAsset: null,
    resolvedAsset: null,
    homeCompanyOverride: null,
    landscapeConfiguration: { ...draft.landscapeConfiguration, diseaseAreaId: null, homeAssetId: null },
  }
}

/** Selecting a catalogued Home Asset -- refuses silently if it doesn't belong to the selected Disease Area, same discipline as applyHomeAssetSelection. */
export function selectKnownHomeAsset(draft: SetupDraft, assetId: string): SetupDraft {
  const asset = getAssetById(assetId)
  if (!asset) return draft
  // Root-Cause Recon implementation, Part A/B: an exact diseaseAreaId match
  // still works for the legacy short-id path, but a Disease Area selected
  // via the new canonical MONDO search carries an id ASSETS_CONFIG never
  // uses -- bridge via the same name/alias cross-reference
  // getAssetsForResolvedDiseaseArea() already uses for the search UI's own
  // "known assets" list, so a result that field legitimately offered can
  // actually be selected.
  const idMatches = asset.diseaseAreaId === draft.landscapeConfiguration.diseaseAreaId
  const display = resolveDiseaseAreaDisplay(draft)
  const nameMatches = !!display && getAssetsForResolvedDiseaseArea(display.name, display.aliases).some((a) => a.id === assetId)
  if (!idMatches && !nameMatches) return draft
  return {
    ...draft,
    landscapeConfiguration: { ...draft.landscapeConfiguration, homeAssetId: assetId },
    manualAsset: null,
    resolvedAsset: null,
    homeCompanyOverride: null,
  }
}

/** Confirms a company for the currently-selected asset when neither the catalog nor a resolvedAsset has one recorded (Phase 6 / Step 13). No-op for a manual asset (which carries its own required `company` already) or when nothing is selected. */
export function confirmHomeCompany(draft: SetupDraft, company: string): SetupDraft {
  if (!company.trim() || draft.manualAsset || !draft.landscapeConfiguration.homeAssetId) return draft
  return { ...draft, homeCompanyOverride: company.trim() }
}

/**
 * A manually entered asset is explicitly attached to the CURRENTLY selected
 * TA/DA -- never guessed. Company is REQUIRED (Phase 6): without it, Ariya
 * cannot reliably exclude the home company from its own competitor
 * suggestions later, so this refuses (returns `draft` unchanged) rather than
 * accept a company-less manual asset. Refuses if TA/DA aren't both selected
 * yet, or if displayName/company are blank.
 */
export function attachManualHomeAsset(
  draft: SetupDraft,
  input: { displayName: string; innName?: string | null; company: string; developmentCode?: string | null },
): SetupDraft {
  const { therapeuticAreaId, diseaseAreaId } = draft.landscapeConfiguration
  if (!therapeuticAreaId || !diseaseAreaId || !input.displayName.trim() || !input.company.trim()) return draft

  const manualAsset: ManualAssetIdentity = {
    source: 'manual',
    id: createLocalId('manual-asset'),
    displayName: input.displayName.trim(),
    innName: input.innName?.trim() || null,
    company: input.company.trim(),
    developmentCode: input.developmentCode?.trim() || null,
    diseaseAreaId,
    therapeuticAreaId,
  }
  return {
    ...draft,
    manualAsset,
    resolvedAsset: null,
    homeCompanyOverride: null,
    landscapeConfiguration: { ...draft.landscapeConfiguration, homeAssetId: manualAsset.id },
  }
}

/**
 * Attaches a Home Asset search result (Step 20/28) -- the backend already
 * did the real identity resolution (known_catalog or live CT.gov alias
 * convergence); this just adopts it as the draft's Home Asset, the same
 * way selectKnownHomeAsset adopts a static catalog entry.
 */
export function selectResolvedAsset(draft: SetupDraft, identity: ResolvedAssetIdentity): SetupDraft {
  return {
    ...draft,
    resolvedAsset: identity,
    manualAsset: null,
    homeCompanyOverride: null,
    landscapeConfiguration: { ...draft.landscapeConfiguration, homeAssetId: identity.id },
  }
}

/** Clears the currently selected Home Asset (manual/resolved/catalog) so Stage 1 falls back to the search UI -- the "Change" action. Never touches the Disease Area/category. */
export function clearHomeAsset(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    manualAsset: null,
    resolvedAsset: null,
    homeCompanyOverride: null,
    landscapeConfiguration: { ...draft.landscapeConfiguration, homeAssetId: null },
  }
}

export interface HomeAssetDisplay {
  displayName: string
  innName: string | null
  /** null only when the source has no recorded company yet -- a genuine, honest gap, never fabricated. See needsHomeCompanyConfirmation(). */
  companyName: string | null
  /** Populated only for a resolvedAsset (Step 21/25) -- undefined for a manual/catalog asset, never fabricated to fill the panel. */
  aliases?: string[]
  mechanismOfAction?: string[]
  indicationContexts?: string[]
}

/** Resolves the Home Asset identity for display, whichever source it came from. Null when nothing is selected yet. */
export function resolveHomeAssetDisplay(draft: SetupDraft): HomeAssetDisplay | null {
  if (draft.manualAsset && draft.manualAsset.id === draft.landscapeConfiguration.homeAssetId) {
    return { displayName: draft.manualAsset.displayName, innName: draft.manualAsset.innName, companyName: draft.manualAsset.company }
  }
  if (draft.resolvedAsset && draft.resolvedAsset.id === draft.landscapeConfiguration.homeAssetId) {
    const r = draft.resolvedAsset
    return {
      displayName: r.preferredName,
      innName: r.innNames[0] ?? null,
      companyName: r.ownerCompanies[0] ?? draft.homeCompanyOverride,
      aliases: r.aliases,
      mechanismOfAction: r.mechanismOfAction,
      indicationContexts: r.indicationContexts,
    }
  }
  const asset: AssetConfig | undefined = draft.landscapeConfiguration.homeAssetId
    ? getAssetById(draft.landscapeConfiguration.homeAssetId)
    : undefined
  if (asset) return { displayName: asset.brandName, innName: asset.innName, companyName: asset.company ?? draft.homeCompanyOverride }
  return null
}

/** True when a Home Asset is selected but its company is genuinely unknown -- Stage 1 must prompt for it (Phase 6/Step 13) rather than proceed or guess. */
export function needsHomeCompanyConfirmation(draft: SetupDraft): boolean {
  const display = resolveHomeAssetDisplay(draft)
  return !!display && !display.companyName
}

export interface DiseaseAreaDisplay {
  name: string
  aliases?: string[]
  source: 'manual' | 'catalog' | 'mondo'
}

/** Resolves the Disease Area identity for display, whichever source it came from (Root-Cause Recon implementation, Part A). Null when nothing is selected yet. */
export function resolveDiseaseAreaDisplay(draft: SetupDraft): DiseaseAreaDisplay | null {
  const { diseaseAreaId } = draft.landscapeConfiguration
  if (draft.manualDiseaseArea && draft.manualDiseaseArea.id === diseaseAreaId) {
    return { name: draft.manualDiseaseArea.name, source: 'manual' }
  }
  if (draft.resolvedDiseaseArea && draft.resolvedDiseaseArea.id === diseaseAreaId) {
    return { name: draft.resolvedDiseaseArea.preferredName, aliases: draft.resolvedDiseaseArea.aliases, source: 'mondo' }
  }
  const catalogEntry = diseaseAreaId ? getDiseaseAreaById(diseaseAreaId) : undefined
  if (catalogEntry) return { name: catalogEntry.name, source: 'catalog' }
  return null
}

/**
 * Step 26: whether the resolvedAsset's own real evidence (indicationContexts,
 * raw CT.gov condition text) agrees with the user's selected Disease Area.
 * 'unknown' when there's nothing to compare (no resolvedAsset, or it has no
 * indication evidence at all) -- absence of evidence is never treated as a
 * mismatch. Deliberately simple token-overlap, not a synonym/ontology
 * lookup: every word in the Disease Area's own name must appear in at least
 * one indication context string for a 'match'.
 */
export function assetDiseaseAreaAgreement(draft: SetupDraft): 'match' | 'mismatch' | 'unknown' {
  const r = draft.resolvedAsset
  if (!r || r.id !== draft.landscapeConfiguration.homeAssetId || r.indicationContexts.length === 0) return 'unknown'
  const diseaseAreaName = resolveDiseaseAreaDisplay(draft)?.name
  if (!diseaseAreaName) return 'unknown'
  const targetWords = diseaseAreaName.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = r.indicationContexts.some((c) => {
    const contextLower = c.toLowerCase()
    return targetWords.every((w: string) => contextLower.includes(w))
  })
  return matches ? 'match' : 'mismatch'
}

export function isStage1Valid(draft: SetupDraft): boolean {
  const { therapeuticAreaId, diseaseAreaId, homeAssetId } = draft.landscapeConfiguration
  if (!therapeuticAreaId || !diseaseAreaId || !homeAssetId) return false
  if (!isLandscapeConfigurationConsistent(draft.landscapeConfiguration)) return false
  // A manual asset must genuinely be attached to this exact draft's TA/DA -- never trusted merely because homeAssetId matches.
  if (draft.manualAsset) {
    if (draft.manualAsset.id !== homeAssetId
      || draft.manualAsset.diseaseAreaId !== diseaseAreaId
      || draft.manualAsset.therapeuticAreaId !== therapeuticAreaId) return false
  } else if (draft.resolvedAsset) {
    if (draft.resolvedAsset.id !== homeAssetId) return false
  } else if (!getAssetById(homeAssetId)) {
    return false
  }
  // A manual Disease Area must genuinely be attached to this exact draft's category.
  if (draft.manualDiseaseArea && draft.manualDiseaseArea.id === diseaseAreaId
    && draft.manualDiseaseArea.therapeuticAreaId !== therapeuticAreaId) return false
  // A resolved company is required before Ariya can run discovery at all (Phase 6/13).
  return !needsHomeCompanyConfirmation(draft)
}

// ── Stage 2: FIND + SELECT companies ────────────────────────────────────────

/** Maps one real backend SuggestedCompanySuggestion into this module's CompanyEntry -- the one place that shape conversion happens. */
export function suggestedCompanyToEntry(s: SuggestedCompanySuggestion): CompanyEntry {
  return {
    id: s.companyKey,
    source: 'discovered',
    companyName: s.companyName,
    relevantAssets: s.relevantAssets.map((a) => ({
      identityKey: a.identityKey,
      candidateStatus: a.candidateStatus,
      evidenceGaps: a.evidenceGaps,
      sourceReferences: a.sourceReferences,
      reasonDetail: a.reasonDetail,
      unresolvedQuestions: a.unresolvedQuestions,
      detail: a.detail,
      historicalOrganizationName: a.historicalOrganizationName,
    })),
    ariyaAssessment: s.aiProposedRelationship,
    evidenceStatus: 'evidence_available',
    evidenceRefs: s.evidenceRefs,
    verifiedDomains: s.verifiedDomains,
    whySuggested: s.whySuggested,
  }
}

/**
 * Merges real, already-shortlisted company suggestions into the draft.
 * Never overwrites a manual competitor -- but a manual entry whose company
 * name exactly matches (case-insensitive, trimmed, generic-suffix-agnostic
 * is NOT attempted here -- see module docstring) a freshly suggested
 * company is dropped in favor of the richer discovered record. Deliberately
 * exact-match only -- no fuzzy entity resolution in the frontend (that
 * belongs in Python; see competitor_promotion.py's own docstring).
 */
export function setSuggestedCompanies(draft: SetupDraft, suggestions: SuggestedCompanySuggestion[]): SetupDraft {
  const discoveredEntries = suggestions.map(suggestedCompanyToEntry)
  const discoveredNames = new Set(discoveredEntries.map((c) => c.companyName.trim().toLowerCase()))
  const manualOnly = draft.companies.filter(
    (c) => c.source === 'manual' && !discoveredNames.has(c.companyName.trim().toLowerCase()),
  )
  return { ...draft, companies: [...discoveredEntries, ...manualOnly] }
}

/**
 * Manual competitor addition -- company-rooted (Phase 19): the required
 * identity is the COMPANY, never an asset. An optional relevant asset/INN
 * nests underneath it exactly like a discovered company's relevant assets,
 * never as its own top-level entry.
 */
export function addManualCompany(
  draft: SetupDraft,
  input: { companyName: string; assetName?: string | null; innName?: string | null },
): SetupDraft {
  if (!input.companyName.trim()) return draft
  const relevantAssets: RelevantAssetEntry[] = input.assetName?.trim()
    ? [{
      identityKey: input.assetName.trim(),
      candidateStatus: null,
      evidenceGaps: [],
      sourceReferences: [],
      reasonDetail: [],
      unresolvedQuestions: [],
      detail: null,
      historicalOrganizationName: null,
    }]
    : []
  const company: CompanyEntry = {
    id: createLocalId('manual-company'),
    source: 'manual',
    companyName: input.companyName.trim(),
    relevantAssets,
    ariyaAssessment: null,
    evidenceStatus: 'not_evaluated',
    evidenceRefs: [],
    verifiedDomains: [],
    whySuggested: null,
  }
  return { ...draft, companies: [...draft.companies, company] }
}

// ── Stage 2 selection (moved out of Stage 3 -- Phase 15/20 fixed decision) ──

export function toggleCompanySelection(draft: SetupDraft, companyId: string): SetupDraft {
  const exists = draft.selections.some((s) => s.companyId === companyId)
  const selections = exists
    ? draft.selections.filter((s) => s.companyId !== companyId)
    : [...draft.selections, { companyId, userRelationship: null }]
  return { ...draft, selections }
}

/** Clears every Stage 2 selection at once -- the fixed footer's "Clear selection" action (Root-Cause Recon implementation, Part D1). */
export function clearCompanySelections(draft: SetupDraft): SetupDraft {
  if (draft.selections.length === 0) return draft
  return { ...draft, selections: [] }
}

export function isCompanySelected(draft: SetupDraft, companyId: string): boolean {
  return draft.selections.some((s) => s.companyId === companyId)
}

// ── Stage 3: CLASSIFY + REVIEW only (no selection here -- Phase 20) ────────

export function setCompanyRelationship(draft: SetupDraft, companyId: string, relationship: UserRelationship): SetupDraft {
  return {
    ...draft,
    selections: draft.selections.map((s) => (s.companyId === companyId ? { ...s, userRelationship: relationship } : s)),
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

// ── Final output: TrackedCompetitor (company-level, Phase 21) ──────────────
//
// Kept structurally separate from SetupDraft's own CompanyEntry/
// SelectedCompanyDraft (provisional, in-progress) and from the legacy rich
// static Competitor type (src/data/competitors.json) -- a tracked
// competitor here only ever carries fields a user or Ariya's advisory read
// actually supplied, never a fabricated profile. userRelationship belongs
// to the COMPANY; relevantAssets (with their own evidence) are preserved
// underneath it, never discarded merely because the company became the
// top-level unit.

export interface TrackedCompetitor {
  companyId: string
  companyName: string
  source: CompanySource
  userRelationship: UserRelationship
  ariyaAssessment: AdvisoryRelationship | null
  relevantAssets: RelevantAssetEntry[]
  evidenceRefs: string[]
  evidenceStatus: 'not_evaluated' | 'evidence_available'
}

/** Only classified selections become tracked competitors -- isStage3Valid() is the real gate; this is just the projection. */
export function draftToTrackedCompetitors(draft: SetupDraft): TrackedCompetitor[] {
  const byId = new Map(draft.companies.map((c) => [c.id, c]))
  const result: TrackedCompetitor[] = []
  for (const selection of draft.selections) {
    if (!selection.userRelationship) continue
    const company = byId.get(selection.companyId)
    if (!company) continue
    result.push({
      companyId: company.id,
      companyName: company.companyName,
      source: company.source,
      userRelationship: selection.userRelationship,
      ariyaAssessment: company.ariyaAssessment,
      relevantAssets: company.relevantAssets,
      evidenceRefs: company.evidenceRefs,
      evidenceStatus: company.evidenceStatus,
    })
  }
  return result
}

// ── Home company exclusion (deterministic -- Phase 22) ──────────────────────

/** Deterministic normalization mirroring the backend's own company_grouping_key() closely enough for a frontend-side guard (e.g. blocking a manual add of the home company) -- NOT used for backend promotion, which is Python's job. */
export function normalizeCompanyName(name: string): string {
  const GENERIC_SUFFIXES = new Set(['bio', 'biopharma', 'biotech', 'pharma', 'pharmaceuticals', 'therapeutics'])
  const LEGAL_SUFFIXES = new Set(['inc', 'incorporated', 'ltd', 'limited', 'llc', 'plc', 'corp', 'corporation', 'co', 'company'])
  let tokens = name.trim().toLowerCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
  while (tokens.length && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1)
  while (tokens.length && GENERIC_SUFFIXES.has(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1)
  return tokens.join(' ') || name.trim().toLowerCase()
}

/** True when `companyName` resolves to the same company as the draft's own Home Asset -- used to block a manual "competitor" add of the home company itself (Phase 22). */
export function isHomeCompany(draft: SetupDraft, companyName: string): boolean {
  const home = resolveHomeAssetDisplay(draft)
  if (!home?.companyName) return false
  return normalizeCompanyName(home.companyName) === normalizeCompanyName(companyName)
}

// ── Cross-landscape staleness (NAV 2) ───────────────────────────────────────

/** True when the draft has Stage 2/3 data that a landscape change would strand. */
export function hasDownstreamData(draft: SetupDraft): boolean {
  return draft.companies.length > 0 || draft.selections.length > 0
}

/** Clears everything downstream of Stage 1 -- used only after explicit user confirmation (NAV 2). */
export function clearDownstreamData(draft: SetupDraft): SetupDraft {
  return { ...draft, companies: [], selections: [] }
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
    if (!parsed || typeof parsed !== 'object' || !parsed.landscapeConfiguration || !Array.isArray(parsed.companies)) return null
    return parsed
  } catch { return null }
}

export function clearSetupDraft(): void {
  try { localStorage.removeItem(SETUP_DRAFT_STORAGE_KEY) } catch { /* noop */ }
}
