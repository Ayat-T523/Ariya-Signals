-- Name: phase2-3-pending-ownership-review
-- Description: Creates the pending_ownership_review log table used by
--   scripts/resolve-ownership-from-8k.mjs (Phase 2.3).
--
-- Rows are written here when the script detects a 2.01 completion 8-K but
-- the confidence check fails — i.e. no cleanly defined target entity name
-- could be extracted from the filing text. These rows require human review
-- before any ownership fold is applied.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS pending_ownership_review (
  id            uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  signal_id     uuid        REFERENCES company_signals(id) ON DELETE SET NULL,
  acquirer_id   text        NOT NULL,   -- competitor_id of the filing entity (BioCryst, etc.)
  raw_excerpt   text,                   -- the text that was checked (body_excerpt or item 2.01 section)
  reason        text        NOT NULL,   -- why the confidence check failed
  logged_at     timestamptz DEFAULT now()
);

-- Prevent the same signal from being logged twice across re-runs
CREATE UNIQUE INDEX IF NOT EXISTS pending_ownership_review_signal_id_uidx
  ON pending_ownership_review (signal_id);
