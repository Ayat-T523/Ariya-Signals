# Chat Design System — Specification

**InForm (working title) — Medical Affairs AI Platform**
Foundations + Components + Patterns, scoped to the Chat component.
Derived from V1–V6 in the Design Decisions Log. Resolves OV1, OV2, OV4.

Companion file: `Chat Design System — Visual Reference.html` — the source of truth for visual rendering. This document is the source of truth for rationale, tokens, and decisions.

---

## 0 · Principles

Three principles govern every decision in this system.

1. **Two layers, one register.** Glass for passive infrastructure (sidebar, top bar, profile, menus, tooltips). Neumorphic for active workspace (chat surface, inputs, citation panel, cards). No third layer. No crossover on a single surface.
2. **Colour is meaning, never decoration.** In a compliance-critical product, every functional colour has fixed semantics. Decorative colour creates ambiguity and erodes trust in state.
3. **Warmth is the guardrail.** Neutrals, glass, neumorphic shadows, and typography all bias warm. This keeps the product from drifting cold (generic enterprise) or saccharine (consumer AI).

---

## 1 · Colour tokens

### Foundation

| Token | Value | Use |
|---|---|---|
| `--bg-page` | `#EDE6DB` | Neumorphic base. The product's page colour. **Resolves OV2.** |
| `--bg-elevated` | `#F1EADF` | Raised neumorphic surfaces (cards, message bubbles, citation panel) |
| `--bg-sunken` | `#E5DDD0` | Sunken neumorphic surfaces (input bars, pressed states, disabled controls) |
| `--bg-glass` | `rgba(247, 241, 232, 0.72)` | Glass panel default. Warm bias preserved. **Resolves OV1.** |

### Functional — fixed semantics

Every functional colour has a **fill** hue (for dots, borders, and filled controls) and, where needed, a **text** variant darkened to meet WCAG AA contrast against its corresponding tint.

| Token | Value | Meaning |
|---|---|---|
| `--primary` | `#2B6F6A` | Primary action. CTAs, send, confirm. Also drives focus ring. |
| `--primary-hover` | `#24605B` | Primary hover |
| `--primary-pressed` | `#1D514D` | Primary pressed |
| `--primary-tint` | `#DCE8E6` | Soft primary background (user message bubble, tertiary hover) |
| `--info` | `#4A5A8C` | AI signal. Citation pills, AI avatar, info status. |
| `--info-tint` | `#DDE1EC` | Citation pill background |
| `--urgent` | `#C87F1F` | Urgency **fill** — dots, borders, knowledge-gap accent. |
| `--urgent-text` | `#7A4A0F` | Urgency **text** on `--urgent-tint`. AA-compliant. |
| `--urgent-tint` | `#F3E3CC` | Urgent status background |
| `--approved` | `#4F7A4F` | Approved **fill** |
| `--approved-text` | `#2F5530` | Approved **text** on tint |
| `--approved-tint` | `#D9E4D7` | Approved pill background |
| `--returned` | `#B5633F` | Returned **fill** |
| `--returned-text` | `#7A3F24` | Returned **text** on tint |
| `--returned-tint` | `#EEDAC8` | Returned pill background |
| `--error` | `#A94444` | Error **fill**. System error only — not a content state. |
| `--error-text` | `#7A2E2E` | Error **text** on tint |
| `--error-tint` | `#EDD2D2` | Error pill background |

**V2 colour adjustments.** Foundation backgrounds shifted to a cooler warm off-white (`--bg-page #F4F3F0`, `--bg-elevated #F8F7F4`, `--bg-sunken #EDECEA`) for a calmer chat surface. Primary teal deepened to `#1A5855` for stronger presence against the new base. Text neutrals re-grounded on `#1C1917` (primary) / `#6B6560` (secondary) / `#9D9690` (tertiary) / `#C4BFB8` (disabled) plus a new `--text-placeholder #B0A9A2`. Semantic `--border-default #D8D1C5`, `--border-strong #B5AEA6`, `--border-focus` (= `--primary`), `--border-error #B54040`, and `--divider #E0D9CE` promoted into first-class tokens — components no longer reference raw `--n*` neutrals for strokes or dividers. Error family adjusted to `--error #B54040` / `--error-text #7A2A2A` / `--error-tint #F2DADA`. Raw neutrals (`--n50`…`--n900`) retained for reference only; do not consume directly.

**Rule.** Functional colours drive *fills, dots, and borders*. For text on a tinted background, always use the `-text` variant. This preserves hue semantics while meeting AA contrast.

### Warm neutral scale

`N50 #F7F2EA` · `N100 #EDE6DB` · `N200 #E3DBCE` · `N300 #D0C6B5` · `N400 #B8AD9A` · `N500 #948C7D` · `N600 #746D5F` · `N700 #534E44` · `N800 #3A362F` · `N900 #2A2722`

### Text

| Token | Value | On `--bg-page` | Compliance |
|---|---|---|---|
| `--text-primary` | `#2A2722` | 12.00:1 | ✓ AAA |
| `--text-secondary` | `#655E52` | 5.17:1 | ✓ AA |
| `--text-tertiary` | `#7A7365` | 3.79:1 | ✓ AA large text / UI components only |
| `--text-disabled` | `#B8B1A4` | 2.44:1 | Below AA — disabled controls are exempt (WCAG 1.4.3) |
| `--text-inverse` | `#F7F2EA` | — | For use on `--primary` fill. 5.26:1 on teal ✓ AA |

---

## 2 · Typography

**Plus Jakarta Sans + JetBrains Mono.** Single humanist-geometric family for all display and UI text — chosen for its recognisable character identity (double-storey 'a' with pronounced spur, single-storey 'g' with full loop, sharp 'R' leg) and full weight range. Mono reserved for functional data only.

| Family | Role | Where |
|---|---|---|
| **Plus Jakarta Sans** | Display + UI | All display, heading, and interface text |
| **JetBrains Mono** | Functional mono | Citation IDs, `1 of 3` counters, source labels, token names |

### Scale

Rationalised scale approximating a 1.25 major-third ratio — tighter at reading sizes (where subtle hierarchy matters) and wider at display sizes (where visual distinction matters).

| Style | Size / Weight / Line height | Tracking |
|---|---|---|
| Display | 48 / 700 / 1.10 | -0.025em |
| Display-sm | 38 / 700 / 1.15 | -0.02em |
| H1 | 30 / 700 / 1.20 | -0.015em |
| H2 | 24 / 600 / 1.25 | -0.01em |
| H3 | 20 / 600 / 1.35 | -0.005em |
| Body-lg | 18 / 400 / 1.55 | 0 |
| Body | 16 / 400 / 1.50 | 0 |
| Body-sm | 14 / 400 / 1.45 | 0 |
| Caption | 12 / 400 / 1.40 | +0.02em |
| Mono | 13 / 400 / — | +0.01em |

**Weight usage.** 200 ExtraLight and 300 Light reserved for display-scale atmospheric use (not body text). 400 Regular is body default. 500 Medium for labels and secondary emphasis. 600 SemiBold for primary emphasis and subheadings. 700 Bold for display and h1. 800 ExtraBold avoided — too close to 700 at UI sizes, loses hierarchy.

**Body-lg (18px)** is used for AI responses because comprehension matters more than density. Inside the 16–19px reading-research sweet spot (Bringhurst / Smashing).

**V2 type scale available in parallel.** See § 2b below for the tokenised 14px-base scale (`--t-*`, `--lh-*`, `--ls-*`) that supersedes the values in this table for new components. The v1 scale remains supported for legacy surfaces already consuming it.

---

## 2b · Type system v2

A tokenised type scale rebased at 14px and expressed entirely through CSS custom properties. Components reference `--t-*` (size), `--lh-*` (line-height), `--ls-*` (letter-spacing) — never raw pixel values. Eleven steps, semantic names, plus strict line-height pairings.

### Sizes

