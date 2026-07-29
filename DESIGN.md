# DESIGN.md — InForm design language (Ariya Signals reskin)

> Impeccable design-context file. Target location: **repo root** (`DESIGN.md`).
> Scope: InForm is the **visual language** applied to the existing Ariya Signals CI portal — a
> reskin, not a new product. Source of truth: `src/styles/inform-tokens.css` +
> `src/styles/inform-theme.css` (from the InForm design system). Reconcile with any `DESIGN.md`
> your Claude Code session already generated; keep whichever is more current, but the token values
> below are authoritative.

## Direction (superseded the original "Analyst's Desk" warm-neumorphic world)

Replaced after live review: the original warm-cream neumorphic direction read as too soft/decorative
for the audience and too visually "empty" in practice (low page/card contrast, subtle shadows that
didn't register). User-confirmed replacement, grounded in a reference screenshot (Reddit's web UI) —
**"Clean Clinical."**

- **THESIS:** Precision over warmth. An analyst's tool should read as fast and exact, not cozy —
  refuses the neumorphic "wood desk" softness the previous direction shipped with.
- **OWN-WORLD:** Near-white surfaces, near-black ink, **flat 1px-bordered cards** (no emboss, no
  soft shadow-as-material), **Signal Indigo as the sole accent** carrying all meaning, Plus Jakarta
  Sans throughout, JetBrains Mono for every figure.
- **STORY:** The analyst opens the tool, scans dense information in seconds, trusts the precision
  of what's shown, acts.
- **FIRST VIEWPORT:** War Room's worklist — flat white rows on a near-white page, indigo as the
  only color signal, sharp corners on internal divider lines, generous but not sparse spacing.
- **FORM:** Restrained color strategy (neutrals + one accent — the Operate-mode default). Direction
  is user-pinned via a reference screenshot + an explicit structured-question confirmation, not an
  open concept exploration — no concept-seed roll was run.

## North star

**The Analyst's Desk, re-read as a precision instrument, not a warm room.** A monitoring workspace
that feels like a fast, exact tool — closer to a well-made spreadsheet or terminal than a cozy
consumer surface. Two failure modes to avoid: too soft/decorative (the previous neumorphic-cream
world) and too playful (consumer-AI). The register is a senior analyst's tool: calm, legible,
evidence-first, quietly premium — premium now reads through restraint and precision, not warmth.

## One material layer (replaces the old two-layer neumorphic/glass model)

The previous two-layer model (frosted-glass chrome vs. neumorphic-embossed content) is retired.
There is now **one flat material**: white/near-white surfaces with a 1px border, distinguished from
their surroundings by the border and by structure (columns, dividers), not by a shadow-driven
"raised" illusion or by a colored chrome fill.

- **Chrome (top bar, nav, filter bars, menus):** same near-white surface as content, separated by a
  1px border/divider. The nav is **not** a dark or glass-tinted panel — it reads as a distinct
  column purely through the border and its own content, matching the reference world.
- **Content (cards, rows, inputs):** white/near-white background, 1px border in the neutral-300
  step, optionally a very small (2–4px, low-opacity) shadow for the barest lift on hover/focus only
  — never a resting-state neumorphic emboss.
- Neumorphic tokens (`--neu-raised`, `--neu-raised-strong`, `--neu-inset`, `--neu-pressed`,
  `--neu-knob`) and glass tokens (`--glass-bg`, `--glass-border`, `--glass-shadow`) are **deprecated**
  — do not reach for them in new work. They remain defined for now only so already-migrated
  components don't hard-break mid-transition; components should move off them as they're touched.

## Color (from `inform-tokens.css`)

Color always carries meaning — never decorative. Restrained strategy: neutrals plus one accent.

- **Surfaces (neutral, cool-leaning near-white — not warm cream):** `--cream-50` through
  `--cream-400` are being renamed in spirit to a neutral-gray ramp; until the token file is
  physically renamed, treat `--cream-50 #FDFBF7`/`--cream-100` as the primary white-ish surface and
  `--cream-300/400` as border/divider steps, not as "warm cream" — new work should not lean into
  their warmth.
