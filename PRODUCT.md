# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a **BI Manager running a competitive-intelligence workstream** inside a pharma company. They track competitors at drug-asset (INN) level, not at company level. Their day splits into two distinct jobs:

1. **Daily triage** of a change feed, under real alert fatigue. They need to know what moved and whether it needs action, fast.
2. **Scoped investigation** of a specific decision question, where they follow one asset or competitor in depth.

They do not trust intelligence they cannot trace, so source provenance must be visible on every signal rather than available on request.

Three claims about this persona are **unverified against the written spec** and must not be treated as requirements without confirmation: that a first session is abandoned without an immediate signal, that historical backfill is load-bearing at onboarding, and that there are four distinct free-tier user types.

Not the lens for this build: the AI decision-support personas (Stefan, Giulia, Marco) belong to a separate experimental track.

## Product Purpose

Ariya Light is a **free, self-serve competitive-intelligence portal for pharma**. It does aggregation and monitoring: what is happening in a watched competitive space. It stops deliberately before interpretation.

It is a real product for customers, not a demo.

Success is measured on four fronts at once (all four confirmed by the owner, none subordinate to the others):

- a **weekly triage habit**: the user returns each week and works the change feed;
- **self-serve signup and activation**: a stranger signs up unaided and reaches a first useful signal without help;
- **funnelling to the paid tier** at genuine friction points;
- **credibility with the client sponsor**, who must accept it as a shippable product rather than a demo.

## Positioning

The mechanism a neighbouring product could not truthfully copy: **every ranking, grouping and connection is deterministic and traceable to a public source.** No model sits between the source and the screen. Importance is computed from facts (event category, recency, corroborating source count, proximity to a known forward catalyst), so any ranking can be explained rather than asserted.

The primary internal object is the **drug asset, keyed by INN**. Company-level intelligence is derived from asset-to-sponsor relationships, never the other way around.

The free tier stops before interpretation on purpose. Auto-generated "what this means" shown to a competent CI professional would destroy the credibility of the paid product, so the boundary is a positioning decision, not a technical limit.

## Operating Context

- **Delivery model: one self-serve, multi-tenant web app.** Users sign up, then choose the asset and therapeutic area they track. `src/config/demo-config.ts` currently hardcodes a single client identity (company "Pharma Inc", persona "David", asset Ekterly, area HAE) and describes itself as a per-client re-skin. Confirmed by the owner that this is legacy: it becomes first-run defaults only, and per-user identity must come from the signed-in account.
- **Area-agnostic by intent.** Nothing may hardcode a therapeutic area into logic or layout. Current live data happens to be HAE-heavy. Note the gap: asset selection today is constrained to indications already curated by Phamax (HAE, PNH, PBC), so free-text area entry is a direction rather than a shipped fact.
- Deployment: Vercel. Data: Supabase (PostgreSQL). Ingest runs as scripts and Deno edge functions, always sequentially.
- Two working modes the UI must serve differently: triage (scan and decide) and investigation (follow one thread deep).

## Capabilities and Constraints

**Confirmed capabilities**

- Signal aggregation from public sources into a single feed, attributed to a drug asset where the source names one.
- Deterministic importance banding (act / watch / context) with an explainable breakdown.
- Deterministic facets: **arc** governs ordering, **theme** is the browse facet the user filters by. These are distinct and must stay distinct in the UI.
- Asset threading: signals sharing a resolved asset identity form one thread.
- Provenance on every signal: source name, last refresh, attribution tier (exact match, name match, company level).
- Watchlist of competitors, per user.
- Alerts: **free**, and part of daily triage.

**Hard exclusions, on data-governance grounds** (pharma signals must not pass through non-enterprise model handling)

- No AI or LLM enrichment anywhere in the free product.
- No `why_it_matters`, no `suggested_action`, no auto-generated recommendations.
- No synthesized market or landscape narrative. Deterministic, structural, connective text only.
- Removed and not to be reintroduced: RAG chat ("Ask Ariya"), AI severity rescore, AI theme enrichment, the AI transformation pipeline, all `ai_*` database columns.