| Token | Size | Role |
|---|---|---|
| `--t-display` | 32 | Empty-state greeting, hero moments |
| `--t-heading-xl` | 22 | Screen titles, major section headers |
| `--t-heading-lg` | 18 | Card titles, panel headers |
| `--t-heading-md` | 16 | Subsection headers, dense list headers |
| `--t-heading-sm` | 14 | Inline group labels, drawer titles |
| `--t-body-lg` | 15 | **AI response body only** |
| `--t-body-md` | 14 | **Base** — UI labels, user messages, prompt cards |
| `--t-body-sm` | 13 | Secondary descriptions, in-context captions |
| `--t-caption` | 12 | Timestamps, metadata, document names |
| `--t-label` | 11 | Category labels, overlines — **always uppercase** |
| `--t-micro` | 10 | Citation markers, badge counts — **mono only** |

### Line heights

| Token | Value | Paired with |
|---|---|---|
| `--lh-display` | 1.15 | `--t-display` |
| `--lh-heading` | 1.3 | `--t-heading-xl` / `-lg` / `-md` / `-sm` |
| `--lh-response` | **1.75** | `--t-body-lg` — **reserved for AI response body** |
| `--lh-body` | 1.6 | `--t-body-md` default |
| `--lh-body-sm` | 1.55 | `--t-body-sm` |
| `--lh-caption` | 1.4 | `--t-caption` |
| `--lh-label` | 1.2 | `--t-label` |

### Letter spacing

| Token | Value | Paired with |
|---|---|---|
| `--ls-display` | −0.3px | `--t-display` |
| `--ls-heading` | −0.1px | all heading sizes |
| `--ls-body` | 0 | body sizes |
| `--ls-label` | 0.07em | `--t-label` (uppercase only) |

### Paragraph spacing

`--t-response-paragraph-gap: 14px` — governs the gap between paragraphs in the AI response body. Not applied anywhere else; response paragraphs are never separated by indent or blank line.

### Rules

- **14px base.** Most interface text lives at `--t-body-md`. Raise to `--t-body-lg` only for the AI response body where reading comfort governs.
- **`--lh-response` is reserved.** Use `1.75` only for the AI response body. All other body copy uses `--lh-body` or `--lh-body-sm`.
- **Labels are always uppercase.** `--t-label` must be paired with `text-transform: uppercase` and `--ls-label`. Letter-spacing is not applied to any other size.
- **AI response paragraphs** are separated by `--t-response-paragraph-gap` (14px), not by first-line indent or blank lines.
- **Micro is mono.** Citation markers and badge counters use JetBrains Mono at `--t-micro`; never body sans at this size.

---

## 3 · Spacing & radius

### Spacing (4px base)

`s-1: 4` · `s-2: 8` · `s-3: 12` · `s-4: 16` · `s-5: 20` · `s-6: 24` · `s-8: 32` · `s-10: 40` · `s-12: 48` · `s-16: 64` · `s-20: 80`

### Radius

`xs: 6` · `sm: 10` · `md: 14` · `lg: 20` · `xl: 28` · `pill: 999`

Neumorphism requires larger, softer radii than typical material systems. 14–20px is the workhorse range. 28px for hero cards (empty state, large citation panel, workspace frame). `xs: 6` for tight internal elements only (inline code, small badges, bubble tails).

---

## 3b · Layout tokens

Macro-level structure layer that sits alongside `--s-*` but governs different concerns. Component tokens (`--s-*`) control density *inside* elements. Layout tokens control *where regions live* and how much breathing room they carry between zones.

**Rule:** Use `--layout-*` for page margins, zone widths, and structural heights. Use `--s-*` for everything inside a component. The two layers never mix — a sidebar item's internal padding uses `--s-*`; the sidebar's width uses `--layout-*`.

### Zone dimensions

Fixed structural values. Not aliased to `--s-*` because they are architectural constraints, not rhythm decisions.

| Token | Value | What it governs |
|---|---|---|
| `--layout-topbar-h` | `56px` | Top navigation bar height |
| `--layout-sidebar-w` | `256px` | Sidebar expanded width |
| `--layout-sidebar-w-collapsed` | `64px` | Sidebar icon-only (collapsed) mode |
| `--layout-panel-w` | `380px` | Citation panel, source drawer, all right-side panels |

**Why 56px top bar?** Atlassian's standard for focused product rails. Dense enough to respect real estate, tall enough for 40px touch targets with 8px clearance. The heavier 64px (Material baseline) is for hero navigation. InForm's top bar is a utility rail — not a brand statement.

### Content bounds

| Token | Value | When it applies |
|---|---|---|
| `--layout-content-max` | `760px` | Default message column — Chat two-column state |
| `--layout-content-max-narrow` | `560px` | When citation panel is open (three-column state) |
| `--layout-content-max-wide` | `960px` | Library and Insights — table and dashboard views |

**Why 760px?** At Body-lg (18px / 1.55 line-height), 760px yields ~72 characters per line — inside the Bringhurst 65–75 character optimal range. AI responses use Body-lg (C6: AI as colleague, reading comfort matters). Side breathing room is derived, not tokenised:

```
Canvas = 1440px − 256px sidebar = 1184px
Breathing each side = (1184 − 760) / 2 = 212px
```

This recalculates automatically as sidebar or panel states change — no extra token needed.

### Canvas insets

Alias `--s-*` to keep macro layout in rhythm with components.

| Token | Resolves to | px | Where |
|---|---|---|---|
| `--layout-canvas-top` | `var(--s-10)` | 40px | Above first message or empty state greeting |
| `--layout-canvas-bottom` | `var(--s-6)` | 24px | Below input bar to viewport bottom |
| `--layout-input-gap` | `var(--s-4)` | 16px | Between last message and input bar container |

### Sidebar insets

| Token | Resolves to | px | Where |
|---|---|---|---|
| `--layout-sidebar-pad-x` | `var(--s-3)` | 12px | Sidebar horizontal padding — item text indentation |
| `--layout-sidebar-item-h` | `40px` | 40px | Nav item min-height — WCAG 2.5.5 target size |
| `--layout-sidebar-gap` | `var(--s-1)` | 4px | Gap between adjacent sidebar items |
| `--layout-sidebar-section-gap` | `var(--s-2)` | 8px | Gap between labelled sidebar sections |

### Top bar insets

| Token | Resolves to | px | Where |
|---|---|---|---|
| `--layout-topbar-pad-x` | `var(--s-6)` | 24px | Top bar horizontal padding — logo-to-edge, avatar-to-edge |

### Density modes

Applied via `data-density="compact"` on the section container. Chat always uses Default. Library and Insights may use Compact for data-heavy views.

| Property | Default | Compact |
|---|---|---|
| Canvas top | 40px | 24px |
| Canvas bottom | 24px | 16px |
| Nav item height | 40px | 36px |
| Item gap | 4px | 2px |

### Breakpoints

CSS custom properties cannot be used in media queries — documented as reference values, implemented as literal `px` in CSS.

| Name | Value | Layout behaviour |
|---|---|---|
| `xl` | `1440px` | Primary design frame. Full three-zone layout. |
| `lg` | `1280px` | Large desktop. Content column narrows to 680px max. |
| `md` | `1024px` | Compact desktop. Sidebar auto-collapses to 64px. |
| `sm` | `768px` | Tablet. Sidebar becomes overlay drawer. Canvas full-width, 24px side padding. |
| `xs` | `375px` | Mobile. Single column. Input bar fixed to bottom. Sidebar is hamburger overlay. |

---

## 4 · Elevation

Five-level scale. E1–E3 use dual-source neumorphic shadow (light top-left, warm shadow bottom-right) — surfaces that sit *on* the workspace. E4–E5 use hard directional shadow — surfaces that float *above* the workspace. Translated from the Figma dual-source neumorphic and dropdown recipes onto the warm palette.

### Atomic shadow values

