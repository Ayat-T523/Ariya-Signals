# InForm design system — drop-in kit

Everything needed to ground the InForm reskin in the repo, extracted/authored from the
`InForm.zip` design system. Move each file to its target path in your **live** repo (the one your
Claude Code session runs in — not this June snapshot).

## File map

| Staged here | → Target in repo | Notes |
|---|---|---|
| `styles/inform-tokens.css` | `src/styles/inform-tokens.css` | The token system. Import once, globally. |
| `styles/inform-theme.css` | `src/styles/inform-theme.css` | Component recipes (`.btn`, `.card`, `.drawer`…). |
| `DESIGN.md` | `DESIGN.md` (repo root) | Impeccable design context. **Reconcile** with the one your Claude Code session generated. |
| `PRODUCT.md` | `PRODUCT.md` (repo root) | Impeccable product context. Reconcile likewise. |
| `reference/*.md` | `docs/design/` | Product System Map, Decisions Log, Ideation Checklist, Chat spec — grounding for every session. |
| `component-references/*.html` | `docs/design/component-references/` | The design-source HTML per component; build React from these. |

## Wiring steps (do once)

1. **Fonts.** The system needs **Plus Jakarta Sans** + **JetBrains Mono** (optional: BR Segma).
   Add via Fontshare/Google Fonts `<link>` in `index.html` or self-host. The repo currently loads
   Satoshi — InForm replaces it. Update the CSP `font-src` in `vercel.json` if you use a CDN.
2. **Import the CSS.** Import `inform-tokens.css` then `inform-theme.css` globally (e.g. in
   `src/index.css` or `main.tsx`), before app styles so tokens resolve.
3. **Remove the bounce trap.** Delete `--ease-spring: cubic-bezier(0.3,1.3,0.5,1)` from the token
   files — it violates the ≤320ms / no-bounce motion rule (see `DESIGN.md` → Motion).
4. **Set the muted-text floor.** Replace legacy `rgba(5,10,68,0.35–0.40)` muted text with
   `--ink-600` or darker (WCAG AA). See `DESIGN.md` → Accessibility.
5. **Run `/impeccable document`** after the CSS lands so `.impeccable/design.json` regenerates from
   the real tokens.

## Component library — build in production (nothing to port)

This InForm repo is a **design sandbox** (HTML/CSS + specs), not an app clone, and the production
`Ariya-Signals` repo has **no `src/components/inform/` yet** — so there are no React components to
git-port. Build the whole library in production from this design source
(`component-references/*.html` + `styles/inform-theme.css`), per **Phase 0.4** of
`docs/build-prompts.md`:

- **Reuse existing `src/components/ui/` primitives** where they cover the need — `SlideOver`
  (drawer), `ProvenanceChip`, `EmptyState`, `FilterDropdown`, `Skeleton`, `CompetitorBadge`,
  `ConfidenceIndicator` — wrap in InForm styling, don't duplicate.
- **Build** `src/components/inform/*`: SignalCard, KpiCard, FeedFilterBar, MarketWeather,
  DigestFeed, SignalFeed (states + variants), plus any missing primitives (Button, Chip, Card,
  Input, Tabs, Table, Toast, Banner).

## Scope

InForm here = **visual reskin** of Ariya Signals (the CI portal). The zip's Chat/Content component
designs are out of scope for this cycle — see `PRODUCT.md` → Scope note.
