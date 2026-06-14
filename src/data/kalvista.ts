/**
 * kalvista.ts — Single source of truth for all demo data.
 *
 * Rules:
 *   - All numbers shown in the UI come from here. No parallel numbers in components.
 *   - Never log any data to the browser console.
 *   - All competitor / market data is illustrative demo data only.
 *
 * To swap vertical: change the import below to point at a different dataset-*.ts file.
 */

export {
  competitorsData,
  alertsData,
  eventsData,
  marketDevelopments,
  marketPerformanceData,
  pricingData,
  reportsData,
  themesData,
  userData,
} from './dataset-hae'

import { DEMO } from '../config/demo-config'

/** Snapshot date used by formatDate() and any "today" reference in data. */
export const DEMO_SNAPSHOT_DATE = DEMO.snapshotDate

export { DEMO as demoConfig }
