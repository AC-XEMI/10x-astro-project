# Auth error codes Implementation Plan

## Overview

Auth failures reach `/auth/signin`, `/auth/signup` and `/auth/confirm-email` as a **code** in
`?error=`. The page renders only the message mapped to that code, so neither a crafted link nor a
raw Supabase message reaches the user. This is the same contract as `src/lib/report-errors.ts`.

## Current State Analysis

- `src/pages/api/auth/{signin,signup,resend-confirmation}.ts` redirect with
  `?error=<encodeURIComponent(text)>`. The text is one of: `translateAuthError(error.message)`, the
  literal "Supabase is not configured", or (resend) "Sesja rejestracji wygasła…".
- `src/lib/auth-errors.ts` `translateAuthError` maps 4 exact and 2 prefix Supabase messages to
  Polish. **Unknown messages fall through unchanged** (raw English).
- `src/pages/auth/{signin,signup}.astro` pass `?error` as `serverError` to the form, and
  `ServerError` renders it. `confirm-email.astro` renders it in an `Alert`.
- `scripts/smoke.mjs` only checks the prefix `/auth/signin?error=`.

## Desired End State

- `src/lib/auth-errors.ts` exports:
  - `AUTH_ERROR_MESSAGES`: code → Polish text. The 6 existing texts stay word for word. Added are
    `signup_session_expired` (existing resend text), `not_configured` (same text as
    `REPORT_ERROR_MESSAGES.not_configured`) and `GENERIC_AUTH_ERROR` = "Coś poszło nie tak. Spróbuj
    ponownie.".
  - `authErrorCode(supabaseMessage)`: returns a known code, or `"unknown"` for unmapped messages,
    and logs the raw message with `console.error`.
  - `authErrorMessage(param)`: `null` when the param is absent, the mapped text for a known code,
    `GENERIC_AUTH_ERROR` for anything else.
  - `authErrorUrl(path, code)`.
- The 3 endpoints redirect only with codes. The 3 pages render `authErrorMessage(...)`.
- The smoke test asserts `/auth/signin?error=invalid_credentials`.
- CLAUDE.md gets a line about auth errors traveling as codes.

## What We're NOT Doing

- No change to the 6 existing Polish messages or to the form field validation messages.
- No change to auth flows, cookies or rate limits.
- No backfill of other `?error` users. Reports already use codes.

## Phase 1: Error codes

### Changes Required:

#### 1. Code map and helpers

**File**: `src/lib/auth-errors.ts`

**Intent**: Make one module the single source of auth error text, keyed by code.

**Contract**: The exports listed in Desired End State. Codes: `invalid_credentials`,
`email_not_confirmed`, `user_exists`, `email_rate_limit`, `weak_password`, `resend_too_soon`,
`signup_session_expired`, `not_configured`, `unknown`. The exact and prefix matching of Supabase
messages stays as today. `translateAuthError` is removed (all callers move to the codes).

#### 2. Endpoints

**Files**: `src/pages/api/auth/signin.ts`, `signup.ts`, `resend-confirmation.ts`

**Intent**: Never put free text in a redirect URL.

**Contract**: Each failure branch redirects to `authErrorUrl(<page>, <code>)`. A missing client
redirects with `not_configured`.

#### 3. Pages

**Files**: `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro`

**Intent**: Render only mapped text.

**Contract**: `const error = authErrorMessage(Astro.url.searchParams.get("error"))`. The rest of
each page is unchanged.

#### 4. Smoke and docs

**Files**: `scripts/smoke.mjs`, `CLAUDE.md`

**Contract**: The smoke step "signin rejects wrong password" expects
`/auth/signin?error=invalid_credentials`. The CLAUDE.md auth-flow section says that auth failures
travel as codes from `src/lib/auth-errors.ts`, and that raw Supabase messages go only to
`console.error`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -rn "encodeURIComponent" src/pages/api/auth` returns nothing
- `grep -rn "translateAuthError" src` returns nothing
- `/auth/signin?error=Kliknij%20tutaj` renders "Coś poszło nie tak. Spróbuj ponownie." and not "Kliknij tutaj"
- `/auth/signin?error=invalid_credentials` renders "Nieprawidłowy email lub hasło. Sprawdź dane i spróbuj ponownie."
- `npm run smoke` passes against the running dev server, including "signin rejects wrong password"

#### Manual Verification:

- A wrong password on `/auth/signin` shows the same Polish message as before, and the URL contains `?error=invalid_credentials`

## References

- Pattern: `src/lib/report-errors.ts`, `context/archive/2026-10-07-reports-list-ui-contract/`
- Rule: `context/foundation/lessons.md` (no raw DB names / Supabase messages in UI)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Error codes

#### Automated

- [x] 1.1 Type check passes: `npx astro check`
- [x] 1.2 Lint passes: `npm run lint`
- [x] 1.3 `grep -rn "encodeURIComponent" src/pages/api/auth` returns nothing
- [x] 1.4 `grep -rn "translateAuthError" src` returns nothing
- [x] 1.5 `/auth/signin?error=Kliknij%20tutaj` renders "Coś poszło nie tak. Spróbuj ponownie." and not "Kliknij tutaj"
- [x] 1.6 `/auth/signin?error=invalid_credentials` renders "Nieprawidłowy email lub hasło. Sprawdź dane i spróbuj ponownie."
- [ ] 1.7 `npm run smoke` passes against the running dev server, including "signin rejects wrong password"

#### Manual

- [x] 1.8 A wrong password on `/auth/signin` shows the same Polish message as before, and the URL contains `?error=invalid_credentials`
