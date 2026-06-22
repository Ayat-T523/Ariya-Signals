-- Name: phase2-4-indication-tags
-- Description: Adds indication_tags (TEXT array) to the assets table.
--   Populated by scripts/backfill-indication-tags.mjs from two sources:
--     - CT.gov: trials.raw_json.protocolSection.conditionsModule.conditions
--     - DailyMed: regulatory_events.details (indication text extracted via regex)
--
-- All condition terms are stored permissively — broad CT.gov terms ("Angioedema",
-- "Rare Diseases") are kept alongside specific terms ("Hereditary Angioedema", "HAE").
-- The Phase 5 relevance gate uses substring matching, so extra broad terms only risk
-- false negatives (nothing passes when it should), not false positives.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS indication_tags TEXT[];
