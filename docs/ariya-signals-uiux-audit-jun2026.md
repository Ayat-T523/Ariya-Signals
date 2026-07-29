# Ariya Signals (Ariya Light) — UI/UX Evaluation

**Date:** 25 June 2026
**Scope:** Deployed portal at `ariya-signals-one.vercel.app`, evaluated as a competitive-intelligence monitoring portal (portal-first, AI-second).
**Method:** Live walkthrough of the authenticated build (onboarding, War Room, Alerts, Intelligence Feed, Competitors, competitor profile, Market Performance, Alert Preferences, Ask Ariya) cross-checked against source (`src/`).
**Persona:** David, Head of Competitive Intelligence, Pharma Inc — tracking Ekterly (sebetralstat) vs the HAE class.

---

## 1. Executive summary

Ariya Light has the right *bones* for a monitoring portal: onboarding starts with therapeutic area → asset selection and infers competitors from the asset; the War Room is genuinely asset-centric and alert-first; provenance and freshness ("Live · ClinicalTrials.gov", "Refreshed") appear throughout; and Alert Preferences even offers a "Raw signal — source extracts only" format that directly honors the portal-first ethos. The mental-model order the spec wants — *choose what I care about → see what changed → inspect evidence → decide* — is mostly present.

The problem is not the concept; it's **execution and trust**. Three things actively undercut the product:

1. **A core page is broken.** The Competitors page renders its three tracked-competitor cards at `opacity: 0` (a Framer Motion variant-propagation bug). A CI user who clicks "Competitors" sees an empty area and a paywalled "Add competitor" card — i.e., the page looks empty and monetization-first, even though three competitors are tracked.
2. **The signal is buried under raw evidence.** Alert cards dump full, unprocessed source text (SEC filing paragraphs), render raw HTML entities (`&#8220;`), and sometimes use a raw filename as the headline. The "Why it matters" line is identical boilerplate across unrelated signals. This is the exact "source attribution dominates the insight" failure mode the brief warns about.
3. **Unfinished surfaces leak the backend.** Market Performance is a placeholder that exposes "Azure data pipeline", "the data engineering team", and a named internal contact to the end user — the opposite of "users shouldn't think in ingestion pipelines."

None of these are conceptual disagreements with your plan — they're the difference between "fast, scannable monitoring workspace" and "dense, half-built database with a paywall." The good news: the two highest-impact items (invisible cards, raw-text dumping) are narrow, code-localized fixes, not redesigns.

**Where I'd push back on the plan itself:** the brief treats text density as the headline risk. After seeing the live build, density is real but secondary — the War Room and Alert Preferences are reasonably scannable. The bigger threats are *correctness and trust* (broken page, inconsistent counts, raw-data leakage, prototype/"coming soon" scaffolding in production). I've weighted the findings accordingly.

---

## 2. Top 5 UI/UX gaps

1. **Competitors page shows nothing but a paywall.** The three tracked competitors are in the DOM but invisible (`opacity: 0`); only the "Add competitor · Available in paid version" card paints. *Highest priority — it breaks a primary journey and makes the product read as paywall-first.*
2. **Alert cards dump raw source text instead of a summary.** No truncation/progressive disclosure on the body; raw HTML entities and filename-as-headline appear. Evidence dominates the signal.
3. **"Why it matters" is verbatim boilerplate.** The same sentence repeats across unrelated competitors/signals, so the one line meant to add value reads as filler and erodes trust.
4. **Unfinished/dead surfaces in production.** Market Performance leaks internal pipeline/team details; "Earnings Filings · Coming soon" ships as a disabled tab; the Grouped alerts view collapses all 73 alerts into a single meaningless "Live signals" group.
5. **Cross-view data inconsistency.** Takeda's signal count reads "2 medium" (War Room) vs "134" (Competitors list); BioCryst's count is missing on the list; copy says "1 assets". In a trust product, mismatched numbers are disproportionately damaging.

---

## 3. Detailed issue table

