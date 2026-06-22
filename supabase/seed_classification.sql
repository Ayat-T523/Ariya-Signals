-- Ariya Light — Drug classification seed data
-- Run AFTER add_drug_detail_columns.sql
-- Run in Supabase SQL editor: Database → SQL editor → New query
--
-- Values sourced from manual FDA assessments (June 2026).
-- These fields cannot be reliably automated — they require clinical judgement.
-- NOTE: Update WHERE inn = '...' values if your assets table uses different INN spellings.
--       Check with: SELECT id, inn FROM assets ORDER BY inn;

-- ─────────────────────────────────────────────────────────────────────────────
-- LANADELUMAB (TAKHZYRO) — BLA 761090 — Takeda — Approved 08/23/2018
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE assets SET
  inn_stem                          = 'lanadelumab',
  inn_full                          = 'lanadelumab-flyo',
  substance_name_formulated         = 'LANADELUMAB-FLYO',
  indication_type                   = 'prophylaxis',
  drug_class_detail                 = 'mAb-IgG1',
  mechanism_target                  = 'kallikrein',
  cascade_level                     = 'kallikrein',
  approval_date                     = '2018-08-23',
  application_numbers               = ARRAY['BLA761090'],
  te_code                           = NULL,
  rld                               = false,
  rs_strengths                      = ARRAY[]::text[],
  formulary_substitution_permitted  = false,
  dose_type                         = 'scheduled',
  manufacturer_current              = 'Takeda Pharmaceuticals America, Inc.',
  manufacturer_bla_holder           = 'Dyax Corp',   -- original BLA filer; acquired by Shire then Takeda
  original_developer                = 'Dyax Corp',
  warnings = '[{"type": "hypersensitivity", "section": "5.1", "text": "Hypersensitivity reactions, including anaphylaxis, have occurred. Discontinue and treat appropriately."}]'::jsonb,
  contraindications                 = '[]'::jsonb,
  lab_interactions = '[{"test": "aPTT", "mechanism": "Lanadelumab interferes with intrinsic pathway assay reagents — not a clinical bleeding risk", "clinical_bleeding_risk": false}]'::jsonb,
  dosing_regimens = '[
    {"frequency": "Q2W", "dose": "300mg SC", "status": "starting", "population": "adults and children 12+"},
    {"frequency": "Q4W", "dose": "300mg SC", "status": "maintenance (if well-controlled >6 months)", "population": "adults and children 12+"},
    {"frequency": "Q2W", "dose": "150mg SC", "status": "standard", "population": "children 6-<12 yrs"},
    {"frequency": "Q4W", "dose": "150mg SC", "status": "fixed", "population": "children 2-<6 yrs"}
  ]'::jsonb,
  storage_model = '{"primary": "refrigerator 2-8°C", "room_temp": false}'::jsonb,
  ndc_completeness                  = 'complete'
WHERE inn = 'lanadelumab';

-- ─────────────────────────────────────────────────────────────────────────────
-- BEROTRALSTAT (ORLADEYO) — NDA 214094 + NDA 219776 — BioCryst — Approved 12/03/2020
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE assets SET
  inn_stem                          = 'berotralstat',
  inn_full                          = 'berotralstat',
  substance_name_formulated         = 'BEROTRALSTAT DIHYDROCHLORIDE',
  indication_type                   = 'prophylaxis',
  drug_class_detail                 = 'small_molecule',
  mechanism_target                  = 'kallikrein',
  cascade_level                     = 'kallikrein',
  approval_date                     = '2020-12-03',
  application_numbers               = ARRAY['NDA214094', 'NDA219776'],  -- capsules + oral pellets (pediatric)
  te_code                           = NULL,
  rld                               = true,  -- both strengths are RLD
  rs_strengths                      = ARRAY['150mg'],  -- 150mg is RS; 110mg is NOT RS
  formulary_substitution_permitted  = false,
  dose_type                         = 'scheduled',
  manufacturer_current              = 'BioCryst Pharmaceuticals, Inc.',
  manufacturer_bla_holder           = 'BioCryst Pharmaceuticals, Inc.',
  original_developer                = 'BioCryst Pharmaceuticals, Inc.',
  warnings = '[{"type": "QTc prolongation", "section": "5.1", "dose_dependent": true, "text": "QTc prolongation observed at doses higher than recommended. At 3x recommended dose: mean QTcF +15.9ms. No significant effect at recommended 150mg dose. Do NOT use extra doses for acute attacks."}]'::jsonb,
  contraindications                 = '[]'::jsonb,
  lab_interactions                  = '[]'::jsonb,
  dosing_regimens = '[
    {"frequency": "QD", "dose": "150mg oral capsule", "status": "standard", "population": "adults and children 12+"},
    {"frequency": "QD", "dose": "110mg oral capsule", "status": "hepatic impairment (moderate/severe)", "population": "adults and children 12+"},
    {"frequency": "QD", "dose": "72mg oral pellets", "status": "standard", "population": "children 2-<12 yrs, 12kg to <24kg"},
    {"frequency": "QD", "dose": "96mg oral pellets", "status": "standard", "population": "children 2-<12 yrs, 24kg to <32kg"},
    {"frequency": "QD", "dose": "108mg oral pellets", "status": "standard", "population": "children 2-<12 yrs, 32kg to <40kg"},
    {"frequency": "QD", "dose": "132mg oral pellets", "status": "standard", "population": "children 2-<12 yrs, ≥40kg"}
  ]'::jsonb,
  storage_model = '{"primary": "room temperature", "room_temp": true, "note": "Oral capsules and pellets — no refrigeration required"}'::jsonb,
  ndc_completeness                  = 'complete'
