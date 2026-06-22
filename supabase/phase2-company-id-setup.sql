-- Name: phase2-company-id-setup
-- Description: Prepares the trials table for slug-based company_id values and
--   creates the unresolved_trials log table for the Phase 2.1 entity-resolution pass.
--
-- Steps:
--   1. Drops the UUID FK constraint on trials.company_id (it referenced the
--      companies table which uses generated UUIDs, not the slug-based competitor IDs
--      used everywhere else in the app).
--   2. Alters the column type from UUID to TEXT.
--   3. Creates the unresolved_trials log table.
--
-- Run in Supabase SQL editor BEFORE executing scripts/backfill-trials-company-id.mjs
-- Safe to re-run: DROP CONSTRAINT IF EXISTS and CREATE TABLE IF NOT EXISTS.

-- ── Step 1: Drop UUID FK constraint ──────────────────────────────────────────
ALTER TABLE trials
  DROP CONSTRAINT IF EXISTS trials_company_id_fkey;

-- ── Step 2: Change column type to TEXT ────────────────────────────────────────
ALTER TABLE trials
  ALTER COLUMN company_id TYPE TEXT;

-- ── Step 3: Create unresolved_trials log table ────────────────────────────────
CREATE TABLE IF NOT EXISTS unresolved_trials (
  id              uuid   DEFAULT uuid_generate_v4() PRIMARY KEY,
  trial_id        uuid   REFERENCES trials(id) ON DELETE CASCADE,
  nct_id          text,
  raw_sponsor_name text,
  logged_at       timestamptz DEFAULT now()
);

-- Prevent duplicate log entries for the same trial across multiple script runs
CREATE UNIQUE INDEX IF NOT EXISTS unresolved_trials_trial_id_uidx
  ON unresolved_trials (trial_id);