| Area | UX Gap | Severity | Evidence from UI | Why it matters for Ariya Light | Recommendation |
|------|--------|:--------:|------------------|--------------------------------|----------------|
| Layout / Journey | Tracked-competitor cards render invisible; only paywalled "Add competitor" card visible | **High** | `/competitors` header says "3 competitors tracked" but body shows empty space + paywall card. DOM contains Takeda/BioCryst/Pharvaris cards. Root cause: `Competitors.tsx:814–827` parent `motion.div` passes inline `initial`/`animate` objects, so child `variants={listItem}` (initial `opacity:0`) never resolves to "animate"; `lib/motion.ts` | The core "Competitors" object page looks empty and monetization-first. Breaks the asset→competitor inspection journey | Give the parent `variants={staggerContainer} initial="initial" animate="animate"`, OR drop the child variant and animate inline. Add a render-correctness check |
| Text density / Hierarchy | Alert body dumps full raw source text; no truncation or progressive disclosure | **High** | Alerts feed: BioCryst card shows a full "Amended and Restated Stock Incentive Plan…" filing paragraph. `AlertsPage.tsx:224–231` renders `whatHappened` with no line-clamp | "Source attribution dominates the insight" — users scroll raw evidence to find the change | Clamp body to 2 lines; move full text behind "View source / Show more". Lead with a one-line synthesized "what changed" |
| Trust / Data quality | Raw HTML entities and filename-as-headline rendered literally | **High** | Alerts: `&#8220;`/`&#8221;` shown as text; headline "EX-99.1 2 shareholderletter2026_en.htm EX-99.1 …" | Looks unprocessed/broken; directly damages the trust layer | Decode entities and sanitize at ingestion; derive a clean human headline; never use raw filenames as titles |
| Hierarchy / Trust | "Why it matters" is identical boilerplate across signals | **High** | Two different cards: "Leadership change at BioCryst / Takeda — often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity." (verbatim) | The one value-add line reads as filler; generic is fine, *repetitive* is noise | Template per signal *type* but inject the specific entity/event; if no specific value, omit rather than repeat |
| Journey / Privacy | Market Performance leaks internal implementation | **Medium** | `/market-performance`: "Embedded Power BI report… via Power BI embed, aligned with the Azure data pipeline. Configuration in progress with the data engineering team. Contact: Ananda Ramachandra · data pipeline lead" | Forces users to think in pipelines/source systems; exposes internal staff; dead nav item | Replace with a neutral "Coming soon" empty state (no internal names/stack), or hide the nav item until live |
| Mental model | Intelligence Feed "Actionable follow up" over-promises role-tailored interpretation | **Medium** | Event card: "Initiate counter-launch narrative review with medical affairs and alert the commercial team to accelerate readiness milestones." | Spec reserves role-tailored "what it means for you" for paid tier; free tier should surface *what happened*, not prescribe strategy | Reframe as neutral, factual follow-ups ("PDUFA expected late 2026–early 2027; watch FDA acknowledgement letter") or gate behind paid |
| Layout | Grouped alerts view collapses everything into one group | **Medium** | `/alerts` → "Grouped": single "Live signals · 73 alerts" row | Grouping by backend feed, not by asset/competitor/type — the red-flag "organized by source" pattern | Group by competitor, asset, or signal type; default to the dimension users filter by most |
| Trust / Data quality | Signal counts inconsistent across views | **Medium** | Takeda: "2 medium signals" (War Room card) vs "134" (Competitors list DOM). BioCryst count missing on list. "1 assets" (Pharvaris) | Mismatched numbers in a monitoring tool undermine the whole trust proposition | Single source of truth for counts; reconcile windows (7-day vs all-time) with explicit labels; fix pluralization |
| Onboarding | Onboarding re-triggers within a session | **Medium** | After completing/skipping, navigating fresh to `/` re-shows the modal. `AppContext.tsx:107` resets `onboardingComplete` when the Supabase profile is missing/version-mismatched | Repeated onboarding is friction and signals state isn't trusted | Verify profile `onboarding_complete` persists on completion; don't let an absent profile clobber a valid local-complete flag |
| Completeness | "Coming soon"/disabled features ship in production | **Medium** | Intelligence Feed: "Earnings Filings · Coming soon" disabled tab; multiple inline paid-gates; Ask Ariya: "illustrative in this prototype" | Multiple placeholders make a live product feel half-built | Hide not-ready tabs; consolidate paid-gates into one tasteful upsell; drop "prototype" copy from a production URL |
| Layout / Responsive | Competitors grid is not responsive | **Medium** | `Competitors.tsx:817` inline `repeat(3,1fr)` with no `data-*` hook; WarRoom grids correctly collapse via `index.css` breakpoints | On phones the competitor grid won't reflow (other pages do) | Add the responsive `data-*` hook or a CSS grid class so it collapses to 1–2 columns |
| Hierarchy / Jargon | Pipeline Gantt uses unexplained marker + dense labels | **Low** | Competitor profile: "PCD" markers absent from the legend; quarter labels Q3'25–Q4'29 are tiny/many | Minor comprehension friction in an otherwise strong view | Add "PCD" to the legend (or spell it out); consider a default zoom window with horizontal scroll |
| Brand / Polish | Prototype framing visible to users | **Low** | "Ask anything… illustrative in this prototype"; persistent "by phamax" | Reads as internal/unfinished | Remove prototype disclaimers in production; keep attribution subtle |

