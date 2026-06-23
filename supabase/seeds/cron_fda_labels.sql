-- Name: cron_fda_labels
-- Description: Schedules the ingest-fda-labels Edge Function to run every Sunday at 02:00 UTC.
--
-- Prerequisites:
--   1. pg_cron extension must be enabled in the Supabase dashboard (Database → Extensions → pg_cron)
--   2. pg_net extension must be enabled (Database → Extensions → pg_net)
--   3. Replace <PROJECT_REF> with your Supabase project reference (e.g. dawpxwcrcgpaooszjhhq)
--   4. Replace <SERVICE_ROLE_KEY> with your SUPABASE_SERVICE_ROLE_KEY from .env.local
--
-- Run once in the Supabase SQL editor to register the schedule.

SELECT cron.schedule(
  'fda-label-radar-weekly',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/ingest-fda-labels',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- To verify the schedule was registered:
-- SELECT * FROM cron.job WHERE jobname = 'fda-label-radar-weekly';

-- To remove the schedule:
-- SELECT cron.unschedule('fda-label-radar-weekly');