| Token | Value |
|---|---|
| `--shadow-soft` | `rgba(170, 155, 130, 0.18)` |
| `--shadow-mid` | `rgba(170, 155, 130, 0.28)` |
| `--shadow-strong` | `rgba(170, 155, 130, 0.38)` |
| `--shadow-deep` | `rgba(120, 100, 75, 0.45)` |
| `--shadow-modal` | `rgba(60, 45, 30, 0.22)` |
| `--highlight-soft` | `rgba(255, 250, 242, 0.65)` |
| `--highlight-mid` | `rgba(255, 250, 242, 0.85)` |
| `--highlight-strong` | `rgba(255, 250, 242, 0.95)` |

### Elevation scale

| Token | Composition | Use |
|---|---|---|
| `--elevation-1` | `-2 -2 6 highlight-soft` + `2 2 6 shadow-soft` | Subtle ambient lift — sidebar item hover, soft chips |
| `--elevation-2` | `-4 -4 12 highlight-mid` + `4 4 12 shadow-mid` | Default raised — buttons, chips, message bubbles, source chips |
| `--elevation-3` | `-6 -6 16 highlight-mid` + `6 6 18 shadow-strong` | Emphasised — citation panel, E2 hover |
| `--elevation-4` | `0 4 16 shadow-deep` + `0 1 4 rgba(120,100,75,0.25)` | Popover / dropdown — hard directional, NOT neumorphic |
| `--elevation-5` | `0 16 48 shadow-modal` + `0 4 12 rgba(60,45,30,0.16)` | Modal / top-level overlay |

### Inset

| Token | Composition | Use |
|---|---|---|
| `--inset-1` | `inset 2 2 6 shadow-mid` + `inset -2 -2 6 highlight-soft` | Text inputs, search fields, gentle press |
| `--inset-2` | `inset 3 3 8 shadow-strong` + `inset -3 -3 8 highlight-mid` | Pressed button, active toggle, selected row |

### Elevation rules

- **E1–E3 must sit on an opaque neumorphic surface** (`--bg-elevated` or `--bg-page`). Neumorphic shadows depend on surrounding surface continuity; they do not read on glass.
- **E4 is for on-workspace overlays.** Dropdowns and menus attach visually to the workspace via directional shadow, not neumorphic inset.
- **E5 is modal only.** Every modal must be accompanied by a scrim `rgba(42, 39, 34, 0.40)` to block interaction with the layer beneath.
- **Never stack E1 inside E2.** Elevations are not additive — pick one per surface.
- **Hover lift:** E1→E2 or E2→E3. Never skip two levels — the jump reads as broken.

**Resolves OV4.** Shadow tokens complete.

---

## 4b · Glow system

Glow is an **additive** highlight layered on top of a surface's base shadow — never a replacement. It is used as a restraint tool: five sanctioned tokens, four locations, every other surface stays matte. Overuse flattens the system and erases meaning.

### Tokens

| Token | Value | Use |
|---|---|---|
| `--glow-input-focus` | `0 0 48px 0 rgba(26, 88, 85, 0.13)` | Input bar on focus |
| `--glow-topbar` | `0 8px 32px 0 rgba(28, 25, 23, 0.07)` | Top bar ambient float |
| `--glow-brief-urgent` | `0 0 12px 0 rgba(200, 127, 31, 0.18)` | Brief item left edge — urgent variant |
| `--glow-brief-info` | `0 0 12px 0 rgba(26, 88, 85, 0.15)` | Brief item left edge — info variant |
| `--glow-response-edge` | `0 0 10px 0 rgba(74, 90, 140, 0.14)` | AI response left edge |

### Sanctioned locations

Glow appears at exactly four places in the product:

1. **Input bar focus.** Layered on top of `--inset-1` when the input is focused. Signals active intent.
2. **Top bar ambient.** Layered beneath the glass top bar as a subtle float. Separates chrome from canvas without a hard border.
3. **Brief item left edge.** Two variants — urgent (amber) and info (teal) — layered on top of `--elevation-1`. Pairs with a 3px coloured left border; the glow reinforces the border, never replaces it.
4. **AI response left edge.** Layered on top of `--elevation-2` with a 2px indigo left border, reinforcing the voice of the response.

### Rules

- **Glow is additive.** Always layered on top of the surface's base shadow (elevation or inset), never a replacement.
- **Four sanctioned locations only.** Every other surface — buttons, chips, cards, sidebar items, citation panel, popovers — stays matte.
- **Glow always pairs with a structural element** — a coloured left border, a focused input, or an ambient float. Glow alone is never the signal; it reinforces one.
- **No glow on hover or press.** State changes use elevation and tint, not glow. This keeps glow meaningful: it signals a small set of persistent, elevated conditions, not transient interaction.

---

## 5 · Glass family

Four glass roles. Each has distinct opacity, blur, and shadow calibrated to its job. Glass is for *passive* surfaces (frames, menus, tooltips). Never mix glass and neumorphic on a single surface.

| Role | Token block | Where |
|---|---|---|
| **Workspace** | `--glass-workspace-bg` (180° gradient cream → warm), `--glass-workspace-blur` (32px / sat 1.15), `--glass-workspace-shadow` | Large main surface — Library, Reviewer, Insights feed |
| **Panel** | `--glass-panel-bg` (0.72), `--glass-panel-blur` (24px / sat 1.1), `--glass-panel-shadow` | Sidebar, top bar, floating chrome |
| **Popover** | `--glass-popover-bg` (0.92, near-opaque), `--glass-popover-blur` (20px / sat 1.1), `--glass-popover-shadow` = `--elevation-4` | Dropdowns, menus, `@` source picker |
| **Tooltip** | `--glass-tooltip-bg` `rgba(42,39,34,0.92)` with `--glass-tooltip-fg` cream, `--glass-tooltip-blur` (12px), `--glass-tooltip-shadow` | Small transient — hover help, verbatim citation |

**Workspace** gradient translates the Figma Library container (`linear-gradient(180deg, rgba(246,247,249,0.75), rgba(158,165,173,0.75))`) onto the warm palette.

**Tooltip** uses a dark fill instead of a light frosted one so it remains legible regardless of backdrop — a critical difference for small floating elements that appear over varied surfaces.

**Rule.** Panel and workspace glass read *as frames* — the stage, not the content. Neumorphic workspace cards sit *on* them. Popover and tooltip glass read *as floating* — they appear above the workspace stage and disappear when dismissed.

---

## 6 · Focus & disabled states

Single recipes. Applied uniformly across every component. A11y floor.

### Focus ring

2px teal outline with 3px offset. Visible on keyboard navigation only (`:focus-visible`) — pointer users don't see it. Inverse (cream) variant for use on teal-filled primary CTAs where the teal ring would vanish.

| Token | Value |
|---|---|
| `--focus-ring` | `2px solid var(--primary)` |
| `--focus-ring-offset` | `3px` |
| `--focus-ring-inverse` | `2px solid var(--bg-page)` |

**Contrast.** Teal on cream = 4.73:1 · cream on teal = 5.26:1. Both pass WCAG 1.4.11 (3:1 UI component min, 4.5:1 AAA).

### Disabled

Sunken fill, muted text, shadow removed, cursor `not-allowed`. **Colour does the work — no opacity dimming.** Opacity degrades hue semantics for colourblind users, so disabled controls use actual tokens instead.

| Token | Value |
|---|---|
| `--disabled-bg` | `var(--bg-sunken)` |
| `--disabled-fg` | `var(--text-disabled)` |
| `--disabled-border` | `var(--n300)` |
| `--disabled-shadow` | `none` |
| `--disabled-cursor` | `not-allowed` |

Disabled controls are exempt from WCAG 1.4.3 text contrast, but must be announced correctly: every disabled control carries `aria-disabled="true"` and, where the reason isn't obvious, a tooltip explaining why it's disabled.

---

## 7 · Motion tokens

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | Chip add/remove, hover tint, pill hover |
| `--dur-base` | 200ms | Button press, tooltip open, status change |
| `--dur-slow` | 320ms | Citation panel slide, column transition |
| `--dur-deliberate` | 480ms | Page/route change, modal open, generation reveal |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default |
| `--ease-entrance` | `cubic-bezier(0, 0, 0.2, 1)` | Elements appearing |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving |
| `--ease-spring` | `cubic-bezier(0.3, 1.3, 0.5, 1)` | Neumorphic press return, chip add |

