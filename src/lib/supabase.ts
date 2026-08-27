import { createClient } from '@supabase/supabase-js'

// Optional chaining on `env` itself (V1 Login/Auth Restoration checkpoint,
// 2026-08-27): import.meta.env is a Vite-injected global, absent when this
// module is loaded directly under plain Node (e.g. `npx tsx` running
// authContext.test.ts, which now transitively imports this module via
// AuthContext.tsx's restored Supabase session handling) rather than bundled
// through Vite -- same pattern AuthContext.tsx's own import.meta.env?.
// access already established.
const SUPABASE_URL      = import.meta.env?.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined

// supabase is null when env vars are missing (local dev without DB configured).
// All callers must guard: if (!supabase) return
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