**Removed from scope**

- My Space, including My Documents. Flagged out of scope by the client sponsor, and document upload additionally fails on data security since this product uses public data only.

**Terminology** (use these words, they are load-bearing)

- **INN**: the generic drug name, the primary key for an asset.
- **Arc**: ordering category. Importance order is regulatory, trial, deal, ip, commercial, evidence, personnel. Display order within a thread is a different sequence and the two must not be unified.
- **Theme**: browse facet (pipeline and trials, evidence, regulatory, market access, commercial, IP and exclusivity, deals and BD, leadership).
- **Attribution tier**: how confidently a signal is tied to an asset.
- **Relation**: direct or indirect, always relative to the user's own asset.

**The paid tier** (settled by the owner, superseding the handoff's "human analyst" wording)

The paid tier is **AI-backed**, and "Ask Ariya" will eventually return there as a paid tease. Two things follow, and neither loosens the free tier:

- The free tier stays strictly deterministic with no AI, unchanged. Every §2 exclusion holds.
- Ask Ariya is **removed from this iteration**, not reserved space within it. Its paid tease will be designed as separate later work. Nothing in this build should anticipate it, hold a slot for it, or hint at it.

The current priority is a functional deterministic product.

**Open, deliberately undecided**

- Navigation click model: whether the click-to-toggle nav is specific to this product or system-wide across Ariya.
- Intelligence Feed layout: grouped theme sections, or a flat feed with a theme filter.
- Which git branch this work lands on.

## Brand Commitments

- Product name: **Ariya**, this build is **Ariya Light**. Vendor: **Phamax**. In-app branding today reads "Ariya Signals, by phamax".
- Typeface: **Satoshi**.
- Design system: Ariya v2 tokens and components. Dark-blue authority and blue action, plus semantic status colours.
- Voice: plain language throughout, readable by a non-technical medical affairs user rather than a data analyst. The client sponsor prefers brief communication.
- No em dashes in any written output for this product.

## Evidence on Hand

Real, verified against the live database during this session:

- `company_signals`: **287 rows**. By type: publication 147, press_release 73, exec_change 17, congress_abstract 15, regulatory_catalyst 11, hta_decision 9, deal 8, trial_update 7.
- `assets`: 11 rows with real mechanisms, phases and sponsors. `asset_lexicon`: 11 rows, 6 carrying a brand name.
- Live ingest sources: SEC EDGAR, PubMed, company IR RSS, EU HTA, EMA regulatory calendar.
- Hand-curated but genuinely real, with verifiable URLs: `market-developments.json`, `events.json` (NICE guidance, company IR, GlobeNewswire).
- `ariya-war-room-wireframe.html` is cited as the one container drawn at content-complete fidelity, and the design-system reference files are cited as project files. **None of these are present in this repository**, so they cannot currently be composed against.

**Absences that must not be fabricated**

- No net pricing data. Actual net prices reflect confidential managed-entry agreements and are not available from any free source. The pricing surface is explicitly labelled illustrative.
- No market-performance data. That surface is an honest placeholder pending a Power BI embed.
- No document store. My Documents has no backing data and is out of scope.
- No paid Rx or share data.

## Product Principles

1. **Traceable or absent.** If a fact cannot be traced to a public source, it does not render. Unknown shows as an honest empty state, never as a plausible placeholder.
2. **Aggregate, never interpret.** The free tier reports what happened. It may signpost that interpretation exists behind the paid tier, which is not the same as producing it.
3. **The asset is the unit.** Identity resolves to an INN first; company views are derived from that, never the reverse.
4. **Quiet is intelligence.** A week with nothing urgent must read as calm and be stated in words, not look broken or empty.
5. **Every feature works without AI.** Determinism is a governance requirement, not a preference, so no capability may depend on a model.

## Accessibility & Inclusion

WCAG AA is the required bar: contrast minimums, keyboard operability including the navigation toggle, visible focus states, and adequate target sizes. Plain language is an accessibility requirement here as much as a voice one, since the reader is a medical affairs professional rather than a data analyst.
