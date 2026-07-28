-- Name: asset_lexicon public read policy
--
-- Description:
--   asset_lexicon had row-level security ENABLED but ZERO policies. In Postgres
--   that is deny-by-default for everyone, including logged-in users, so every
--   read returned an empty result and the live-lexicon feature had never once
--   worked. It failed silently: the app caught the empty result, logged a
--   console warning, and fell back to the hardcoded lexicon, so nothing visibly
--   broke.
--
--   This adds the SELECT policy the table was always missing, matching the
--   assets_public_read policy already on the `assets` table.
--
-- What to expect after running this:
--   - Anonymous and logged-in users can READ asset_lexicon (11 rows today:
--     inn, brand_name, synonyms for each tracked HAE drug).
--   - Writes stay DENIED for both roles. That is deliberate, not an oversight:
--     asset_lexicon is shared reference data, so allowing client writes would
--     let one user's onboarding rewrite the lexicon every other user matches
--     against. It is seeded server-side with the service-role key.
--   - No other table changes. Per-user tables (user_profiles, watched_assets)
--     keep their existing policies and stay invisible to anonymous callers.
--
-- Idempotent: safe to run more than once.

DROP POLICY IF EXISTS asset_lexicon_public_read ON public.asset_lexicon;

CREATE POLICY asset_lexicon_public_read
  ON public.asset_lexicon
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Verification: expect exactly one row, asset_lexicon_public_read | SELECT | {anon,authenticated}
--
--   SELECT policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'asset_lexicon';
