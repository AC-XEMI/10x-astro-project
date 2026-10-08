# Upload error visibility — Plan Brief

> Full plan: `context/changes/upload-error-visibility/plan.md`

## What & Why

Roadmap M-4, S-16: when a report upload or deletion fails, the team should be able to see it after
the fact, with an error code and context but no personal data. Today these failures end as raw
`console.error` calls — visible only while watching `wrangler tail` live — or leave no trace at all.

## Starting Point

Workers Logs is already enabled (`wrangler.jsonc`) and stores console output, indexing the fields
of logged objects. `upload.ts` logs four database failures as raw Supabase error objects; its five
rejection paths and the compensating rollback leave nothing. `delete.ts` logs only `delete_failed`.
Error codes already exist in `report-errors.ts`.

## Desired End State

Every error redirect in upload and delete writes exactly one structured entry (`event`, `level`,
`code`, `stage`, ids, file extension/size, row count, Postgres error code). Our own failures log at
`error`, rejections at `warn`. A failed rollback is no longer silent. The entries can be filtered
by `event` in Cloudflare Workers Logs, and S-17…S-19 reuse the same module.

## Key Decisions Made

| Decision           | Choice                                                              | Why (1 sentence)                                                                 |
| ------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Destination        | Cloudflare Workers Logs (structured console objects)                | Already enabled — no account, secret or dependency; alerts are parked anyway.     |
| What counts        | Every error redirect: failures `error`, rejections `warn`            | Shows why managers' files get rejected, not only our own outages.                 |
| Allowed fields     | Codes, UUIDs, extension, size, row count, Postgres `code`, parser detail | Enough to diagnose; no filename, no raw DB `message`/`details`, no sheet values. |
| Testing            | Vitest for the pure event builder; routes verified manually          | Fits the existing pure-module test layer; route-test pattern belongs to F-03.    |

## Scope

**In scope:**
- `src/lib/app-events.ts` and its tests;
- an entry on every error path in `upload.ts` and `delete.ts`;
- a checked compensating rollback;
- removing the raw `console.error` calls;
- a CLAUDE.md convention bullet with the observed retention.

**Out of scope:**
- external services;
- success or duration entries (S-19);
- report-view and auth logging (S-17, S-18);
- route tests;
- alerts;
- any change to user-facing messages.

## Architecture / Approach

A pure `buildAppEvent` whitelists fields (only `error.code` passes from a Supabase error; `detail`
only for `invalid_file`). A thin `logAppEvent` writes the object as the single argument of
`console.error`/`console.warn`, which Workers Logs indexes. The routes call it at each error redirect.

## Phases at a Glance

| Phase                         | What it delivers                                        | Key risk                                           |
| ----------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| 1. Event module               | Tested, PII-safe entry builder + logger                 | Whitelist too loose (filename/raw message leaks)   |
| 2. Wire routes and document   | Entries on all upload/delete error paths, rollback check | A path missed, or entry logged as unindexed text   |

**Prerequisites:** none — Workers Logs already on; manual production check needs a deploy (CI deploys on `master`).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Workers Logs retention is a few days depending on the plan; the exact value is checked and noted in Phase 2.
- Head sampling stays at the default (all entries); heavy traffic is not expected at this scale.

## Success Criteria (Summary)

- A rejected or failed upload/delete can be found in Workers Logs by `event` after it happened.
- No log entry contains a filename, a raw database message or a value from the uploaded sheet.
- User-facing behaviour is unchanged.
