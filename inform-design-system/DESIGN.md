# DESIGN.md — InForm design language (Ariya Signals reskin)

> Impeccable design-context file. Target location: **repo root** (`DESIGN.md`).
> Scope: InForm is the **visual language** applied to the existing Ariya Signals CI portal — a
> reskin, not a new product. Source of truth: `src/styles/inform-tokens.css` +
> `src/styles/inform-theme.css` (from the InForm design system). Reconcile with any `DESIGN.md`
> your Claude Code session already generated; keep whichever is more current, but the token values
> below are authoritative.

## North star

**The Analyst's Desk — intelligent warmth.** A monitoring workspace that feels like a precision
instrument on a warm wooden desk, not a cold enterprise dashboard. Two failure modes to avoid:
too cold (legacy enterprise blue-grey) and too casual (consumer-AI playful). The register is a
senior analyst's tool: calm, legible, evidence-first, quietly premium.

## Two-layer visual model (V1–V4)

The system has exactly two material layers. Do not blend them.

1. **Chrome / passive layer — frosted glass.** Top bar, nav sidebar, filter bar, menus, modals'
   backdrop. Tinted, translucent (`--glass-bg`, `--glass-border`, `--glass-shadow`), warm bias.
   Frames the work; never competes with it.
2. **Workspace / content layer — opaque neumorphic.** Cards, feed rows, KPI tiles, inputs, the
   canvas. Warm near-white cream base (`--cream-100`), soft neumorphic depth
   (`--neu-raised`, `--neu-inset`). This is where the user's work lives — grounded, legible,
   wallpaper-independent.

Rule: **glass only for chrome, neumorphism only for content.** A glass content card or a
neumorphic top bar is a violation.

## Color (from `inform-tokens.css`)

Color always carries meaning — never decorative (X4).

- **Surfaces (warm neutrals):** `--cream-50 #FDFBF7`, `--cream-100 #F7F2EA` (primary surface),
  `--cream-200 #EDE6DB` (page bg), `--cream-300 #E5DDCF` (divider), `--cream-400 #D4CABA`.
- **Ink (text):** `--ink-900 #2A2722` (primary) → `--ink-200 #E5E1D6`. **Minimum text opacity/step
  for legibility: `--ink-600 #6B655B`** for muted/caption text (see Accessibility — do not go
  lighter than ink-600 on cream for body/caption).
- **Deep register (navy):** `--navy-900 #14283A` → `--navy-500`. `--navy-700 #24445C` is the
  signature deep surface.
- **Signal Indigo (the one accent):** `--indigo-500 #2A76F4` — AI, citations, primary action.
  `--indigo-600` hover, `--indigo-100/050` tints. One accent only.
- **Functional states:** `--amber-500 #FFDA44` alerts/gaps; `--sage-600 #4F7A4F` approved;
  `--terra-600 #B5633F` returned/attention; `--crimson-600 #D80027` error/destructive. Each has
  100/050 tints.

For Ariya severity mapping: high → crimson/terra register, medium → amber, low → ink-muted;
"live/approved" provenance → sage; AI-synthesized content → indigo.

## Typography

- **Display + UI:** `Plus Jakarta Sans` (`--font-display`, `--font-ui`). Documented brand choice —
  not "generic," do not flag it as drift.
- **Mono:** `JetBrains Mono` (`--font-mono`) — **every number, timestamp, count, and code-like
  token** uses mono (`.num`, `.mono`). This is a signature of the system.
- **Accent (optional):** `BR Segma`, falls back to Plus Jakarta Sans.
- **Scale:** `--t-display-72/48`, `--t-h1 36`, `--t-h2 24`, `--t-h3 18`, `--t-body-lg 16`,
  `--t-body 14`, `--t-ui-med 14/500`, `--t-caption 12`, `--t-micro 11`, `--t-mono 12`.

## Spacing, radii, elevation

- **Spacing:** `--s-xxs 4` → `--s-wide 64` (4/6/8/12/16/24/32/48/64).
- **Radii:** `--r-xs 6` → `--r-xl 28`, `--r-pill 999`. Cards typically `--r-md`/`--r-lg`.
- **Neumorphic shadows:** `--neu-raised`, `--neu-raised-strong`, `--neu-inset`, `--neu-pressed`,
  `--neu-knob`. Use raised for resting cards, inset/pressed for active controls. **Neumorphic
  base must be cream, never pure white** — pure white collapses the shadows (V4).
- **Glass:** `--glass-bg`, `--glass-border`, `--glass-shadow` for chrome only.

## Motion

- **Cap: 320ms. No bounce, no tilt, no glow.** Motion communicates state, not personality (X3).
- **Trap:** `--ease-spring: cubic-bezier(0.3,1.3,0.5,1)` exists in the token files and **violates
  this rule** (overshoots/bounces). Remove it or mark it explicitly unused — do not adopt it.
- Respect `prefers-reduced-motion` centrally (already wired in the app).

## Accessibility (V5, V6 — non-negotiable)

- **Primary CTAs are color-filled flat (indigo), not pure neumorphic** — neumorphic-only states
  fail WCAG AA contrast. Secondary/tertiary may use neumorphic emboss/deboss.
- **Explicit focus ring on every interactive element** (`--ring-indigo`, `--ring-ink`) — shadow
  inversion alone is insufficient for keyboard visibility.
- **Text contrast ≥ 4.5:1.** The legacy `rgba(5,10,68,0.35–0.40)` muted-text pattern fails at
  ~2.3–2.7:1 — replace with `--ink-600` or darker. Treat ink-600 on cream as the muted floor.
- **Touch targets ≥ 24×24 (aim 44×44).**

## Component inventory (recipes in `inform-theme.css`)

Buttons (`.btn`, `-primary/-secondary/-ghost/-danger/-icon`, `-sm/-lg/-xl`, `.btn-spinner`),
cards (`.card`, `.src-card`), chips/tags (`.chip-select`, `.tag`), inputs (`.input`, `.textarea`,
`.field`, `.composer`), `.drawer`, `.modal` (`-hd/-body/-ft`), `.menu`/`.menu-glass`, `.tabs`/
`.tabs-line`, `.table`, `.seg`, `.slider-*`, `.toast`, `.banner`, `.empty` (empty states),
`.cite`/`.claim`/`.reason` (citation/provenance), `.num`/`.mono` (tabular figures), `.progress`,
`.check`/`.radio`, `.kbd`, `.glass-stage`, `.masthead`, `.nav-item`, `.rail`, `.sidebar`.

Ariya-specific components (build from the zip's HTML references): **Signal Card, KPI Card,
Market Weather, ProvenanceChip, Feed Filter Bar, Signal Feed (states + variants)**. React
implementations live in `src/components/inform/*`.

## What "migrated to InForm" means (per-component test)

A component is migrated only if: it uses `inform-tokens.css` variables (no raw hex/legacy
`rgba(5,10,68,*)`), applies the correct layer (glass chrome / neumorphic content), uses mono for
numbers, respects the motion cap, and passes the accessibility rules above. "Imports from
`components/inform`" is not sufficient — check per component, not per page.
