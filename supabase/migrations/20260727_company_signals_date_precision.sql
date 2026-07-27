-- ============================================================================
-- Name:        20260727_company_signals_date_precision
--
-- Description: Adds date_precision to company_signals so a date we only know to
--              the year can be stored without pretending to know the day.
--
--              PubMed reports many publication dates as a bare year ("2026", no
--              month, no day). Those rows currently have date = NULL, which is
--              honest but has a cost: the D11 importance score reads recency off
--              `date`, so a 2026 paper scores zero recency and ranks as if it were
--              ancient. 17 rows are affected.
--
--              The fix is to store the year as a real date (YYYY-01-01) and record
--              HOW PRECISELY we know it. Precision travels with the value, so
--              nothing is fabricated: recency can use the year, and the UI can
--              render "2026" instead of "1 January 2026", which would be a
--              precision we do not have.
--
-- Values:      'day'   — full date from the source (the default for existing rows)
--              'month' — year and month known, day is not
--              'year'  — year only
--              NULL    — no date at all
--
-- What you'll see after running:
--   - company_signals gains a date_precision column, CHECK-constrained to those
--     three values
--   - every existing row with a date is marked 'day', which is what those dates
--     are; rows with no date stay NULL
--   - no date value changes
--
-- Additive and idempotent. Safe to run more than once.
-- Reversible: see the rollback block at the bottom.
-- ============================================================================

ALTER TABLE public.company_signals
  ADD COLUMN IF NOT EXISTS date_precision text;

-- Constrain to the three meaningful values. Added separately so re-running is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_signals_date_precision_check'
  ) THEN
    ALTER TABLE public.company_signals
      ADD CONSTRAINT company_signals_date_precision_check
      CHECK (date_precision IS NULL OR date_precision IN ('day', 'month', 'year'));
  END IF;
END$$;

-- Existing dated rows carry a full date from their source, so they are 'day'.
-- Undated rows stay NULL; the year-only publications are filled by
-- scripts/backfill-publication-dates.mjs, which reads the year back from PubMed.
UPDATE public.company_signals
   SET date_precision = 'day'
 WHERE date IS NOT NULL
   AND date_precision IS NULL;

-- ── Verification (run after; all reads) ──────────────────────────────────────
-- Expect: day = 267, NULL = 19, no other values
--   SELECT COALESCE(date_precision, '(null)') AS precision, count(*)
--   FROM public.company_signals GROUP BY 1 ORDER BY 2 DESC;

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- ALTER TABLE public.company_signals DROP CONSTRAINT IF EXISTS company_signals_date_precision_check;
-- ALTER TABLE public.company_signals DROP COLUMN IF EXISTS date_precision;
