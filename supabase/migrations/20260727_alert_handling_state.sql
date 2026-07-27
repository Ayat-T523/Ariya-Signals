-- Phase 4.1 (war-room-redesign-spec.md §7, open question 1): per-user triage state for
-- alerts/signals. Personal, Supabase-backed — same shape and RLS posture as read_alerts
-- (20260624_user_profiles.sql): keyed by user_id + alert_id, RLS restricted to auth.uid().
-- Cross-device for that one user; NOT visible to other users/teammates — there is no
-- team/account concept anywhere else in the app yet, so team-shared triage is out of
-- scope until that infrastructure exists.
--
-- Absence of a row means 'needs_triage' (the default), mirroring how read_alerts only
-- stores rows for the non-default (read) state rather than writing a row per alert.

create table if not exists alert_handling_state (
  user_id        uuid not null references auth.users(id) on delete cascade,
  alert_id       text not null,          -- alert.id (JSON demo) or company_signals UUID (Phase 4)
  handling_state text not null default 'needs_triage'
                 check (handling_state in ('needs_triage', 'in_progress', 'handled', 'dismissed')),
  updated_at     timestamptz not null default now(),
  primary key (user_id, alert_id)
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table alert_handling_state enable row level security;

create policy "own handling state"
  on alert_handling_state for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_alert_handling_state_user_id on alert_handling_state(user_id);