---

## 4. Recommendations by category

### Text density
The portal is *not* uniformly over-crowded — the War Room KPI strip, right rail, and Alert Preferences are appropriately lean. Density concentrates in two places, and both want the same fix: **progressive disclosure**.

- **Alert cards:** lead with a synthesized one-line "what changed," clamp the raw body to ~2 lines, and put full source text behind "Show more / View source." Right now the raw paragraph *is* the card.
- **Intelligence Feed event cards:** "Expected topics" + "Why this is relevant" + "Actionable follow up" is three text blocks per card. Collapse "Actionable follow up" by default; keep the factual relevance line visible.

### Layout & scannability
- Fix the Competitors invisibility bug first — it's the single biggest scannability failure (the page reads as empty).
- Make Grouped alerts group by a dimension users care about (competitor/asset/type), or remove the toggle until it does.
- The War Room ordering is already strong (alerts/KPIs → top signals → tracked competitors → events/digest). Keep it; don't dilute it with the embedded Ask Ariya box growing in prominence.

### User journey & mental model
- The onboarding → War Room → inspect → source path is correct. Protect it by (a) fixing the Competitors page and (b) not dropping users onto dead ends (Market Performance).
- Keep competitor tracking *inferred* from the asset (it already is) — that matched the mental model well.
- Pull prescriptive, role-tailored "what to do" language back to neutral "what happened / what to watch," per the free-tier intent. Reserve interpretation for the paid tier explicitly rather than half-delivering it.

