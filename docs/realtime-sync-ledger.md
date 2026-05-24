# Realtime Sync Ledger

Last updated: 2026-05-24

## Current Goal

Replace polling-based POS, kitchen, and customer-table synchronization with a hardened, revisioned realtime notification model.

## Branch / Baseline

- Branch: `codex/realtime-notification-architecture`
- Baseline: `main@96e3448`, after mobile client UI/UX refactor.
- Existing dirty file before branch creation: `apps/next/next-env.d.ts`; leave untouched unless explicitly needed.

## Decisions

- Transport v1: Cloudflare Worker + Durable Object WebSocket.
- Realtime transport is notification-only. HTTP APIs remain mutation source.
- Source of truth: D1.
- Consistency model: committed domain writes produce scope revisions and `domainEvents`; WebSocket messages only hint `{scope, revision, eventId, type}`.
- Scope model: `venue:default` for POS/Kitchen/admin and `table:{tableId}` for customer table sessions.
- Security rollout: harden auth/API/table sessions before removing network polling.

## Public Contracts

- Unsafe HTTP mutations require same-origin `Origin`, JSON body, CSRF header, and `Idempotency-Key` unless explicitly exempted.
- Admin auth uses opaque `yoncom_session`; cookie no longer stores `userId`.
- Customer access uses `yoncom_table_session`, bound to table and active table context.
- Successful HTTP mutations return `{ result, mutationId, revision, affectedScopes }`.
- Sync endpoints:
  - `GET /api/sync/admin?afterRevision=...`
  - `GET /api/sync/table?tableId=...&afterRevision=...`
- Realtime endpoint:
  - `GET /api/realtime/socket`

## Implemented In This Branch

- Added realtime sync persistence migration: `tableSessions`, `mutationRequests`, `scopeRevisions`, `domainEvents`.
- Replaced forgeable admin cookie semantics with opaque server-side `sessions` lookup and CSRF cookie issuance.
- Added customer table sessions bound to active table context and revoked on table remove/vacate.
- Centralized unsafe method guard for origin, JSON content type, CSRF, body size, simple rate limiting, and idempotency header.
- Retrofitted unsafe API routes under `apps/next/app/api/**/route.ts`.
- Narrowed customer table reads to authorized current-table context.
- Replaced D1 HTTP fake batch behavior with Cloudflare D1 batch payload support.
- Added sync endpoints for admin and table scopes with snapshot-on-initial/gap behavior.
- Added notification event groundwork for order, payment, deposit, table, menu, and menu category mutations.
- Added Cloudflare Worker + Durable Object notification fanout skeleton with scope authorization and signed internal notify path.
- Replaced admin 4s network polling and client footer payment polling with websocket hint/focus sync refresh.

## Risks

- Legacy D1 HTTP helper previously used `Promise.all` for `batch`; this is not atomic and must not be used for transaction semantics.
- Existing mutation functions still perform many raw SQL calls. Event recording is now present but not yet fully in the same D1 transaction boundary as every domain write.
- `mutationRequests` schema exists, but full persisted idempotency replay/reject semantics are not wired through every mutation yet.
- Worker source is scaffolded under `workers/realtime`, but this repo does not yet include it in `pnpm-workspace.yaml` or a Worker typecheck/deploy command.
- Customer `/api/table` previously returned raw table relations; narrowing response can affect UI assumptions.
- Local browser smoke for client table currently requires applying the new migration/fixture; otherwise `/api/table/session` can fail with missing legacy tables.

## Verification

- Passed: `rtk pnpm typecheck`.
- Passed: `rtk pnpm test` with 32 tests.
- Passed: `rtk pnpm build`.
- Passed: `git diff --check`.
- Browser smoke:
  - `/auth` rendered.
  - `/admin` redirected to `/auth` when unauthenticated, but direct admin layout paths can fail in this local DB because `sessions` migration is not applied.
  - `/client/table/table_e2e_00001` rendered shell, then `/api/table/session` failed because local D1 lacks `tableContexts`.

## Next Owner

- Wire `mutationRequests` persisted idempotency before production rollout.
- Convert high-risk mutation/event writes into explicit D1 batch/Worker-bound transaction paths.
- Add Worker package/typecheck/deploy scripts and replace placeholder D1 database id.
- Apply migration to local/dev D1 and run authenticated POS/Kitchen/customer browser smoke with seeded fixture data.
