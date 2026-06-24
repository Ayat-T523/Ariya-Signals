-- Phase 2: per-user tables for onboarding state, watchlist, and alert read-state.
-- All tables use auth.uid() as the key; RLS is default-deny.
-- No anon grants are issued — these tables are never anon-readable.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists user_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  indication          text,
  asset_id            text,         -- ASSETS_CONFIG id or ChEMBL INN
  asset_name          text,         -- brandName or INN for display
  onboarding_complete boolean not null default false,
  onboarding_version  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists watched_assets (
  user_id       uuid not null references auth.users(id) on delete cascade,
  competitor_id text not null,      -- slug matching ASSETS_CONFIG id / competitor slug
  created_at    timestamptz not null default now(),
  primary key (user_id, competitor_id)
);

create table if not exists read_alerts (
  user_id   uuid not null references auth.users(id) on delete cascade,
  alert_id  text not null,          -- alert.id (JSON demo) or company_signals UUID (Phase 4)
  marked_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table user_profiles  enable row level security;
alter table watched_assets enable row level security;
alter table read_alerts    enable row level security;

-- Each user may only read/write their own rows. No shared-read, no admin bypass.
create policy "own profile"
  on user_profiles for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own watchlist"
  on watched_assets for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own read state"
  on read_alerts for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_watched_assets_user_id on watched_assets(user_id);
create index if not exists idx_read_alerts_user_id    on read_alerts(user_id);
