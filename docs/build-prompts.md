# Ariya Signals — Build Prompts (Claude Code + Impeccable + InForm)

**Project:** Ariya Signals — CI portal, **reskinned in the InForm design language**
**Date:** 26 July 2026
**Design engine:** [Impeccable](https://impeccable.style/docs) (`/impeccable <command> <target>`)

---

## 0. Read-me

- **Two kinds of work:** *functional/data* (bug fix, PaidGate removal, DB, ingestion, mapping,
  counts) = **plain Claude Code**. *Design + surface build* = **Impeccable**, every pass targeting
  **InForm** (glass chrome / neumorphic content, Signal Indigo accent, JetBrains Mono for numbers,
  motion ≤320ms no-bounce). See `DESIGN.md`.
- **Paths below are from a June snapshot; confirm by reading the file.** Your live repo has
  diverged (InForm reskin). Each step lists **Read first** files — if a path 404s, `git ls-files |
  grep -i <name>` to find where it moved.
- **Migrate per-component, not per-page.** **Don't reskin a component a redesign will delete.**

**Session preamble (paste once):**
```
Read CLAUDE.md, PRODUCT.md, DESIGN.md, docs/hygiene-check.md, and the "Repository map" in
docs/build-prompts.md §0.5 first. Single full product — no tiers/gating/upsell. Reskin in InForm:
use src/styles/inform-tokens.css vars (never raw hex or legacy rgba(5,10,68,*)), glass for chrome +
neumorphism for content, JetBrains Mono for every number, motion ≤320ms no bounce. Confirm every
path by reading it; if missing, git ls-files | grep to locate. Don't invent data — stop and tell me
if a field/table is absent. After code changes: npm run build && npm run lint, graphify update .,
commit. Work only on the sub-step I give you.
```

---

## 0.5 Repository map (where everything lives)

**Pages** (`src/pages/`): `WarRoom.tsx` (route `/`), `AlertsPage.tsx` (`/alerts`),
`Portal.tsx` (`/intelligence`), `Competitors.tsx` (`/competitors`), `CompetitorProfile.tsx`
(`/competitors/:id`), `MarketPerformance.tsx`, `MyAlerts.tsx` (`/myspace/alerts`), `Ask.tsx`.

**Shell** (`src/components/shell/`): `NavPanel.tsx` (active nav — edit this, not `layout/Sidebar`),
`TopBar.tsx`, `ContentColumn.tsx`.

**Reusable UI primitives** (`src/components/ui/`) — **reuse these, don't rebuild:**
`SlideOver.tsx` (drawer — use for the Alerts detail drawer), `ProvenanceChip.tsx` (source/
provenance), `EmptyState.tsx`, `FilterDropdown.tsx` (sort/filter bars), `Skeleton.tsx` (loading),
`ConfidenceIndicator.tsx`, `CompetitorBadge.tsx`, `TimelineStrip.tsx`, `PaidGate.tsx` (to be
removed), `AskModal.tsx`.

**Competitor tabs** (`src/components/competitor/tabs/`): `CompanyTab.tsx` (holds the SWOT
`PaidGate`), `WhatItMeansTab.tsx`, `PipelineTab.tsx`, `KeyEventsTab.tsx`, `MessagingTab.tsx`, …

**InForm components** (`src/components/inform/` — **does not exist in production yet; built in
Phase 0.4**). The Inform repo is a *design sandbox* (HTML/CSS + specs), not an app clone — there
are no production React components to git-port. The whole library is built in production from the
design-system source (`src/styles/inform-theme.css` recipes + `docs/design/component-references/*.html`).
Reuse the `ui/` primitives above where they already cover a need (drawer, provenance, empty, filter).

**Data / logic** (`src/lib/`): `signalMapping.ts` (`mapSignal` — headline/whatHappened/whyItMatters
mapping + the `accession_number` headline bug), `db/index.ts` (`getRecentSignals`,
`getMarketImplications`, `DbRecentSignal`, `DbMarketImplication`), `transformers.ts`,
`signalText.ts`, `motion.ts` (`listItem` variant — the Competitors bug), `supabase.ts`.

**Design tokens** (`src/styles/`): `tokens.css` (legacy) + `inform-tokens.css`, `inform-theme.css`
(InForm — from `inform-design-system/styles/`). Data hub: `src/data/kalvista.ts`.

**State** (`src/context/AppContext.tsx`): `unreadCount`, `readAlerts`, `watchedCompetitors`,
onboarding — where alert/triage state lives.

**Ingestion / DB:** `api/ingest/*.ts` (`fda-labels`, `sec-deals`, `sec-financials`, `trials`) and
`supabase/functions/ingest-*` (edge functions) write signals. Schema/migrations in `supabase/*.sql`
— note `supabase/add-why-it-matters.sql`, `company_signals.sql`, `market_intelligence.sql`,
`supabase/migrations/`, `supabase/seeds/`.

---

## PHASE 0 — InForm foundation (once)

### 0.1 — Land the design system
```
Read first: inform-design-system/README.md, DESIGN.md, PRODUCT.md; src/index.css or src/main.tsx
(wherever global CSS imports live); index.html; vercel.json.
Do: copy inform-design-system/styles/inform-tokens.css → src/styles/inform-tokens.css and
inform-theme.css → src/styles/inform-theme.css; import tokens then theme globally before app CSS;
wire fonts Plus Jakarta Sans + JetBrains Mono (Fontshare/Google in index.html or self-host), update
vercel.json font-src CSP if using a CDN; move inform-design-system/reference/*.md → docs/design/
and component-references/*.html → docs/design/component-references/.
Verify build+lint. Commit.
```
### 0.2 — Kill the two systemic traps
```
Read first: src/styles/inform-tokens.css, src/styles/inform-theme.css; then grep for
rgba(5,10,68 across src/.
Do: remove --ease-spring: cubic-bezier(0.3,1.3,0.5,1) from both CSS files (violates ≤320ms/no-bounce);
replace legacy rgba(5,10,68,0.35–0.40) text with var(--ink-600) or darker (WCAG AA floor).
Verify build+lint. Commit.
```
### 0.3 — Baselines
```
npx impeccable detect src/ ; /impeccable document   (regenerates .impeccable/design.json)
```

### 0.4 — Build the InForm component library (porting step)
```
The Inform repo is a design sandbox (HTML/CSS + specs), NOT an app clone — nothing to git-merge.
Build the React component library in THIS repo from the design source, before any surface reskin.

Read first: src/styles/inform-tokens.css, src/styles/inform-theme.css; docs/design/component-
references/*.html (KPI Card, Feed Filter Bar, Market Weather, ProvenanceChip, Signal Card, Signal
Feed States, Signal Feed Variants, icons); docs/design/chat-design-system-spec.md; and the existing
primitives src/components/ui/{SlideOver,ProvenanceChip,EmptyState,FilterDropdown,Skeleton,
CompetitorBadge,ConfidenceIndicator}.tsx.

Do: create src/components/inform/ and implement, each token-driven (inform-tokens.css), correct
layer (neumorphic content / glass chrome), mono numbers, ≤320ms motion, WCAG-AA per DESIGN.md:
- Primitives first (only if a ui/ primitive doesn't already cover it): Button, Chip, Card, Input,
  Tabs, Table, Toast, Banner. Reuse SlideOver (drawer), EmptyState, FilterDropdown, Skeleton,
  ProvenanceChip as-is or wrap them in InForm styling — do NOT duplicate them.
- Ariya components (from the reference HTML): SignalCard, KpiCard, FeedFilterBar, MarketWeather,
  DigestFeed, SignalFeed (states + variants).
Build with Impeccable so they match the system:
  /impeccable a set of InForm components for Ariya (KpiCard, SignalCard, FeedFilterBar,
  MarketWeather, DigestFeed, SignalFeed), from docs/design/component-references/*.html and
  src/styles/inform-theme.css, token-driven and matching DESIGN.md
Then per component: /impeccable audit <component>  (contrast, focus, targets).
Verify build+lint; render each in isolation (Storybook/scratch route). Commit per component.
```

**Skip commands:** overdrive, delight, bolder, colorize (wrong register).

---

## PHASE 1 — Cleanup + first InForm surfaces

### 1.1 — Competitors
```
Read first: docs/competitors-page-redesign-spec.md; src/pages/Competitors.tsx; src/lib/motion.ts
(listItem variant); src/components/ui/FilterDropdown.tsx (reuse for sort/filter),
src/components/ui/Skeleton.tsx, src/components/ui/EmptyState.tsx; src/lib/db/index.ts (counts);
src/styles/inform-tokens.css.

FUNCTIONAL: fix the invisible-cards bug (parent motion.div inline initial/animate vs child
variants={listItem}); delete the "Available in paid version" placeholder; grid →
repeat(auto-fill,minmax(300px,1fr)); wire sort (Activity/Recent/Threat/Name, default Activity-desc)
+ posture filter (reuse FilterDropdown) + shared count source. Verify build+lint; cards visible. Commit.

INFORM: /impeccable polish the competitors page  → then adapt, clarify, critique, audit (per §1 loop).
```

### 1.2 — Market Implications (War Room)
```
Read first: docs/war-room-spec.md §3.2; src/pages/WarRoom.tsx (PaidGate for Market Implications);
src/lib/db/index.ts (getMarketImplications, DbMarketImplication); src/components/ui/PaidGate.tsx;
src/components/ui/EmptyState.tsx.
FUNCTIONAL: remove the Market Implications <PaidGate/>; render marketImplications (content ordered
by display_order, period_label, empty state via EmptyState). Verify. Commit.
INFORM: /impeccable clarify → /impeccable polish (the market implications section).
```

### 1.3 — Intelligence: remove "Earnings Filings · Coming soon" tab
```
Read first: docs/intelligence-feed-spec.md §2.1; src/pages/Portal.tsx (TABS array).
FUNCTIONAL: remove the disabled Earnings Filings tab + its handling. Verify. Commit.
```

### 1.4 — War Room audit fixes ⚠️ surviving components only
```
Read first: docs/war-room-redesign-spec.md §3 (what gets cut); src/pages/WarRoom.tsx;
src/components/inform/* (built in Phase 0.4); src/components/shell/NavPanel.tsx (hamburger target);
src/styles/inform-tokens.css.
Do NOT migrate CompactCompetitorCard, the Ask panel, the weekly digest, or the greeting header —
Phase 4 deletes them. Fix only survivors (EventRow, generic Card wrappers, KpiCard/FilterBar/
DigestFeed/MarketWeather, nav hamburger): contrast → --ink-600+, touch targets → ≥24px.
INFORM: /impeccable harden the war room ; /impeccable adapt the war room ; re-run /impeccable audit.
Commit.
```
> Deferred: SWOT PaidGate (`src/components/competitor/tabs/CompanyTab.tsx`) + `/pricing`
> (`src/pages/PricingAndAccess.tsx`, route in `src/App.tsx`, nav in `NavPanel.tsx`). Don't delete
> `PaidGate.tsx` until both usages are gone.

---

## PHASE 2 — AI synthesis pipeline (plain Claude Code)

⚠️ Lock personalization vs. caching first. Read `docs/alerts-ai-synthesis-spec.md` §2.

### 2.1 — DB migration
```
Read first: supabase/company_signals.sql, supabase/add-why-it-matters.sql (pattern),
supabase/migrations/; src/lib/db/index.ts (DbRecentSignal, getRecentSignals select).
Do: add nullable clean_headline, what_changed, suggested_action to company_signals (why_it_matters
exists); asset-scoped table if personalization requires. Update DbRecentSignal + the select list.
Verify migration; fields return null. Commit.
```
### 2.2 — Ingestion synthesis
```
Read first: docs/alerts-ai-synthesis-spec.md §2.1–2.4; api/ingest/*.ts AND
supabase/functions/ingest-* (wherever company_signals rows are written); api/lib/snapshot.ts.
Do: once per new signal — normalize (decode HTML entities, strip markup) → one model call →
clean_headline (never accession/filename), what_changed, why_it_matters (HAE/asset-specific),
suggested_action → validate → persist. Respect personalization + cost ceiling. Verify test ingest.
Commit.
```
### 2.3 — Mapping + remove boilerplate
```
Read first: docs/war-room-spec.md §3.1; src/lib/signalMapping.ts (mapSignal); src/pages/WarRoom.tsx
(buildWhyItMatters).
Do: mapSignal — headline from clean_headline (drop `headline ?? accession_number`), whatHappened
from what_changed, whyItMatters from populated field; body_excerpt only as "view source". Delete the
templated buildWhyItMatters switch; omit when null. Verify. Commit + graphify update .
```

---

## PHASE 3 — Wire synthesized fields + build surfaces in InForm

### 3.1 — Alerts inbox (build new, in InForm)
```
Read first: docs/alerts-ai-synthesis-spec.md §3; src/pages/AlertsPage.tsx; src/components/ui/
SlideOver.tsx (reuse as the detail drawer), ProvenanceChip.tsx (source), EmptyState.tsx,
Skeleton.tsx; src/lib/signalMapping.ts + src/lib/db/index.ts (fields); src/components/inform/*
(match existing InForm components); src/styles/inform-tokens.css; docs/design/component-references/
Signal Card.html + Signal Feed States.html + Signal Feed Variants.html.
BUILD: /impeccable redesign the alerts page as a compact InForm inbox table with a right-side detail
drawer (reuse SlideOver), per the spec — neumorphic rows on cream, glass drawer chrome, mono for
recency/counts, severity via functional color, Signal Indigo for why-it-matters; row = severity ·
competitor · clean_headline · type · recency · actions; Read more → drawer (clean_headline →
what_changed → why_it_matters → chips → collapsible decoded source via ProvenanceChip); default
filter unread+med/high with "Showing N of M"; Grouped by competitor.
REFINE: /impeccable clarify → harden → onboard (empty state) → animate (drawer). 
EVALUATE: /impeccable critique → audit → live. Commit per pass.
```

### 3.2 — War Room fields + counts
```
Read first: docs/war-room-spec.md §3.3–3.4; src/pages/WarRoom.tsx; src/lib/db/index.ts;
src/pages/Competitors.tsx + src/pages/CompetitorProfile.tsx (shared count target).
FUNCTIONAL: top-signal cards read clean_headline/why_it_matters/signal_type (no raw source); one
shared per-competitor + windowed count helper across War Room / Competitors / profile; label every
window. Verify counts reconcile. Commit.
INFORM: /impeccable polish the war room ; /impeccable audit the war room.
```

### 3.3 — Intelligence annotations
```
Read first: docs/intelligence-feed-spec.md §2.2–2.4; src/pages/Portal.tsx (buildRegulatoryContext,
LEADERSHIP_ANNOTATIONS, haeExtract render); src/components/ui/ProvenanceChip.tsx.
FUNCTIONAL: remove hardcoded buildRegulatoryContext + LEADERSHIP_ANNOTATIONS; read per-event
synthesized annotation fields; omit actionable_follow_up when null; synthesized hae_summary above
haeExtract, raw extract behind "Show extract" (decoded). Verify. Commit.
INFORM: /impeccable clarify the intelligence feed event annotations ; polish ; critique.
```

---

## PHASE 4 — War Room worklist redesign (InForm)

Read `docs/war-room-redesign-spec.md`. Depends on `suggested_action` (Phase 2) + triage decision.

### 4.1 — Triage state [DECISION REQUIRED]
```
Read first: src/context/AppContext.tsx (readAlerts/watchedCompetitors pattern); if shared:
supabase/*.sql + src/lib/db/index.ts.
Do: personal (localStorage) or shared (Supabase table by user+signal)? Add handling_state:
needs_triage|in_progress|handled|dismissed. Verify persistence. Commit.
```
### 4.2 — Worklist build
```
Read first: docs/war-room-redesign-spec.md; src/pages/WarRoom.tsx; src/components/inform/*
(reuse market weather + events); src/components/ui/SlideOver.tsx (reuse Alerts drawer);
src/styles/inform-tokens.css.
BUILD: /impeccable redesign the war room as an action-first "what needs me" worklist that fits one
screen with no scroll, in InForm, per the spec (Direction A) — glass stat bar + neumorphic worklist
rows (severity · competitor · clean_headline · suggested_action · Handle/Inspect, mono counts) +
condensed rail; Inspect reuses the Alerts drawer; cut the competitors grid, Ask panel, digest,
customise/"Add module".
REFINE: /impeccable distill → adapt (no-scroll 1440×900 & 1280×800) → clarify → harden → animate.
EVALUATE: /impeccable critique → audit. Commit per pass.
```
### 4.3 — Triage actions + keyboard
```
Read first: src/pages/WarRoom.tsx; src/context/AppContext.tsx; src/components/ui/SlideOver.tsx.
Do: Handle → advance handling_state; Save; keyboard triage (↑/↓, Enter, E); drawer prev/next.
Verify end-to-end. Commit + graphify update .
```

---

## Cross-cutting
- Per-file token migration to `src/styles/inform-tokens.css` vars as you touch each file (no global
  sweep). `/impeccable extract` to pull recurring patterns. `/impeccable typeset` once.
  `/impeccable optimize` + `audit` per changed page pre-ship. `npx impeccable detect src/` pre-commit.

## Sequencing
Phase 0 → 1 → lock decisions → 2 → 3 → 4. Functional/data = plain Claude Code; every design pass =
Impeccable targeting InForm, fed the specs as brief.
