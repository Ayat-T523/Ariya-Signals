-- ============================================================================
-- Name:        20260725_company_signals_identity_columns
--
-- Description: Ariya Light INN-persistence fix, Phase 1 (backend §2.1).
--              Adds the three drug-identity columns that company_signals is
--              currently missing, so the INN/asset_id already computed at ingest
--              for the soft signals (publication, hta_decision, congress_abstract,
--              regulatory_catalyst) can be PERSISTED instead of discarded.
--
--              This unlocks asset-level attribution for ~180 of 393 signals with
--              no new matching logic. It is additive and idempotent — safe to run
--              more than once. It does NOT touch any ai_* / enrichment column
--              (those belong to the excluded AI branch).
--
-- What you'll see after running:
--   - company_signals gains 3 nullable columns: asset_id, inn, nct
--   - asset_id is a foreign key to assets(id); deleting an asset nulls the link
--     (ON DELETE SET NULL) rather than deleting the signal
--   - a btree index on asset_id for asset-level queries
--   - existing 393 rows are UNCHANGED (all three columns start NULL) — the
--     backfill is a separate, gated step (Phase 3)
--
-- Reversible: see the rollback block at the bottom (commented out).
-- ============================================================================

-- asset_id — canonical asset UUID (FK to assets). NULL for orphan / unresolved.
ALTER TABLE public.company_signals
  ADD COLUMN IF NOT EXISTS asset_id uuid;

-- inn — canonical International Nonproprietary Name resolved at ingest. NULL if none.
ALTER TABLE public.company_signals
  ADD COLUMN IF NOT EXISTS inn text;

-- nct — ClinicalTrials.gov identifier, native to trial_update (planned v1). NULL now.
ALTER TABLE public.company_signals
  ADD COLUMN IF NOT EXISTS nct text;

-- Foreign key: asset_id → assets(id). Added only if not already present.
-- ON DELETE SET NULL keeps the signal and degrades to an honest orphan if the
-- asset row is ever removed. We only ever write a real assets.id or NULL, so this
-- constraint can never make an ingest insert throw.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_signals_asset_id_fkey'
  ) THEN
    ALTER TABLE public.company_signals
      ADD CONSTRAINT company_signals_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Index for asset-level lookups (competitor → asset → thread containment).
CREATE INDEX IF NOT EXISTS idx_company_signals_asset_id
  ON public.company_signals (asset_id);

-- ── Verification (run these after; all reads, no writes) ─────────────────────
-- Expect: three rows (asset_id/uuid, inn/text, nct/text)
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'company_signals' AND column_name IN ('asset_id','inn','nct')
--   ORDER BY column_name;
-- Expect: 393 (all NULL until the Phase 3 backfill)
--   SELECT count(*) AS total, count(asset_id) AS with_asset, count(inn) AS with_inn
--   FROM public.company_signals;

-- ── Rollback (uncomment to undo) ─────────────────────────────────────────────
-- ALTER TABLE public.company_signals DROP CONSTRAINT IF EXISTS company_signals_asset_id_fkey;
-- DROP INDEX IF EXISTS public.idx_company_signals_asset_id;
-- ALTER TABLE public.company_signals DROP COLUMN IF EXISTS nct;
-- ALTER TABLE public.company_signals DROP COLUMN IF EXISTS inn;
-- ALTER TABLE public.company_signals DROP COLUMN IF EXISTS asset_id;
