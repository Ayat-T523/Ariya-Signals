-- Name: add hae_revenue_usd to financial_snapshots
-- Description: Adds a hae_revenue_usd column to store HAE-indication-specific revenue where
--   it is separately disclosed in a company's press release (e.g. ORLADEYO revenue for BioCryst).
--   Most competitors do not break out HAE revenue in public filings, so this column will be NULL
--   for them. After running this migration, re-run the run-sec-financials.mjs ingest script to
--   populate it for BioCryst using the GlobeNewswire earnings press release.
--   Safe to re-run: IF NOT EXISTS guard prevents duplicate column errors.

alter table financial_snapshots
  add column if not exists hae_revenue_usd numeric;
