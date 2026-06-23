-- Name: cron_federal_register
-- Description: Registers the ingest-federal-register Edge Function to run every Monday
--              at 08:00 UTC. Fetches FDA advisory committee and PDUFA notices from the
--              Federal Register API, applies a relevance gate against asset_lexicon drug
--              names, and writes landscape-level regulatory events (competitor_id = null)
--              to regulatory_calendar and company_signals (signal_type='regulatory_catalyst').
--
-- Prerequisites:
--   1. pg_cron extension enabled  (Database → Extensions → pg_cron)
--   2. pg_net extension enabled   (Database → Extensions → pg_net)
--   3. ingest_errors.sql has been run
--   4. regulatory_calendar_schema_v2.sql has been run (adds source_hash column)
--   5. asset_lexicon_competitor_id.sql has been run
--   6. supabase functions deploy ingest-federal-register
--
-- If the old 'federal-register-weekly' job already exists (0 6 * * 1), unschedule it
-- first, then re-register with the new 08:00 UTC Monday schedule:

SELECT cron.unschedule('federal-register-weekly');

SELECT cron.schedule(
  'federal-register-weekly',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/ingest-federal-register',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'federal-register-weekly';
