-- Ariya Light — Drug detail column migration
-- Run in Supabase SQL editor: Database → SQL editor → New query
-- Safe to re-run: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

-- ── Identity / INN handling ───────────────────────────────────────────────────
-- inn_stem: bare INN without biologic suffix or salt modifier (= generic_name from API)
-- inn_full: full name including biologic suffix e.g. garadacimab-gxii (= substance_name for biologics)
-- substance_name_formulated: salt/conjugate form e.g. donidalorsen sodium, icatibant acetate
-- previous_names: historical names (e.g. Sajazir was "icatibant acetate" pre-SUPPL-1)

ALTER TABLE assets ADD COLUMN IF NOT EXISTS inn_stem                   text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS inn_full                   text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS substance_name_formulated  text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS previous_names             text[];

-- ── Classification ────────────────────────────────────────────────────────────
-- indication_type: 'prophylaxis' | 'acute_treatment' | 'both'
-- drug_class_detail: 'mAb-IgG1' | 'mAb-IgG4' | 'small_molecule' | 'ASO-GalNAc' | 'synthetic_decapeptide'
-- mechanism_target: 'kallikrein' | 'FXIIa' | 'PKK_mRNA' | 'B2_receptor'
-- cascade_level: which step in the HAE contact pathway this drug acts on

ALTER TABLE assets ADD COLUMN IF NOT EXISTS indication_type            text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS drug_class_detail          text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mechanism_target           text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS cascade_level              text;

-- ── Regulatory metadata ───────────────────────────────────────────────────────
-- label_version: SPL version number from API (e.g. '14')
-- label_effective_date: date the current label version took effect (always >= approval_date)
-- approval_date: original FDA approval date (ORIG-1)
-- application_numbers: array for multi-NDA drugs (Berotralstat has NDA214094 + NDA219776)
-- te_code: Therapeutic Equivalence code ('AP' for icatibant generics; null for all others)
-- rld: Reference Listed Drug (true/false from Orange Book)
-- rs_strengths: strengths where Reference Standard = Yes (diverges by strength for Berotralstat)
-- ndc_completeness: 'complete' | 'incomplete' | 'label_body_supplement'

ALTER TABLE assets ADD COLUMN IF NOT EXISTS label_version              text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS label_effective_date       date;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS approval_date              date;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS application_numbers        text[];
ALTER TABLE assets ADD COLUMN IF NOT EXISTS te_code                    text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS rld                        boolean;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS rs_strengths               text[];
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ndc_completeness           text;

-- ── Safety ────────────────────────────────────────────────────────────────────
-- warnings: null for Garadacimab (explicitly none); array of warning entries for others
-- contraindications: [] for most drugs; [{type, severity, target}] for Donidalorsen
-- lab_interactions: [{test, mechanism, incidence, threshold, clinical_bleeding_risk}]
--   Note: Garadacimab affects BOTH aPTT AND PT/INR; Lanadelumab affects aPTT only

ALTER TABLE assets ADD COLUMN IF NOT EXISTS warnings                   jsonb;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS contraindications          jsonb;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS lab_interactions           jsonb;

-- ── Dosing (structured, replaces flat mechanism/drug_class strings) ───────────
-- dose_type: 'scheduled' | 'on_demand' | 'loading+maintenance'
--   Icatibant = on_demand (event-triggered, not scheduled)
--   Garadacimab = loading+maintenance (400mg Day 1, then 200mg monthly)
--   All others = scheduled
-- dosing_regimens: array of regimen objects [{frequency, dose, status, attack_reduction}]
--   Donidalorsen has TWO approved regimens (Q4W 81% reduction; Q8W 55% reduction)

ALTER TABLE assets ADD COLUMN IF NOT EXISTS dose_type                  text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS dosing_regimens            jsonb;

-- ── Storage ───────────────────────────────────────────────────────────────────
-- storage_model: {primary, secondary, discard_rule}
--   Most drugs: refrigerate only
--   Donidalorsen: refrigerator primary; room temp ≤30°C up to 6 weeks secondary
--   Icatibant: 2-25°C (room temp permitted)

ALTER TABLE assets ADD COLUMN IF NOT EXISTS storage_model              jsonb;

-- ── Manufacturing ─────────────────────────────────────────────────────────────
-- manufacturer_current: current label holder (from API openfda.manufacturer_name or label body)
-- manufacturer_bla_holder: original BLA/NDA filer (may differ after acquisitions)
--   Lanadelumab: BLA holder = Dyax Corp (original); current = Takeda
--   Garadacimab: CSL truncated in API — correct value = 'CSL Behring LLC'
-- manufacturer_roles: {manufactured_for, manufactured_by, distributed_by, license_numbers}

ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer_current       text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer_bla_holder    text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer_roles         jsonb;

-- ── Generic market ────────────────────────────────────────────────────────────
-- formulary_substitution_permitted: true only for Icatibant (TE Code AP)
-- generic_andas: list of approved ANDA numbers
--   Icatibant: 8 generics all AP-rated (212446 Sajazir/Cycle + 7 unnamed)
-- original_developer: company that ran the original clinical trials
--   Icatibant originator is Jerini AG (Germany), acquired by Shire, then Takeda
-- patent_expiry_date: when generics became legally permissible

ALTER TABLE assets ADD COLUMN IF NOT EXISTS formulary_substitution_permitted  boolean DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS generic_andas              text[];
ALTER TABLE assets ADD COLUMN IF NOT EXISTS original_developer         text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS patent_expiry_date         date;

-- ── regulatory_events: add missing unique constraint ──────────────────────────
-- This constraint is required for the FDA ingest connector's upsert to work correctly.
-- Without it, re-running the connector creates duplicate approval records.
-- Semantics: one FDA approval event per drug (asset_id + authority + event_type is unique).
-- Note: PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS — use a DO block instead.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'regulatory_events_asset_authority_type_key'
  ) THEN
    ALTER TABLE regulatory_events
      ADD CONSTRAINT regulatory_events_asset_authority_type_key
      UNIQUE (asset_id, authority, event_type);
  END IF;
END $$;
