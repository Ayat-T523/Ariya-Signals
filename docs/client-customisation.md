# Client Customisation Guide

This guide explains how to spin up a new Ariya Signals instance for a different client (therapeutic area, asset, or company) without touching application logic.

---

## Architecture overview

| Layer | File | What it controls |
|---|---|---|
| **Config** | `src/config/demo-config.ts` | All client-specific strings and settings |
| **Dataset** | `src/data/dataset-hae.ts` | Which JSON data files to load |
| **Hub** | `src/data/kalvista.ts` | Re-exports dataset + config for components |
| **Data files** | `src/data/*.json` | The actual signals, competitors, events, etc. |

Every UI string that varies per client reads from `DEMO` in `demo-config.ts`. No hardcoded client strings exist outside that file and the JSON data files.

---

## Steps to create a new client variant

### 1 — Edit `src/config/demo-config.ts`

Update every field for the new client:

```ts
export const DEMO = {
  companyLabel:        'Novo Nordisk',          // client company name
  personaName:         'Sarah',                 // demo persona first name
  personaTitle:        'Head of Competitive Intelligence',
  personaEmail:        'sarah@novonordisk.com', // used in feedback form

  assetName:           'Orzyme',                // tracked product brand name
  assetGenericName:    'orzemidib',             // INN / generic name
  therapeuticArea:     'T1D',                   // short TA abbreviation
  therapeuticAreaFull: 'Type 1 Diabetes',
  drugClass:           'GABA-A receptor agonist',

  appName:             'Ariya Signals',         // keep unless white-labelled
  appTagline:          'T1D Competitive Intelligence',
  appVendor:           'Phamax',

  snapshotDate:        '2026-06-01',            // ISO date — "today" for all relative times
  snapshotDateDisplay: '1 June 2026',
  demoBadgeLabel:      'Illustrative data – not for clinical or commercial decisions',
  dataSources:         'IQVIA EU5 · Veeva CRM · EBSCO clinical feeds',

  requestAccessUrl:    'mailto:ariya@phamax.ch?subject=Ariya%20Signals%20T1D%20access',
  expiryContactUrl:    'mailto:ariya@phamax.ch?subject=Ariya%20Signals%20renewal',

  accentColour:        'var(--blue-700)',
}
```

### 2 — Create a new dataset file

Copy `src/data/dataset-hae.ts` to `src/data/dataset-t1d.ts` and replace the JSON imports:

```ts
// src/data/dataset-t1d.ts
export { default as competitorsData }       from './t1d-competitors.json'
export { default as alertsData }            from './t1d-alerts.json'
export { default as eventsData }            from './t1d-events.json'
export { default as marketDevelopments }    from './t1d-market-developments.json'
export { default as marketPerformanceData } from './t1d-market-performance.json'
export { default as pricingData }           from './t1d-pricing.json'
export { default as reportsData }           from './t1d-reports.json'
export { default as themesData }            from './t1d-themes.json'
export { default as userData }              from './t1d-user.json'
```

The JSON files themselves follow the same schema as the existing HAE files. Use them as a template.

### 3 — Wire the new dataset into `kalvista.ts`

In `src/data/kalvista.ts`, change the one import line:

```ts
// Before (HAE):
} from './dataset-hae'

// After (T1D):
} from './dataset-t1d'
```

This is the **only** change needed in application code once the config and dataset files are ready.

### 4 — Verify

```bash
npm run build    # must produce zero TypeScript errors
npm run dev      # smoke-check all pages
```

Check that:
- The illustrative-data ribbon shows the correct `demoBadgeLabel`
- War Room greeting shows the correct `therapeuticArea` and `assetName`
- Market Performance page shows the correct `dataSources` string
- Competitor profiles show the correct company name in the messaging comparison table

---

## Deploying as a separate Vercel project

Each client gets its own Vercel project pointing at the same Git repo. The client-specific `demo-config.ts` lives on its own branch.

### One-time setup per client

1. **Create a branch** for the client:
   ```bash
   git switch -c client/novo-nordisk-t1d main
   ```

2. **Apply the customisation** (steps 1–3 above) on the branch and push:
   ```bash
   git push -u origin client/novo-nordisk-t1d
   ```

3. **Create a new Vercel project** in the Vercel dashboard:
   - Connect the same GitHub repo
   - Set **Production Branch** to `client/novo-nordisk-t1d`
   - Leave Build Command as `npm run build` and Output Directory as `dist`

4. **Add environment variables** in Vercel → Settings → Environment Variables:

   | Variable | Example value | Required |
   |---|---|---|
   | `VITE_POSTHOG_KEY` | `phc_xxxxxxxx` | Optional (analytics) |
   | `VITE_IS_INTERNAL` | `false` | Optional |

   No client-specific env vars are needed beyond these — all client strings live in `demo-config.ts` on the branch.

5. **Deploy**: Vercel auto-deploys on every push to the branch.

### Per-client Vercel project summary

| Client | Branch | Vercel project |
|---|---|---|
| Pharma Inc (HAE) | `iteration-3` | `ariya-signals-hae` |
| Novo Nordisk (T1D) | `client/novo-nordisk-t1d` | `ariya-signals-t1d` |

---

## Files you must NOT edit for a client swap

The following files contain no client-specific strings and should not need changes:

- `src/App.tsx` — routing only
- `src/components/shell/NavPanel.tsx` *(nav labels only, no TA strings)*
- `src/components/ui/*` — generic UI components
- `src/context/AppContext.tsx` — generic state
- All CSS / token files

---

## Quick reference: fields in `demo-config.ts`

| Field | Used in |
|---|---|
| `companyLabel` | Nav help modal, Messaging tab header, AskModal disclaimer, FeedbackWidget |
| `assetName` | War Room greeting/subtitle, TopBar, TourBanner, MarketPerformance, PipelineTab legend |
| `therapeuticArea` | War Room header, TopBar subtitle, CompanyTab, PipelineTab empty state, TourBanner |
| `personaName` | `userData.user.name` (via `user.json`) |
| `personaEmail` | FeedbackWidget POST body |
| `demoBadgeLabel` | TopBar illustrative-data ribbon |
| `snapshotDate` | `formatDate()`, `Portal.tsx` reference date, `kalvista.ts` |
| `snapshotDateDisplay` | Available for any human-readable date display |
| `dataSources` | MarketPerformance page subtitle |
| `requestAccessUrl` | Available for access-request CTAs |
| `expiryContactUrl` | Available for session-expiry banner CTAs |
| `accentColour` | Available for dynamic theming overrides |
