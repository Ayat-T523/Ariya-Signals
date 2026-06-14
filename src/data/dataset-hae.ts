/**
 * dataset-hae.ts — HAE vertical data bundle.
 *
 * To add a new vertical (e.g. oncology):
 *   1. Copy this file to dataset-oncology.ts.
 *   2. Replace each JSON import with the new vertical's data files.
 *   3. In src/data/kalvista.ts, swap the import line from dataset-hae to dataset-oncology.
 *   4. In src/config/demo-config.ts, update all client-specific fields.
 */

export { default as competitorsData }       from './competitors.json'
export { default as alertsData }            from './alerts.json'
export { default as eventsData }            from './events.json'
export { default as marketDevelopments }    from './market-developments.json'
export { default as marketPerformanceData } from './market-performance.json'
export { default as pricingData }           from './pricing.json'
export { default as reportsData }           from './reports.json'
export { default as themesData }            from './themes.json'
export { default as userData }              from './user.json'