**Principle.** Motion communicates state, not personality. A neumorphic press settles with a small spring — signals "you touched something tactile." A citation panel slide is deliberate — signals "context is shifting." No bouncy logo loaders, no whimsical empty-state animations.

**Open gap.** `prefers-reduced-motion` fallback not yet specified — all spring and slide transitions need a reduced variant.

---

## 8 · Accessibility

### Contrast — verified with WCAG 2.1 relative-luminance formula

**Text on opaque surfaces**

| Pair | Tokens | Ratio | Compliance |
|---|---|---|---|
| Text primary on page | `#2A2722` on `#EDE6DB` | 12.00:1 | ✓ AAA |
| Body on elevated | `#2A2722` on `#F1EADF` | 12.45:1 | ✓ AAA |
| Text secondary on page | `#655E52` on `#EDE6DB` | 5.17:1 | ✓ AA |
| Text tertiary on page | `#7A7365` on `#EDE6DB` | 3.79:1 | ✓ AA large / UI components only |

**Text on glass surfaces** (composited over `--bg-page`)

| Pair | Composite | Ratio | Compliance |
|---|---|---|---|
| Text primary on glass-workspace (top) | `#2A2722` on ≈`#F5EFE5` | 13.01:1 | ✓ AAA |
| Text primary on glass-workspace (bottom) | `#2A2722` on ≈`#D8CEBB` | 9.54:1 | ✓ AAA |
| Text secondary on glass-workspace (top) | `#655E52` on ≈`#F5EFE5` | 5.60:1 | ✓ AA |
| Text secondary on glass-workspace (bottom) | `#655E52` on ≈`#D8CEBB` | 4.11:1 | ⚠ AA large only |
| Text primary on glass-popover | `#2A2722` on ≈`#F6F0E7` | 13.13:1 | ✓ AAA |
| Text secondary on glass-popover | `#655E52` on ≈`#F6F0E7` | 5.66:1 | ✓ AA |
| Text inverse on glass-tooltip | `#F7F2EA` on ≈`#3A3631` | 10.76:1 | ✓ AAA |

**Filled controls & status pills**

| Pair | Tokens | Ratio | Compliance |
|---|---|---|---|
| Primary button label | `#F7F2EA` on `#2B6F6A` | 5.26:1 | ✓ AA |
| Info label on tint | `#4A5A8C` on `#DDE1EC` | 5.13:1 | ✓ AA |
| Urgent text on tint | `#7A4A0F` on `#F3E3CC` | 5.92:1 | ✓ AA |
| Approved text on tint | `#2F5530` on `#D9E4D7` | 6.51:1 | ✓ AA |
| Returned text on tint | `#7A3F24` on `#EEDAC8` | 6.04:1 | ✓ AA |
| Error text on tint | `#7A2E2E` on `#EDD2D2` | 6.53:1 | ✓ AA |

**Non-text & system**

| Pair | Tokens | Ratio | Compliance |
|---|---|---|---|
| Primary teal on page (UI component) | `#2B6F6A` on `#EDE6DB` | 4.73:1 | ✓ 1.4.11 |
| Focus ring (teal on page) | 2px `#2B6F6A` + 3px offset | 4.73:1 | ✓ 1.4.11 |
| Focus ring inverse (cream on teal CTA) | 2px `#EDE6DB` + 3px offset | 4.73:1 | ✓ 1.4.11 |
| Disabled text on disabled bg | `#B8B1A4` on `#E5DDD0` | 1.58:1 | Exempt — WCAG 1.4.3 |
| Input icon button touch target | 40×40 | — | ✓ 2.5.5 AA |

### Rules

- Functional colours (urgent, approved, returned, error) are used for **fills, dots, and borders only**. Text on tinted backgrounds uses the darker `-text` variant.
- On **glass-workspace**, only `--text-primary` is safe for body text. `--text-secondary` falls to 4.11:1 on the darker end of the gradient and is limited to large text / metadata. In practice workspace content sits inside neumorphic cards so this rarely bites, but document it for any direct-on-workspace copy (e.g. workspace headers or empty states).
- Neumorphic hover-by-shadow is always supplemented with colour fill (primary) or tint overlay (secondary) for low-vision users.
- Disabled by colour, not opacity.
- Focus ring token applied uniformly — never per-component.

### Contrast math

```
L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin
  where R_lin = R/12.92 if R ≤ 0.03928, else ((R + 0.055)/1.055)^2.4

Contrast = (L_light + 0.05) / (L_dark + 0.05)

AA  thresholds: 4.5:1 normal · 3:1 large / UI
AAA thresholds: 7:1   normal · 4.5:1 large
```

### Contrast fixes made during Phase 0

- Urgent-on-tint was 2.56:1 at `#C87F1F` — darkened to `#7A4A0F` (`--urgent-text`), now 5.92:1.
- Approved, returned, error status pills darkened similarly with `-text` variants.
- Text tertiary repositioned as large-text-only.
- Input icon button touch targets raised from 36→40px.

---

## 9 · Composite effect recipes

Nine named recipes bundle the atomic tokens (surface + shadow + blur + border + radius + state behaviour) into reusable visual treatments. Every component in Section 10 references **exactly one recipe** by name and then declares its overrides — padding, typography, fixed dimensions, component-specific states.

The recipes keep the atomic tokens in one place. If a shadow value or glass opacity shifts, every component inheriting a recipe inherits the change automatically. No per-component shadow strings.

### R1 · Neumorphic raised (default)

- **Surface:** `var(--bg-elevated)` — `#F1EADF`
- **Border:** none
- **Shadow:** `var(--elevation-2)` — `-4 -4 12 highlight-mid` + `4 4 12 shadow-mid`
- **Blur:** —
- **Radius:** component-driven — `var(--r-md)` default, `var(--r-lg)` for soft rectangles, `var(--r-pill)` for chips
- **Hover:** shadow → `var(--elevation-3)`, optional `translateY(-1px)`, transition `var(--dur-base) var(--ease-standard)`
- **Active / pressed:** shadow → `var(--inset-1)`, bg → `var(--bg-sunken)`
- **Focus:** `var(--focus-ring)` with `var(--focus-ring-offset)`
- **Disabled:** Section 6 recipe (sunken bg, text-disabled fg, no shadow)
- **Used by:** AI message bubble, source chip, secondary button, sidebar item (hover), citation panel row (hover lift)

### R2 · Neumorphic raised — emphasised

- **Surface:** `var(--bg-elevated)` — `#F1EADF`
- **Border:** none
- **Shadow:** `var(--elevation-3)` — `-6 -6 16 highlight-mid` + `6 6 18 shadow-strong`
- **Blur:** —
- **Radius:** `var(--r-lg)` default; `var(--r-xl)` for hero surfaces
- **Hover:** `translateY(-1px)`, shadow opacity intensifies ~10% (no elevation bump — already at E3)
- **Active:** shadow → `var(--inset-2)`, bg → `var(--bg-sunken)`
- **Focus:** `var(--focus-ring)` with `var(--focus-ring-offset)`
- **Disabled:** Section 6 recipe
- **Used by:** citation panel (primary differentiator surface), dashboard alert, empty-state hero card

### R3 · Neumorphic pressed

- **Surface:** `var(--bg-sunken)` — `#E5DDD0`
- **Border:** none
- **Shadow:** `var(--inset-1)` — `inset 2 2 6 shadow-mid` + `inset -2 -2 6 highlight-soft`
- **Blur:** —
- **Radius:** `var(--r-xl)` for input bars, `var(--r-pill)` for streaming indicator, `var(--r-md)` for inline pressed panels
- **Hover (interactive variants only):** bg → `#EFE7DB` (+3% L*), inset unchanged
- **Focus-within (input bar exception):** `2px solid var(--primary)` inside the radius — no offset. An outer offset ring would float against the chip row in the bar's bottom row. Documented deviation; all other R3 uses retain standard offset ring.
- **Disabled:** Section 6 recipe
- **Used by:** input bar, search field, streaming indicator, sidebar item (active), toggle (on)

