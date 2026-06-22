-- Name: csl_behring_signals
-- Description: Manual seed of five CSL Behring company_signals rows.
--   CSL Behring is a subsidiary of CSL Limited (ASX: CSL), an Australian company with no SEC EDGAR
--   filings. Two rows (FDA approval, EC approval) are sourced from verified CSL newsroom press
--   releases. Three rows (Germany formulary, exec hire, earnings update) are illustrative — no
--   specific public press release has been confirmed for these events; is_illustrative = true.
--   Run AFTER company_signals.sql and add_is_illustrative.sql.
--
--   NOTE: Uses ON CONFLICT ... DO UPDATE so re-running this seed corrects existing rows.

insert into company_signals (competitor_id, signal_type, date, headline, body_excerpt, source_url, accession_number, is_illustrative)
values
  -- VERIFIED: FDA approval date June 16, 2025. Source: CSL newsroom press release.
  ('csl-behring', 'press_release', '2025-06-16',
   'FDA approves Andembry (garadacimab-gxii) for hereditary angioedema prophylaxis',
   'CSL announced that the US Food and Drug Administration (FDA) has approved Andembry (garadacimab-gxii), the only prophylactic HAE treatment targeting Factor XIIa with once-monthly dosing for all patients from the start. Approval was based on the Phase 3 VANGUARD trial in which Andembry reduced HAE attack frequency by more than 99% median and kept 62% of patients attack-free.',
   'https://newsroom.csl.com/2025-06-16-U-S-Food-and-Drug-Administration-Approves-CSLs-ANDEMBRY-R-garadacimab-gxii-,-the-Only-Prophylactic-Hereditary-Angioedema-HAE-Treatment-Targeting-Factor-XIIa-with-Once-Monthly-Dosing-for-All-Patients-From-the-Start',
   'csl-manual-2025-03-07-fda-approval',
   false),

  -- VERIFIED: EC approval date February 13, 2025. Source: CSL newsroom press release.
  ('csl-behring', 'press_release', '2025-02-13',
   'Andembry receives European Commission approval for HAE prophylaxis',
   'CSL announced that the European Commission has granted marketing authorisation for Andembry (garadacimab) for the prevention of recurrent attacks of hereditary angioedema (HAE) in patients 12 years and older. The centralised marketing authorisation covers all EU member states and EEA countries Norway, Iceland and Liechtenstein.',
   'https://newsroom.csl.com/2025-02-13-European-Commission-Approves-CSLs-ANDEMBRY-R-garadacimab-for-the-Prevention-of-Recurrent-Attacks-of-Hereditary-Angioedema-HAE',
   'csl-manual-2025-09-15-ec-approval',
   false),

  -- ILLUSTRATIVE: No specific press release confirmed for Andembry Germany formulary access.
  --   GKV reimbursement status as of February 2026 not publicly announced. Marked illustrative.
  ('csl-behring', 'press_release', '2026-02-14',
   'Andembry achieves formulary access in Germany ahead of schedule',
   '(Illustrative — no specific press release confirmed.) CSL Behring is expected to announce GKV statutory health insurance reimbursement for Andembry (garadacimab) in Germany following the AMNOG benefit assessment process. The company noted commercial preparation milestones ahead of the original timeline.',
   'https://newsroom.csl.com/csl-behring',
   'csl-manual-2026-02-14-de-formulary',
   true),

  -- ILLUSTRATIVE: VP-level executive appointments are not typically disclosed by CSL Behring
  --   in a press release. No specific announcement found. Marked illustrative.
  ('csl-behring', 'exec_change', '2025-11-10',
   'CSL Behring appoints new Head of HAE Commercial, North America',
   '(Illustrative — no specific press release confirmed.) CSL Behring is expected to expand its commercial team following the US approval of Andembry, including leadership appointments in HAE commercial roles. No public disclosure of this appointment has been found.',
   'https://newsroom.csl.com/csl-behring',
   'csl-manual-2025-11-10-exec-hire',
   true),

  -- ILLUSTRATIVE: CSL Limited Q3 FY2026 financial update (nine months ended 31 March 2026).
  --   The specific revenue run-rate figure has not been confirmed from an official CSL report.
  --   Marked illustrative pending CSL Q3 FY2026 ASX announcement (expected April 2026).
  ('csl-behring', 'press_release', '2026-04-05',
   'CSL Behring reports strong Andembry uptake in Q1 2026 earnings update',
   '(Illustrative — specific revenue figure not confirmed from official CSL report.) CSL Limited is expected to report financial results for the nine months ended 31 March 2026, including commentary on Andembry commercial launch performance. Specific revenue figures will be available in the official ASX announcement.',
   'https://www.csl.com/investors',
   'csl-manual-2026-04-05-q1-earnings',
   true)

on conflict (competitor_id, accession_number)
do update set
  date         = excluded.date,
  headline     = excluded.headline,
  body_excerpt = excluded.body_excerpt,
  source_url   = excluded.source_url,
  is_illustrative = excluded.is_illustrative;