- **Ink (text):** `--ink-900` primary, `--ink-600` is still the muted-text floor (≥4.5:1 on white).
- **Signal Indigo (the one accent):** `--indigo-500 #2A76F4` — the only color carrying meaning
  (primary action, links, AI-synthesized content, active nav state). `--indigo-600` for resting
  filled buttons (contrast-corrected, see Accessibility). One accent only — do not reach for the
  navy/deep-register tokens as a second brand color in new work.
- **Functional states:** `--amber-*` alerts/gaps, `--sage-*` approved/live, `--terra-*`
  returned/attention, `--crimson-*` error/destructive — unchanged, these aren't part of the warmth
  problem and stay as the severity/status vocabulary.
- Severity mapping unchanged: high → crimson/terra, medium → amber, low → ink-muted; live/approved
  → sage; AI-synthesized content → indigo.

## Typography

Unchanged: Plus Jakarta Sans for display/UI (`--font-display`/`--font-ui`), JetBrains Mono for
every number/timestamp/count (`--font-mono`, `.num`/`.mono`). Scale unchanged.

## Spacing, radii, elevation

- Spacing scale unchanged (`--s-*`).
- **Radii — two dedicated tokens, not the shared `--r-*` scale.** `--r-*` stays as-is for
  not-yet-migrated neumorphic components (their rounded corners are paired with a soft emboss
  shadow; retargeting the shared scale would flatten the corner but leave the curve, an incoherent
  half-state). Migrated components use:
  - `--r-flat-content` (0px) — every page-level content container: cards, plates, the stat bar,
    rail panels, modal/dropdown-scale surfaces. Content-area surfaces are sharp-cornered, full
    stop, not "less rounded."
  - `--r-flat-control` (4px) — small rectangular controls only: nav items, icon buttons, focus
    outlines. Pills/circular controls (segmented control, badges, the floating nav chevron, avatar)
    stay on the shared `--r-pill` — this scale never touches them.
- **Elevation:** flat by default, no resting shadow. The one shadow token, `--shadow-flat-hover`
  (`0 1px 2px rgba(15,15,20,0.04)`), is scoped to elements that visibly float off the surface below
  them (the nav's edge chevron) — not used as a "this is active/hovered" cue on resting surfaces
  (e.g. not on a segmented control's active pill; a background/text color change is enough there).
- **No page-level padding on migrated pages.** The content area fills its column edge-to-edge;
  cards' own 1px borders meet the nav/viewport edges directly rather than floating in an inset
  margin. Card-internal padding (row padding, panel padding) stays — this is about the outer page
  wrapper, not content legibility.
- **Straight internal lines:** a divider between rows/sections is a plain `border-top`/`border-bottom`
  with **no border-radius on that same box** — if an element needs a rounded hover-highlight, give
  the highlight its own non-dividing box rather than rounding the box that also carries the divider.

## Motion

Unchanged: cap 320ms, no bounce/tilt/glow, respect `prefers-reduced-motion`.

## Accessibility (non-negotiable)

- Text contrast ≥ 4.5:1 — easier to hit on near-white/near-black than the old cream/ink pairing;
  still verify per component.
- Explicit focus ring on every interactive element (`--ring-indigo`/`--ring-ink`).
- Touch targets ≥ 24×24 (aim 44×44).
- Primary CTAs are indigo-600 filled (unchanged reasoning — flat color, not an emboss, meets
  contrast reliably).

## Component inventory (recipes in `inform-theme.css`)

Same component set as before (buttons, cards, chips, inputs, drawer, modal, menu, tabs, table,
seg, nav-item, etc.) — being migrated component-by-component from the neumorphic/glass recipes to
the flat-bordered ones described above. A component that still uses `--neu-*`/`--glass-*` tokens or
a warm-cream-only surface has **not** been migrated to this direction yet, even if it was already
"InForm" under the previous world.

## What "migrated to Clean Clinical" means (per-component test)

A component is migrated only if: it uses a flat near-white surface with a 1px neutral border (not
a neumorphic shadow as its resting elevation), Signal Indigo is the only color used for meaning
(not decoration), any internal divider line has no border-radius on its own box, mono is used for
every number/timestamp/count, and it passes the accessibility rules above. Check per component, not
per page — a page can be partway migrated.
