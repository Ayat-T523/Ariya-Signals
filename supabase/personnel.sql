-- Name: personnel
-- Description: Stores named executive officers for each tracked competitor, auto-derived from
--   SEC DEF 14A (US filers) and 20-F Item 6 (foreign private issuers). Name and Title only —
--   no age or biographical narrative. Real-time updates driven by 8-K Item 5.02 exec_change
--   signals. CSL Behring: manual download from csl.com/investors annual report.
--   Safe to re-run: IF NOT EXISTS guards throughout.
--   After running, execute scripts/ingest-proxy.mjs to populate from EDGAR proxy statements.

create extension if not exists "uuid-ossp";

create table if not exists personnel (
  id              uuid        default uuid_generate_v4() primary key,
  competitor_id   text        not null,
  name            text        not null,
  title           text        not null,
  source_url      text,                   -- URL of the DEF 14A / 20-F / 8-K filing
  source_type     text        not null,   -- 'def-14a' | '20-f' | '8-k-5.02' | 'ir-page'
  effective_date  date,                   -- date of appointment/filing
  is_current      boolean     default true,
  ingested_at     timestamptz default now(),
  constraint personnel_competitor_name_unique unique (competitor_id, name)
);

comment on table personnel is
  'Named executive officers per competitor, derived from SEC DEF 14A, 20-F Item 6, and 8-K 5.02 filings. Name + Title only.';

comment on column personnel.source_type is
  'def-14a | 20-f | 8-k-5.02 | ir-page';

-- Row-level security: service role full access, anon read-only
alter table personnel enable row level security;

create policy if not exists "anon_read_personnel"
  on personnel for select
  using (true);

create policy if not exists "service_write_personnel"
  on personnel for all
  to service_role
  using (true) with check (true);

grant select on personnel to anon;
grant select on personnel to authenticated;
