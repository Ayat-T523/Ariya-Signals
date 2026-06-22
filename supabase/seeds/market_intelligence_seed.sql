-- Name: market_intelligence_seed
-- Description: Initial three implication bullets for the War Room "Market weather" section.
--   These mirror the previous hardcoded IMPLICATION_ITEMS constants so the UI looks
--   identical on first load, but can now be updated directly in the Supabase dashboard.
--   Run AFTER market_intelligence.sql.

insert into market_intelligence (type, content, display_order, active, period_label)
values
  ('implication',
   'Sebetralstat''s first-mover window is compressing — plausibly 18 months ahead of Pharvaris rather than 24. Commercial readiness and KOL anchoring should accelerate.',
   1, true, 'last 7 days'),

  ('implication',
   'Pediatric expansion across Takhzyro and Andembry creates pressure to clarify our asset''s pediatric narrative within Q3 to avoid ceding ground in this segment.',
   2, true, 'last 7 days'),

  ('implication',
   'Incumbents'' defensive posture is softening on tone (BioCryst, CSL) but tightening on access — double down on real-world time-to-relief evidence to support switching conversations.',
   3, true, 'last 7 days')

on conflict do nothing;
