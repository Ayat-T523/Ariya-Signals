import posthog from 'posthog-js'

// Single enable-guard so every callsite is clean.
// When Clerk is wired, swap the identify() stub below — nowhere else needs changing.
const enabled = () => Boolean(import.meta.env.VITE_POSTHOG_KEY)

export const analytics = {

  // ── Identity ────────────────────────────────────────────────────────────────
  // TODO: replace 'ariya-internal' with clerk.user.id once Clerk is integrated.
  identify(role?: string | null) {
    if (!enabled()) return
    posthog.identify('ariya-internal', {
      role: role ?? 'unknown',
      product: 'ariya-signals',
      is_internal: import.meta.env.VITE_IS_INTERNAL === 'true',
    })
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  page_viewed(route: string, from_route?: string) {
    if (!enabled()) return
    posthog.capture('page_viewed', { route, from_route })
  },

  // ── Signals (War Room) ──────────────────────────────────────────────────────
  signal_opened(id: string, priority: string, source: string) {
    if (!enabled()) return
    posthog.capture('signal_opened', { signal_id: id, priority, source })
  },

  signal_sorted(mode: 'Importance' | 'Recency') {
    if (!enabled()) return
    posthog.capture('signal_sorted', { mode: mode.toLowerCase() })
  },

  // ── Competitors ─────────────────────────────────────────────────────────────
  competitor_viewed(name: string) {
    if (!enabled()) return
    posthog.capture('competitor_viewed', { competitor_name: name })
  },

  competitor_tab_viewed(tab: string, competitor_id: string) {
    if (!enabled()) return
    posthog.capture('competitor_tab_viewed', { tab, competitor_id })
  },

  // ── Ask Ariya ───────────────────────────────────────────────────────────────
  ariya_prompt_clicked(prompt_id: string, prompt_text: string) {
    if (!enabled()) return
    posthog.capture('ariya_prompt_clicked', { prompt_id, prompt_text })
  },

  // NOTE: Capture length only — never the question content.
  ariya_question_typed(question_length: number) {
    if (!enabled()) return
    posthog.capture('ariya_question_typed', { question_length })
  },

  // ── Alerts ──────────────────────────────────────────────────────────────────
  alert_expanded(alert_id: string) {
    if (!enabled()) return
    posthog.capture('alert_expanded', { alert_id })
  },

  alerts_marked_all_read(count: number) {
    if (!enabled()) return
    posthog.capture('alerts_marked_all_read', { count })
  },

  // ── Other actions ───────────────────────────────────────────────────────────
  export_clicked(surface: string) {
    if (!enabled()) return
    posthog.capture('export_clicked', { surface })
  },

  feedback_opened() { if (enabled()) posthog.capture('feedback_opened') },
  feedback_submitted(rating: string) { if (enabled()) posthog.capture('feedback_submitted', { rating }) },

  // ── Guided tour ─────────────────────────────────────────────────────────────
  tour_started() { if (enabled()) posthog.capture('tour_started') },
  tour_completed() { if (enabled()) posthog.capture('tour_completed') },
  tour_skipped(step: number) { if (enabled()) posthog.capture('tour_skipped', { step }) },

  // ── Session ─────────────────────────────────────────────────────────────────
  session_expiry_banner_seen() {
    if (enabled()) posthog.capture('session_expiry_banner_seen')
  },
}
