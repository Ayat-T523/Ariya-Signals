/**
 * authFormValidation.ts — V1 final auth requirements checkpoint (2026-08-27).
 *
 * Pure validation for the sign-up and reset-password forms, extracted out
 * of SignUp.tsx/ResetPassword.tsx so it is unit-testable without a DOM
 * (this repo has no React/DOM testing library -- see any *.test.ts file's
 * own docstring). No password-policy invention beyond what these two forms
 * ask for themselves (email present, password present, passwords match) --
 * Supabase's own signUp()/updateUser() enforce whatever real policy the
 * project has configured, and their error is surfaced as-is.
 */

export function validateSignUpForm(email: string, password: string, confirmPassword: string): string | null {
  if (!email.trim()) return 'Email is required.'
  if (!password) return 'Password is required.'
  if (password !== confirmPassword) return 'Passwords do not match.'
  return null
}

export function validateResetPasswordForm(password: string, confirmPassword: string): string | null {
  if (!password) return 'Password is required.'
  if (password !== confirmPassword) return 'Passwords do not match.'
  return null
}
