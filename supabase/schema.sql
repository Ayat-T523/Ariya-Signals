-- Ariya Light — Full schema
-- Run this in the Supabase SQL editor (Database → SQL editor → New query)
-- Safe to re-run: all statements use IF NOT EXISTS

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Core entities ─────────────────────────────────────────────────────────────

create table if not exists assets (
  id          uuid primary key default uuid_generate_v4(),
  chembl_id   text unique,
  inn         text unique not null,          -- international non-proprietary name
  drug_class  text,                          -- "Small molecule", "Biologicals", etc.
  max_phase   int,                           -- 4 = approved
  indication  text,
  synonyms    text[] default '{}',
  created_at  timestamptz default now()
);

create table if not exists companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text unique not null,
  sec_cik     text,                          -- SEC EDGAR CIK (US-listed only)
  ir_url      text,                          -- investor relations page
  ticker      text,
  exchange    text,                          -- NYSE, NASDAQ, TYO, ASX, etc.
  created_at  timestamptz default now()
);

create table if not exists asset_sponsors (
  asset_id    uuid references assets(id) on delete cascade,
  company_id  uuid references companies(id) on delete cascade,
  primary key (asset_id, company_id)
);

-- ── User configuration ────────────────────────────────────────────────────────

-- user_id is the Clerk userId string (not a UUID FK — Clerk manages the user table)
create table if not exists user_watched_assets (
  user_id            text not null,
  asset_id           uuid references assets(id) on delete cascade,
  therapeutic_area   text,
  created_at         timestamptz default now(),
  primary key (user_id, asset_id)
);

create table if not exists user_watched_companies (
  user_id              text not null,
  company_id           uuid references companies(id) on delete cascade,
  inferred_from_asset  uuid references assets(id) on delete set null,
  created_at           timestamptz default now(),
  primary key (user_id, company_id)
);

create table if not exists user_keywords (
  id          uuid primary key default uuid_generate_v4(),
  user_id     text not null,
  keyword     text not null,
  created_at  timestamptz default now(),
  unique (user_id, keyword)
);

-- ── Ingested data tables ──────────────────────────────────────────────────────

create table if not exists trials (
  id               uuid primary key default uuid_generate_v4(),
  nct_id           text unique not null,
  asset_id         uuid references assets(id) on delete set null,
  company_id       uuid references companies(id) on delete set null,
  phase            text,                    -- "Phase 1", "Phase 2", "Phase 3", "Phase 4"
  status           text,                    -- "Recruiting", "Completed", "Terminated", etc.
  title            text,
  brief_summary    text,
  start_date       date,
  completion_date  date,
  design           text,                    -- "Randomized, double-blind, placebo-controlled"
  sites_count      int,
  conditions       text[],
  interventions    text[],
  raw_json         jsonb,                   -- full ClinicalTrials.gov response
  last_synced_at   timestamptz default now()
);

create table if not exists regulatory_events (
  id              uuid primary key default uuid_generate_v4(),
  asset_id        uuid references assets(id) on delete set null,
  event_type      text not null,            -- "approval" | "label-change" | "chmp-opinion" | "epar-update"
  date            date,
  authority       text,                     -- "FDA" | "EMA" | "MHRA"
  country         text,
  headline        text,
  details         text,
  source_url      text,
  last_synced_at  timestamptz default now()
);

create table if not exists filings (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid references companies(id) on delete cascade,
  form_type        text not null,           -- "8-K" | "10-K" | "10-Q"
  filed_date       date,
  accession_number text unique,
  headline         text,
  excerpt          text,
  source_url       text,
  last_synced_at   timestamptz default now()
);

create table if not exists hta_decisions (
  id                          uuid primary key default uuid_generate_v4(),
  asset_id                    uuid references assets(id) on delete set null,
  body                        text,                    -- "NICE" | "G-BA" | "HAS" | "AIFA"
  country                     text,
  date                        date,
  outcome                     text,                    -- "Approved" | "Rejected" | "Restricted"
  restrictions                text,
  time_to_reimbursement_days  int,
  source_url                  text,
  last_synced_at              timestamptz default now()
);

create table if not exists press_releases (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid references companies(id) on delete cascade,
  title           text,
  published_at    timestamptz,
  source          text,                     -- "PR Newswire" | "GlobeNewswire" | "IR page"
  url             text unique,
  content_excerpt text,
  last_synced_at  timestamptz default now()
);

create table if not exists publications (
  id              uuid primary key default uuid_generate_v4(),
  asset_id        uuid references assets(id) on delete set null,
  pmid            text unique,
  title           text,
  authors         text[],
  published_date  date,
  journal         text,
  abstract_excerpt text,
  last_synced_at  timestamptz default now()
);

create table if not exists congress_events (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  location    text,
  start_date  date,
  end_date    date,
  type        text,                          -- "conference" | "earnings" | "regulatory"
  website_url text
);

create table if not exists congress_abstracts (
  id           uuid primary key default uuid_generate_v4(),
  congress_id  uuid references congress_events(id) on delete cascade,
  asset_id     uuid references assets(id) on delete set null,
  title        text,
  presenter    text,
  abstract_url text
);

create table if not exists messaging_snapshots (
  id                uuid primary key default uuid_generate_v4(),
  company_id        uuid references companies(id) on delete cascade,
  url               text not null,
  snapshot_date     date not null,
  content_hash      text,                   -- SHA-256 of scraped content
  content_excerpt   text,
  changed_from_prior boolean default false,
  unique (company_id, snapshot_date)
);

-- ── Alert spine (generated by change-detection) ───────────────────────────────

create table if not exists alerts (
  id            uuid primary key default uuid_generate_v4(),
  asset_id      uuid references assets(id) on delete set null,
  company_id    uuid references companies(id) on delete set null,
  type          text not null,              -- "trial-update"|"label-change"|"filing"|"hta"|"press"|"messaging-drift"|"publication"
  severity      text default 'medium',      -- "high"|"medium"|"low"
  headline      text not null,
  what_happened text,
  source        text,
  source_url    text,
  created_at    timestamptz default now(),
  read          boolean default false
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_trials_asset_id         on trials(asset_id);
create index if not exists idx_trials_status           on trials(status);
create index if not exists idx_regulatory_asset_id     on regulatory_events(asset_id);
create index if not exists idx_filings_company_id      on filings(company_id);
create index if not exists idx_filings_filed_date      on filings(filed_date desc);
create index if not exists idx_alerts_created_at       on alerts(created_at desc);
create index if not exists idx_alerts_type             on alerts(type);
create index if not exists idx_user_watched_user_id    on user_watched_assets(user_id);
create index if not exists idx_press_published_at      on press_releases(published_at desc);
