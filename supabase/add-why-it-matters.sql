-- Name: add-why-it-matters
-- Description: Phase 2 migration — adds the why_it_matters column to company_signals.
--   This column stores a 1-2 sentence competitive rationale generated at ingest time
--   by scripts/run-sec-deals.mjs (deterministic + Claude Haiku LLM).
--   After running this SQL, run:
--     node --env-file=.env.local scripts/backfill-why.mjs
--   to populate existing rows.
--
-- Safe to re-run: IF NOT EXISTS guard prevents errors on repeat execution.

ALTER TABLE company_signals
  ADD COLUMN IF NOT EXISTS why_it_matters TEXT;
