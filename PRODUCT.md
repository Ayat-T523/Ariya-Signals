# PRODUCT.md — Ariya Signals

> Impeccable product-context file. Target location: **repo root** (`PRODUCT.md`).
> Reconcile with any `PRODUCT.md` your Claude Code session already generated.

## Platform

Web, desktop-first, mobile-responsive. React 19 + TypeScript, Vite, Tailwind v4, deployed on
Vercel, Supabase-backed live data.

## Who it's for

**Any competitive-intelligence or medical-affairs analyst, at any pharma brand, tracking any
asset.** There is no home asset and no fixed therapeutic area — a user from Company A tracking
Drug A and a user from Company B tracking a rival Drug B are both first-class, equally-served
users of the same product. **David, Head of Competitive Intelligence at Pharma Inc, tracking HAE
(hereditary angioedema) around the launch of Ekterly (sebetralstat)**, is the current reference
persona and the only asset with real backing data today — useful for grounding examples and
demos, but **not** the product's fixed identity. `src/config/assets-config.ts` already lists 7
assets across 3 indications (HAE, PNH, PBC), including "competitor products" entries explicitly
so a user from a rival company can configure Ariya from their own perspective — more assets are
coming, and every future decision should assume the catalog keeps growing, not that HAE is
permanent.

## What it makes possible

A **portal-first competitive-intelligence monitoring workspace**: choose what you care about →
see what changed → inspect the evidence → decide. It surfaces synthesized, provenance-backed
signals (from ClinicalTrials.gov, FDA/openFDA, SEC/EDGAR, PubMed, regulatory agencies) with a
clean "what changed / why it matters" layer, and lets the analyst drill to the raw source in one
click. The thing a neighboring tool can't truthfully claim: **every signal is traceable to a
dated primary source, and the interpretation is specific to the user's tracked asset — whichever
one that is — not generic.**

## What future work must preserve

- **Provenance and freshness are load-bearing**, not decoration. Source name, date, "Live ·
  ClinicalTrials.gov", "Refreshed" — the trust layer stays visible.
- **Single full product — no tiers, no gating, no upsell.** Everything (including AI
  interpretation / "why it matters" / implications) is shown to every user. Remove all `PaidGate`
  usage and the pricing surface.
- **The serious analyst register.** No playful/consumer-AI tone, no decorative motion. See
  `DESIGN.md` (intelligent warmth, ≤320ms, no bounce).
- **Asset-aware interpretation, genuinely — not just for Ekterly.** "Why it matters" and suggested
  actions must reference whichever competitor and asset the *specific user* has tracked. As of
  27 Jul 2026 this is only true in the config/onboarding layer (asset selection, competitor
  watchlists, lexicon gating) — the AI-synthesized copy itself (`why_it_matters`, `suggested_action`
  on `company_signals`) is currently one global value per signal, generated once against the HAE/
  Ekterly context. A real per-asset synthesis cache table already exists for this
  (`company_signal_asset_actions` — signal × asset → suggested_action) but is unpopulated and
  unwired. Do not treat the current single-asset behavior as acceptable long-term; treat it as the
  known gap between "designed for" and "actually built."
- **No hardcoded HAE/Ekterly assumption in new code.** The demo dataset happens to be HAE today;
  new frontend or pipeline work should read the user's tracked asset dynamically (`useConfig()`,
  `assets-config.ts`) rather than assuming HAE terminology, competitors, or copy register.

## Design language

The product's visual language is **InForm** (see `DESIGN.md`) — warm cream neumorphic content
surfaces, glass chrome, one accent (Signal Indigo), JetBrains Mono for all figures. This is a
**reskin** of Ariya Signals: InForm supplies the styling and components; the product, IA, and
functionality remain the CI portal described above.

## Scope note (context, not a to-do)

The broader InForm design vision (see `inform-design-system/reference/ariya-product-system-map.md`)
describes a three-component Medical Affairs AI platform — Chat, Content, and an Insights Hub.
**Ariya Signals corresponds to the Insights Hub only.** Chat and Content are out of scope for this
build cycle. Keep this file and `DESIGN.md` written so they don't contradict that fuller vision if
the product expands later, but do not build Chat/Content now.

## Surfaces (current CI portal)

War Room (home) · Alerts · Intelligence Feed · Competitors (+ profile) · Market Performance ·
My Space / Alert Preferences · Ask Ariya. Routes in `src/App.tsx`.
