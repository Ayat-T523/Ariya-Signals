# Ariya Signals — Spec Decisions Log

Tracks resolutions to spec ambiguities and contradictions. Append new entries as they arise.

---

## D-001 — Logo assets
**Date:** 2026-04-21
**Question:** The spec references `takeda.svg`, `biocryst.svg`, `pharvaris.svg` in competitors.json, but no SVG files exist in the repo. What should be used?
**Resolution:** Use initials-based placeholder badges throughout. Navy circle with white letter: "T" (Takeda), "B" (BioCryst), "P" (Pharvaris). Same size and treatment everywhere. Consistent with §7.2 monochrome differentiation principle.

---

## D-002 — Calendar component for CI Portal → Events
**Date:** 2026-04-21
**Question:** The spec specifies a month-grid calendar view but lists no calendar library in the approved stack (§2).
**Resolution:** Build a custom CSS grid calendar. No library. The calendar only needs to display ~12 events across a few months. Keeps the dependency list minimal per §2.

---

## D-003 — Revenue chart Y-axis labeling
**Date:** 2026-04-21
**Question:** How should the Y-axis be labeled on inline revenue trend charts to communicate units and illustrative nature without cluttering every tick?
**Resolution:** Label the Y-axis as "Revenue (USD M, illustrative)" in muted text, smaller than the chart title. Tick values are plain numbers only (0, 500, 1000, 1500). No "$M" suffix on every tick.

---

## D-004 — `example ariya signals.png` usage
**Date:** 2026-04-21
**Question:** Is the example screenshot a layout reference or a brand reference?
**Resolution:** Visual reference for brand feel only — tone, palette, typography, gradient treatment, whitespace. SPEC.md is authoritative for IA, page structure, and component behavior. Do not copy specific layouts from the image.

---

## D-005 — Competitor color-coding on alert cards (spec conflict)
**Date:** 2026-04-21
**Question:** §7.2 says do not assign distinct brand colors to competitors (use monochrome badges). §4.1 describes alert cards as having a "color-coded" competitor badge. Which takes priority?
**Resolution:** Brand system rule (§7.2) takes priority. Use monochrome initial badges for competitor identity on all alert cards. Severity border color (rose / amber / hairline per §7.6) handles visual urgency. `competitorId` is used for filtering and linking only, not for color-coding the UI.

---

## D-006 — Deployment target
**Date:** 2026-04-21
**Question:** Spec lists both Vercel and Netlify as deployment targets (§2).
**Resolution:** Vercel. Add `vercel.json` only if non-default config is needed (e.g., SPA rewrites). If Vercel defaults handle client-side routing correctly, skip the config file.
