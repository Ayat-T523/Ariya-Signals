-- Name: phase2-2-assets-competitor-id
-- Description: Adds competitor_id (TEXT slug) to the assets table and populates it
--   by joining through the resolved trials.company_id values from Phase 2.1.
--
-- Why TEXT, not a FK: there is no 'competitors' table in Supabase — competitor
--   identity is carried as a slug ('takeda', 'biocryst', etc.) matching the
--   frontend competitors.json. This is consistent with trials.company_id.
--
-- Coverage after this migration:
--   10 of 11 assets → competitor_id set via trials join
--   1 asset (sebetralstat) → remains NULL — it is our own drug, not a competitor
--
-- No fallback to regulatory_events is needed: all competitor-owned assets are
--   already covered by at least one trial with company_id resolved in Phase 2.1.
--
-- Run in Supabase SQL editor after scripts/backfill-trials-company-id.mjs completes.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, UPDATE is idempotent.

-- ── Step 1: Add competitor_id column ─────────────────────────────────────────
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS competitor_id TEXT;

-- ── Step 2: Populate from resolved trials ────────────────────────────────────
-- Picks the first non-null company_id from the trials table for each asset.
-- Because Phase 2.1 guarantees all competitor trials have company_id set, any
-- asset that appears in at least one competitor-sponsored trial will be resolved.
UPDATE assets a
SET competitor_id = (
  SELECT t.company_id
  FROM   trials t
  WHERE  t.asset_id   = a.id
    AND  t.company_id IS NOT NULL
  LIMIT  1
)
WHERE a.competitor_id IS NULL;

-- ── Step 3: Verify ────────────────────────────────────────────────────────────
-- Run this SELECT to confirm expected distribution:
--
--   SELECT inn, competitor_id FROM assets ORDER BY inn;
--
-- Expected output (10 with competitor_id, 1 null = sebetralstat):
--   bcx17725            | biocryst
--   berotralstat        | biocryst
--   deucrictibant       | pharvaris
--   donidalorsen        | ionis
--   garadacimab         | csl-behring
--   icatibant           | takeda
--   lanadelumab         | takeda
--   lonvoguran ziclumeran | intellia
--   mezagitamab         | takeda
--   navenibart          | biocryst
--   sebetralstat        | (null)   ← own asset
