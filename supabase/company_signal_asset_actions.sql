-- Name: company_signal_suggested_actions
-- Description: Phase 2.1 migration — asset-scoped variant table for
--   suggested_action, per docs/war-room-redesign-spec.md §4 and the personalization
--   note in docs/alerts-ai-synthesis-spec.md §6 Q4.
--
--   Unlike clean_headline/what_changed, suggested_action is required to be
--   asset-aware ("action must be specific to the signal + user's asset" —
--   war-room-redesign-spec.md §4), so a single global column on company_signals
--   cannot hold it. Personalizing per individual user would break the
--   one-call-per-signal caching economics the synthesis pipeline depends on
--   (alerts-ai-synthesis-spec.md §2.1); the tracked-asset catalog is small and
--   curated (src/config/assets-config.ts), not per-user, so this table stores
--   one row per (signal, asset) pair instead — bounded fan-out, still cached
--   at ingestion, never generated at render time.
--
--   signal_id        — FK to company_signals.id
--   asset_id         — matches AssetConfig.id in src/config/assets-config.ts (e.g. 'ekterly')
--   suggested_action — one concrete verb-phrase next step. NULL when no
--                      defensible action exists (spec: omit rather than filler).
--   generated_at     — timestamp of the ingest run that wrote this row.
--
--   Populated at ingest time by the synthesis pipeline (later phase); empty
--   after this migration runs.
--
-- Safe to re-run: IF NOT EXISTS guard and idempotent policy/grant statements.

CREATE TABLE IF NOT EXISTS company_signal_asset_actions (
  signal_id        UUID NOT NULL REFERENCES company_signals(id) ON DELETE CASCADE,
  asset_id         TEXT NOT NULL,
  suggested_action TEXT,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, asset_id)
);

-- RLS: anon role can read (required for browser-side Supabase client) —
-- new tables do not automatically inherit the wildcard grant older tables
-- received (see supabase/grant_anon_read.sql).
ALTER TABLE company_signal_asset_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_signal_asset_actions' AND policyname = 'anon read'
  ) THEN
    CREATE POLICY "anon read" ON company_signal_asset_actions FOR SELECT TO anon USING (true);
  END IF;
END
$$;

GRANT SELECT ON company_signal_asset_actions TO anon, authenticated;