### R4 · Neumorphic pressed — deep

- **Surface:** `var(--bg-sunken)` — `#E5DDD0`
- **Border:** none
- **Shadow:** `var(--inset-2)` — `inset 3 3 8 shadow-strong` + `inset -3 -3 8 highlight-mid`
- **Blur:** —
- **Radius:** `var(--r-md)` or `var(--r-lg)`
- **Hover:** — (terminal state; does not lift further)
- **Focus:** `var(--focus-ring)` with `var(--focus-ring-offset)`
- **Used by:** primary button active-state shadow substitution, selected-row indicator, deeply recessed panel or slot

### R5 · Glass panel

- **Surface:** `var(--glass-panel-bg)` — `rgba(247, 241, 232, 0.72)`
- **Border:** `1px solid rgba(255, 250, 242, 0.45)` top/left (catches light) + `1px solid rgba(120, 100, 75, 0.08)` bottom/right (separates from workspace)
- **Shadow:** `var(--glass-panel-shadow)` — `0 2px 8px rgba(60, 45, 30, 0.08)` on the edge facing the workspace; no shadow on flush-mounted edges
- **Blur:** `backdrop-filter: blur(24px) saturate(1.1)` → `var(--glass-panel-blur)`
- **Radius:** `0` when flush-mounted (sidebar, top bar); `var(--r-lg)` 20px when floating
- **States:** frames do not carry interaction states. Children inside (sidebar items, menu rows) carry state via their own recipes.
- **Rule:** panel glass must sit on an opaque `--bg-page` or workspace wallpaper. Backdrop blur has no effect on an empty backdrop.
- **Used by:** sidebar, top bar, floating chrome, mobile bottom sheet (strong variant: `blur(32px)` + bg opacity `0.85`)

### R6 · Glass workspace

- **Surface:** `var(--glass-workspace-bg)` — `linear-gradient(180deg, rgba(247,241,232,0.78) 0%, rgba(208,196,175,0.72) 100%)`
- **Border:** none (workspace is a stage, not a card)
- **Shadow:** `var(--glass-workspace-shadow)` — `inset 0 1px 0 rgba(255, 250, 242, 0.4)` along the top edge. No outer shadow.
- **Blur:** `backdrop-filter: blur(32px) saturate(1.15)` → `var(--glass-workspace-blur)`
- **Radius:** `var(--r-xl)` 28px (Figma reference)
- **States:** no direct interaction — workspace is a container.
- **Rules:**
  - Only `--text-primary` is safe for direct body text on workspace glass. `--text-secondary` falls to 4.11:1 at the gradient's lower end — large text / metadata only.
  - Neumorphic cards (R1, R2) sit *on* workspace glass and carry their own elevation. **Never apply R1/R2 shadow directly to workspace glass** — neumorphic dual-source shadow needs opaque surface continuity.
- **Used by:** Library, Reviewer, Insights feed. **Chat does not use this recipe** — Chat sits on `--bg-page`.

### R7 · Glass popover

- **Surface:** `var(--glass-popover-bg)` — `rgba(247, 241, 232, 0.92)` (near-opaque to guarantee legibility over any backdrop)
- **Border:** `1px solid rgba(120, 100, 75, 0.12)` for crisp edge against bright workspaces
- **Shadow:** `var(--elevation-4)` — `0 4 16 shadow-deep` + `0 1 4 rgba(120, 100, 75, 0.25)` (hard directional — detaches from workspace)
- **Blur:** `backdrop-filter: blur(20px) saturate(1.1)` → `var(--glass-popover-blur)`
- **Radius:** `var(--r-md)` 14px
- **States:** frame is static; menu items inside carry their own hover tint and focus ring.
- **Entrance:** opacity `0 → 1` + scale `0.96 → 1` over `var(--dur-base)` `var(--ease-entrance)`. On open, focus moves to the first menu item (receives `--focus-ring`).
- **Used by:** dropdowns, `@` source picker, context menus, date pickers, settings panels

### R8 · Glass tooltip

- **Surface:** `var(--glass-tooltip-bg)` — `rgba(42, 39, 34, 0.92)` (**dark** fill for cross-backdrop legibility)
- **Foreground:** `var(--glass-tooltip-fg)` — `#F7F2EA` (cream)
- **Border:** `1px solid rgba(255, 250, 242, 0.08)` hairline for edge definition
- **Shadow:** `var(--glass-tooltip-shadow)` — `0 6px 20px rgba(20, 15, 10, 0.35)` + `0 1px 3px rgba(20, 15, 10, 0.4)`
- **Blur:** `backdrop-filter: blur(12px)` → `var(--glass-tooltip-blur)`
- **Radius:** `var(--r-md)` 14px
- **Entrance:** opacity `0 → 1` + `translateY(4px → 0)` over `var(--dur-base)` `var(--ease-entrance)`. Hover open delay `400ms`, close delay `120ms`.
- **Used by:** hover help, verbatim citation tooltip (C3 differentiator), keyboard shortcut hints

### R9 · Filled CTA (primary teal)

