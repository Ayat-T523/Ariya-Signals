# PRODUCT.md — Ariya Signals

> Impeccable product-context file. Target location: **repo root** (`PRODUCT.md`).
> Reconcile with any `PRODUCT.md` your Claude Code session already generated.

## Platform

Web, desktop-first, mobile-responsive. React 19 + TypeScript, Vite, Tailwind v4, deployed on
Vercel, Supabase-backed live data.

## Who it's for

**David, Head of Competitive Intelligence at Pharma Inc** — and CI/medical-affairs analysts like
him. He tracks HAE (hereditary angioedema) competitors around the launch of **Ekterly
(sebetralstat)**: their trials, filings, label changes, leadership moves, deals, and market access.
He needs to see what changed, judge why it matters for his asset, and inspect the evidence — fast,
every morning, without babysitting a tool.

## What it makes possible

A **portal-first competitive-intelligence monitoring workspace**: choose what you care about →
see what changed → inspect the evidence → decide. It surfaces synthesized, provenance-backed
signals (from ClinicalTrials.gov, FDA/openFDA, SEC/EDGAR, PubMed, regulatory agencies) with a
clean "what changed / why it matters" layer, and lets the analyst drill to the raw source in one
click. The thing a neighboring tool can't truthfully claim: **every signal is traceable to a
dated primary source, and the interpretation is specific to the user's asset — not generic.**

## What future work must preserve

- **Provenance and freshness are load-bearing**, not decoration. Source name, date, "Live ·
  ClinicalTrials.gov", "Refreshed" — the trust layer stays visible.
- **Single full product — no tiers, no gating, no upsell.** Everything (including AI
  interpretation / "why it matters" / implications) is shown to every user. Remove all `PaidGate`
  usage and the pricing surface.
- **The serious analyst register.** No playful/consumer-AI tone, no decorative motion. See
  `DESIGN.md` (intelligent warmth, ≤320ms, no bounce).
- **Asset-aware interpretation.** "Why it matters" and suggested actions reference the specific
  competitor and the user's tracked asset (Ekterly/HAE) — never boilerplate.
- **HAE/Ekterly domain context and terminology.**

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
