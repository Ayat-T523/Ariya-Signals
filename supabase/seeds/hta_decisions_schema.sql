-- Name: hta_decisions_schema
-- Description: Creates the hta_decisions table to store NICE Technology Appraisal
--              decisions for tracked HAE drugs. Each row is one NICE TA decision for
--              one drug. source_hash is used for deduplication (unique per TA).
--
--              Populated by the ingest-hta Edge Function, which queries
--              search-api.nice.org.uk for each drug in asset_lexicon.
--
-- Prerequisites:
--   None — this is a standalone table creation script.
--
-- Expected outcome:
--   Table hta_decisions is created (or already exists — idempotent).
--   Unique index on source_hash is created.
--   After running, zero rows are present until ingest-hta is invoked.

CREATE TABLE IF NOT EXISTS hta_decisions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_inn       text        NOT NULL,
  agency         text        NOT NULL DEFAULT 'NICE',
  decision_type  text,
  guidance_ref   text,
  decision_date  date,
  indication     text,
  source_url     text,
  source_hash    text        UNIQUE,
  raw_summary    text,
  created_at     timestamptz DEFAULT now()
);

-- Index for common lookup patterns
CREATE INDEX IF NOT EXISTS hta_decisions_drug_inn_idx ON hta_decisions (drug_inn);
CREATE INDEX IF NOT EXISTS hta_decisions_decision_date_idx ON hta_decisions (decision_date DESC);
CREATE INDEX IF NOT EXISTS hta_decisions_guidance_ref_idx ON hta_decisions (guidance_ref);

-- Verify:
-- SELECT * FROM hta_decisions ORDER BY created_at DESC LIMIT 10;
