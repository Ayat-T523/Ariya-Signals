-- Name: ingest_errors
-- Description: Table + helper function for tracking per-feed failures in the ingest pipeline.
--              handleFeedError() in ingest-ir-rss calls upsert_ingest_error() on every HTTP
--              error or connection failure. consecutive_failures increments on each failed run
--              without a successful fetch, enabling persistent-failure detection and alerting.
--
-- Run once in the Supabase SQL editor before deploying ingest-ir-rss.
-- Then verify with: SELECT * FROM ingest_errors;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingest_errors (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source               text        NOT NULL,
  competitor_id        text        NOT NULL,
  error_message        text        NOT NULL,
  consecutive_failures integer     NOT NULL DEFAULT 1,
  last_seen            timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source, competitor_id)
);

-- ── Helper function ───────────────────────────────────────────────────────────
-- Creates or updates a failure record for (source, competitor_id).
-- On conflict: increments consecutive_failures, updates last_seen and error_message.
-- Called via supabase.rpc('upsert_ingest_error', { p_source, p_competitor_id, p_error_message })

CREATE OR REPLACE FUNCTION upsert_ingest_error(
  p_source        text,
  p_competitor_id text,
  p_error_message text
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO ingest_errors (source, competitor_id, error_message, consecutive_failures, last_seen)
  VALUES (p_source, p_competitor_id, p_error_message, 1, now())
  ON CONFLICT (source, competitor_id) DO UPDATE SET
    consecutive_failures = ingest_errors.consecutive_failures + 1,
    last_seen            = now(),
    error_message        = EXCLUDED.error_message;
$$;
