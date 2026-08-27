/**
 * authFormValidation.test.ts — V1 final auth requirements checkpoint (2026-08-27).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/authFormValidation.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import assert from 'node:assert/strict'
import { validateSignUpForm, validateResetPasswordForm } from './authFormValidation'

let passed = 0
let failed = 0
function check(label: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓  ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${label}`)
    console.error(`     ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

console.log('1. validateSignUpForm()')
check('a fully valid form passes', () => {
  assert.equal(validateSignUpForm('a@b.com', 'password123', 'password123'), null)
})
check('missing email is rejected', () => {
  assert.equal(validateSignUpForm('', 'password123', 'password123'), 'Email is required.')
})
check('whitespace-only email is rejected, not silently trimmed into acceptance', () => {
  assert.equal(validateSignUpForm('   ', 'password123', 'password123'), 'Email is required.')
})
check('missing password is rejected', () => {
  assert.equal(validateSignUpForm('a@b.com', '', ''), 'Password is required.')
})
check('mismatched passwords are rejected', () => {
  assert.equal(validateSignUpForm('a@b.com', 'password123', 'password124'), 'Passwords do not match.')
})
check('email presence is checked before password mismatch (first real problem reported first)', () => {
  assert.equal(validateSignUpForm('', 'password123', 'password124'), 'Email is required.')
})

console.log('2. validateResetPasswordForm()')
check('a fully valid form passes', () => {
  assert.equal(validateResetPasswordForm('newpassword123', 'newpassword123'), null)
})
check('missing password is rejected', () => {
  assert.equal(validateResetPasswordForm('', ''), 'Password is required.')
})
check('mismatched passwords are rejected', () => {
  assert.equal(validateResetPasswordForm('newpassword123', 'somethingElse'), 'Passwords do not match.')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
