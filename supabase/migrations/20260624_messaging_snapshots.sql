create table if not exists messaging_snapshots (
  competitor_id  text primary key,
  content_hash   text not null,      -- SHA-256 of normalized core content (candidate detection)
  core_message   text,               -- last extracted core message headline
  pillars        jsonb,              -- string[] of messaging pillars
  source_url     text not null,
  scraped_at     timestamptz not null default now()
);

-- Written by the ingest script (service role). Read by the frontend via getMessagingSnapshot()
-- which uses the anon-key Supabase client. Grant SELECT so authenticated browsers can read it.
-- No RLS needed — this is non-sensitive competitor positioning data, same category as
-- company_signals and financial_snapshots which also carry anon SELECT grants.
grant select on messaging_snapshots to anon, authenticated;
