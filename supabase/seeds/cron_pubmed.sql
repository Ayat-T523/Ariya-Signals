-- Name: cron_pubmed
-- Description: Registers the ingest-pubmed Edge Function to run every Wednesday at 07:00 UTC.
--              Searches PubMed for new publications mentioning HAE drug INNs from asset_lexicon.
--              Results written to company_signals (signal_type='publication', data_source='pubmed').
--
-- Prerequisites:
--   1. pg_cron extension enabled  (Database → Extensions → pg_cron)
--   2. pg_net extension enabled   (Database → Extensions → pg_net)
--   3. NCBI_API_KEY added to Edge Function secrets (optional but recommended)
--      Dashboard → Edge Functions → ingest-pubmed → Secrets → Add NCBI_API_KEY
--      Free key: https://www.ncbi.nlm.nih.gov/account/
--
-- Run once in the Supabase SQL editor to register the schedule.
-- If the job already exists, unschedule it first (see bottom of file).

SELECT cron.schedule(
  'pubmed-weekly',
  '0 7 * * 3',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/ingest-pubmed',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- To verify the schedule was registered:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'pubmed-weekly';

-- To unschedule (if re-registering):
-- SELECT cron.unschedule('pubmed-weekly');
