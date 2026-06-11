/**
 * kalvista.ts — Single source of truth for all Kalvista locked numbers and data.
 *
 * Rules (same as scenario.ts in Ariya Compass):
 *   - All numbers shown in the UI come from here. No parallel numbers in components.
 *   - Never log any data to the browser console.
 *   - All competitor / market data is illustrative demo data only.
 */

// ── Re-export JSON data files so components import from here, not directly ───

export { default as competitorsData }      from './competitors.json'
export { default as alertsData }           from './alerts.json'
export { default as eventsData }           from './events.json'
export { default as marketDevelopments }   from './market-developments.json'
export { default as marketPerformanceData } from './market-performance.json'
export { default as pricingData }          from './pricing.json'
export { default as reportsData }          from './reports.json'
export { default as themesData }           from './themes.json'
export { default as userData }             from './user.json'

// ── Demo snapshot date — all "relative time" displays compute from this ───────
export const DEMO_SNAPSHOT_DATE = '2026-04-21'
