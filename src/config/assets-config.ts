/**
 * assets-config.ts — Curated asset catalog for InForm.
 *
 * Each entry describes a trackable asset: brand name, INN, indication,
 * suggested competitor watchlist, and the lexicon arrays used to gate
 * signal relevance for that asset's therapeutic area.
 *
 * MAINTAINABILITY: Add or edit entries here without touching component code.
 * No code change is required to add a new asset — just append an entry below.
 *
 * MIGRATION: This will move to a Supabase `assets` table (backbone follow-up,
 * Phase 5+). When that lands, this file becomes the static seed / offline fallback.
 */

export interface AssetConfig {
  id: string
  brandName: string
  innName: string
  indication: string
  indicationFull: string
  /**
   * The company that develops/owns/sponsors this asset -- REQUIRED for
   * deterministic home-company exclusion when this asset is selected as
   * Home Asset (see setup-draft.ts's isHomeCompany/needsHomeCompanyConfirmation).
   * Optional here on purpose: only set where it's a verified, already-real
   * fact already established elsewhere in this app (src/data/competitors.json's
   * own company/product records, or this milestone's own live backend
   * discovery evidence for sebetralstat/KalVista) -- never guessed from
   * general knowledge. An entry with no `company` is a genuine, honest gap;
   * Stage 1 prompts the user to confirm it rather than silently proceeding.
   */
  company?: string
  suggestedCompetitors: string[]
  /** INNs and brand synonyms used to gate whether a live signal is relevant to this asset's TA. */
  lexiconInns: string[]
  /** Therapeutic-area keywords for the same relevance gate. */
  lexiconTaTerms: string[]
  /**
   * Canonical Disease Area id (src/config/therapeutic-areas.ts). `indication`/
   * `indicationFull` above are kept as-is (legacy-compatible, unchanged) — this
   * is the new link into the Therapeutic Area / Disease Area hierarchy; every
   * curated entry below sets it, and it must always resolve to a DiseaseArea
   * whose `shortCode`/`name` match this entry's own `indication`/
   * `indicationFull` (checked in landscape-configuration.test.ts). Optional,
   * not required, because OnboardingModal.tsx's live ChEMBL-search path builds
   * a synthetic AssetConfig-shaped object for an asset that genuinely has no
   * catalogued Disease Area — see deriveLandscapeConfigurationFromAsset, which
   * already treats an absent diseaseAreaId the same as an uncatalogued asset
   * (id kept, Therapeutic/Disease Area left null rather than guessed).
   */
  diseaseAreaId?: string
}

