-- Name: company_summaries
-- Description: Stores per-competitor rolling narration summaries generated at ingest time
--   by scripts/run-sec-deals.mjs (Phase 2C). One row per competitor_id.
--   Regenerated each ingest run from the last 90 days of company_signals.
--
--   Fields:
--     competitor_id      — FK to competitor id (from competitors.json)
--     competitor_summary — 1-2 sentence narration of recent signal activity (NULL = no recent signals)
--     summary_source     — always 'deterministic' (no LLM)
--     summary_updated_at — timestamp of last ingest that wrote this row
--
-- Usage:
--   After creating this table, run:
--     node --env-file=.env.local scripts/backfill-narration.mjs
--   to populate existing competitors from current company_signals data.
--
-- Safe to re-run: IF NOT EXISTS guard and idempotent policy/grant statements.

CREATE TABLE IF NOT EXISTS company_summaries (
  competitor_id      TEXT PRIMARY KEY,
  competitor_summary TEXT,
  summary_source     TEXT NOT NULL DEFAULT 'deterministic',
  summary_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: anon role can read (required for browser-side Supabase client)
ALTER TABLE company_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_summaries' AND policyname = 'anon read'
  ) THEN
    CREATE POLICY "anon read" ON company_summaries FOR SELECT TO anon USING (true);
  END IF;
END
$$;

GRANT SELECT ON company_summaries TO anon, authenticated;