WHERE inn = 'berotralstat';

-- ─────────────────────────────────────────────────────────────────────────────
-- ICATIBANT (FIRAZYR / SAJAZIR) — NDA 022150 — Takeda (orig. Jerini AG) — Approved 08/25/2011
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE assets SET
  inn_stem                          = 'icatibant',
  inn_full                          = 'icatibant',
  substance_name_formulated         = 'ICATIBANT ACETATE',
  previous_names                    = ARRAY['icatibant acetate'],  -- ANDA 212446 pre-naming as Sajazir
  indication_type                   = 'acute_treatment',           -- CRITICAL: not prophylaxis
  drug_class_detail                 = 'synthetic_decapeptide',
  mechanism_target                  = 'B2_receptor',
  cascade_level                     = 'downstream_B2',
  approval_date                     = '2011-08-25',
  application_numbers               = ARRAY['NDA022150'],  -- originator; ANDAs listed in generic_andas
  te_code                           = 'AP',                -- therapeutically equivalent
  rld                               = true,                -- Firazyr is the RLD
  rs_strengths                      = ARRAY['30mg/3mL'],   -- Firazyr is the Reference Standard
  formulary_substitution_permitted  = true,  -- TE Code AP — pharmacists can substitute
  generic_andas                     = ARRAY['212446', '208317', '210118', '211021', '211501', '212081', '213521', '213773'],
  dose_type                         = 'on_demand',         -- event-triggered, NOT scheduled
  manufacturer_current              = 'Takeda Pharmaceuticals America, Inc.',
  manufacturer_bla_holder           = 'Takeda Pharmaceutical Company Limited',
  original_developer                = 'Jerini AG',         -- German company, acquired by Shire → Takeda
  patent_expiry_date                = '2019-07-15',        -- when generics legally entered market
  warnings = '[{"type": "laryngeal attacks", "section": "5.1", "text": "Laryngeal HAE attacks are life-threatening. Advise patients to seek immediate medical attention in addition to treating with icatibant."}]'::jsonb,
  contraindications                 = '[]'::jsonb,
  lab_interactions                  = '[]'::jsonb,
  dosing_regimens = '[
    {"frequency": "on_demand", "dose": "30mg SC into abdomen", "max_doses_per_24h": 3, "min_inter_dose_interval_hours": 6, "note": "Additional doses if response inadequate or symptoms recur"}
  ]'::jsonb,
  storage_model = '{"primary": "2-25°C (36-77°F)", "room_temp": true, "do_not_freeze": true}'::jsonb,
  ndc_completeness                  = 'complete',
  manufacturer_roles = '{"nda_holder": "Takeda Pharmaceutical Company Limited", "packager": "Takeda Pharmaceuticals America, Inc.", "sajazir_anda_holder": "Cipla Ltd.", "sajazir_label_sponsor": "Cycle Pharmaceuticals Ltd (UK)", "sajazir_manufacturer": "Cipla Ltd. at Gland Pharma, Hyderabad"}'::jsonb
