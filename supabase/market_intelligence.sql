-- Name: market_intelligence
-- Description: Stores curated market-intelligence implication bullets displayed in the War Room
--   "Market weather" section. Rows are managed via the Supabase dashboard — edit content
--   here to refresh what appears in the app without a code deploy.
--   Run this file BEFORE market_intelligence_seed.sql.

create extension if not exists "uuid-ossp";

create table if not exists market_intelligence (
  id            uuid        default uuid_generate_v4() primary key,
  type          text        not null,          -- 'implication' (reserved for future types)
  content       text        not null,
  display_order int         default 0,
  active        boolean     default true,      -- set false to hide without deleting
  period_label  text        default 'last 7 days',
  created_at    timestamptz default now()
);

-- Allow the anon / authenticated Supabase roles to read rows
grant select on market_intelligence to anon, authenticated;
