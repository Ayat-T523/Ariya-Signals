-- Name: regulatory_calendar
-- Description: Stores EMA committee meeting dates (CHMP, COMP, PRAC, etc.) ingested
--   from the EMA events RSS feed. Used to surface upcoming regulatory meetings in
--   competitor Key Events tabs. Disease-agnostic — not tied to any specific asset.
--
-- To create: run this file once in the Supabase SQL editor.
-- To populate: node --env-file=.env.local scripts/run-ema-events.mjs

create extension if not exists "uuid-ossp";

create table if not exists regulatory_calendar (
  id          uuid        default uuid_generate_v4() primary key,
  event_type  text        not null,                  -- CHMP | COMP | PRAC | HMPC | PDCO | OTHER
  title       text,                                  -- Full meeting title from RSS
  start_date  date,
  end_date    date,
  source_url  text,
  created_at  timestamptz default now(),
  unique (event_type, start_date)
);

-- Allow anonymous reads (no PII in this table)
grant select on regulatory_calendar to anon, authenticated;
alter table regulatory_calendar disable row level security;
