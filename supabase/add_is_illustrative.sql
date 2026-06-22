-- Name: add_is_illustrative
-- Description: Adds an is_illustrative boolean column to company_signals.
--   Allows the UI to badge any signal that is not sourced from a verified primary document.
--   Defaults to false so all existing SEC EDGAR rows remain trusted.
--   After running, re-run seeds/csl_behring_signals.sql to mark the three unverified CSL
--   Behring rows as illustrative.
--   Safe to re-run: the IF NOT EXISTS check on the column prevents errors on subsequent runs.

alter table company_signals
  add column if not exists is_illustrative boolean not null default false;

comment on column company_signals.is_illustrative is
  'true = data was manually authored with no confirmed primary source document; display "Illustrative" badge in the UI';