export const ASSETS_CONFIG: AssetConfig[] = [
  {
    id: 'ekterly',
    brandName: 'Ekterly',
    innName: 'sebetralstat',
    // Verified via this milestone's own live backend discovery evidence:
    // "KalVista Pharmaceuticals, Ltd." is the real CT.gov-declared sponsor
    // organization for sebetralstat/KVD900/KVD824 trials (confirmed in the
    // live gMG/HAE smoke tests run earlier in this project).
    company: 'KalVista',
    indication: 'HAE',
    indicationFull: 'Hereditary Angioedema',
    diseaseAreaId: 'hae',
    suggestedCompetitors: ['takeda', 'biocryst', 'pharvaris'],
    lexiconInns: [
      'berotralstat', 'navenibart', 'bcx17725', 'garadacimab',
      'lonvoguran', 'ziclumeran', 'donidalorsen', 'deucrictibant',
      'lanadelumab', 'icatibant', 'mezagitamab', 'sebetralstat',
      'orladeyo', 'takhzyro', 'firazyr', 'dawnzera', 'andembry',
    ],
    lexiconTaTerms: [
      'hae', 'hereditary angioedema', 'angioedema', 'bradykinin',
      'kallikrein', 'c1 inhibitor', 'c1-inh', 'plasma kallikrein',
      'factor xii', 'contact pathway', 'haelo',
    ],
  },
  {
    id: 'zevaro',
    brandName: 'Zevaro',
    innName: 'iptacopan',
    indication: 'PNH',
    indicationFull: 'Paroxysmal Nocturnal Haemoglobinuria',
    diseaseAreaId: 'pnh',
    suggestedCompetitors: ['takeda', 'csl-behring', 'ionis'],
    lexiconInns: [
      'iptacopan', 'fabhalta', 'pegcetacoplan', 'empaveli',
      'avacopan', 'tavneos', 'ravulizumab', 'ultomiris',
      'eculizumab', 'soliris', 'crovalimab', 'danicopan',
    ],
    lexiconTaTerms: [
      'pnh', 'paroxysmal nocturnal haemoglobinuria', 'complement',
      'factor d', 'factor b', 'c3', 'c5', 'haemolysis', 'hemolysis',
      'aplastic anemia', 'complement inhibitor',
    ],
  },
  {
    id: 'chelira',
    brandName: 'Chelira',
    innName: 'seladelpar',
    indication: 'PBC',
    indicationFull: 'Primary Biliary Cholangitis',
    diseaseAreaId: 'pbc',
    suggestedCompetitors: ['takeda', 'ionis', 'intellia'],
    lexiconInns: [
      'seladelpar', 'livdelzi', 'obeticholic acid', 'ocaliva',
      'elafibranor', 'iqirvo', 'linerixibat', 'volixibat',
      'tropifexor', 'cilofexor', 'bezafibrate',
    ],
    lexiconTaTerms: [
      'pbc', 'primary biliary cholangitis', 'bile acid', 'bile salt',
      'fxr', 'tgr5', 'ppar', 'alkaline phosphatase', 'alp',
      'ursodeoxycholic acid', 'udca', 'biliary', 'autoimmune liver', 'cholestasis',
    ],
  },
  // ── Competitor products ────────────────────────────────────────────────────
  // These allow users from other companies to configure Ariya from their perspective.
  // Each entry excludes its own company from suggestedCompetitors.
  // lexiconInns/lexiconTaTerms are shared within the same indication.
  {
    id: 'takhzyro',
    brandName: 'Takhzyro',
    innName: 'lanadelumab',
    // Verified via src/data/competitors.json's own existing company/product
    // record (id "takeda", product "Takhzyro") -- also consistent with this
    // entry's own suggestedCompetitors list excluding "takeda".
    company: 'Takeda',
    indication: 'HAE',
    indicationFull: 'Hereditary Angioedema',
    diseaseAreaId: 'hae',
    suggestedCompetitors: ['biocryst', 'pharvaris', 'csl-behring', 'ionis'],
    lexiconInns: [
      'berotralstat', 'navenibart', 'bcx17725', 'garadacimab',
      'lonvoguran', 'ziclumeran', 'donidalorsen', 'deucrictibant',
      'lanadelumab', 'icatibant', 'mezagitamab', 'sebetralstat',
      'orladeyo', 'takhzyro', 'firazyr', 'dawnzera', 'andembry',
    ],
    lexiconTaTerms: [
      'hae', 'hereditary angioedema', 'angioedema', 'bradykinin',
      'kallikrein', 'c1 inhibitor', 'c1-inh', 'plasma kallikrein',
      'factor xii', 'contact pathway', 'haelo',
    ],
  },
  {
    id: 'orladeyo',
    brandName: 'Orladeyo',
    innName: 'berotralstat',
    // Verified via src/data/competitors.json's own existing company/product
    // record (id "biocryst", product "Orladeyo").
    company: 'BioCryst',
    indication: 'HAE',
    indicationFull: 'Hereditary Angioedema',
    diseaseAreaId: 'hae',
    suggestedCompetitors: ['takeda', 'pharvaris', 'csl-behring', 'ionis'],
    lexiconInns: [
      'berotralstat', 'navenibart', 'bcx17725', 'garadacimab',
      'lonvoguran', 'ziclumeran', 'donidalorsen', 'deucrictibant',
      'lanadelumab', 'icatibant', 'mezagitamab', 'sebetralstat',
      'orladeyo', 'takhzyro', 'firazyr', 'dawnzera', 'andembry',
    ],
    lexiconTaTerms: [
      'hae', 'hereditary angioedema', 'angioedema', 'bradykinin',
      'kallikrein', 'c1 inhibitor', 'c1-inh', 'plasma kallikrein',
      'factor xii', 'contact pathway', 'haelo',
    ],
  },
  {
    id: 'deucrictibant',
    brandName: 'Deucrictibant',
    innName: 'deucrictibant',
    // Verified via src/data/competitors.json's own existing company/product
    // record (id "pharvaris", product "Deucrictibant").
    company: 'Pharvaris',
    indication: 'HAE',
    indicationFull: 'Hereditary Angioedema',
    diseaseAreaId: 'hae',
    suggestedCompetitors: ['takeda', 'biocryst', 'csl-behring', 'ionis'],
    lexiconInns: [
      'berotralstat', 'navenibart', 'bcx17725', 'garadacimab',
      'lonvoguran', 'ziclumeran', 'donidalorsen', 'deucrictibant',
      'lanadelumab', 'icatibant', 'mezagitamab', 'sebetralstat',
      'orladeyo', 'takhzyro', 'firazyr', 'dawnzera', 'andembry',
    ],
    lexiconTaTerms: [
      'hae', 'hereditary angioedema', 'angioedema', 'bradykinin',
      'kallikrein', 'c1 inhibitor', 'c1-inh', 'plasma kallikrein',
      'factor xii', 'contact pathway', 'haelo',
    ],
  },
  {
    id: 'navenibart',
    brandName: 'Navenibart',
    innName: 'navenibart',
    indication: 'HAE',
    indicationFull: 'Hereditary Angioedema',
    diseaseAreaId: 'hae',
    suggestedCompetitors: ['takeda', 'pharvaris', 'csl-behring', 'ionis'],
    lexiconInns: [
      'berotralstat', 'navenibart', 'bcx17725', 'garadacimab',
      'lonvoguran', 'ziclumeran', 'donidalorsen', 'deucrictibant',
      'lanadelumab', 'icatibant', 'mezagitamab', 'sebetralstat',
      'orladeyo', 'takhzyro', 'firazyr', 'dawnzera', 'andembry',
    ],
    lexiconTaTerms: [
      'hae', 'hereditary angioedema', 'angioedema', 'bradykinin',
      'kallikrein', 'c1 inhibitor', 'c1-inh', 'plasma kallikrein',
      'factor xii', 'contact pathway', 'haelo',
    ],
  },
]

export function getAssetById(id: string): AssetConfig | undefined {
  return ASSETS_CONFIG.find(a => a.id === id)
}