### Text hierarchy
- Headlines must be human-readable; never render a filename (`EX-99.1 …htm`) as a title.
- De-emphasize provenance: source name + date should be the smallest, lightest element on the card, not competing with the headline.
- "Why it matters" should be visually subordinate (it is, via the tinted strip) **and** substantively specific (it currently isn't). Specific-but-quiet beats generic-but-repeated.

---

## 5. Suggested page-level restructuring

**Alert card (current → target hierarchy):**

Current: badges → *raw filing paragraph* → "Why it matters" boilerplate → date/source/Mark read.

Target:
1. Signal type · severity · freshness (badges) — keep
2. **Clean event headline** (synthesized, human)
3. **One-line "what changed"** (synthesized summary, not raw text)
4. Asset / sponsor / region / phase chips where relevant
5. "Why it matters" — *specific* one-liner, subordinate styling
6. Source · refreshed date · actions (View source expands raw text, Mark read, Save)

**Competitors page:** fix rendering, then lead with the three tracked-competitor cards (logo, positioning tag, signal count, pipeline, last-signal recency — all already designed), and demote "Add competitor (paid)" to a single quiet tile at the end.

**Market Performance:** until the Power BI embed is live, show a neutral empty state ("Market uptake data is coming soon") with no internal stack/team/contact details — or remove from nav.

---

## 6. Quick wins (low effort, high impact)

1. **Fix the Framer Motion variant bug** on Competitors (`Competitors.tsx:814–827`) — one-line change, restores the whole page.
2. **Decode HTML entities + clamp alert body** — kills the "looks broken / wall of text" impression in the highest-traffic feed.
3. **Stop using filenames as headlines** — derive a clean title at ingestion.
4. **Scrub Market Performance copy** — remove "Azure data pipeline / data engineering team / [named contact]".
5. **Hide "Earnings Filings · Coming soon"** and drop "illustrative in this prototype" from Ask Ariya.
6. **Reconcile signal counts** across War Room / Competitors / profile and fix "1 assets" → "1 asset".

---

## 7. Larger product / design recommendations

- **Insert a synthesis layer between ingestion and display.** Most high-severity issues (raw text, entities, filename headlines, boilerplate "why it matters") trace to rendering raw ingested data. A normalization step (clean title, 1-line summary, entity decoding, type-specific rationale) fixes them structurally rather than card-by-card.
- **Define and enforce the free/paid line in copy.** The build currently *gestures* at paid interpretation ("counter-launch narrative review", "…mean for us") in free surfaces while gating other things. Decide what free shows (what happened + neutral what-to-watch) and make paid the home of strategic interpretation — consistently.
- **Add a pre-ship "no placeholders in prod" gate.** "Coming soon" tabs, prototype disclaimers, and internal contact names in a customer-facing deployment are individually small but collectively read as unfinished.
- **Treat numeric consistency as a trust feature.** A monitoring product lives or dies on whether users believe the counts. One source of truth + explicit time-window labels.

---

## 8. What's already working (keep it)

- Onboarding leads with TA → asset, and **infers competitors from the asset** (pre-selected, editable) — matches the intended mental model.
- War Room is asset-centric and alert-first; the New-this-week / Unread / High-importance KPI strip is scannable; the right rail (Market weather, Upcoming events, Weekly digest) is well-prioritized.
- **Alert Preferences → Format → "Raw signal: source extracts only, minimal interpretation"** is a direct, thoughtful expression of the portal-first/raw ethos.
- Provenance and freshness are present across the product (source tags, "Refreshed", "Live · ClinicalTrials.gov").
- Competitor profile (Pipeline / Company / Key Events / Messaging, phase tracker, Gantt, "Compare to our asset") is a strong, appropriately dense data view — and it renders correctly, which confirms the Competitors-list bug is isolated.
- Responsive shell is properly built (mobile nav drawer + breakpoints at 1100/900/767); most pages reflow correctly (Competitors grid is the exception).

---

## Appendix — coverage & caveats

- **Screens reviewed live:** Sign-in, Onboarding (asset step + competitor-watchlist step), War Room (full), Alerts (List + Grouped), Intelligence Feed (Events), Competitors (list + Takeda profile), Market Performance, Alert Preferences, Ask Ariya.
- **Code cross-checked:** `App.tsx`, `Competitors.tsx`, `AlertsPage.tsx`, `WarRoom.tsx`, `lib/motion.ts`, `context/AppContext.tsx`, `index.css`, `components/shell/NavPanel.tsx`.
- **Mobile caveat:** the browser tool could not capture a true narrow-viewport screenshot, so mobile findings are derived from CSS/component code (breakpoints in `index.css`, `isMobile` logic in `NavPanel.tsx`/`TopBar.tsx`, and inline grid declarations), not from rendered phone screens.
- **Data caveat:** the deployed build appears to pull live-ingested data; raw entities/filename headlines were observed in the rendered feed, not present in the local demo JSON — i.e., they originate upstream and render unsanitized.
