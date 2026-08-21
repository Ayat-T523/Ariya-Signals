/**
 * therapeutic-areas.ts — canonical landscape category / Disease Area catalog.
 *
 * Landscape Input Resolution milestone: the user-facing top-level catalog is
 * now the fixed 22-category list (18 standard Therapeutic Areas + 4 Special/
 * Cross-Cutting categories) — replacing the previous 2-entry placeholder.
 * `TherapeuticArea` is kept as the type/field name throughout the codebase
 * (avoids a large, low-value rename across setup-draft.ts, AppContext.tsx,
 * Stage1Define.tsx, etc.) but now carries `categoryType` so a cross-cutting
 * category (Rare Diseases, Vaccines, Pediatrics/Neonatology, Medical Imaging
 * & Contrast Agents) is never silently treated as an organ-system TA. See
 * `LandscapeCategory` below for the semantically-named alias.
 *
 * Disease Area stays a SEPARATE, smaller, controlled catalog on purpose —
 * this milestone does not attempt to populate every disease in medicine
 * (explicitly out of scope). Only the disease areas the existing asset
 * catalog already covers (HAE, PNH, PBC) plus gMG are represented; the
 * architecture (see setup-draft.ts's ManualDiseaseArea) no longer treats
 * that smallness as a dead end — a category with zero configured Disease
 * Areas gets a manual-entry path instead of an empty state.
 */

export type LandscapeCategoryType = 'therapeutic_area' | 'cross_cutting'

export interface TherapeuticArea {
  id: string
  name: string
  categoryType: LandscapeCategoryType
}

/** Semantic alias — same shape, the name this milestone's own spec uses. */
export type LandscapeCategory = TherapeuticArea

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

// GROUP A — standard, organ-system-rooted Therapeutic Areas (18).
const _STANDARD_THERAPEUTIC_AREAS: TherapeuticArea[] = [
  { id: 'oncology', name: 'Oncology', categoryType: 'therapeutic_area' },
  { id: 'immunology', name: 'Immunology & Inflammation', categoryType: 'therapeutic_area' },
  { id: 'cardiovascular', name: 'Cardiovascular', categoryType: 'therapeutic_area' },
  { id: 'metabolism-endocrinology', name: 'Metabolism & Endocrinology', categoryType: 'therapeutic_area' },
  // 'neurology' id preserved unchanged from the prior 2-entry catalog — gMG's
  // existing DiseaseArea entry below already references it; renaming the id
  // here would silently break that link for no benefit.
  { id: 'neurology', name: 'Neurology & Neuroscience', categoryType: 'therapeutic_area' },
  { id: 'gastroenterology-hepatology', name: 'Gastroenterology / Hepatology', categoryType: 'therapeutic_area' },
  { id: 'pulmonology-respiratory', name: 'Pulmonology / Respiratory', categoryType: 'therapeutic_area' },
  { id: 'nephrology-renal', name: 'Nephrology / Renal', categoryType: 'therapeutic_area' },
  { id: 'hematology', name: 'Hematology', categoryType: 'therapeutic_area' },
  { id: 'dermatology', name: 'Dermatology', categoryType: 'therapeutic_area' },
  { id: 'urology', name: 'Urology', categoryType: 'therapeutic_area' },
  { id: 'gynecology-obstetrics', name: 'Gynecology / Obstetrics', categoryType: 'therapeutic_area' },
  { id: 'ophthalmology', name: 'Ophthalmology', categoryType: 'therapeutic_area' },
  { id: 'psychiatry-mental-health', name: 'Psychiatry / Mental Health', categoryType: 'therapeutic_area' },
  { id: 'analgesia-pain-anesthesiology', name: 'Analgesia, Pain & Anesthesiology', categoryType: 'therapeutic_area' },
  { id: 'orthopedics-rheumatology', name: 'Orthopedics & Rheumatology', categoryType: 'therapeutic_area' },
  { id: 'otolaryngology-ent', name: 'Otolaryngology (ENT)', categoryType: 'therapeutic_area' },
  { id: 'infectious-diseases-virology', name: 'Infectious Diseases & Virology', categoryType: 'therapeutic_area' },
]

// GROUP B — special / cross-cutting categories (4). Never collapsed into a
// standard organ-system Therapeutic Area — each spans multiple TAs by
// definition (a vaccine can be infectious-disease OR oncology-adjacent; a
// rare disease can occur in any organ system), so filing one under a single
// TA would misrepresent it.
const _CROSS_CUTTING_CATEGORIES: TherapeuticArea[] = [
  { id: 'vaccines', name: 'Vaccines', categoryType: 'cross_cutting' },
  { id: 'rare-diseases', name: 'Rare Diseases', categoryType: 'cross_cutting' },
  { id: 'pediatrics-neonatology', name: 'Pediatrics / Neonatology', categoryType: 'cross_cutting' },
  { id: 'medical-imaging-contrast-agents', name: 'Medical Imaging & Contrast Agents', categoryType: 'cross_cutting' },
]

export const THERAPEUTIC_AREAS: TherapeuticArea[] = [..._STANDARD_THERAPEUTIC_AREAS, ..._CROSS_CUTTING_CATEGORIES]

export const DISEASE_AREAS: DiseaseArea[] = [
  { id: 'hae', name: 'Hereditary Angioedema', shortCode: 'HAE', therapeuticAreaId: 'immunology' },
  { id: 'pnh', name: 'Paroxysmal Nocturnal Haemoglobinuria', shortCode: 'PNH', therapeuticAreaId: 'immunology' },
  { id: 'pbc', name: 'Primary Biliary Cholangitis', shortCode: 'PBC', therapeuticAreaId: 'immunology' },
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
