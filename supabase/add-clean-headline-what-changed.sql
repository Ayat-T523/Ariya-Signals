-- Name: add-clean-headline-what-changed
-- Description: Phase 2.1 migration — adds clean_headline and what_changed to
--   company_signals, per docs/alerts-ai-synthesis-spec.md §2.3. Both are
--   asset-agnostic (a human-readable title and a neutral factual one-line
--   summary of the change) so they live as plain columns on the signal row
--   itself, same as the existing why_it_matters column — no personalization,
--   no asset-scoped variant needed.
--
--   clean_headline — human-readable event title, never a filename, max ~90 chars.
--   what_changed   — one-line factual summary of the change. Neutral, no interpretation.
--
--   Populated at ingest time by the synthesis pipeline (later phase). Until
--   then both are NULL and callers fall back to existing headline/body_excerpt
--   handling in src/lib/signalText.ts.
--
-- Safe to re-run: IF NOT EXISTS guard prevents errors on repeat execution.

ALTER TABLE company_signals
  ADD COLUMN IF NOT EXISTS clean_headline TEXT,
  ADD COLUMN IF NOT EXISTS what_changed   TEXT;
