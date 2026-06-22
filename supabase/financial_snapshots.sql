-- Name: financial_snapshots migration
-- Description: Creates the financial_snapshots table, which stores annual revenue and R&D spend
--   for each competitor pulled from SEC EDGAR XBRL filings. Each row is one competitor × fiscal year.
--   After running, the table will be empty — data is populated by the run-sec-financials.mjs ingest
--   script. Safe to re-run: the IF NOT EXISTS guard means it skips creation if the table already exists.
-- Run in Supabase SQL editor after schema.sql

create table if not exists financial_snapshots (
  id                 uuid    default uuid_generate_v4() primary key,
  competitor_id      text    not null,
  fiscal_year        int     not null,
  total_revenue_raw  numeric,
  total_revenue_usd  numeric,
  currency           text    default 'USD',
  rd_expense_raw     numeric,
  rd_expense_usd     numeric,
  exchange_rate_usd  numeric,        -- conversion rate used (e.g. 153.8 for JPY→USD FY2025)
  filing_date        date,
  source_url         text,
  created_at         timestamptz default now(),
  unique(competitor_id, fiscal_year)
);
