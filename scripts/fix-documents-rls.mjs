/**
 * One-shot RLS fix for the documents table.
 * The documents table had RLS enabled with no read policy, so the anon key returned 0 rows.
 * This script adds a permissive SELECT policy so the browser can read documents.
 * Usage: node --env-file=.env.local scripts/fix-documents-rls.mjs
 *
 * Safe to re-run: uses CREATE POLICY IF NOT EXISTS.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing env vars. Run with: node --env-file=.env.local scripts/fix-documents-rls.mjs')
  process.exit(1)
}

// The Supabase JS client doesn't expose raw SQL, but we can call the REST API
// management endpoint using the project reference extracted from the service key JWT.

const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]

const SQL = `
  alter table documents enable row level security;
  do $$ begin
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename  = 'documents'
        and policyname = 'Allow anon read'
    ) then
      create policy "Allow anon read" on documents
        for select to anon, authenticated using (true);
    end if;
  end $$;
`

console.log('\n🔒  Applying RLS policy to documents table...\n')

const resp = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  }
)

const body = await resp.text()

if (!resp.ok) {
  console.error(`❌  Management API returned ${resp.status}:`, body)
  console.error('\n   This endpoint requires a Supabase Personal Access Token (PAT),')
  console.error('   not the service role key. Please run the following SQL manually')
  console.error('   in the Supabase dashboard → SQL Editor:\n')
  console.error('   ALTER TABLE documents ENABLE ROW LEVEL SECURITY;')
  console.error('   CREATE POLICY "Allow anon read" ON documents')
  console.error('     FOR SELECT TO anon, authenticated USING (true);')
  console.error('\n   Then re-run the app — the Messaging tab will show source documents.')
  process.exit(1)
}

console.log('✅  RLS policy applied successfully.')
console.log('   Anon key can now read documents table.')
