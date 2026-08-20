/**
 * landscape-configuration.ts — the canonical Ariya Light CI configuration model.
 *
 * Frontend Step 2 of 7. Three distinct semantic concepts, kept distinct on
 * purpose (do not collapse Therapeutic Area and Disease Area into one
 * `indication` field — see PRODUCT_CONTRACT in the handoff this implements):
 *
 *   Therapeutic Area  →  Disease Area  →  Home / Reference Asset
 *
 * This module is pure (no React, no Supabase, no localStorage) so it's testable
 * in isolation — see landscape-configuration.test.ts. AppContext.tsx wires it
 * into state/persistence; nothing else in this step depends on React.
 *
 * Deliberately excluded from this type (per the product contract's own scope
 * for this step): competitor/watchlist state, discovery candidates, and
 * Direct/Indirect classification. Those begin after configuration is stable.
 */

import { ASSETS_CONFIG, getAssetById, type AssetConfig } from './assets-config'
import {
  DISEASE_AREAS,
  type DiseaseArea,
  getDiseaseAreaById,
  getTherapeuticAreaForDiseaseArea,
} from './therapeutic-areas'

export interface LandscapeConfiguration {
  therapeuticAreaId: string | null
  diseaseAreaId: string | null
  /** References AssetConfig.id — the existing asset identity, not a duplicate. */
  homeAssetId: string | null
}

export const EMPTY_LANDSCAPE_CONFIGURATION: LandscapeConfiguration = {
  therapeuticAreaId: null,
  diseaseAreaId: null,
  homeAssetId: null,
}

/**
 * Builds a LandscapeConfiguration from a Home Asset id via the catalog — the
 * only source of truth for deriving Disease Area / Therapeutic Area from an
 * asset. Returns null fields (never a guess) when the asset isn't in the
 * catalog or the catalog entry has no diseaseAreaId.
 */
export function deriveLandscapeConfigurationFromAsset(assetId: string | null): LandscapeConfiguration {
  if (!assetId) return { ...EMPTY_LANDSCAPE_CONFIGURATION }

  const asset = getAssetById(assetId)
  if (!asset || !asset.diseaseAreaId) {
    // Unknown asset (e.g. a synthetic ChEMBL-search asset not in ASSETS_CONFIG),
    // or a catalogued asset with no Disease Area link (same synthetic case,
    // reached via a static match instead — see AssetConfig.diseaseAreaId). The
    // asset id itself is still real and worth keeping; TA/DA are not
    // deterministically knowable, so they stay null rather than guessed.
    return { therapeuticAreaId: null, diseaseAreaId: null, homeAssetId: assetId }
  }

  const diseaseArea = getDiseaseAreaById(asset.diseaseAreaId)
  const therapeuticArea = diseaseArea ? getTherapeuticAreaForDiseaseArea(diseaseArea.id) : undefined

  return {
    homeAssetId: assetId,
    diseaseAreaId: diseaseArea?.id ?? null,
    therapeuticAreaId: therapeuticArea?.id ?? null,
  }
}

/**
 * The legacy `indication` / `indicationFull` shape that existing code
 * (useConfig() and every consumer that reads it) still expects.
 *
 * Canonical direction: Disease Area → legacy indication projection, never the
 * reverse. `indication`/`indicationFull` are compatibility-only from here on —
 * Disease Area is the product concept that's allowed to grow (new disease
 * areas, richer fields); the legacy pair is a fixed, narrow view onto it that
 * exists only so already-shipped code keeps working unmodified this step.
 */
export interface LegacyIndicationCompat {
  indication: string
  indicationFull: string
}

export function getLegacyIndicationCompat(diseaseAreaId: string | null): LegacyIndicationCompat | null {
  if (!diseaseAreaId) return null
  const diseaseArea = getDiseaseAreaById(diseaseAreaId)
  if (!diseaseArea) return null
  return { indication: diseaseArea.shortCode, indicationFull: diseaseArea.name }
}

/**
 * Legacy per-user state as already persisted (localStorage keys
 * ariya-user-asset-id / ariya-user-indication) before this step existed.
 */
export interface LegacyUserState {
  assetId: string | null
  indication: string | null
}

/**
 * Migration/fallback contract (product contract Step 7):
 *
 *   if canonical landscape fields exist:        use them
 *   else if the legacy asset deterministically maps via the catalog:  derive it
 *   else:                                        user requires configuration
 *
 * Never infers a Therapeutic Area from free text, and never silently maps an
 * unrecognised legacy `indication` string to a guessed Disease Area — an
 * asset-catalog match is the only accepted deterministic source.
 */
