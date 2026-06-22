-- Name: company_signals migration
-- Description: Creates the company_signals table, which stores classified SEC 8-K filings for each
--   competitor. Each row is one filing, tagged as 'deal' (item 1.01/2.01), 'exec_change' (item 5.02),
--   or 'press_release' (item 8.01), with a short excerpt of the filing text and a link to the SEC doc.
--   After running, the table will be empty — data is populated by the run-sec-deals.mjs ingest script.
--   Safe to re-run: IF NOT EXISTS guard skips creation if the table already exists.
-- Run in Supabase SQL editor after schema.sql

create table if not exists company_signals (
  id                 uuid    default uuid_generate_v4() primary key,
  competitor_id      text    not null,
  signal_type        text    not null,   -- 'deal' | 'press_release' | 'exec_change'
  date               date,
  headline           text,
  body_excerpt       text,              -- first ~400 chars of relevant item text
  items              text,              -- 8-K item numbers e.g. '1.01,9.01'
  source_url         text,
  accession_number   text,
  created_at         timestamptz default now(),
  unique(competitor_id, accession_number)
);
