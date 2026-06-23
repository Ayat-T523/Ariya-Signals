-- Name: cron_hta
-- Description: Registers the ingest-hta Edge Function to run every Tuesday
--              at 09:00 UTC. Queries the NICE search API for each tracked HAE drug
--              in asset_lexicon, finds new Technology Appraisal decisions, and writes
--              them to hta_decisions and company_signals (signal_type='hta_decision').
--
-- Prerequisites:
--   1. pg_cron extension enabled  (Database → Extensions → pg_cron)
--   2. pg_net extension enabled   (Database → Extensions → pg_net)
--   3. ingest_errors.sql has been run
--   4. hta_decisions_schema.sql has been run
--   5. asset_lexicon_competitor_id.sql has been run
--   6. supabase functions deploy ingest-hta
--
-- To run an initial 4-year backfill after deployment, invoke manually:
--   supabase functions invoke ingest-hta --body '{"lookbackDays":1500}'
--
-- Cron schedule: 0 9 * * 2 = 09:00 UTC every Tuesday

SELECT cron.schedule(
  'nice-hta-weekly',
  '0 9 * * 2',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/ingest-hta',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'nice-hta-weekly';
