-- ============================================================================
-- Name:        asset_navenibart_owner_fix
--
-- Description: Corrects a seed data error surfaced by the INN backfill (§2.2).
--              navenibart (dev code STAR-0215) is Astria Therapeutics' asset, but
--              both `assets` and `asset_lexicon` seeded competitor_id='biocryst'.
--              BioCryst's HAE assets are berotralstat and bcx17725, not navenibart.
--              This is a reference-data (physical ownership) correction, permitted
--              in the deterministic build.
--
--              astria is already a known competitor (asset_competitors, indirect),
--              so no new competitor slug is introduced.
--
-- Idempotent. Existing company_signals rows are unaffected (asset_id/inn stay);
-- only the drug->owner reference is corrected, so the resolver now returns
-- competitorId='astria' for navenibart going forward.
--
-- What you'll see after running:
--   - assets.competitor_id and asset_lexicon.competitor_id for navenibart = 'astria'
-- ============================================================================

UPDATE public.assets
   SET competitor_id = 'astria'
 WHERE inn = 'navenibart' AND competitor_id = 'biocryst';

UPDATE public.asset_lexicon
   SET competitor_id = 'astria'
 WHERE inn = 'navenibart' AND competitor_id = 'biocryst';

-- ── Verification (run after) ─────────────────────────────────────────────────
--   SELECT inn, competitor_id FROM public.assets       WHERE inn = 'navenibart';
--   SELECT inn, competitor_id FROM public.asset_lexicon WHERE inn = 'navenibart';
