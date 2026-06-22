-- unresolved_trials view
-- Purpose: Tracks trials where company_id could not be resolved to a known
--   competitor slug, EXCLUDING sebetralstat / own-asset trials (which
--   legitimately have company_id = null because they are our own pipeline,
--   not a competitor's).
-- Usage:
--   SELECT * FROM unresolved_trials;       -- inspect gaps
--   SELECT count(*) FROM unresolved_trials; -- must be < 10% of total trials (134)
--
-- An unresolved trial is one where:
--   - company_id IS NULL
--   - AND the linked asset belongs to a competitor (competitor_id IS NOT NULL)
-- Own-asset trials (asset.competitor_id = null = sebetralstat) are excluded.

drop table if exists unresolved_trials;
create or replace view unresolved_trials as
select
  t.id,
  t.nct_id,
  t.asset_id,
  t.title,
  t.phase,
  t.status,
  t.start_date,
  t.completion_date,
  a.inn       as asset_inn,
  a.competitor_id as expected_competitor_id
from trials t
join assets a on a.id = t.asset_id
where t.company_id is null
  and a.competitor_id is not null;
