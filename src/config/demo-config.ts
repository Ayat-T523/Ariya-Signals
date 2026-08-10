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
  // REMOVED: companyLabel, personaName, personaTitle, personaEmail.
  //
  // Ariya Light is one self-serve multi-tenant app, so who the user is comes from
  // their signed-in account (useAccountIdentity in context/AppContext), never from
  // configuration. These four fields made every visitor "David" from "Pharma Inc",
  // and sent david@pharmainc.com as the author of everyone's feedback.
  //
  // No organisation field replaces companyLabel: nothing in the schema stores one,
  // and rendering a company we do not hold would be a fabricated value.

  // ── Tracked asset ───────────────────────────────────────────────────────────
  assetName:           'Ekterly',
  assetGenericName:    'sebetralstat',
  therapeuticArea:     'HAE',
  therapeuticAreaFull: 'Hereditary Angioedema',
  drugClass:           'plasma kallikrein inhibitor',

  // ── App branding ────────────────────────────────────────────────────────────
  appName:    'Ariya Signals',
  appTagline: 'HAE Competitive Intelligence',
  appVendor:  'Phamax',

  // ── Demo metadata ───────────────────────────────────────────────────────────
  /** ISO date string — used by formatDate() and any "today" reference in data. */
  snapshotDate:        '2026-04-21',
  /** Human-readable label shown in the UI. */
  snapshotDateDisplay: '21 April 2026',
  demoBadgeLabel:      'Illustrative data – not for clinical or commercial decisions',
  dataSources:         'IQVIA DE/UK/US · Veeva CRM · Movianto logistics',

  // ── Links ───────────────────────────────────────────────────────────────────
  requestAccessUrl:      'mailto:ariya@phamax.ch?subject=Ariya%20Signals%20access%20request',
  expiryContactUrl:      'mailto:ariya@phamax.ch?subject=Ariya%20Signals%20session%20renewal',
  capabilityRequestUrl:  'mailto:ariya@phamax.ch?subject=Request%3A%20My%20Documents%20capability&body=I%20would%20like%20to%20use%20the%20My%20Documents%20capability%20in%20Ariya%20Signals.',

  // ── Design ──────────────────────────────────────────────────────────────────
  /** Primary accent colour — maps to the active/button colour in the current theme. */
  accentColour: 'var(--blue-700)',
}

/** Semantic version shown in the help modal for support conversations. */
export const APP_VERSION = 'v1.0.0'

/** Backwards-compatible alias used by older imports. */
export const CLIENT = DEMO