WHERE inn = 'icatibant';

-- ─────────────────────────────────────────────────────────────────────────────
-- GARADACIMAB (ANDEMBRY) — BLA 761367 — CSL Behring LLC — Approved 06/16/2025
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE assets SET
  inn_stem                          = 'garadacimab',
  inn_full                          = 'garadacimab-gxii',
  substance_name_formulated         = 'GARADACIMAB-GXII',
  indication_type                   = 'prophylaxis',
  drug_class_detail                 = 'mAb-IgG4',
  mechanism_target                  = 'FXIIa',             -- NOT plasma kallikrein
  cascade_level                     = 'upstream_FXIIa',    -- upstream of kallikrein in the cascade
  approval_date                     = '2025-06-16',
  application_numbers               = ARRAY['BLA761367'],
  te_code                           = NULL,
  rld                               = false,
  rs_strengths                      = ARRAY[]::text[],
  formulary_substitution_permitted  = false,
  dose_type                         = 'loading+maintenance',
  manufacturer_current              = 'CSL Behring LLC',   -- API truncates this to 'CSL' — correct value stored here
  manufacturer_bla_holder           = 'CSL Behring LLC',
  original_developer                = 'CSL Behring',
  warnings                          = NULL,                -- Section 5 explicitly states: "None. None."
  contraindications                 = '[]'::jsonb,
  lab_interactions = '[
    {"test": "aPTT", "mechanism": "FXIIa inhibition interferes with intrinsic pathway assay reagents", "incidence_percent": 8, "threshold": ">1.4x ULN", "clinical_bleeding_risk": false},
    {"test": "PT/INR", "mechanism": "FXIIa cross-talk with extrinsic pathway markers", "incidence_percent": 15, "threshold": ">1.3x ULN", "clinical_bleeding_risk": false}
  ]'::jsonb,
  dosing_regimens = '[
    {"type": "loading", "dose": "400mg SC (2 x 200mg injections)", "timing": "Day 1"},
    {"type": "maintenance", "dose": "200mg SC", "frequency": "Q4W (once monthly)"}
  ]'::jsonb,
  storage_model = '{"primary": "refrigerator 2-8°C", "room_temp": false, "remove_before_use_min": 30}'::jsonb,
  ndc_completeness                  = 'incomplete',   -- prefilled syringe NDC 63833-920 absent from openfda.product_ndc; in label body only
  manufacturer_roles = '{"manufactured_for": "CSL Behring GmbH (Marburg, Germany) — US License 1765", "manufactured_by": "CSL Behring LLC (King of Prussia, PA) — US License 1767", "distributed_by": "CSL Behring LLC (Kankakee, IL)"}'::jsonb
WHERE inn = 'garadacimab';

-- ─────────────────────────────────────────────────────────────────────────────
-- DONIDALORSEN (DAWNZERA) — NDA 219407 — Ionis Pharmaceuticals — Approved 08/21/2025
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE assets SET
  inn_stem                          = 'donidalorsen',
  inn_full                          = 'donidalorsen',
  substance_name_formulated         = 'DONIDALORSEN SODIUM',  -- API generic_name drops the sodium; substance_name has it
  indication_type                   = 'prophylaxis',
  drug_class_detail                 = 'ASO-GalNAc',           -- antisense oligonucleotide with GalNAc hepatocyte targeting
  mechanism_target                  = 'PKK_mRNA',             -- targets PKK mRNA (pre-protein level), not PKK protein
  cascade_level                     = 'kallikrein_pre',       -- upstream of kallikrein protein (acts at mRNA level)
  approval_date                     = '2025-08-21',
  application_numbers               = ARRAY['NDA219407'],
  te_code                           = NULL,
  rld                               = true,                   -- first approved ASO for HAE
  rs_strengths                      = ARRAY['80mg/0.8mL'],   -- RS = Yes (confirmed in screenshots)
  formulary_substitution_permitted  = false,
  dose_type                         = 'scheduled',
  manufacturer_current              = 'Ionis Pharmaceuticals Inc.',
  manufacturer_bla_holder           = 'Ionis Pharmaceuticals Inc.',
  original_developer                = 'Ionis Pharmaceuticals Inc.',
  warnings = '[{"type": "hypersensitivity", "section": "5.1", "text": "Hypersensitivity reactions including anaphylaxis. Discontinue and seek immediate medical attention if symptoms occur."}]'::jsonb,
  contraindications = '[{"type": "hypersensitivity", "severity": "serious/anaphylaxis", "target": "donidalorsen or any excipient", "section": "4"}]'::jsonb,
  lab_interactions = '[
    {"test": "platelets", "mechanism": "pharmacological — ASO mechanism reduces PKK which affects platelet interaction pathways", "mean_reduction_percent": 9.6, "regimen": "Q4W", "clinical_bleeding_risk": false, "note": "No counts <50,000/mm³ observed"},
    {"test": "ALT/AST/GGT", "mechanism": "hepatic delivery mechanism — liver is primary tissue target", "clinical_significance": "generally <3x ULN, self-limited"}
  ]'::jsonb,
  dosing_regimens = '[
    {"frequency": "Q4W", "dose": "80mg SC", "status": "recommended", "attack_reduction_percent": 81, "attack_free_percent": 53},
    {"frequency": "Q8W", "dose": "80mg SC", "status": "alternative", "attack_reduction_percent": 55, "attack_free_percent": 35}
  ]'::jsonb,
  storage_model = '{"primary": "refrigerator 2-8°C", "secondary": "room temperature ≤30°C", "secondary_max_weeks": 6, "discard_after_room_temp": "6 weeks", "room_temp": true}'::jsonb,
  ndc_completeness                  = 'complete',
  manufacturer_roles = '{"distributed_by": "Ionis Pharmaceuticals Inc., Carlsbad, CA 92010"}'::jsonb
