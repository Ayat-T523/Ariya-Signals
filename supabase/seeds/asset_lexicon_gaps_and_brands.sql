-- ============================================================================
-- Name:        asset_lexicon_gaps_and_brands
--
-- Description: Ariya Light lexicon workstream, §2.2 (part a + brand fixes).
--              Brings asset_lexicon from 7 → 11 rows (one per covered asset) and
--              corrects two stale brand names, so more signals resolve to a drug.
--
--              Two changes:
--              1. INSERT the 4 missing assets (the §2.2 gaps): icatibant,
--                 mezagitamab, bcx17725, lonvoguran ziclumeran. Identity taken
--                 from the already-curated `assets` table (competitor_id, dev
--                 codes) plus known brand names. chembl_id left NULL where not
--                 verified — honest, not guessed.
--              2. UPDATE garadacimab + donidalorsen: both were approved AFTER the
--                 lexicon was first seeded, so brand_name was NULL. Set the real
--                 brands (Andembry, Dawnzera) and add brand/dev-code aliases.
--
--              Reference data only (physical drug identity), permitted in the
--              deterministic build. No fabricated values.
--
-- Idempotent: INSERTs use ON CONFLICT (inn) DO UPDATE; re-running is safe.
--
-- What you'll see after running:
--   - asset_lexicon row count goes 7 → 11
--   - icatibant carries brand_name 'Firazyr'; garadacimab 'Andembry';
--     donidalorsen 'Dawnzera'
--   - the resolver (loadAssetResolver) now matches these brands + dev codes
-- ============================================================================

-- 1. Fill the four gaps ───────────────────────────────────────────────────────
INSERT INTO public.asset_lexicon (inn, brand_name, competitor_id, max_phase, synonyms, fetched_at)
VALUES
  ('icatibant', 'Firazyr', 'takeda', 4,
     ARRAY['ICATIBANT','icatibant acetate','HOE 140','HOE-140','Sajazir','SAJAZIR'], now()),
  ('mezagitamab', NULL, 'takeda', 2,
     ARRAY['MEZAGITAMAB','TAK-079','TAK079'], now()),
  ('bcx17725', NULL, 'biocryst', 1,
     ARRAY['BCX17725','BCX-17725'], now()),
  ('lonvoguran ziclumeran', NULL, 'intellia', 2,
     ARRAY['LONVOGURAN ZICLUMERAN','lonvoguran-ziclumeran','NTLA-2002','NTLA2002'], now())
ON CONFLICT (inn) DO UPDATE SET
  brand_name    = EXCLUDED.brand_name,
  competitor_id = EXCLUDED.competitor_id,
  max_phase     = EXCLUDED.max_phase,
  synonyms      = EXCLUDED.synonyms,
  fetched_at    = now();

-- 2. Fix stale brand names on the two newly-approved assets ────────────────────
UPDATE public.asset_lexicon
   SET brand_name = 'Andembry',
       synonyms   = ARRAY['garadacimab','Andembry','garadacimab-gxii']
 WHERE inn = 'garadacimab';

UPDATE public.asset_lexicon
   SET brand_name = 'Dawnzera',
       synonyms   = ARRAY['DONIDALORSEN','Dawnzera','ISIS-721744 FREE ACID','ISIS 721744 (free acid)']
 WHERE inn = 'donidalorsen';

-- ── Verification (run after; all reads) ──────────────────────────────────────
-- Expect: 11 rows
--   SELECT count(*) FROM public.asset_lexicon;
-- Expect: brands present
--   SELECT inn, brand_name, competitor_id, synonyms
--   FROM public.asset_lexicon
--   WHERE inn IN ('icatibant','garadacimab','donidalorsen','mezagitamab','bcx17725','lonvoguran ziclumeran')
--   ORDER BY inn;
