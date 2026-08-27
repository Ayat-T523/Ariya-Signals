/**
 * auth.test.ts — V1 final auth requirements checkpoint (2026-08-27).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/auth.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 *
 * Under plain Node (no Vite), import.meta.env is undefined, so lib/supabase.ts's
 * `supabase` client is null (same mechanism authContext.test.ts's own docstring
 * relies on) -- every function here hits its `if (!supabase) throw` guard
 * deterministically, with zero live Supabase calls and zero quota consumed.
 * The real signUp()/resetPasswordForEmail()/updatePassword() request shapes
 * were verified live against a real Supabase project (see this checkpoint's
 * final report, section 8-10) -- this file only proves the configuration
 * guard itself, which IS safely testable without a live backend.
 */
import assert from 'node:assert/strict'
import { signUp, resetPasswordForEmail, updatePassword } from './auth'

let passed = 0
let failed = 0
async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✓  ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${label}`)
    console.error(`     ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

async function main() {
  console.log('1. Every new auth function fails closed to a real, honest error -- never a silent fake success -- when Supabase is unconfigured')
  await check('signUp() rejects with "Auth not configured" rather than pretending to create an account', async () => {
    await assert.rejects(() => signUp('new@example.com', 'password123'), /Auth not configured/)
  })
  await check('resetPasswordForEmail() rejects with "Auth not configured" rather than pretending to send an email', async () => {
    await assert.rejects(() => resetPasswordForEmail('someone@example.com'), /Auth not configured/)
  })
  await check('updatePassword() rejects with "Auth not configured" rather than pretending to update anything', async () => {
    await assert.rejects(() => updatePassword('newpassword123'), /Auth not configured/)
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
