/**
 * demo-config.ts — single source of truth for all client-specific values.
 *
 * To re-skin for a new client:
 *   1. Edit the values below (or swap this file for a new one).
 *   2. Create src/data/dataset-<vertical>.ts with the new data exports.
 *   3. Update the import in src/data/kalvista.ts to point at the new dataset.
 *   4. See docs/client-customisation.md for the full checklist.
 */
export const DEMO = {
  // ── Client identity ─────────────────────────────────────────────────────────
  companyLabel:     'Pharma Inc',
  personaName:      'David',
  personaTitle:     'Head of Competitive Intelligence',
  personaEmail:     'david@pharmainc.com',

  // ── Tracked asset ───────────────────────────────────────────────────────────
  assetName:           'Ekterly',
  assetGenericName:    'sebetralstat',
  therapeuticArea:     'HAE',
  therapeuticAreaFull: 'Hereditary Angioedema',
  drugClass:           'plasma kallikrein inhibitor',

  // ── App branding ────────────────────────────────────────────────────────────
  appName:    'InForm',
  appTagline: 'HAE Competitive Intelligence',
  appVendor:  '',

  // ── Demo metadata ───────────────────────────────────────────────────────────
  /** ISO date string — used by formatDate() and any "today" reference in data. */
  snapshotDate:        '2026-04-21',
  /** Human-readable label shown in the UI. */
  snapshotDateDisplay: '21 April 2026',
  demoBadgeLabel:      'Illustrative data – not for clinical or commercial decisions',
  dataSources:         'IQVIA DE/UK/US · Veeva CRM · Movianto logistics',

  // ── Links ───────────────────────────────────────────────────────────────────
  requestAccessUrl:      'mailto:ariya@phamax.ch?subject=InForm%20access%20request',
  expiryContactUrl:      'mailto:ariya@phamax.ch?subject=InForm%20session%20renewal',
  capabilityRequestUrl:  'mailto:ariya@phamax.ch?subject=Request%3A%20My%20Documents%20capability&body=I%20would%20like%20to%20use%20the%20My%20Documents%20capability%20in%20InForm.',

  // ── Design ──────────────────────────────────────────────────────────────────
  /** Primary accent colour — maps to the active/button colour in the current theme. */
  accentColour: 'var(--blue-700)',
}

/** Semantic version shown in the help modal for support conversations. */
export const APP_VERSION = 'v1.0.0'

/** Backwards-compatible alias used by older imports. */
export const CLIENT = DEMO
