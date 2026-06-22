# Ariya Signals — Full System Audit · June 2026

**Prepared for:** Claude Chat ideation session  
**Scope:** All modules — War Room, Intelligence Feed, Competitors, Shell, Demo Configurator  
**Format:** Current state per module → issues per module → root causes → code context for targeted fixes

---

## Table of Contents

1. [War Room](#1-war-room)
2. [War Room — "WHY —" Rationale Text](#2-war-room--why--rationale-text)
3. [Intelligence Feed](#3-intelligence-feed)
4. [Competitors Module](#4-competitors-module)
5. [Overall Shell](#5-overall-shell)
6. [Demo Configurator / Onboarding](#6-demo-configurator--onboarding)
7. [Technical Context — Key Code Snippets](#7-technical-context--key-code-snippets)
8. [Data Trust Map](#8-data-trust-map)
9. [Open Questions for Ideation](#9-open-questions-for-ideation)

---

## 1. War Room

### Current State

| Section | Data source | Live? |
|---|---|---|
| Top Signals cards | Supabase `company_signals` | ✅ Live |
| "WHY —" rationale text | `buildWhyItMatters()` — template function | ⚠️ Template only |
| Market Weather / pressure status | Derived from live signal severity counts | ✅ Live |
| "What moved this week" needle items | Supabase `company_signals` | ✅ Live |
| Implications section | `PaidGate` placeholder | ✅ Gated |
| Tracked competitor cards | Supabase `company_signals` summary | ✅ Live (with stub fallback) |
| Upcoming events | Supabase `regulatory_calendar` + `events.json` | ✅ Live |
| Strategic posture labels ("Incumbent to displace") | Hardcoded in `competitors.json` | ❌ Manual |

### Issues

#### Issue 1 — Top Signals shows 3 cards instead of 5 (Critical)

**Symptom:** User sees 3 Top Signals cards. The code has `.slice(0, 5)` which is correct.

**Root cause:** Signals pass through `isSignalReadable()` before reaching the slice. Only signals that pass the prose quality gate are included in `liveDisplayItems`. If only 3 signals pass the readable filter, only 3 cards show. This is not a slice issue — it is a signal quality/filtering issue. Expanding `isSignalReadable` or lowering the prose threshold would surface more signals.

**File:** `src/pages/WarRoom.tsx` — `isSignalReadable()` function, `liveDisplayItems` derivation

---

#### Issue 2 — Importance and Recency filters produce near-identical results (Medium)

**Symptom:** Switching between Importance and Recency filter shows no visible change in the signal order.

**Root cause:** 
- Importance = sort by `SEVERITY_RANK` then date descending
- Recency = sort unread-first, then date descending

These are logically different, but if all displayed signals are currently unread (the common case when David first opens the War Room), both sorts reduce to date descending. They look identical until some signals have been read.

**Fix direction:** Make Importance sort more visibly distinct — e.g. group HIGH → MEDIUM → LOW as labelled sections, so the ranked grouping is visible regardless of read state.

**File:** `src/pages/WarRoom.tsx` — filter/sort logic on `liveDisplayItems`

---

#### Issue 3 — CSL Behring signal cards are seeded/illustrative data (Critical)

**Symptom:** CSL Behring signals appear on the War Room as if live.

**Root cause:** CSL Limited files with ASX (Australian Securities Exchange), not SEC. No automated ingest covers ASX. The signals currently in Supabase for `competitor_id = 'csl-behring'` were seeded manually — they are not live EDGAR data. They must not appear in the live portal without a clear "Illustrative" badge or be removed entirely from live views.

**File:** Supabase `company_signals` table — rows with `competitor_id = 'csl-behring'`

---

#### Issue 4 — Export button in Market Weather (Cleanup)

**Symptom:** An "Export" button appears in the Market Weather card header. It calls `window.print()`.

**Fix:** Remove `<ExportButton label="Export" />` from the Market Weather CardHeader right-side.

**File:** `src/pages/WarRoom.tsx` — Market Weather CardHeader

---

#### Issue 5 — Tracked competitor cards show stub "executive summary" text (Medium)

**Symptom:** Pharvaris and Takeda competitor cards on the War Room show old static `executiveSummary` text from `competitors.json` instead of live recent activity.

**Root cause:** `CompactCompetitorCard` falls back to `competitor.executiveSummary` when no recent live signals exist for that competitor. Pharvaris and Takeda have not generated readable signals recently, so the fallback fires. The fallback text is manually authored stub content.

**Fix direction:** Replace stub fallback with an honest empty state: "No recent signals" rather than stub text.

**File:** `src/pages/WarRoom.tsx` — `CompactCompetitorCard` fallback logic

---

#### Issue 6 — Strategic posture labels are hardcoded editorial strings (Medium)

**Symptom:** Labels like "Incumbent to displace", "Adjacent oral competitor" appear on competitor cards.

**Root cause:** These are manually authored strings in `competitors.json` under the `strategicPosture` field. They are surfaced via `POSTURE_STYLE` constant in `WarRoom.tsx` (lines 339–346). They are not computed from data — they are editorial opinion hardcoded into a config file.

**Fix direction:** Either (a) compute from data (approved products, pipeline phase, market entry date), or (b) make the label source explicit with a "Manually set" or editorial badge so users understand these are not AI-derived.

**File:** `src/pages/WarRoom.tsx` lines 339–346, `src/data/competitors.json` `strategicPosture` field per competitor

---

## 2. War Room — "WHY —" Rationale Text

### The Core Problem

The "WHY —" line on every Top Signals card is a **pure template**. It reads the signal type, picks one of five fixed sentences, and substitutes the competitor name. The actual content of the filing — what the deal was, who left or joined, what the clinical result showed — is **never used**.

Every deal card from every competitor says the same thing. Every exec change says the same thing. It is not a rationale; it is a category label dressed as an insight.

### The Full Function

```typescript
// WarRoom.tsx lines 220–236
function buildWhyItMatters(s, competitorName, assetName, indication) {
  const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`  // assembled but barely used

  switch (s.signal_type) {
    case 'deal':
      // Every deal, every competitor, always the same sentence
      return `${competitorName} is making a strategic move — watch for pipeline or commercial implications in ${indication}.`

    case 'exec_change':
      // Every exec change, every competitor, always the same sentence
      return `Leadership change at ${competitorName} — often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity.`

    case 'press_release':
      if (CLINICAL_KW.test(text))
        // Every clinical press release, always the same sentence
        return `Clinical update from ${competitorName} — assess relative positioning versus ${assetName} on efficacy and safety.`
      if (COMMERCIAL_KW.test(text))
        return `${competitorName} is signalling commercial performance or launch momentum — review for market share implications.`
      return `${competitorName} filed a public disclosure — review for competitive implications relevant to ${indication}.`

    default:
      return `${competitorName} filed a regulatory or corporate disclosure — monitor for follow-up.`
  }
}
```

The `text` variable on line 221 reads both `headline` and `body_excerpt` from the signal — but is only ever tested against regex patterns to pick a branch. The actual **content** of `body_excerpt` is never used to construct the output string.

### Current Output vs What Would Be Useful

**BioCryst deal 8-K** (body_excerpt contains: "$874M acquisition of Astria, adds navenibart"):
- *Current:* "BioCryst is making a strategic move — watch for pipeline or commercial implications in HAE."
- This sentence is equally true (and equally useless) for a $5M IP licensing deal.

**Takeda exec_change 8-K** (body_excerpt names the departing CMO):
- *Current:* "Leadership change at Takeda — often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity."
- The person's name, their role, and whether it was a departure or new appointment are all in body_excerpt. None of it is used.

**What a useful WHY actually answers:** *What specifically happened, and what does that mean for my position?*
- Deal → what was acquired/licensed, what asset it adds, which market segment is affected
- Exec change → title of the person, departure vs appointment, which function they led
- Clinical PR → which phase, result direction (positive/negative/mixed), which endpoint

### Fix Direction

The information is already in `body_excerpt` (up to 500 chars of filing text). The fix is **pattern extraction, not AI**. SEC 8-Ks follow predictable structures:

- **Deals (Item 2.01):** regex for dollar amounts (`/\$[\d,.]+\s*(million|billion)/i`), company names near "acquisition of" / "license from", drug names in HAE_LEXICON → *"BioCryst acquired Astria Therapeutics for $874M, adding navenibart to their HAE portfolio."*
- **Exec changes (Item 5.02):** extract title keywords near a proper noun → *"Takeda's Chief Medical Officer departed — monitor for CMO replacement and any shift in clinical strategy."*
- **Clinical PRs:** phase number + result direction keywords → *"BioCryst reported Phase 3 results for navenibart — positive HAE prophylaxis signal. Assess impact on long-acting positioning vs Takhzyro."*

Failed extraction falls back to the current generic template — no regression risk.

---

## 3. Intelligence Feed

### Current State

| Tab | Data source | Live? |
|---|---|---|
| Events | `events.json` (15 real entries) + Supabase `regulatory_calendar` | ✅ Live |
| Earnings Filings | Supabase `company_signals` (filtered to `signal_type = 'earnings'`) | ✅ Live but tab needs PaidGate |
| Market Developments | `market-developments.json` (5 real entries) + Supabase live deal signals | ✅ Live |
| Reports | `reports.json` (all illustrative) | ❌ All illustrative |
| Key Catalysts Calendar | Derived from `eventsData` at module load | ✅ Live (congress + earnings from events.json) |

### Issues

#### Issue 1 — EMA calendar event cards are content-sparse vs other event types (Medium)

**Symptom:** EMA calendar events render the same `EventCard` component as manually authored events.json entries, but they are missing: attending competitors, expected topics, "Why this is relevant" / "Actionable follow up" panels, and CI significance text.

**Root cause:** EMA rows from Supabase are mapped with `attendingCompetitors: []` and `expectedTopics: []` (hardcoded empty arrays). The `buildRegulatoryContext()` function has a guard `if ((event as any)._isLive) return null` on line 107 that blocks the depth panels for all EMA rows. This guard was added to prevent the function from running on rows without `ciContext` data — but the guard is too broad. The `ciContext` availability check on line 108 already handles the missing-data case safely.

**Fix direction:** Remove the `_isLive` guard on line 107 and generate context text for EMA event types dynamically (CHMP, PRAC, OTHER each have predictable significance text). Or generate `ciContext`-style text from the `event_type` field at mapping time.

**File:** `src/pages/Portal.tsx` lines 105–111 (`buildRegulatoryContext`), lines 963–969 (EMA row mapping)

---

#### Issue 2 — Earnings Filings tab should be gated with PaidGate, not fully clickable (Medium)

**Symptom:** The "Earnings Filings" tab opens normally and shows content. User expectation is that it should show a PaidGate badge and not be clickable.

**Fix:** Add a `PaidGate` component as the tab content for the Earnings Filings tab, or disable the tab with a lock icon. Pattern already exists in the codebase: `src/components/ui/PaidGate.tsx`.

**File:** `src/pages/Portal.tsx` — Earnings Filings tab render

---

#### Issue 3 — Key Catalysts Calendar: verify it is actually working and live (Verify)

**Current state:** The calendar is constructed from `eventsData` at module load time via `CONF_DATA`, `IR_DATA`, and `CAL_CELLS` constants. These are computed from `events.json` filtered by year and excluding `sourceType: 'illustrative'` entries. It is NOT hardcoded — it does use real events.json data.

**What to verify:** Confirm congress months and earnings months render correctly based on events.json dates. Confirm `event-005` (illustrative FDA Advisory) is excluded. Confirm ClinicalTrials.gov trial dates are being used for milestone cells (or identify that they are not, which would be a gap).

**File:** `src/pages/Portal.tsx` — `CONF_DATA`, `IR_DATA`, `CAL_CELLS` constants

---

#### Issue 4 — All 13 reports are illustrative (Structural)

**Current state:** `reports.json` contains 13 entries, all with `isIllustrative: true`. All report cards show an "Illustrative" badge. There is no live reports data source.

**This is a known structural gap** — reports require analyst synthesis and cannot be auto-generated from a free API. The Illustrative badges are correct. No UX change needed until real reports exist.

---

## 4. Competitors Module

### Current State

| Section | Data source | Live? |
|---|---|---|
| Competitor list cards | `competitors.json` (descriptors now computed from `marketedProducts`/`pipeline`) | ✅ Computed |
| Company Tab — financials (SEC badge) | Supabase `financial_snapshots` | ✅ Live |
| Company Tab — financials (Illustrative) | `competitors.json` stubs | ❌ Illustrative |
| Company Tab — disease area revenue card | `competitors.json` or financials | ❌ Remove |
| Company Tab — recent leadership changes | Supabase `company_signals` (exec_change) → `cleanSignalHeadline()` | ⚠️ Live but garbage text |
| Company Tab — recent signals | Supabase `company_signals` → `cleanSignalHeadline()` | ⚠️ Live but garbage text |
| Company Tab — hiring signals | Supabase `company_signals` (exec_change) → `cleanSignalHeadline()` | ⚠️ Live but garbage text |
| Company Tab — SWOT Analysis | `PaidGate` placeholder | ✅ Gated |
| Pipeline Tab — trial data | Supabase `trials` (ClinicalTrials.gov) | ✅ Live |
| Pipeline Tab — Gantt rows | `COMP_ROWS_BY_TYPE` hardcoded JS | ❌ Hardcoded |
| Messaging Tab — announcements | Supabase `company_signals` (press_release) | ✅ Live |
| Messaging Tab — source documents | Supabase `documents` | ✅ Live |
| Messaging Tab — current message card | `competitors.json` `.messaging` stubs | ❌ 100% stubs, no transformer |

### Issues

#### Issue 1 — Remove Disease Area Revenue card from Company Tab (Cleanup)

**Location:** `src/components/competitor/tabs/CompanyTab.tsx` — `FinancialsSection` lines 96–108  
**Fix:** Remove the disease area revenue row. It shows "Not reported separately" (live) or "HAE Franchise Revenue" (illustrative) — neither adds value at this stage.

---

#### Issue 2 — Recent Leadership Changes: garbage content (Critical)

**Symptom:** Leadership change entries show raw SEC filing metadata instead of readable executive change summaries. Examples include exhibit filenames, accession number strings, XBRL data fragments.

**Root cause:** `cleanSignalHeadline()` in `useCompetitorSupabase.ts` only catches 3 specific SEC boilerplate patterns. The sentence regex `([A-Z][^.!?]{15,400}[.!?])` matches anything starting with a capital letter and ending with a period — including metadata rows that happen to fit this shape. The `isSecMetadata()` guard only catches NYSE/NASDAQ ticker patterns and misses: dual CIK numbers, exhibit filenames, form-type codes, and raw XBRL metadata.

**File:** `src/hooks/useCompetitorSupabase.ts` — `cleanSignalHeadline()` lines 369–397, `isSecMetadata()` lines 422–427

---

#### Issue 3 — Recent Signals: same garbage content as leadership changes (Critical)

**Same root cause** as Issue 2. All three sections (leadership changes, recent signals, hiring signals) call `cleanSignalHeadline()`. The function is defined once as a local closure inside the hook's `useEffect`.

---

#### Issue 4 — Hiring Signals: same garbage content (Critical)

**Same root cause.** Additionally: the "hiring signals" section uses `exec_change` type signals — which are SEC 8-K Item 5.02 filings about officer departures and appointments. These are not hiring signals in the conventional sense. The section label is misleading.

---

#### Issue 5 — Messaging Tab: no live transformer exists (Structural)

**Current state:**
- `AnnouncementsSection`: live Supabase press_release signals ✅
- `SourceDocsSection`: live Supabase documents table ✅
- `CurrentMessageCard`: entirely from `competitors.json` `.messaging` stubs ❌

There is no transformer, hook, or ingest script that builds structured messaging data from live sources. The `competitors.json` `.messaging` field contains manually authored positioning statements, message pillars, and claim lists — 100% invented, not derived from any document.

**The comment in the illustrative banner reads:** *"none of which has been ingested yet"* — which confirms this is a known gap, not a temporary placeholder.

**Fix direction:** Requires a document corpus (FDA labels from DailyMed API, SEC 10-K Item 1 "Business" sections, EMA EPARs) + human analyst curation. Cannot be auto-populated from raw text without human review. Until then, either: show `PaidGate` on the messaging card, or display "Data not yet available" with source links to the underlying documents.

---

## 5. Overall Shell

### Issue 1 — Illustrative data banner still shows globally (Cleanup)

**Symptom:** A blue banner at the top of every page reads something like "Demo data — some content is illustrative." This banner was added during early demo phases and is now misleading because most of the platform is live data.

**Location:** `src/components/shell/TopBar.tsx` lines 124–152 (unconditional render, `role="note"`, background `#d2e2ff`). Also in `src/components/layout/Header.tsx` lines 232–245.

**Fix:** Remove the banner entirely. Replace with per-card "Illustrative" badges on the specific items that are still stubbed (reports, pricing, some competitors.json fields). The banner implies the whole platform is fake; per-card badges are accurate.

---

## 6. Demo Configurator / Onboarding

### Current State

The demo flow itself works correctly. The configurator is the problem.

**Step 1 — User Role:** 5 hardcoded radio options (Commercial, Market Access, Analytics, BD, Executive). Saved to localStorage as `ariya-user-role`. **Never read anywhere in the app.** Entirely decorative.

**Step 2 — Therapeutic Area:** 4 hardcoded radio options (HAE, Oncology, Immunology, Neurology) + "Other" unlocks a free-text input. Saved value used only for greeting text and narrative labels — **no content filtering.**

**Step 3 — Asset Name:** Open free-text field. Placeholder is "Ekterly". Accepts any string. **No list, no validation, no connection to what's in our system.** Used only for greeting labels.

**Missing — Competitor Selection:** No step exists to select which competitors to track. The portal defaults to Takeda / BioCryst / Pharvaris — hardcoded in AppContext. Users can only toggle competitors after onboarding inside the War Room.

### Why Configuration Doesn't Drive the Portal

Selecting "Oncology" in onboarding shows HAE content. The `useConfig()` hook returns the saved indication value, but it is used only to personalise text strings (greeting, event annotations) — not to filter any data. All events, reports, competitors, and signals are shown to every user regardless of configuration.

The `HAE_LEXICON` in `WarRoom.tsx` is entirely hardcoded — it has no connection to whatever the user configured as their asset or indication. Typing any asset name into Step 3 changes the greeting but does not change which signals surface.

### Issues

#### Issue 1 — Configuration does not filter the portal (Core)

For the configurator to be meaningful, selecting a TA + asset must determine:
- Which competitors are tracked by default
- Which events appear (filtered to relevant TA and competitor set)
- Which signals surface (relevance lexicon should include the configured asset's INN)
- Which pipeline data shows (assets filtered by indication)

**File:** `AppContext.tsx` — `useConfig()`, `WarRoom.tsx` lines 124–136 (`HAE_LEXICON` hardcoded), `Portal.tsx` (no indication filter on events/reports)

---

#### Issue 2 — Asset name is a free-text field — should be a list from our system (UX)

Step 3 is a blank text input. A user can type anything, and the system has no way to associate the typed string with real product data (INN, competitors, indication).

**Correct approach:** A searchable list of client assets from a curated config file (brand name → INN → indication → suggested competitor set). Selecting an asset auto-populates the indication and drives the competitor defaults. The list must be maintainable without a code change.

**File:** `OnboardingModal.tsx` lines ~250–290 (Step 3 render), `src/config/demo-config.ts`

---

#### Issue 3 — No competitor selection step (UX)

The onboarding flow never asks which competitors to track. The correct flow: after selecting the asset, show the competitor set relevant to that asset (pre-selected), allow the user to confirm or adjust before entering the portal.

**File:** `AppContext.tsx` lines 15–24 (hardcoded defaults), `OnboardingModal.tsx` (no competitor step)

---

#### Issue 4 — User Role collected but never used (Waste)

Step 1 collects a role that is saved but never read by any component. Either (a) make it drive something (landing module, default view), or (b) remove it until it does.

---

#### Issue 5 — Indication "Other" free-text bypasses system linkage (UX)

The "Other — I'll type it" option in Step 2 creates the same problem as the asset name field: a free-text value has no system linkage. The lexicon, competitor defaults, and signal filters remain HAE-specific regardless of what is typed.

**Fix:** Remove "Other" or replace with a longer list from a maintainable config file.

---

### What a Correctly Wired Configurator Should Look Like

**Step 1 — Select your asset (list, not free text):** Searchable card-select UI showing branded drug names from a curated list in our system. Selecting an asset auto-fills the indication and drives a suggested competitor set.

**Step 2 — Confirm or adjust competitors (pre-selected from asset):** Show the relevant competitor set, allow deselection. This replaces the hardcoded AppContext defaults.

**Step 3 — Select role (only if it drives something):** Keep only if role determines the landing module or personalises layout. Remove if not.

**What "portal shows information only based on configuration" requires technically:**
1. All data queries scope to the configured competitor set
2. The relevance filter (HAE_LEXICON) is built from the selected asset's INN at runtime
3. Portal events filter to `attendingCompetitors` overlapping with the configured set
4. Reports/Market Developments filter to entries tagged with the relevant indication or competitor

---

## 7. Technical Context — Key Code Snippets

### 7.1 Config propagation: `useConfig()`, `HAE_LEXICON`, AppContext state

**Files:** `src/context/AppContext.tsx` lines 62–237, `src/pages/WarRoom.tsx` lines 124–136

```typescript
// AppContext.tsx — three state slices
const [userRole, setUserRoleState] = useState(() =>
  localStorage.getItem('ariya-user-role') || null
)
const [userIndication, setUserIndicationState] = useState(() =>
  localStorage.getItem('ariya-user-indication') || null
)
const [userAssetName, setUserAssetNameState] = useState(() =>
  localStorage.getItem('ariya-user-asset') || null
)

// Watched competitors — hardcoded defaults, NOT driven by onboarding
const [watchedCompetitors, setWatchedCompetitors] = useState(() => {
  const stored = localStorage.getItem('pharma-inc-ciwarroom-watched')
  return stored ? new Set(JSON.parse(stored)) : new Set(['takeda', 'biocryst', 'pharvaris'])
})

// Public hook consumed by WarRoom, Portal, etc.
export function useConfig() {
  const { userIndication, userAssetName } = useApp()
  return {
    assetName:        userAssetName  || DEMO.assetName,        // fallback: "Ekterly"
    indication:       userIndication || DEMO.therapeuticArea,  // fallback: "HAE"
    indicationFull:   userIndication || DEMO.therapeuticAreaFull,
    assetGenericName: DEMO.assetGenericName,  // ALWAYS hardcoded — never from user input
  }
}
```

```typescript
// WarRoom.tsx lines 124–136 — hardcoded, not derived from useConfig()
const HAE_LEXICON = {
  inns: [
    'berotralstat', 'navenibart', 'bcx17725', 'garadacimab',
    'lonvoguran', 'ziclumeran', 'donidalorsen', 'deucrictibant',
    'lanadelumab', 'icatibant', 'mezagitamab', 'sebetralstat',
    'orladeyo', 'takhzyro', 'firazyr', 'dawnzera', 'andembry',
  ],
  ta_terms: [
    'hae', 'hereditary angioedema', 'angioedema', 'bradykinin',
    'kallikrein', 'c1 inhibitor', 'c1-inh', 'plasma kallikrein',
    'factor xii', 'contact pathway', 'haelo',
  ],
}

// WarRoom.tsx line 931 — watched competitors bypass the lexicon gate; all others must match
const relevantSignals = readableSignals.filter(
  s => watchedCompetitors.has(s.competitor_id ?? '') || isRelevant(s, HAE_LEXICON)
)
```

**Key insight:** Every downstream filter (`isRelevant`, `isRelevantEMAEvent`, `computeSeverity`, pressure score) already receives the lexicon as a parameter — the call sites are clean. Only the lexicon construction needs to change to make config drive the portal.

---

### 7.2 Headline cleaning: `cleanSignalHeadline()` + `isSecMetadata()`

**File:** `src/hooks/useCompetitorSupabase.ts` lines 369–439  
**Used by:** Deals, exec changes, press releases, and hiring signals in Company Tab — all four sections.

```typescript
// Defined as a local closure inside useEffect — not exported, not reusable
function cleanSignalHeadline(signal: any): string {
  const raw     = (signal.headline ?? '').trim()
  const excerpt = (signal.body_excerpt ?? '').trim()

  // Only catches 3 very specific SEC boilerplate patterns
  const BOILERPLATE = [
    /^[a-z\s,;]*material definitive agreement[.,\s]*/i,
    /^[a-z\s,;]*directors or certain officers[^.]*\.\s*/i,
    /^departure of directors[^.]*\.\s*/i,
  ]
  const isBoilerplate = BOILERPLATE.some(p => p.test(raw))
  const rawHasCompleteSentence = /[A-Z][^.!?]{15,}[.!?]/.test(raw)
  let cleaned = (isBoilerplate || !rawHasCompleteSentence) ? (excerpt || raw) : raw
  for (const p of BOILERPLATE) { cleaned = cleaned.replace(p, '') }

  cleaned = cleaned
    .replace(/&#8220;|&ldquo;/g, '"').replace(/&#8221;|&rdquo;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&amp;/g, '&').trim()

  // Extract first complete sentence (capital letter start, 15–400 chars, ends in punctuation)
  const sentence = cleaned.match(/([A-Z][^.!?]{15,400}[.!?])/)
  if (sentence) return sentence[1].trim()

  if (cleaned.length > 20) {
    const MAX = 200
    if (cleaned.length <= MAX) return cleaned
    const cut = cleaned.lastIndexOf(' ', MAX)
    return cleaned.slice(0, cut > 0 ? cut : MAX).trim() + '…'
  }
  return raw.slice(0, 120) || 'SEC filing'
}

// Detects SEC filing metadata — only catches ticker-adjacent patterns
function isSecMetadata(s: any): boolean {
  const text = (s.headline ?? '') + ' ' + (s.body_excerpt ?? '')
  return /\b(NASDAQ|NYSE|AMEX)\s+(true|false)/i.test(text) ||
         /SECURITIES AND EXCHANGE COMMISSION/i.test(text) ||
         /^[A-Z0-9\s]{0,5}(NASDAQ|NYSE)\b/.test((s.headline ?? '').trim())
  // Does NOT catch: dual CIK numbers, exhibit filenames, form-type codes,
  // accession number strings, XBRL metadata — these all pass through
}
```

**Why garbage slips through:** The sentence regex `([A-Z][^.!?]{15,400}[.!?])` matches anything starting with a capital letter and ending with a period. SEC exhibit table rows and metadata strings often fit this shape. Example: `"K false 0001652130 0001652130 2026-04-27"` — starts with "K", is over 15 chars, and the date looks like a sentence terminator to a simple regex.

---

### 7.3 EMA card depth: `buildRegulatoryContext()` + `_isLive` guard

**File:** `src/pages/Portal.tsx` lines 105–111, 963–969

```typescript
// The guard that prevents EMA events getting "Why this is relevant" / "Actionable follow up" panels
function buildRegulatoryContext(event: any): { whyRelevant: string; actionableFollowUp: string } | null {
  if (event.type !== 'regulatory') return null
  if ((event as any)._isLive) return null        // ← blocks ALL EMA calendar rows
  const ctx = (event as any).ciContext
  if (!ctx?.whyRelevant || !ctx?.actionableFollowUp) return null
  return { whyRelevant: ctx.whyRelevant, actionableFollowUp: ctx.actionableFollowUp }
}

// How EMA rows are mapped from Supabase — _isLive is always true
const mappedCalendarEvents = (calendarEvents ?? []).map(row => ({
  id:                   `ema-${row.id}`,
  type:                 'regulatory' as const,
  title:                row.title ?? 'EMA Committee Meeting',
  location:             'Amsterdam, Netherlands (EMA)',
  attendingCompetitors: [] as string[],   // always empty
  expectedTopics:       [] as string[],   // always empty
  _isLive:              true as const,    // this flag blocks the depth panels
}))
```

**Fix:** The `ciContext` availability check on line 108 already safely handles the missing-data case. Remove the `_isLive` guard on line 107 and generate context text for EMA event types dynamically. CHMP, PRAC, and OTHER each have predictable significance text that can be templated from `event_type`.

---

## 8. Data Trust Map

| Module | Section | Source | Trust |
|---|---|---|---|
| War Room | Live signals (Top Signals, needle items) | Supabase `company_signals` (SEC EDGAR) | ✅ Live |
| War Room | WHY rationale text | Template function | ⚠️ Template — not content-derived |
| War Room | CSL Behring signals | Supabase (manually seeded) | ❌ Illustrative — not live EDGAR |
| War Room | Posture labels ("Incumbent to displace") | `competitors.json` manual field | ❌ Editorial |
| War Room | Tracked competitor card — fallback text | `competitors.json` `executiveSummary` | ❌ Stub |
| Intelligence Feed | Events (congress, earnings, regulatory) | `events.json` (verified sources) | ✅ Live |
| Intelligence Feed | EMA calendar events | Supabase `regulatory_calendar` | ✅ Live |
| Intelligence Feed | Market Developments (5 real entries) | `market-developments.json` | ✅ Live |
| Intelligence Feed | Reports (13 entries) | `reports.json` | ❌ All illustrative |
| Company Tab | Financials (SEC badge) | Supabase `financial_snapshots` | ✅ Live |
| Company Tab | Financials (no badge / Illustrative) | `competitors.json` stubs | ❌ Illustrative |
| Company Tab | Leadership changes / signals / hiring | Supabase `company_signals` → `cleanSignalHeadline()` | ⚠️ Live source, garbage display |
| Company Tab | SWOT Analysis | PaidGate | ✅ Gated |
| Pipeline Tab | Trial data | Supabase `trials` (ClinicalTrials.gov) | ✅ Live |
| Pipeline Tab | Gantt rows | `COMP_ROWS_BY_TYPE` hardcoded JS | ❌ Hardcoded |
| Messaging Tab | Announcements | Supabase `company_signals` | ✅ Live |
| Messaging Tab | Source documents | Supabase `documents` | ✅ Live |
| Messaging Tab | Current message card / pillars | `competitors.json` `.messaging` | ❌ 100% invented |
| Configurator | All configuration | localStorage only | ⚠️ Config saved but doesn't drive portal |

---

## 9. Open Questions for Ideation

**Q1 — Configurator asset list: where does the list come from?**  
The "select your asset" step needs a curated list of client assets with their associated INNs, indications, and competitor sets. This list needs to live somewhere maintainable (a config file, not hardcoded in the component). What is the right data structure? Who maintains it? Does it live in `demo-config.ts`, a new `assets-config.json`, or in Supabase?

**Q2 — WHY rationale: regex extraction vs LLM?**  
Pattern extraction from `body_excerpt` works for well-structured 8-Ks but may produce partial or empty results for malformed filings. At what failure rate does it make sense to use an LLM call instead, and what does that mean for cost and latency on the signal card render?

**Q3 — Headline cleaning: rewrite vs new approach?**  
`cleanSignalHeadline()` is a local closure inside a hook's `useEffect` — it is not testable, not reusable, and not visible from the War Room (which has its own separate `cleanNeedleText()` doing similar work). The two functions should be one. Should this be a shared utility in `src/lib/` with a proper positive prose gate, or should the fix happen at ingest time (storing clean headlines in Supabase at ingest, not cleaning at display time)?

**Q4 — CSL Behring: what is the intended long-term solution?**  
CSL files with ASX — no automated ingest is possible. Options: (a) remove CSL from the platform until manual annual download is integrated; (b) keep CSL with permanent "Illustrative" badges on all their data; (c) build a manual upload flow for ASX annual reports. Which direction?

---

*Document compiled: June 2026 · Based on codebase audit of branch `iteration-4`*
