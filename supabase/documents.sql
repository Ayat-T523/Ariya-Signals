-- Name: documents
-- Description: Creates the documents table, which stores full-text content of primary source documents
--   (SEC 8-K / 6-K filings, FDA drug labels, NICE Technology Appraisals, EMA EPARs).
--   Each row is one document, uniquely identified by source_url.
--   Adds a document_id FK to company_signals (one signal → one primary document) and a
--   source_document_id FK to market_intelligence (implication bullets can cite a source).
--   Safe to re-run: IF NOT EXISTS and ADD COLUMN IF NOT EXISTS guards prevent errors.
--   After running, execute scripts/ingest-documents.mjs to backfill full text from
--   existing company_signals rows.

create extension if not exists "uuid-ossp";

create table if not exists documents (
  id             uuid        default uuid_generate_v4() primary key,
  competitor_id  text        not null,
  source_url     text        not null unique,
  document_type  text        not null,   -- '8-K' | '6-K' | '10-K' | '20-F' | 'DEF-14A' | 'FDA-label' | 'NICE-TA' | 'EMA-EPAR'
  source_label   text,                   -- 'SEC EDGAR' | 'FDA DailyMed' | 'NICE' | 'EMA'
  date_published date,
  full_text      text,
  word_count     int,
  ingested_at    timestamptz default now()
);

comment on table documents is
  'Full-text primary source documents (SEC filings, FDA labels, NICE TAs, EMA EPARs). Linked from company_signals and market_intelligence for data traceability.';

comment on column documents.document_type is
  '8-K | 6-K | 10-K | 20-F | DEF-14A | FDA-label | NICE-TA | EMA-EPAR';

comment on column documents.full_text is
  'Full plain-text content of the document, HTML-stripped. Capped at 200 000 characters by the ingest script.';

-- FK: company_signals → documents
alter table company_signals
  add column if not exists document_id uuid references documents(id);

comment on column company_signals.document_id is
  'FK to documents.id — links this signal to its full primary source document.';

-- FK: market_intelligence → documents
alter table market_intelligence
  add column if not exists source_document_id uuid references documents(id);

comment on column market_intelligence.source_document_id is
  'FK to documents.id — the primary source document that this implication bullet is derived from.';

-- Allow browser (anon) and authenticated roles to read documents
grant select on documents to anon, authenticated;

-- RLS: enable and create a permissive read-all policy (this is public demo data)
alter table documents enable row level security;

create policy "Allow anon read" on documents
  for select
  to anon, authenticated
  using (true);