- **Surface:** `var(--primary)` — `#2B6F6A`
- **Foreground:** `var(--text-inverse)` — `#F7F2EA`
- **Border:** none
- **Shadow:** custom dual-source on teal — `-2px -2px 6px rgba(255, 250, 242, 0.5)` (highlight, softened on saturated fill) + `3px 3px 10px rgba(29, 81, 77, 0.35)` (depth, darker teal). **Do not reuse the neutral neumorphic stack** — warm shadow on teal reads muddy.
- **Blur:** —
- **Radius:** `var(--r-pill)` for text buttons, `var(--r-full)` for 40×40 circular send
- **Hover:** bg → `var(--primary-hover)` `#24605B`, shadow depth +10%
- **Active:** bg → `var(--primary-pressed)` `#1D514D`, shadow → inset `inset 2 2 6 rgba(20, 55, 50, 0.4)` (outer highlight fades to 0.25)
- **Focus:** `var(--focus-ring-inverse)` — cream ring. **Teal ring vanishes on teal fill — always use inverse.**
- **Disabled:** bg → `var(--bg-sunken)`, fg → `var(--text-disabled)`, shadow removed. Teal loses semantic meaning when disabled; falls back to neutral sunken (so users don't mistake a disabled primary for an active one).
- **Used by:** primary button, send button in input bar, primary dialog action, "Search externally" CTA in empty library state

### Recipe selection guide

| Situation | Recipe |
|---|---|
| Content surface that users read (message, alert, citation row) | R1 |
| Hero / differentiator surface (citation panel, empty-state hero) | R2 |
| Text-entry surface (input, search, textarea) | R3 |
| Currently-selected element (sidebar item active, toggle on) | R3 |
| Button in active / pressed terminal state | R4 |
| Primary action | R9 |
| Secondary action | R1 |
| Tertiary action | — (no surface; text + hover tint only) |
| Full-page chrome frame (sidebar, top bar) | R5 |
| Spacious workspace backdrop (Library, Reviewer) | R6 |
| Floating menu / dropdown / picker | R7 |
| Floating tooltip / micro-overlay | R8 |

### Mixing rules

- **One recipe per surface.** Never layer neumorphic (R1–R4) and glass (R5–R8) on the same element.
- **Neumorphic inside glass is allowed** — an R1 source chip on an R5 panel is the canonical pattern. The *parent* carries glass; the *child card* carries neumorphic.
- **Glass inside neumorphic is not.** An R7 popover anchored to a neumorphic button is fine (popovers float *above* the workspace), but you cannot nest R5/R6 as a child of R1/R2 — the neumorphic card's opaque surface kills the blur.
- **R9 is special.** It's the only saturated-fill surface. Treat it as its own primitive — never stack it inside or on top of R1/R2/R3. A primary button standing alone is correct; a primary button wrapped in a card is redundant.

---

## 10 · Components — Chat

Components reference exactly one recipe from Section 9, then declare overrides (padding, typography, fixed dimensions, state-specific behaviours). If a component still references a legacy `--neu-*` alias, the alias maps to the new scale (see HTML `:root` for the mapping table).

### 10.1 Message bubble — user

- **Recipe:** R1 with surface override
- **Surface:** `var(--primary-tint)` `#DCE8E6` (override — R1 default `--bg-elevated` is replaced to signal "you said this")
- **Shadow:** `var(--elevation-2)`
- **Radius:** `var(--r-lg)` 20px with `var(--r-xs)` 6px bottom-right tail
- **Padding:** `var(--s-3) var(--s-4)` — 12px vertical / 16px horizontal
- **Typography:** Body (16 / 400 / 1.50), `var(--text-primary)`
- **Layout:** `max-width: 72%`, right-aligned
- **States:** passive surface — no hover, no focus, not disable-able

### 10.2 Message bubble — AI

- **Recipe:** R1 (Neumorphic raised, default)
- **Shadow:** `var(--elevation-2)`
- **Radius:** `var(--r-lg)` 20px with `var(--r-xs)` 6px bottom-left tail
- **Padding:** `var(--s-4) var(--s-5)` — 16px vertical / 20px horizontal
- **Typography:** Body-lg (18 / 400 / 1.55), `var(--text-primary)` — comprehension over density
- **Header:** 8px dot, `linear-gradient(135deg, var(--primary), var(--info))` + `INFORM` caption (Mono 11 / 500 / +0.06em, `var(--text-secondary)`). Header-to-body gap `var(--s-3)`.
- **Layout:** `max-width: 80%`, left-aligned
- **Children inside:** inline citation pills (10.3), knowledge-gap blocks (10.11)
- **States:** passive surface — no hover, no focus, not disable-able

### 10.3 Citation pill (inline)

- **Recipe:** R1 variant — surface tint, shadow omitted (inline elements don't lift)
- **Surface:** `var(--info-tint)` `#DDE1EC`
- **Border:** none
- **Shadow:** — (inline, flush to prose)
- **Radius:** `var(--r-pill)`
- **Padding:** `2px 8px`
- **Typography:** JetBrains Mono 11 / 500 / +0.02em, `var(--info)`
- **Hover:** bg → `var(--info)` solid, fg → `var(--text-inverse)` cream. Transition `var(--dur-fast) var(--ease-standard)`.
- **Active (pressed to open tooltip):** bg `var(--info)`, pill compresses `scale(0.98)`
- **Focus:** `var(--focus-ring)` with `var(--focus-ring-offset)`
- **A11y:** semantic `<button>`, `aria-expanded` bound to tooltip visibility, `aria-describedby` anchors 10.6

### 10.4 Source chip (selected source)

Three states, all inside the input bar bottom row (C8 resolved — chips are interior to the bar, not above it):

**State 1 — Default (no selection)**
- **Chip:** "All documents" with a storage SVG glyph (not a letter code)
- **Recipe:** R1 raised. Surface `var(--bg-elevated)`, shadow `var(--elevation-2)` → hover `var(--elevation-3)`, radius `var(--r-pill)`, padding `4px 10px 4px 5px`
- **Glyph container:** 18×18, `var(--info-tint)` bg, `var(--info)` fg
- **Typography:** 13 / 500, `var(--text-primary)`
- **Behaviour:** always visible — signals current scope. Click opens the source drawer (C1: AI searches entire library when this is the scope)

**State 2 — 1–2 sources selected (individual chips)**
- **Recipe:** R1 raised (same as State 1)
- **Source-type glyph:** 18×18 rounded square, `var(--info-tint)` bg, `var(--info)` fg, letter P / W / G / I (Mono 9 / 700)
- **Close (`×`) control:** 16×16 hit target, `var(--text-tertiary)`. Hover → fg `var(--text-primary)`, bg `rgba(120, 100, 75, 0.08)` pill. Independent focus stop from chip body (2 tab stops per chip).
- **Hover (whole chip):** shadow → `var(--elevation-3)`, transition `var(--dur-fast)`

**State 3 — 3+ sources selected (condensed pill)**
- **Recipe:** R1 surface override — bg `var(--primary-tint)`, shadow `var(--elevation-2)` → hover `var(--elevation-3)`, radius `var(--r-pill)`, padding `4px 12px`
- **Typography:** 13 / 600, `var(--primary)`
- **Label:** "N documents selected" with a list SVG glyph
- **Behaviour:** click opens source drawer which shows currently selected docs
- **A11y:** `aria-label` announces count ("3 documents selected — click to manage")

**Placement:** Row 2 of the input bar (two-row interior layout — see 10.5). Chips flow left-to-right inside `iba-row2-left` alongside the "+ Select source" button. No horizontal scroll needed — State 3 condenses overflow automatically.

**Focus:** chip body gets `var(--focus-ring)`; close control gets its own ring

### 10.5 Input bar

- **Recipe:** R3 (Neumorphic pressed)
- **Surface:** `var(--bg-sunken)`
- **Shadow:** `var(--inset-1)`
- **Radius:** `var(--r-xl)` 28px
- **Padding:** `var(--s-3) var(--s-3) var(--s-3) var(--s-4)`

**Two-row interior layout** (C8 resolved 2026-04-19):

```
┌─────────────────────────────────────────────────────────────┐  R3
│ Row 1: [search icon]  textarea / placeholder                │
│ Row 2: [+ Select source]  [scope chip(s)]        [mic] [→] │
└─────────────────────────────────────────────────────────────┘
```

- **Row 1 (`iba-row1`):** 18×18 search icon (`var(--text-tertiary)`) + auto-expanding textarea. Textarea: transparent bg, Body (16 / 400 / 1.50), `var(--text-primary)`, placeholder `var(--text-tertiary)`. Auto-expand up to 6 lines then scroll.
- **Row 2 (`iba-row2`):** left cluster + right cluster, `justify-content: space-between`
  - **Left cluster:** `+ Select source` text button + scope chip(s) (see 10.4). Text button: 13 / 500, `var(--primary)`, transparent bg → hover `var(--primary-tint)` pill. Triggers R7 source picker menu (see 10.5.1).
  - **Right cluster:** mic button + send button
    - **Mic button:** 40×40 circle, R1 raised, always visible. `var(--text-secondary)` icon.
    - **Send button:** 40×40 circle. Disabled state: `var(--disabled-bg)` surface, `var(--disabled-fg)` fg, no shadow, `cursor: not-allowed`. Active state: R9 (teal fill, custom neumorphic shadow). Transitions between states at `var(--dur-base) var(--ease-standard)` when textarea has content.

- **Hover (bar itself):** — (R3 is terminal; the bar is always pressed)
- **Focus-within:** `2px solid var(--primary)` border inside the radius. **Documented exception to the focus-offset rule** — an outer offset ring would float against the chip row inside the bar. The inner border is the correct solution here. No `outline-offset` applied.
- **Drag-to-upload:** secondary upload affordance. On `dragover`, a dashed `var(--primary)` overlay appears over the bar surface. Primary path is the "+ Select source" → "Upload file" menu item.
- **Disabled:** R3 disabled recipe; send button disables independently via R9 disabled

#### 10.5.1 Source picker menu (+ Select source)

- **Recipe:** R7 (Glass popover)
- **Surface:** `var(--glass-popover-bg)` (0.92α warm glass)
- **Blur:** `var(--glass-popover-blur)` 20px saturate 1.1
- **Border:** `1px solid rgba(120, 100, 75, 0.12)`
- **Shadow:** `var(--elevation-4)`
- **Radius:** `var(--r-md)` 14px
- **Anchor:** bottom-left of the "+ Select source" button
- **Entrance:** `scale(0.96 → 1) + opacity(0 → 1)` at `var(--dur-base) var(--ease-entrance)`, transform-origin bottom-left
- **Two items (with hairline divider between):**
  1. **Upload file** — triggers drag-to-upload affordance or file picker. Icon: upload arrow.
  2. **Internal library** — opens source drawer (10.5.2) on the Internal tab.
- **Menu item anatomy:** 34×34 R1 icon container + label (14 / 600) + sublabel (11 / 400, `var(--text-tertiary)`)
- **Dismiss:** click outside, Escape key

#### 10.5.2 Source drawer

- **Recipe:** R2 (Neumorphic raised — emphasised) + scrim overlay
- **Surface:** `var(--bg-elevated)`, shadow `var(--elevation-5)`, radius `var(--r-lg)` top-left + bottom-left only
- **Width:** 400px, full viewport height, fixed position
- **Entrance:** `translateX(100% → 0)` at `var(--dur-slow) var(--ease-standard)`. Scrim `rgba(42,39,34,0.40)` fades in simultaneously.
- **Structure:**
  - **Header:** "Select sources" (H3) + close button (32×32 R1 circle)
  - **Tabs:** Internal / External. Active tab uses R3 pressed pill (`var(--bg-sunken)`, `var(--inset-1)`). Tab switcher is `role="tablist"`.
  - **Context note:** info-tint strip below tabs — "InForm will answer from [N] selected sources" — updates live as toggles change
  - **Internal tab:** Collections section (collection rows with toggle) → All documents section (individual doc rows with toggle) → Dashboards & CRM section
  - **External tab:** PubMed, ClinicalTrials.gov, Regulatory databases, Web sources — each with toggle
  - **Doc row:** 32×32 icon + title (13 / 500) + meta (11 / 400 Mono, `var(--text-tertiary)`) + toggle switch
  - **Toggle switch:** 36×20 pill. Off: `var(--n300)`. On: `var(--primary)`. Thumb: 16×16 white circle. Thumb translates 16px on state change at `var(--dur-base) var(--ease-spring)`.
  - **Footer:** live count label (Mono 13, `var(--text-secondary)`, count in `var(--primary)`) + Apply button (R9 pill CTA)
- **Apply behaviour:** closes drawer, updates chip state in the bar (State 1 / 2 / 3 per selection count — see 10.4)

### 10.6 Citation tooltip (hover)

- **Recipe:** R8 (Glass tooltip)
- **Surface:** `var(--glass-tooltip-bg)` — dark
- **Foreground:** `var(--glass-tooltip-fg)` cream
- **Border:** `1px solid rgba(255, 250, 242, 0.08)` (R8 default)
- **Shadow:** `var(--glass-tooltip-shadow)`
- **Blur:** `backdrop-filter: blur(12px)`
- **Radius:** `var(--r-md)` 14px
- **Padding:** `var(--s-4)` 16px
- **Width:** `min-width: 240px; max-width: 320px`
- **Structure:**
  - **Counter (top-right, absolute):** `1 of 3`, Mono 11 / 400, `rgba(247, 242, 234, 0.6)`
  - **Source label:** Mono 11 / 500 / uppercase / +0.06em, `rgba(247, 242, 234, 0.7)`
  - **Source title:** Body-sm 14 / 600, cream
  - **Divider:** `1px solid rgba(255, 250, 242, 0.12)` with `var(--s-3)` vertical gap
  - **Verbatim quote:** `2px solid var(--info)` left border, italic Body-sm, `rgba(247, 242, 234, 0.9)`, padding-left `var(--s-3)`
- **Entrance:** R8 default — opacity `0 → 1` + `translateY(4px → 0)` over `var(--dur-base) var(--ease-entrance)`; hover open delay 400ms / close delay 120ms
- **Pagination:** `←` / `→` floating-bottom on multi-passage, styled as tertiary on dark (cream text, hover opacity bump)

### 10.7 Citation panel (overview)

- **Recipe:** R2 (Neumorphic raised — emphasised); this is the C3 differentiator surface
- **Surface:** `var(--bg-elevated)`
- **Shadow:** `var(--elevation-3)`
- **Radius:** `var(--r-lg)` 20px
- **Padding:** `var(--s-5)` 20px
- **Width:** 320–380px (flex within three-column layout)
- **Structure:**
  - **Header row:** "Sources" (H3 20 / 600, `--text-primary`) + count `{n} sources · {m} passages` (Mono 11 / 400, `--text-secondary`). `flex justify-between align-center`.
  - **Source row (sub-component):**
    - Rest: flat on parent — surface inherits `--bg-elevated`, no shadow
    - Hover: lifts to R1 — shadow `var(--elevation-2)`, radius `var(--r-sm)` 10px, padding `var(--s-3) var(--s-4)`
    - Selected (drilled into 10.8): R3 inset treatment — `var(--inset-1)` on the row
  - **Passage-count badge:** `var(--info-tint)` bg, Mono 11 / 500 `var(--info)`, `var(--r-pill)`, `2px 8px` padding
- **Entrance:** slides in from right, `var(--dur-slow) var(--ease-standard)` — chat column compresses in parallel
- **Focus:** first source row receives `var(--focus-ring)` on panel open (keyboard)

### 10.8 Citation panel (detail)

- **Recipe:** R2 (continuation of overview panel — same surface, different contents)
- **Radius / padding / shadow:** identical to 10.7
- **Structure:**
  - **Back button (top-left):** `← Sources` — tertiary button style (see 10.9). Body-sm / 500, `var(--primary)`. Hover → pill bg `var(--primary-tint)`.
  - **Source metadata header:** type glyph (from 10.4) + title (H3 20 / 600) + authors/date (Body-sm / 400, `var(--text-secondary)`)
  - **Passage list (stacked):** each passage = mini-card with flat R1 treatment (no shadow), `var(--r-sm)` radius, `var(--s-3) var(--s-4)` padding:
    - Verbatim text, Body-sm 14 / 400, `var(--text-primary)`
    - Section/page label, Mono 11 / 400, `var(--text-tertiary)`, `var(--s-2)` above label
  - **Current passage (highlighted):** `3px solid var(--info)` left border, bg `var(--info-tint)` — matches inline citation semantics

### 10.9 Buttons

**Primary** — recipe R9

- Surface `var(--primary)`, fg `var(--text-inverse)`
- Shadow R9 (custom dual-source on teal)
- Radius `var(--r-pill)`, padding `10px 18px`, min-height `40px` (touch)
- Typography Body-sm (14 / 600 / +0)
- Hover / active / disabled per R9; focus uses `var(--focus-ring-inverse)`

**Secondary** — recipe R1

- Surface `var(--bg-elevated)`, fg `var(--text-primary)`
- Shadow `var(--elevation-2)` → hover `var(--elevation-3)` → active `var(--inset-1)`
- Radius `var(--r-pill)`, padding `10px 18px`, min-height `40px`
- Typography Body-sm (14 / 600)
- Focus `var(--focus-ring)` + offset; disabled per Section 6

**Tertiary** — no recipe (text + hover tint only)

- Surface transparent, no shadow, no border
- Radius `var(--r-pill)`, padding `8px 14px`
- Typography Body-sm (14 / 500), `var(--primary)`
- Hover: bg `var(--primary-tint)`, transition `var(--dur-fast)`
- Active: bg `rgba(43, 111, 106, 0.14)` (primary at 14% α)
- Focus `var(--focus-ring)` + offset
- Disabled: fg `var(--text-disabled)`, cursor `not-allowed`, no hover

**Icon button (standalone)**

- 40×40, radius `var(--r-full)` — recipe R1 for neutral, R9 for primary actions
- Icon 20×20 SVG centred
- All states inherit from underlying recipe

### 10.10 Streaming / generation indicator

- **Recipe:** R3 (Neumorphic pressed), pill form
- **Surface:** `var(--bg-sunken)`
- **Shadow:** `var(--inset-1)`
- **Radius:** `var(--r-pill)`
- **Padding:** `var(--s-2) var(--s-4)` — 8px / 16px
- **Typography:** Body-sm (14 / 400), `var(--text-secondary)` for label
- **Dots:** 3 × 6px circles, `var(--text-tertiary)`. Pulse animation `1.4s` stagger: opacity `0.3 → 1 → 0.3`, delays `0`, `0.2s`, `0.4s`. `var(--ease-standard)`.
- **Label cycling:** "Reviewing 4 sources" → "Drafting response" → "Checking citations". Crossfade `var(--dur-base) var(--ease-standard)`.
- **Reduced-motion fallback:** dots hold static at `opacity: 0.7`; label text still cycles (text change is information, not decoration)
- **States:** passive — no hover, no focus, no disabled (control is removed when streaming ends)

### 10.11 Knowledge gap (inline, within AI message)

- **Recipe:** R1 variant — surface swap + left border accent, shadow omitted (inline, flat within bubble)
- **Surface:** `var(--urgent-tint)` `#F3E3CC`
- **Border:** `3px solid var(--urgent)` `#C87F1F` on the **left edge only**
- **Shadow:** —
- **Radius:** `var(--r-md)` 14px
- **Padding:** `var(--s-3) var(--s-4)` — 12px / 16px
- **Structure:** flag glyph 16×16 `var(--urgent-text)` + `var(--s-2)` gap + Body-sm (14 / 400), `var(--text-primary)`
- **States:** passive block; the flag glyph itself is a `<button>` that opens knowledge-gap reporting (popover, recipe R7). Flag hover: bg `rgba(120, 100, 75, 0.08)` circle; focus `var(--focus-ring)`.

### 10.12 AI disclaimer

- **Recipe:** — (no surface; inline text on parent)
- **Surface / shadow / border:** none
- **Typography:** 11 / 400 italic, `var(--text-tertiary)`
- **Glyph:** 12px gradient dot (same stop as AI avatar — `var(--primary)` → `var(--info)`)
- **Layout:** glyph + `6px` gap + text, left-aligned under AI message, or centred beneath input bar, depending on context
- **Rule:** system-level component — never redesigned per screen (per X7)

### 10.13 Dashboard alert (inline)

- **Recipe:** R1 with left-border accent
- **Surface:** `var(--bg-elevated)`
- **Border:** `3px solid var(--urgent)` on the left edge only (semantic match to 10.11)
- **Shadow:** `var(--elevation-2)`
- **Radius:** `var(--r-lg)` 20px
- **Padding:** `var(--s-4)` 16px
- **Structure:**
  - 32×32 icon circle, bg `var(--urgent-tint)`, fg `var(--urgent-text)`, 16×16 SVG centred
  - Title: Body (16 / 600), `var(--text-primary)`
  - Description: Body-sm (14 / 400), `var(--text-secondary)`
  - Action row: "Investigate" (secondary 10.9) + "Dismiss" (tertiary 10.9), flex justified right
- **Hover (whole card, if clickable to open detail):** shadow → `var(--elevation-3)`, `translateY(-1px)`
- **Focus:** `var(--focus-ring)` with offset on the card wrapper

### 10.14 Sidebar item (history)

Three states — three recipe behaviours on the same element. Sidebar sits on an R5 Glass panel; these states describe the item itself.

**Rest (inactive)** — ghost on glass

- Surface: transparent (inherits R5 glass-panel)
- Shadow: none
- Radius `var(--r-sm)` 10px
- Padding `var(--s-2) var(--s-3)` — 8px / 12px
- Typography: title Body-sm (14 / 500) `--text-primary`; meta Caption (11 / 400) `--text-tertiary`

**Hover** — subtle lift (recipe R1 at reduced intensity)

- Surface: `rgba(255, 250, 242, 0.35)` warm overlay on glass-panel
- Shadow: `var(--elevation-1)` (subtle — sidebar is a quiet surface, never E2)
- Transition `var(--dur-fast) var(--ease-standard)`

**Active (currently-open chat)** — recipe R3 variant

- Surface: `var(--bg-elevated)` — **overrides R3's bg-sunken**. Sidebar "selected" reads as inset on elevated surface (not sunken-in-sunken, which feels dead).
- Shadow: `var(--inset-1)`
- Pin dot: 6px circle, `var(--primary)` `#2B6F6A`, positioned 8px from left edge, vertical centre
- Title weight bumps to 600

**Focus** — applies to all three states

- `var(--focus-ring)` 2px teal + 3px offset; offset sits on the glass panel edge

**Disabled** — (not applicable — history items are either present or removed, never disabled)

---

## 11 · Patterns

### 11.1 Two-column default
Sidebar (R5 glass-panel, 220–260px) + chat workspace (neumorphic on `--bg-page`, flex).

### 11.2 Three-column with citation panel
Sidebar + chat (compressed) + citation panel (10.7, R2, 320–380px). Transition `--dur-slow` standard easing — chat compresses, panel slides in from right.

### 11.3 Mobile responsive
Sidebar collapses to hamburger. Citation panel becomes bottom sheet (R5 glass-panel strong variant, swipe up/down). Input bar pins to bottom. Source chips are inside the bar's bottom row — they condense to the "N documents selected" pill automatically at 3+ (no horizontal scroll needed). Source drawer becomes full-screen on mobile. Per X2.

### 11.4 Empty state (new conversation)
Display-sm: "Good morning, {name}." Sub-line: "What would you like to understand today?" Three personalised seeded prompts (per C7) as secondary neumorphic buttons (R1), left-aligned with `→` arrow. No decorative illustration — typography and surface carry the moment.

### 11.5 Streaming state
User message sent (10.1 user bubble). AI bubble (10.2) appears immediately with header only + streaming indicator (10.10) inside. Indicator label cycles: "Reviewing 4 sources" → "Drafting response" → "Checking citations". Content streams in below when ready. Stop button appears as tertiary ghost (10.9) above the input.

### 11.6 Empty library state
Generous empty card — recipe R3 (Neumorphic pressed). `var(--r-xl)` radius. Message: "No documents match this scope." Explanation: "I couldn't find sources covering {scope}. Want me to search externally?" Primary (R9): "Search externally." Tertiary: "Broaden scope."

### 11.7 Error states

| State | Pattern |
|---|---|
| No relevant documents | Empty library pattern (11.6) |
| AI uncertainty | Knowledge gap flag (10.11) inline in response — not a separate screen |
| Connection lost | R5 glass-panel toast pinned top, `--urgent` left border. Auto-retries silently. Surfaces action only after 3rd failure. |
| Upload failed | Error state inside the upload placeholder message in chat thread, not a modal |

---

## 12 · What this system closes

From the Chat ideation checklist and Design Decisions Log:

- **V1–V6** fully specified with tokens
- **OV1, OV2, OV4** resolved with exact values
- **C8** (source chip placement) resolved 2026-04-19 — chips live **inside** the input bar on the bottom row (two-row interior layout). Not above the bar.
- **X4** (functional colour) operationalised with fill/text token pairs for AA contrast
- **X7** (AI disclaimer) formalised as a component
- **5-level elevation scale** translated from Figma shadow recipes onto warm palette
- **Glass family** with 4 roles (workspace, panel, popover, tooltip) defined
- **Focus ring** token — teal + inverse cream variant, system-applied
- **Disabled state** recipe — colour-driven, no opacity
- **Composite effect recipes** (R1–R9) — named bundles (surface + shadow + blur + border + radius + states) that every component inherits, with explicit mixing rules
- Contrast verified against **WCAG 2.1 AA** on every functional pair with actual luminance math

### Still open

- **OV3** — wallpaper variants for portfolio presentation (2–3 versions)
- `prefers-reduced-motion` fallback for spring and slide transitions
- Colourblind simulation (deuteranopia / protanopia) — needs verification in Sim Daltonism or Stark
- Italic usage rules — when to italicise what
- Real medical copy testing (BTK inhibitor, MENA subgroup, etc. render differently than lorem ipsum)
- Arabic companion family (v2, not v1)
- Elevation behaviour on zoom / high-DPI — shadow blur radii may need scaling
- `backdrop-filter` performance with 3+ stacked glass layers — not profiled

Cross-component Content and Insights Hub will extend this system. Nothing here should change; only additions (canvas, brief editor, insight card, task manager).

---

*This spec pairs with* `Chat Design System — Visual Reference.html`. *The HTML is the source of truth for visual rendering. This document is the source of truth for rationale, tokens, and decisions.*
