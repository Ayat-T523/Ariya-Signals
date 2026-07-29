/**
 * motion.ts — Shared animation variants for InForm.
 *
 * Rules:
 *   - Nothing bouncy, nothing over 300ms
 *   - prefers-reduced-motion → all durations become 0 (instant)
 *   - Import from here; never hand-roll one-off animation values elsewhere
 */
import type { Variants } from 'framer-motion'

// ── Reduced-motion gate ───────────────────────────────────────────────────────
// Evaluated once at module load — fine for a Vite SPA with no SSR.
export const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Easing ────────────────────────────────────────────────────────────────────
// Standard material ease-out — professional, not bouncy.
const EASE: [number, number, number, number] = [0.25, 0.0, 0.25, 1.0]

// ── Page transition — fadeUp ──────────────────────────────────────────────────
// Mount: 450ms  |  Exit: 150ms
export const fadeUp: Variants = REDUCED_MOTION
  ? { initial: {}, animate: {}, exit: {} }
  : {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0,   transition: { duration: 0.80, ease: EASE } },
      exit:    { opacity: 0,          transition: { duration: 0.20, ease: EASE } },
    }

// ── Generic fade — no Y offset ────────────────────────────────────────────────
// Use for modals, slide-overs, overlays, and inline reveals.
export const fadeIn: Variants = REDUCED_MOTION
  ? { initial: {}, animate: {}, exit: {} }
  : {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.15, ease: EASE } },
      exit:    { opacity: 0, transition: { duration: 0.10, ease: EASE } },
    }

// ── Stagger container ─────────────────────────────────────────────────────────
// Wrap a list with this variant; each child that also uses a variant
// (e.g. fadeIn) will be staggered by 50ms.
// Usage:
//   <motion.ul variants={staggerContainer} initial="initial" animate="animate">
//     <motion.li variants={listItem}>…</motion.li>
//   </motion.ul>
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: REDUCED_MOTION ? {} : { staggerChildren: 0.05 },
  },
}

// ── List item — child of staggerContainer ─────────────────────────────────────
// Shorter duration (300ms) so the stagger doesn't stretch across the full list.
export const listItem: Variants = REDUCED_MOTION
  ? { initial: {}, animate: {}, exit: {} }
  : {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0,  transition: { duration: 0.30, ease: EASE } },
      exit:    { opacity: 0,         transition: { duration: 0.15, ease: EASE } },
    }
