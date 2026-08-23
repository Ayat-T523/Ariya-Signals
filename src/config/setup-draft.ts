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

/**
 * The same manual -> resolved -> catalog priority resolveHomeAssetDisplay
 * below uses, factored out to accept the four loose pieces directly
 * (Targeted Implementation 4) -- so a caller that isn't holding a full
 * SetupDraft (e.g. AppContext.useConfig(), which persists manualHomeAsset/
 * resolvedHomeAsset independently once setup completes -- see
 * completeSetup()) can reuse the EXACT same resolution logic instead of
 * re-deriving a second, competing implementation. `homeCompanyOverride`
 * defaults to null -- AppContext does not persist Stage 1's own
 * homeCompanyOverride draft field (out of this task's scope), so a
 * resolved/catalog asset with no recorded owner company simply surfaces
 * companyName: null post-setup, the same honest-gap semantics
 * resolveHomeAssetDisplay() already documents, never fabricated.
 */
export function resolveHomeAssetDisplayFrom(
  homeAssetId: string | null,
  manualAsset: ManualAssetIdentity | null,
  resolvedAsset: ResolvedAssetIdentity | null,
  homeCompanyOverride: string | null = null,
): HomeAssetDisplay | null {
  if (manualAsset && manualAsset.id === homeAssetId) {
    return { displayName: manualAsset.displayName, innName: manualAsset.innName, companyName: manualAsset.company }
  }
  if (resolvedAsset && resolvedAsset.id === homeAssetId) {
    return {
      displayName: resolvedAsset.preferredName,
      innName: resolvedAsset.innNames[0] ?? null,
      companyName: resolvedAsset.ownerCompanies[0] ?? homeCompanyOverride,
      aliases: resolvedAsset.aliases,
      mechanismOfAction: resolvedAsset.mechanismOfAction,
      indicationContexts: resolvedAsset.indicationContexts,
    }
  }
  const asset: AssetConfig | undefined = homeAssetId ? getAssetById(homeAssetId) : undefined
  if (asset) return { displayName: asset.brandName, innName: asset.innName, companyName: asset.company ?? homeCompanyOverride }
  return null
}

/** Resolves the Home Asset identity for display, whichever source it came from. Null when nothing is selected yet. */
export function resolveHomeAssetDisplay(draft: SetupDraft): HomeAssetDisplay | null {
  return resolveHomeAssetDisplayFrom(
    draft.landscapeConfiguration.homeAssetId, draft.manualAsset, draft.resolvedAsset, draft.homeCompanyOverride,
  )
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
  /** Populated only for the 'catalog' source (Targeted Implementation 2) -- a manual/MONDO Disease Area has no curated abbreviation, never fabricated. Consumers wanting a short label fall back to `name` when this is absent. */
  shortCode?: string
}

/**
 * The same manual -> resolved(MONDO) -> catalog priority resolveDiseaseAreaDisplay
 * below uses, factored out to accept the three loose pieces directly
 * (Targeted Implementation 2) -- so a caller that isn't holding a full
 * SetupDraft (e.g. AppContext.useConfig(), which persists these three pieces
 * independently once setup completes -- see completeSetup()) can reuse the
 * EXACT same resolution logic instead of re-deriving a second, competing
 * implementation.
 */
export function resolveDiseaseAreaDisplayFrom(
  diseaseAreaId: string | null,
  manualDiseaseArea: ManualDiseaseArea | null,
  resolvedDiseaseArea: ResolvedDiseaseArea | null,
): DiseaseAreaDisplay | null {
  if (manualDiseaseArea && manualDiseaseArea.id === diseaseAreaId) {
    return { name: manualDiseaseArea.name, source: 'manual' }
  }
  if (resolvedDiseaseArea && resolvedDiseaseArea.id === diseaseAreaId) {
    return { name: resolvedDiseaseArea.preferredName, aliases: resolvedDiseaseArea.aliases, source: 'mondo' }
  }
  const catalogEntry = diseaseAreaId ? getDiseaseAreaById(diseaseAreaId) : undefined
  if (catalogEntry) return { name: catalogEntry.name, source: 'catalog', shortCode: catalogEntry.shortCode }
  return null
}

/**
 * The globally-stable CANONICAL Disease Area identity for durable
 * persistence/read (the Ariya HTTP API's `indication_id`) -- the ONE
 * shared implementation DiscoverCompetitors.tsx/WarRoom.tsx/Portal.tsx
 * must all call, so the write and read sides can never independently
 * drift onto different notions of "the id."
 *
 * NOT `resolvedDiseaseArea.id`: on ResolvedDiseaseArea, `id` is merely
 * "this result's own identity as the backend happened to key it" -- for
 * every real code path (disease_resolution.py's `_curated()` AND
 * `_live_mondo_search()`, confirmed by reading both directly) `id` and
 * `sourceId` are always the SAME real MONDO term, so this distinction is
 * usually invisible -- but `sourceId` is the field EXPLICITLY documented
 * as "the underlying ontology/source system's own identifier" (backend:
 * `ResolvedDiseaseArea.source_id`), null whenever no real canonical
 * source id exists. Trusting `id` blindly is what let a hand-seeded/
 * malformed local fixture (id="gmg-mondo", sourceId="MONDO:...") pass as
 * "canonical" purely because it agreed with itself -- `sourceId` cannot
 * silently do that, since a fabricated object would have to fabricate a
 * PLAUSIBLE ontology-shaped string there too, and more importantly a
 * genuinely manual/catalog Disease Area has no ResolvedDiseaseArea at
 * all, so this function already returns null for those without needing
 * to inspect `source`.
 *
 * The staleness guard (`resolvedDiseaseArea.id === diseaseAreaId`) is
 * unchanged from resolveDiseaseAreaDisplayFrom()'s own -- it only proves
 * "this resolvedDiseaseArea object still backs the ACTIVE selection,"
 * never "its own id is a real ontology term." Only `sourceId` proves
 * that second, separate claim.
 */
