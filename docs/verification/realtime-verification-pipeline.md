# Realtime Verification Pipeline

This file is the operator checklist for realtime-notification verification.
Canonical structured data lives in `docs/verification/realtime-verification-pipeline.json`.

## Scope

Verify data integrity, request order, auth, DB permissions, realtime sync, modal/panel state order, and workflow convergence.

Do not verify visual UI breakage in this pipeline. Screenshots may be evidence for navigation state only, not layout approval.

## Trace Logs

Set:

```bash
YONCOM_TRACE=1 NEXT_PUBLIC_YONCOM_TRACE=1 pnpm dev
```

Trace line format:

```text
[yoncom-trace] {"ts":"2026-05-24T00:00:00.000Z","clockMs":1770000000000,"layer":"client","event":"http.request",...}
```

Required ordering for successful mutation:

1. `client:store.request.start`
2. `client:http.request`
3. `server:api.guard.start`
4. `server:api.guard.pass`
5. `server:api.request.json`
6. `server:d1.query.start`
7. `server:d1.query.end`
8. `server:domain.event.append.start`
9. `server:domain.event.appended`
10. `server:realtime.notify.start`
11. `worker:realtime.notify.received`
12. `worker:realtime.broadcast`
13. `client:realtime.socket.message`
14. `client:http.request` for `/api/sync/*`
15. `client:store.request.success` or explicit sync snapshot application
16. `client:ui.dialog.state` / `client:ui.panel.state` where applicable

Blocked mutation must stop at `server:api.guard.block` and must not emit `domain.event.appended`.

## Commands

```bash
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
rtk pnpm verify:realtime
git diff --check
```

`pnpm verify:realtime` writes a structured run report under `artifacts/realtime-verification/`. `artifacts/` is gitignored.

## Browser Workflow

Must use `browser:browser`.

Do not use standalone Playwright MCP, Playwright CLI, or `@playwright/test` for browser workflow verification. Browser plugin may expose `tab.playwright` after Browser runtime setup; that is allowed because the controlling surface remains Codex in-app Browser.

Browser sequence:

1. Start dev server with trace env.
2. Open `/auth`.
3. Open `/admin`; assert unauthenticated redirect to `/auth`.
4. Sign in or sign up with fixture admin account.
5. Open `/admin/pos`.
6. Open `/admin/cooker` in same Browser surface or second Browser tab.
7. Open `/client/table/{tableId}` in same Browser surface or third Browser tab.
8. Drive POS occupy, client order, deposit/payment, Kitchen ready, POS pickup, vacate.
9. Collect Browser console logs with `tab.dev.logs`.
10. Compare Browser console trace order with server terminal trace order.

Use DOM snapshots and visible URL/state text for assertions. Do not score visual layout.

## DB Readiness

Before browser workflow, DB must have:

- `sessions`
- `tableContexts`
- `tableSessions`
- `mutationRequests`
- `scopeRevisions`
- `domainEvents`
- normal order/payment/menu/table tables

Permission checks:

- D1 token can read `sqlite_master`.
- D1 token can read all workflow tables.
- D1 token can insert/update/delete `sessions`.
- D1 token can insert/update/revoke `tableSessions`.
- D1 token can batch mutation writes plus revision/event rows.
- D1 token can read revision/event rows for sync endpoints.

## API Matrix

Every endpoint listed in `realtime-verification-pipeline.json.endpointMatrix` needs one connectivity check:

- correct method returns expected 2xx/3xx/4xx/501
- wrong auth returns 401/403
- unsafe method missing guard material is blocked
- DB-missing failure is classified as environment readiness failure, not UI failure

## Workflow Gates

Smoke:
- `/auth` renders.
- `/admin` redirects to `/auth` without admin session.
- `/api/auth/session` returns unauthenticated shape without server crash.

Auth:
- sign-up validates strict JSON.
- sign-in creates opaque `yoncom_session` and readable `yoncom_csrf`.
- sign-out deletes server session and clears cookies.

Malicious requests:
- missing `Origin` blocked.
- cross-origin `Origin` blocked.
- missing JSON content type blocked.
- missing CSRF blocked.
- missing `Idempotency-Key` blocked.
- customer cannot read other table/order.

Order/payment:
- client table session issued only for active table context.
- create order decrements stock and creates payment.
- mutation response includes `mutationId`, `revision`, `affectedScopes`.
- payment/deposit match creates revisioned events.

Realtime:
- socket accepts only authorized scope.
- client messages limited to `subscribe`, `ack`, `ping`.
- notification payload is hint only.
- reconnect after stale revision calls sync and receives events or snapshot.

Concurrency:
- status transition compare-and-set returns one success and one conflict.
- stock race permits only available quantity.
- vacate blocks unfinished orders.
- failed mutation emits no event.

## Current Local Smoke Result

2026-05-24:

- `browser:browser` connected to Codex in-app Browser and opened `http://localhost:3000/auth`.
- `next dev` was not usable for Browser smoke because Watchpack hit `EMFILE` and `/auth` returned 404.
- `next start` emitted `[yoncom-trace]` server logs.
- Local D1 is not migration-ready: `sessions` table is missing, so auth/session render path fails before interactive auth workflow.
- Client table workflow also needs migrated/seeded local D1 because `tableContexts` is missing.

Next Browser pass requires applying migrations and fixture data first.
