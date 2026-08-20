-- Frontend Step 2: canonical landscape configuration (Therapeutic Area / Disease
-- Area / Home Asset). Additive only -- no existing column is renamed, retyped,
-- or dropped, and no data is deleted or migrated in place.
--
-- Why two new columns, not a rename of `indication`:
--   `indication` already exists on user_profiles and is kept exactly as-is —
--   it's the legacy-compatible short code (e.g. "HAE") that existing code
--   still reads and writes unmodified this step. Disease Area is a distinct,
--   richer product concept (a stable id resolving through the frontend's
--   therapeutic-areas.ts catalog, not a free-text code), so it needs its own
--   column rather than overloading `indication`'s meaning.
--
-- Why a new column for Therapeutic Area, not derived only from the frontend
-- catalog at read time:
--   For a catalogued Home Asset, Therapeutic Area IS deterministically
--   derivable from Disease Area via the frontend catalog, and the app derives
--   it that way by default. But `asset_id`/`asset_name` are already both
--   stored (not just asset_id) specifically to survive assets NOT in the
--   catalog (e.g. a live ChEMBL-search asset from onboarding) -- the same
--   architectural reason applies here: a signed-in user's chosen Therapeutic
--   Area/Disease Area must still be recoverable even if the catalog changes
--   or the asset was never catalogued, so both are persisted as an explicit
--   snapshot rather than only ever being re-derived.
--
-- Why `asset_id`/`asset_name` are NOT duplicated here:
--   They already correctly represent the Home Asset identity and display
--   name (see src/config/landscape-configuration.ts, which reuses them
--   directly as LandscapeConfiguration.homeAssetId) -- adding new columns for
--   the same concept would be exactly the duplicate field Frontend Step 2 was
--   told to avoid.

alter table user_profiles
  add column if not exists disease_area_id     text,
  add column if not exists therapeutic_area_id text;

comment on column user_profiles.disease_area_id is
  'Canonical Disease Area id (frontend therapeutic-areas.ts catalog). Null on rows that predate Frontend Step 2, or when derivation from asset_id was not yet possible.';
comment on column user_profiles.therapeutic_area_id is
  'Canonical Therapeutic Area id (frontend therapeutic-areas.ts catalog). Null on rows that predate Frontend Step 2, or when derivation from asset_id was not yet possible.';