export function migrateLegacyToLandscapeConfiguration(
  canonical: LandscapeConfiguration | null,
  legacy: LegacyUserState,
): LandscapeConfiguration {
  if (canonical && (canonical.diseaseAreaId || canonical.therapeuticAreaId || canonical.homeAssetId)) {
    return canonical
  }
  return deriveLandscapeConfigurationFromAsset(legacy.assetId)
}

/** True when every held id still resolves through the current catalog — a roundtrip/identity check for persistence helpers. */
export function isLandscapeConfigurationConsistent(config: LandscapeConfiguration): boolean {
  if (config.homeAssetId) {
    const asset = getAssetById(config.homeAssetId)
    // A homeAssetId absent from the catalog (synthetic asset) is valid on its
    // own -- only check consistency when the asset IS catalogued.
    if (asset && config.diseaseAreaId && asset.diseaseAreaId !== config.diseaseAreaId) return false
  }
  if (config.diseaseAreaId) {
    const ta = getTherapeuticAreaForDiseaseArea(config.diseaseAreaId)
    if (config.therapeuticAreaId && ta?.id !== config.therapeuticAreaId) return false
  }
  return true
}

// ── Hierarchical selection helpers (Frontend Step 3 onboarding UI) ─────────────
//
// Pure functions the onboarding component calls directly rather than
// reimplementing filtering/clearing logic inline. Keeping them here (not in
// the component) is what makes the hierarchy's interaction rules — clearing
// downstream selections, refusing a cross-hierarchy selection — unit-testable
// without rendering React.

/** Disease Areas belonging to the given Therapeutic Area, in catalog order. */
export function getDiseaseAreasForTherapeuticArea(therapeuticAreaId: string): DiseaseArea[] {
  return DISEASE_AREAS.filter(da => da.therapeuticAreaId === therapeuticAreaId)
}

/** Catalogued (AssetConfig) Home Assets belonging to the given Disease Area, in catalog order. */
export function getAssetsForDiseaseArea(diseaseAreaId: string): AssetConfig[] {
  return ASSETS_CONFIG.filter(a => a.diseaseAreaId === diseaseAreaId)
}

/**
 * Selecting a Therapeutic Area: sets it, and clears Disease Area + Home Asset
 * whenever the Therapeutic Area actually changed (re-selecting the same one is
 * a no-op on the downstream fields, not a fresh clear).
 */
export function applyTherapeuticAreaSelection(
  current: LandscapeConfiguration,
  therapeuticAreaId: string,
): LandscapeConfiguration {
  if (current.therapeuticAreaId === therapeuticAreaId) return current
  return { therapeuticAreaId, diseaseAreaId: null, homeAssetId: null }
}

/**
 * Selecting a Disease Area: refuses silently (returns `current` unchanged) if
 * it doesn't belong to the currently-selected Therapeutic Area — the caller is
 * expected to only ever offer already-filtered options (getDiseaseAreasForTherapeuticArea),
 * so reaching this guard means a stale/inconsistent call, not a valid user
 * choice. Clears Home Asset whenever the Disease Area actually changed.
 */
export function applyDiseaseAreaSelection(
  current: LandscapeConfiguration,
  diseaseAreaId: string,
): LandscapeConfiguration {
  const diseaseArea = getDiseaseAreaById(diseaseAreaId)
  if (!diseaseArea || diseaseArea.therapeuticAreaId !== current.therapeuticAreaId) return current
  if (current.diseaseAreaId === diseaseAreaId) return current
  return { ...current, diseaseAreaId, homeAssetId: null }
}

/**
 * Selecting a Home Asset: refuses silently if it doesn't belong to the
 * currently-selected Disease Area, for the same reason as above.
 */
export function applyHomeAssetSelection(
  current: LandscapeConfiguration,
  homeAssetId: string,
): LandscapeConfiguration {
  const asset = getAssetById(homeAssetId)
  if (!asset || asset.diseaseAreaId !== current.diseaseAreaId) return current
  return { ...current, homeAssetId }
}

/**
 * Whether a configuration is complete and internally consistent enough to
 * persist — the gate for the onboarding primary action. Never trusts UI
 * filtering alone (product contract Step 15): re-validates membership via the
 * catalog, the same way applyDiseaseAreaSelection/applyHomeAssetSelection do.
 */
export function isLandscapeConfigurationSubmittable(config: LandscapeConfiguration): boolean {
  return (
    !!config.therapeuticAreaId &&
    !!config.diseaseAreaId &&
    !!config.homeAssetId &&
    isLandscapeConfigurationConsistent(config)
  )
}

export type { AssetConfig }
