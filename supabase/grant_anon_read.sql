-- Name: grant anon/authenticated read on new tables
-- Description: Grants SELECT access to the anon and authenticated roles on financial_snapshots
--   and company_signals. Required because tables created via SQL editor after the project's
--   initial setup do not automatically inherit the wildcard grant that older tables received.
--   Without this, browser-side Supabase queries (which use the anon key) return an empty array
--   even though the data is present and the ingest (service role) wrote it successfully.
-- Safe to re-run: GRANTs are idempotent.

grant select on financial_snapshots to anon, authenticated;
grant select on company_signals to anon, authenticated;
