-- Name: asset_lexicon_competitor_id
-- Description: Adds a competitor_id column to asset_lexicon so any code that
--              looks up a drug by name can immediately find the owning competitor.
--
--   competitor_id values match the string keys in src/data/competitors.json.
--   sebetralstat is KalVista's own drug (Ekterly) — competitor_id is NULL because
--   KalVista is the client, not a tracked competitor. FDA events for sebetralstat
--   are written to regulatory_calendar only, not to company_signals.
--
-- Run once in the Supabase SQL editor before deploying ingest-federal-register.

ALTER TABLE asset_lexicon
  ADD COLUMN IF NOT EXISTS competitor_id text;

UPDATE asset_lexicon SET competitor_id = 'biocryst'   WHERE inn = 'berotralstat';
UPDATE asset_lexicon SET competitor_id = 'pharvaris'  WHERE inn = 'deucrictibant';
UPDATE asset_lexicon SET competitor_id = 'ionis'      WHERE inn = 'donidalorsen';
UPDATE asset_lexicon SET competitor_id = 'csl-behring' WHERE inn = 'garadacimab';
UPDATE asset_lexicon SET competitor_id = 'takeda'     WHERE inn = 'lanadelumab';
-- navenibart: originally Astria (STAR-0215); BioCryst acquired Astria 2026-01-23.
UPDATE asset_lexicon SET competitor_id = 'biocryst'   WHERE inn = 'navenibart';
-- sebetralstat (Ekterly): KalVista's own drug. competitor_id left NULL.
UPDATE asset_lexicon SET competitor_id = NULL          WHERE inn = 'sebetralstat';

-- Verify:
-- SELECT inn, brand_name, competitor_id FROM asset_lexicon ORDER BY inn;
