// posthog-js is dynamically imported only when VITE_POSTHOG_KEY is present,
// keeping it out of the initial bundle entirely for builds without the key.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ph: any = null

if (import.meta.env.VITE_POSTHOG_KEY) {
  import('posthog-js').then((mod) => { _ph = mod.default })
}

const enabled = () => _ph !== null

export const analytics = {

  // ── Identity ────────────────────────────────────────────────────────────────
  // Uses register() instead of identify() so each device keeps its own anonymous
  // PostHog distinct_id. identify() with a shared ID merges all visitors into one person.
  identify(role?: string | null) {
    if (!enabled()) return
    _ph.register({
      role: role ?? 'unknown',
      product: 'ariya-signals',
      is_internal: import.meta.env.VITE_IS_INTERNAL === 'true',
    })
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  page_viewed(route: string, from_route?: string) {
    if (!enabled()) return
    _ph.capture('page_viewed', { route, from_route })
  },

  // ── Signals (War Room) ──────────────────────────────────────────────────────
  signal_opened(id: string, priority: string, source: string) {
    if (!enabled()) return
    _ph.capture('signal_opened', { signal_id: id, priority, source })
  },

  signal_sorted(mode: 'Importance' | 'Recency') {
    if (!enabled()) return
    _ph.capture('signal_sorted', { mode: mode.toLowerCase() })
  },

  // ── Competitors ─────────────────────────────────────────────────────────────
  competitor_viewed(name: string) {
    if (!enabled()) return
    _ph.capture('competitor_viewed', { competitor_name: name })
  },

  competitor_tab_viewed(tab: string, competitor_id: string) {
    if (!enabled()) return
    _ph.capture('competitor_tab_viewed', { tab, competitor_id })
  },

  // ── Ask Ariya ────────────────────────────────────────────────────────────────
  ariya_prompt_clicked(prompt_id: string, prompt_text: string) {
    if (!enabled()) return
    _ph.capture('ariya_prompt_clicked', { prompt_id, prompt_text })
  },

  // NOTE: Capture length only — never the question content.
  ariya_question_typed(question_length: number) {
    if (!enabled()) return
    _ph.capture('ariya_question_typed', { question_length })
  },

  // ── Alerts ──────────────────────────────────────────────────────────────────
  alert_expanded(alert_id: string) {
    if (!enabled()) return
    _ph.capture('alert_expanded', { alert_id })
  },

  alerts_marked_all_read(count: number) {
    if (!enabled()) return
    _ph.capture('alerts_marked_all_read', { count })
  },

  // ── Other actions ───────────────────────────────────────────────────────────
  export_clicked(surface: string) {
    if (!enabled()) return
    _ph.capture('export_clicked', { surface })
  },

  feedback_opened() { if (enabled()) _ph.capture('feedback_opened') },
  feedback_submitted(rating: string) { if (enabled()) _ph.capture('feedback_submitted', { rating }) },

  // ── Guided tour ─────────────────────────────────────────────────────────────
  tour_started() { if (enabled()) _ph.capture('tour_started') },
  tour_completed() { if (enabled()) _ph.capture('tour_completed') },
  tour_skipped(step: number) { if (enabled()) _ph.capture('tour_skipped', { step }) },

  // ── Session ─────────────────────────────────────────────────────────────────
  session_expiry_banner_seen() {
    if (enabled()) _ph.capture('session_expiry_banner_seen')
  },
}
