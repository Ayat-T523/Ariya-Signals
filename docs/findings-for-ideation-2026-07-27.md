# Findings for Ideation — Ariya Signals

**Date:** 27 July 2026
**Purpose:** Not a status report (see `docs/frontend-status-report-2026-07-27.md`) and not a
build-readiness check (see `docs/hygiene-check.md`) — this is the synthesis of both, reframed as
open questions and opportunities, for a working session between the product owner and Claude
Cowork. Where the other two docs answer "is X built," this one asks "what should we do about X."

---

## The headline finding: this is a single-tenant product pretending to be multi-tenant

Every other finding below is smaller than this one, so it goes first.

**What's true today:** the product owner has confirmed there is no home asset — any user from any
pharma brand should be able to come in, configure their own tracked drug, and get a fully-served
competitive-intelligence experience. **What's actually built:** a genuinely single-tenant product
with a well-disguised multi-tenant *shell*.

- The config layer already looks multi-tenant: `assets-config.ts` lists 7 assets across 3
  indications (HAE, PNH, PBC), including entries explicitly built so a user from a *competitor*
  company can configure Ariya from their own point of view. Onboarding already lets a user pick
  any of these.
- But every one of the 394 rows of real signal data is HAE-specific. Pick "Zevaro" (PNH) or
  "Chelira" (PBC) at onboarding today and there is nothing behind the door.
- The AI-synthesized interpretive text (`why_it_matters`, `suggested_action`) — the layer
  PRODUCT.md calls the product's actual differentiator — is generated once per signal, in language
  specifically about Ekterly, and served identically to every user regardless of what they picked.
- There's even a table already migrated for the correct fix
  (`company_signal_asset_actions`, signal × asset → suggested_action) that's never been populated
  or queried. Somebody already reasoned through this problem and built half the solution before
  the ingestion side caught up.

**Questions worth ideating on:**
- What's the actual sequencing? Ingestion breadth (more indications, more competitors) and
  synthesis depth (per-asset AI text) are two different work-streams that happen to share one
  table. Which unblocks value fastest — one more indication done well, or the per-asset synthesis
  plumbing done once and reused as indications get added?
- Is "PNH and PBC" the right next two indications, or were those just convenient placeholders when
  someone first wrote `assets-config.ts`? Worth revisiting with real go-to-market intent.
- The "competitor products" entries (e.g. a BioCryst or Takeda user configuring Ariya from *their*
  perspective) are a genuinely distinct use case from "a new indication" — same mechanism, different
  audience. Does that change how the next asset gets chosen or prioritized?
- Cost model: synthesis cost now scales with signals × assets, not just signals. Worth sizing
  before committing to how many assets get added at once.

---

## The synthesis pipeline is further along than anyone thought — and unevenly so

Two earlier drafts of the hygiene check assumed most of Phase 2.2 (AI synthesis) hadn't happened
yet. It has, partially, and unevenly — which is itself worth discussing, because it suggests the
pipeline ran once, got most of the way there, and stopped without anyone circling back.

| Field | State | 
|---|---|
| `why_it_matters` | 95% populated, real, already shown everywhere it should be |
| `suggested_action` | 62% populated, real, event-specific — not generic |
| `ai_severity` | 62% populated — **and never read anywhere in the app.** The product computes severity two other ways instead (see below) and this column just sits there. |
| `clean_headline` | 0% populated — the generator clearly runs (it wrote the two fields above) but never touches this one |
| `what_changed` | 0% populated — same |

**Questions worth ideating on:**
- Why did the generator stop short of two fields it was presumably built to fill? Worth actually
  looking at whatever script/prompt ran this, rather than re-guessing from the data — the answer
  might be a one-line fix, or it might reveal the generator was never finished for these two.
- `ai_severity` being fully populated and completely unused is either wasted synthesis spend or a
  half-finished migration to a better severity model. Worth deciding on purpose rather than by
  accident.

---

## Two severity engines quietly disagree with each other

`src/lib/signalSeverity.ts` (asset/lexicon-aware, used by Market Weather + Competitors) and
`src/lib/signalMapping.ts` (a static table keyed by signal type, used by Alerts + the War Room
worklist) can score the *same signal* differently. Meanwhile the real, AI-generated `ai_severity`
column sits unused by either.

**Questions worth ideating on:**
- Is there a reason to keep two engines (maybe they're answering genuinely different questions —
  "how urgent for the page's summary stats" vs. "how urgent for triage"), or is this just drift?
- Does `ai_severity` deserve to become canonical once trust is established, replacing both
  heuristics? What would it take to validate it's actually better than the two rule-based versions
  already in production?

---

## Two pages never got the design refresh the other two got

War Room and Alerts were both rebuilt from scratch in the new InForm visual language this cycle.
Intelligence Feed and Competitors are still on the old system — different colors, different
component patterns, no shared visual grammar with the rest of the product. A user moving between
"the two nice pages" and "the two old pages" would notice.

**Questions worth ideating on:**
- Does this matter now, or is it fine to let it lag until there's a reason to touch those pages
  anyway (e.g. multi-asset work naturally touches Intelligence Feed's event annotations)?
- Competitors already has its functional bugs fixed (Phase 1.1) — it's cosmetically stale, not
  broken. Different priority than a page with real functional debt.

---

## Two decisions the product owner is holding for next iteration

Recorded here so they don't get silently dropped, not because they need resolving now:

- **SWOT** — `CompanyTab.tsx` gates a whole section behind a paywall placeholder with no data
  behind it. The product owner wants to think through the actual logic before building (what would
  a real, non-fabricated SWOT even be built from — signals? Financials? Manually curated?).
- **`/pricing`** — a full nav item + route exists for a page that, per "single full product, no
  tiers," probably shouldn't exist at all. Held pending a decision on where any pricing data would
  even come from.

---

## Smaller findings, worth a mention if the conversation gets there

- Two shared, pre-existing UI components (the primary button, a small asset-name chip) sit just
  under the WCAG AA contrast floor the product's own design system calls non-negotiable. Small,
  app-wide fix, not urgent.
- The old "Reports / Earnings Filings" feature was removed a while back but its data file was never
  deleted — harmless, but it's dead weight nobody's looking at.
- Worklist row controls (Handle, Inspect) are sized for a mouse, not a finger — a deliberate
  desktop-first tradeoff worth revisiting only if touch/tablet use becomes real.

---

## Suggested framing for the Cowork session

The two "hold for next iteration" items (SWOT, pricing) are genuinely separable — they can wait
without blocking anything else. The multi-asset gap is not separable in the same way: it's the
product's own stated identity, currently unmet, and it's the one item on this list that changes
what "done" means for almost everything else already built (severity, synthesis, even how War
Room's "needs you" count should eventually be scoped per asset). Worth deciding whether it's the
next thing to build, or whether there's a reason to sequence something else first.
