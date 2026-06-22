/**
 * assets-config.ts — Curated asset catalog for Ariya Signals.
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
  suggestedCompetitors: string[]
  /** INNs and brand synonyms used to gate whether a live signal is relevant to this asset's TA. */
  lexiconInns: string[]
  /** Therapeutic-area keywords for the same relevance gate. */
  lexiconTaTerms: string[]
}

export const ASSETS_CONFIG: AssetConfig[] = [
  {
    id: 'ekterly',
    brandName: 'Ekterly',
    innName: 'sebetralstat',
    indication: 'HAE',
    indicationFull: 'Hereditary Angioedema',
    suggestedCompetitors: ['takeda', 'biocryst', 'pharvaris'],
    // Source: HAE_LEXICON in src/pages/WarRoom.tsx — the authoritative copy lives here.
    // WarRoom.tsx keeps its own hardcoded copy until 1-WIRE (backbone Phase 5) replaces it.
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
