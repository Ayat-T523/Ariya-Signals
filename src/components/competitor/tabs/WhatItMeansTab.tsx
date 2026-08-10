/**
 * WhatItMeansTab — a paid signpost, not an analysis surface.
 *
 * WHAT THIS USED TO BE, AND WHY IT CHANGED
 *
 * This tab rendered interpretation: a portfolio-overlap read against our own
 * asset, "key strategic questions", "suggested actions", and a SWOT, each with
 * an AI button to generate more. Every one of those is excluded from Ariya
 * Light. The handoff index §1 puts interpretation entirely in the paid tier,
 * because an auto-generated "what this means" shown to a competent CI
 * professional destroys the credibility of the paid analyst product, and §2
 * excludes `suggested_action` and AI generation outright.
 *
 * Frontend §2 is explicit about the treatment: convert to a paid signpost, do
 * not delete the slot. Signposting paid interpretation is correct freemium
 * behaviour (§8) and is not itself interpretation.
 *
 * NOTE ON WIRING: this component is currently not rendered anywhere.
 * CompetitorProfile mounts Pipeline, Company, Key Events and Messaging only, and
 * frontend §6.3's entity-view parts do not list a "what it means" tab either. The
 * slot is preserved as §2 requires, but whether it returns to the tab strip is an
 * entity-view composition decision, not something to settle here.
 *
 * Token-clean per §0 and §10: no raw hex, no ad-hoc inline colour.
 */

import PaidGate from '../../ui/PaidGate'

export default function WhatItMeansTab() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--gap-md)',
        paddingTop: 'var(--padding-xs)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-secondary)',
          fontSize: '13px',
          lineHeight: 1.6,
          color: 'var(--dark-blue-400)',
          maxWidth: '62ch',
        }}
      >
        Ariya Light tracks what is happening in your competitive space. Reading
        what it means for your asset is analyst work, delivered in the full
        platform.
      </p>

      <PaidGate
        label="Market implications"
        description="Portfolio overlap, strategic questions and SWOT, written by an analyst · Available in the full platform"
      />
    </div>
  )
}
