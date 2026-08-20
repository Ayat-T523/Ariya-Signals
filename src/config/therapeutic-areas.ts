/**
 * therapeutic-areas.ts — canonical Therapeutic Area / Disease Area catalog.
 *
 * Frontend Step 2 of the Ariya Light CI landscape-configuration model. Establishes
 * the two levels of the hierarchy that sat above `AssetConfig` in name only until
 * now: every asset in assets-config.ts previously carried its own `indication`/
 * `indicationFull` strings with no shared, stable id and no broader Therapeutic
 * Area concept at all. This file is that missing layer — assets-config.ts's
 * entries link into it via `diseaseAreaId` (see that file).
 *
 * Therapeutic Area → Disease Area is a first-pass organisational grouping for V1,
 * not a claim of authoritative clinical taxonomy — it exists to prove the
 * three-level model, not to encode a definitive classification. Only the disease
 * areas the existing asset catalog already covers (HAE, PNH, PBC) plus one new
 * entry (Generalized Myasthenia Gravis, see the RYSTIGGO/ZILBRYSQ note below) are
 * represented. Do not add more without a real asset behind them.
 */

export interface TherapeuticArea {
  id: string
  name: string
}

export interface DiseaseArea {
  id: string
  /** Full display name, e.g. "Hereditary Angioedema". */
  name: string
  /**
   * Legacy-compatible short code, e.g. "HAE" — exactly what AssetConfig.indication
   * and DEMO.therapeuticArea already store today. Kept as its own field (not
   * derived from `name`) because it's an opaque existing value, not an
   * abbreviation rule.
   */
  shortCode: string
  therapeuticAreaId: string
}

export const THERAPEUTIC_AREAS: TherapeuticArea[] = [
  { id: 'immunology', name: 'Immunology' },
  // Added for RYSTIGGO/ZILBRYSQ (see DISEASE_AREAS below) — matches the product
  // contract's own worked example (Neurology → Generalized Myasthenia Gravis →
  // RYSTIGGO). No asset entry exists for this disease area yet; see the note there.
  { id: 'neurology', name: 'Neurology' },
]

export const DISEASE_AREAS: DiseaseArea[] = [
  { id: 'hae', name: 'Hereditary Angioedema', shortCode: 'HAE', therapeuticAreaId: 'immunology' },
  { id: 'pnh', name: 'Paroxysmal Nocturnal Haemoglobinuria', shortCode: 'PNH', therapeuticAreaId: 'immunology' },
  { id: 'pbc', name: 'Primary Biliary Cholangitis', shortCode: 'PBC', therapeuticAreaId: 'immunology' },
  /**
   * GAP FLAGGED, not filled: RYSTIGGO and ZILBRYSQ (UCB, per
   * docs/multi-asset-seed-pool.md's "Next wave: Myasthenia gravis" note — the
   * only local source that names them) are real reference/home assets used in
   * the ariya-lightci-python backend's live acceptance work, but neither has an
   * AssetConfig entry in assets-config.ts. Their INN, mechanism, suggested
   * competitors, and lexicon terms are not established in any local fixture —
   * inventing them here would be exactly the hallucination this step was told
   * to avoid. This Disease Area entry exists so the TA/DA hierarchy is ready for
   * them; the asset-level entries themselves are deliberately not added until
   * that metadata is sourced from the backend/product side.
   */
  { id: 'gmg', name: 'Generalized Myasthenia Gravis', shortCode: 'gMG', therapeuticAreaId: 'neurology' },
]

export function getTherapeuticAreaById(id: string): TherapeuticArea | undefined {
  return THERAPEUTIC_AREAS.find(ta => ta.id === id)
}

export function getDiseaseAreaById(id: string): DiseaseArea | undefined {
  return DISEASE_AREAS.find(da => da.id === id)
}

/** The Therapeutic Area a given Disease Area belongs to, or undefined if the id is unknown. */
export function getTherapeuticAreaForDiseaseArea(diseaseAreaId: string): TherapeuticArea | undefined {
  const da = getDiseaseAreaById(diseaseAreaId)
  return da ? getTherapeuticAreaById(da.therapeuticAreaId) : undefined
}
