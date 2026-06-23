-- Name: cron_ir_rss
-- Description: Registers the ingest-ir-rss Edge Function to run every day at 06:00 UTC.
--              Polls 6 competitor IR press release RSS feeds. New press releases are written
--              to company_signals (data_source='ir_rss'). Feed failures are recorded in
--              ingest_errors with a consecutive_failures counter.
--
-- Prerequisites:
--   1. pg_cron extension enabled  (Database → Extensions → pg_cron)
--   2. pg_net extension enabled   (Database → Extensions → pg_net)
--   3. ingest_errors.sql has been run (creates table + upsert_ingest_error function)
--
-- Run once in the Supabase SQL editor to register the schedule.
-- If the job already exists, unschedule it first (see bottom of file).

SELECT cron.schedule(
  'ir-rss-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/ingest-ir-rss',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- To verify the schedule was registered:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'ir-rss-daily';

-- To update from 07:00 to 06:00 (if old job exists):
-- SELECT cron.unschedule('ir-rss-daily');
-- (then re-run the SELECT cron.schedule(...) above)