export function resolveCanonicalIndicationId(
  diseaseAreaId: string | null,
  resolvedDiseaseArea: ResolvedDiseaseArea | null,
): string | null {
  if (!resolvedDiseaseArea || resolvedDiseaseArea.id !== diseaseAreaId) return null
  return resolvedDiseaseArea.sourceId ?? null
}

/** Resolves the Disease Area identity for display, whichever source it came from (Root-Cause Recon implementation, Part A). Null when nothing is selected yet. */
export function resolveDiseaseAreaDisplay(draft: SetupDraft): DiseaseAreaDisplay | null {
  return resolveDiseaseAreaDisplayFrom(draft.landscapeConfiguration.diseaseAreaId, draft.manualDiseaseArea, draft.resolvedDiseaseArea)
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

// ── Stale/invalid draft recovery (Targeted Implementation 3) ────────────────

/**
 * Whether a persisted draft actually has a genuinely resolvable Disease
 * Area AND Home Asset AND Home Company -- DISCOVER's real requirement, per
 * this task's own root-cause diagram (resolveDiseaseAreaDisplay() ||
 * resolveHomeAssetDisplay() === null -> the stage was never actually safe).
 *
 * Reuses isStage1Valid() for the Home Asset/Home Company side (its own
 * manualAsset/resolvedAsset/getAssetById branches already exactly match
 * resolveHomeAssetDisplay()'s own null condition) PLUS an explicit
 * resolveDiseaseAreaDisplay() check for the Disease Area side -- a real,
 * confirmed gap in isStage1Valid() alone: it only checks a matching
 * manualDiseaseArea's OWN therapeuticAreaId consistency IF one happens to
 * exist for the current diseaseAreaId; it never asserts that diseaseAreaId
 * resolves to ANYTHING (manual, resolved, or catalog) at all. A draft whose
 * diseaseAreaId is a dangling id -- no manualDiseaseArea, no
 * resolvedDiseaseArea, no catalog match -- passes isStage1Valid() unchanged
 * today, which is exactly the stale-draft symptom this task exists to fix.
 * Never a second, competing validation implementation -- this only adds the
 * ONE missing check the existing functions don't already cover between them.
 */
function isStage1GenuinelyResolvable(draft: SetupDraft): boolean {
  return isStage1Valid(draft) && resolveDiseaseAreaDisplay(draft) !== null && resolveHomeAssetDisplay(draft) !== null
}

/**
 * Whether a persisted draft's OWN claimed `stage` is still safe to resume
 * at, or must be recovered to an earlier stage whose required identities
 * can actually be resolved from what the draft still carries.
 *
 * DISCOVER requires isStage1GenuinelyResolvable() above. CONFIGURE
 * additionally requires at least one selected company (Stage 3's own
 * isStage3Valid() first precondition) -- but NOT that every selection is
 * already classified, since an in-progress, not-yet-fully-classified Stage 3
 * is normal, valid, in-progress state, not staleness.
 *
 * Recovery only ever corrects `stage`, falling back to the HIGHEST stage
 * still safe (configure -> discover -> define, never skipping past a stage
 * that's still genuinely valid) -- every other field is left completely
 * untouched, so no still-valid value is ever discarded and no missing
 * identity is ever fabricated. DEFINE itself is always safe to resume at:
 * Stage 1's own UI already tolerates partial/unresolved selections (that is
 * its normal empty/in-progress state), so no draft is ever rejected
 * entirely -- only routed to the correct starting point.
 */
export function recoverSetupDraft(draft: SetupDraft): SetupDraft {
  if (draft.stage === 'define') return draft
  const stage1Ok = isStage1GenuinelyResolvable(draft)
  if (draft.stage === 'discover') {
    return stage1Ok ? draft : { ...draft, stage: 'define' }
  }
  // draft.stage === 'configure'
  const hasSelections = Array.isArray(draft.selections) && draft.selections.length > 0
  if (stage1Ok && hasSelections) return draft
  return { ...draft, stage: stage1Ok ? 'discover' : 'define' }
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
    // Targeted Implementation 3: a persisted stage is a CLAIM, not a fact --
    // never resumed directly into Stage 2/3 without confirming the
    // identities that stage requires can still actually be resolved.
    return recoverSetupDraft(parsed)
  } catch { return null }
}

export function clearSetupDraft(): void {
  try { localStorage.removeItem(SETUP_DRAFT_STORAGE_KEY) } catch { /* noop */ }
}
