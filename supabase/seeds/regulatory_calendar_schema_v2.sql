-- Name: regulatory_calendar_schema_v2
-- Description: Adds five columns to regulatory_calendar so it can store
--              FDA (and future agency) events with drug and competitor context.
--
--   competitor_id  — links to competitors.json competitor id (nullable; EMA
--                    committee meetings may not be drug-specific)
--   drug_name      — INN of the drug under review (nullable)
--   agency         — 'FDA' | 'EMA' | 'MHRA' etc. Backfills existing rows to 'EMA'.
--   action_type    — ADCOM | PDUFA | LABEL_REVIEW | OTHER (more specific than event_type)
--   source_hash    — SHA-256 of the canonical dedup key; UNIQUE so ON CONFLICT works.
--
-- Run once in the Supabase SQL editor before deploying ingest-federal-register.
-- Safe to re-run — each statement is idempotent.

ALTER TABLE regulatory_calendar
  ADD COLUMN IF NOT EXISTS competitor_id text,
  ADD COLUMN IF NOT EXISTS drug_name     text,
  ADD COLUMN IF NOT EXISTS agency        text,
  ADD COLUMN IF NOT EXISTS action_type   text,
  ADD COLUMN IF NOT EXISTS source_hash   text;

-- Unique index (not constraint) so existing NULL rows don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS regulatory_calendar_source_hash_key
  ON regulatory_calendar (source_hash)
  WHERE source_hash IS NOT NULL;

-- Backfill existing EMA rows.
UPDATE regulatory_calendar
SET agency = 'EMA'
WHERE agency IS NULL;

-- Verify:
-- SELECT id, event_type, action_type, agency, drug_name, competitor_id, source_hash
-- FROM regulatory_calendar LIMIT 5;
