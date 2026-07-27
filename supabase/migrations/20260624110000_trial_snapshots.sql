create table if not exists trial_snapshots (
  nct_id       text primary key,
  content_hash text not null,
  fetched_at   timestamptz not null default now()
);