WHERE inn = 'donidalorsen';

-- ─────────────────────────────────────────────────────────────────────────────
-- PIPELINE DRUGS — classification fields only (no approval data)
-- MoA strings already entered in Supabase by user in previous session
-- ─────────────────────────────────────────────────────────────────────────────

-- Deucrictibant — oral B2 receptor antagonist (pipeline Phase 3)
UPDATE assets SET
  indication_type   = 'prophylaxis',
  drug_class_detail = 'small_molecule',
  mechanism_target  = 'B2_receptor',
  cascade_level     = 'downstream_B2',
  dose_type         = 'scheduled',
  contraindications = '[]'::jsonb
WHERE inn = 'deucrictibant';

-- Lonvoguran ziclumeran (NTLA-2002) — CRISPR/Cas9 KLKB1 knockout
UPDATE assets SET
  indication_type   = 'prophylaxis',
  drug_class_detail = 'gene_therapy',
  mechanism_target  = 'KLKB1_gene',
  cascade_level     = 'kallikrein_pre',
  dose_type         = 'scheduled',
  contraindications = '[]'::jsonb
WHERE inn IN ('lonvoguran ziclumeran', 'lonvoguran-ziclumeran');

-- Navenibart (STAR-0215) — allosteric anti-plasma kallikrein mAb
UPDATE assets SET
  indication_type   = 'prophylaxis',
  drug_class_detail = 'mAb',
  mechanism_target  = 'kallikrein',
  cascade_level     = 'kallikrein',
  dose_type         = 'scheduled',
  contraindications = '[]'::jsonb
WHERE inn = 'navenibart';

-- Mezagitamab (TAK-079) — anti-CD38 mAb (different mechanism — plasma cell depletion)
UPDATE assets SET
  indication_type   = 'prophylaxis',
  drug_class_detail = 'mAb-IgG1',
  mechanism_target  = 'CD38',
  cascade_level     = 'upstream_immune',
  dose_type         = 'scheduled',
  contraindications = '[]'::jsonb
WHERE inn = 'mezagitamab';

-- BCX17725 — selective KLK5 inhibitor / LEKTI-mimetic fusion protein
UPDATE assets SET
  indication_type   = 'prophylaxis',
  drug_class_detail = 'fusion_protein',
  mechanism_target  = 'KLK5',
  cascade_level     = 'kallikrein',
  dose_type         = 'scheduled',
  contraindications = '[]'::jsonb
WHERE inn IN ('bcx17725', 'bcx-17725');

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY: Check what was updated
-- Run this block after the UPDATEs to confirm all 5 approved drugs are populated
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  inn,
  indication_type,
  drug_class_detail,
  mechanism_target,
  cascade_level,
  approval_date,
  dose_type,
  formulary_substitution_permitted,
  te_code
FROM assets
ORDER BY approval_date NULLS LAST, inn;
