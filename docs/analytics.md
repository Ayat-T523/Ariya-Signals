# Analytics Event Catalogue

**Platform:** PostHog (internal team only)  
**Gate:** `VITE_POSTHOG_KEY` env var — absent in client Vercel deployments → PostHog never initialises  
**Identity:** Stubbed as `ariya-internal` until Clerk auth is integrated (swap isolated to `src/lib/analytics.ts`)

---

## Events

### Navigation

| Event | Properties | Fired when |
|---|---|---|
| `page_viewed` | `route: string`, `from_route?: string` | Every route change via React Router |

---

### War Room

| Event | Properties | Fired when |
|---|---|---|
| `signal_opened` | `signal_id: string`, `priority: string`, `source: string` | User clicks a signal row to expand it |
| `signal_sorted` | `mode: 'importance' \| 'recency'` | User switches the sort pill |

---

### Competitors

| Event | Properties | Fired when |
|---|---|---|
| `competitor_viewed` | `competitor_name: string` | User clicks a competitor card |
| `competitor_tab_viewed` | `tab: string`, `competitor_id: string` | User switches tabs on a competitor profile |

---

### Ask Ariya

| Event | Properties | Fired when |
|---|---|---|
| `ariya_prompt_clicked` | `prompt_id: string`, `prompt_text: string` | User clicks "Try Prompt" on a question card |
| `ariya_question_typed` | `question_length: number` | User submits a free-text question (length only — never capture content) |

---

### Alerts

| Event | Properties | Fired when |
|---|---|---|
| `alert_expanded` | `alert_id: string` | User expands an alert |
| `alerts_marked_all_read` | `count: number` | User clicks "Mark all read" |

---

### General UI

| Event | Properties | Fired when |
|---|---|---|
| `export_clicked` | `surface: string` | User clicks any export button |
| `feedback_opened` | — | User opens the feedback panel |
| `feedback_submitted` | — | User submits feedback |

---

### Onboarding & Tour

| Event | Properties | Fired when |
|---|---|---|
| `tour_started` | — | User starts the guided tour |
| `tour_completed` | — | User finishes the final tour step |
| `tour_skipped` | `step: number` | User clicks "Skip tour" |
| `session_expiry_banner_seen` | — | Session expiry banner becomes visible |

---

## Suggested PostHog Insights

### 1. Engagement funnel
**Goal:** See how many sessions progress from landing → signal → AI prompt.

- Funnel: `page_viewed (route = /)` → `signal_opened` → `ariya_prompt_clicked`
- Filter: `is_internal = true`

Tells you which step has the biggest drop-off and whether the War Room is driving users to Ask Ariya.

---

### 2. Most-viewed competitors
**Goal:** Understand which competitors get the most attention.

- Event: `competitor_viewed`
- Breakdown by: `competitor_name`
- Chart type: Bar

Helps prioritise which competitor profiles need the most depth.

---

### 3. Ask Ariya prompt popularity
**Goal:** Identify which suggested prompts resonate most.

- Event: `ariya_prompt_clicked`
- Breakdown by: `prompt_text`
- Chart type: Table (sorted by count descending)

Informs which prompts to surface first and which to retire.

---

## Implementation notes

- `capture_pageview: false` — manual `page_viewed` fires with `from_route` for proper routing context
- `autocapture: true` — catches button clicks and form interactions automatically alongside custom events
- Session recording: `maskAllInputs: true`, `mask_all_text: false` — typed fields masked, page text visible
- All calls go through `src/lib/analytics.ts` — Clerk identity swap touches only that file
