# Yoncom Order Rebuild Context

Generated on 2026-05-18 before new rebuild work.

## Baseline

- Repository: `/Users/choehoyeong/Documents/development/yoncom-order`
- Current git commit: `b0d5aba fix multiple ordering-problem`
- Current worktree was clean before this document was added.
- Dependency lockfile exists, but `node_modules` is not installed.
- Existing ctx memory from 2026-05-16 references a different/stale app shape. Current filesystem and the fresh code graph below are the active baseline.

## Context Index

context-mode has indexed fresh summaries for:

- workspace/package scripts and dependency surfaces
- API route files, controller exports, web route files, and database schema markers
- environment variable references and `.env.example`
- TODO/deprecated/legacy markers
- test file inventory

Important indexed facts:

- Monorepo managed by `pnpm-workspace.yaml`
- Apps: `apps/api`, `apps/web`
- Packages: `packages/db`, `packages/shared`
- Web app: Remix + Vite + React
- API app: Hono on Cloudflare Workers/Wrangler
- Persistence: Drizzle ORM with Cloudflare D1 migrations
- Test files currently detected: `0`

## Code Graph

Fresh full code graph rebuild completed:

- Files parsed: `125`
- Nodes: `329`
- Edges: `3123`
- Execution flows: `61`
- Communities: `14`
- Risk score: `medium (0.55)`
- Generated wiki: `.code-review-graph/wiki`

Largest graph communities:

- `table-handle`: admin POS table/inventory/order UI
- `order-handle`: client table ordering UI
- `lib-query`: API DB/query helpers
- `components-menu`: admin cooker UI
- `lib-filter`: web auth/query/filter utilities
- `admin-admin`: admin API controllers

Critical execution flows:

- `POS`
- `Auth`
- `CartAddModal`
- `CartModal`
- `OrderUpdateModal`
- `queryOrders`
- `handleRequest`
- `Client`
- `MenuAddModal`

## Architecture Shape

The project is a small ordering platform split into:

- Client ordering route: `apps/web/app/routes/client.table.$id/route.tsx`
- Admin POS route: `apps/web/app/routes/admin.pos/route.tsx`
- Admin cooker route: `apps/web/app/routes/admin.cooker/route.tsx`
- Auth route: `apps/web/app/routes/auth/route.tsx`
- API routes under `apps/api/src/routes`
- API controllers under `apps/api/src/controller`
- DB schema and migrations under `packages/db`
- Shared request/response validation types under `packages/shared`

Database schema markers include:

- `sessions`
- `users`
- `menuCategories`
- `menus`
- `tables`
- `tableContexts`
- `orders`
- `payments`
- `menuOrders`

## Rebuild Risks

- No tests were detected. Rebuild work needs at least smoke/type/build coverage before behavior changes.
- `createOrder` is both large and highly connected. Treat order creation as a critical domain path.
- Client cart/order modal components are large, stateful, and graph hotspots.
- Admin POS inventory/table/order modal components are large and tightly coupled to shared UI primitives.
- `queryStore`, `toast`, `useToast`, `kyErrorHandler`, `cn`, and `useValidateOrder` are bridge nodes. Small changes there can affect many screens.
- Cloudflare D1/Wrangler and local SQLite/better-sqlite3 behavior need explicit environment setup before runtime verification.
- TODO markers remain for Toss transfer account configuration and an API production cleanup note.

## Suggested Rebuild Order

1. Restore install/build baseline: `pnpm install`, then typecheck/build per workspace.
2. Verify API local runtime and D1 migration path before UI changes.
3. Add minimal smoke tests around order creation, table lookup, auth/session, and client cart validation.
4. Refactor or stabilize `createOrder` only after coverage exists.
5. Rebuild UI flows by vertical slice: auth, client table ordering, admin POS, cooker.
6. Re-run `build_or_update_graph` and context-mode indexing after each major slice.

## 2026-05-18 Next.js Migration Slice

- `apps/next` now renders migrated legacy UI for `/auth`, `/client/table/[id]`, `/admin/pos`, and `/admin/cooker`.
- Copied the legacy UI primitives, hooks, Zustand stores, route component trees, Tailwind config, and same-origin client query/auth helpers into the Next workspace.
- `pnpm --filter web-next typecheck` and `pnpm --filter web-next build` pass after this slice.
- Added `pnpm run test` for the Next migration workspace. Current Vitest suite covers client API calls, D1 HTTP query traffic, table relation response shaping, implemented route handlers, and placeholder API contracts.
- Fixed the test-vs-runtime gap where Vitest used fresh stubbed D1 env values but the long-running Next dev server kept a stale cached D1 client after `.env.local` edits. The Next server D1 adapter now reloads local D1 env keys and rebuilds the cached client when values change.
- Runtime data is not migrated yet: most `/api/*` route handlers still return `NEXT_MIGRATION_NOT_IMPLEMENTED`, so migrated screens render structure but do not load real DB-backed rows.
- Read-only menu/table API handlers have been started in Next with a lazy Cloudflare D1 HTTP adapter. After correcting `CLOUDFLARE_ACCOUNT_ID`, menu/admin-menu/admin-table list routes return 200. The live D1 schema still has legacy `tableContext`, so Next currently bridges it to the app-facing `tableContexts` shape in read-only queries.
- Next migration notes and the next API-porting order are recorded in `docs/nextjs-migration-analysis.md`.
- Browser verification now uses the Codex in-app Browser plugin (`plugin://browser@openai-bundled`) through `node_repl`, not the standalone Playwright MCP surface.
- `/` now redirects to `/admin/pos` so the dev server opens the actual service screen instead of a migration/status page.
- `/client/table/[id]` now rejects invalid non-15-character table IDs client-side before firing `/api/table`, preventing noisy invalid-request errors and stale table state.
- The POS layout keeps its three-column desktop shape at `lg` and stacks orders/tables/inventory on narrow in-app Browser widths so Korean headings and controls do not wrap vertically.

## 2026-05-19 Dummy Runtime Fixture

- Added `pnpm run seed:dummy`, which upserts realistic `demo_` D1 rows without deleting existing data.
- Current fixture rows: 1 admin user, 3 menu categories, 6 menus with real image URLs, 4 tables, 3 table contexts, 3 orders, 3 payments, and 7 menu-order rows.
- Demo login: `demo.admin@yoncom.local` / `demo-admin-1234`.
- Demo routes: `/admin/pos`, `/admin/cooker`, `/client/table/demo_table_win1`, `/client/table/demo_table_fam1`.
- Implemented minimal Next auth routes for sign-in, sign-up, sign-out, and session cookie checks so the auth screen can be browser-tested.
- Updated cooker defaults to auto-monitor paid pending menu orders, and made cooker cards responsive in the in-app Browser narrow viewport.
- Verified in Codex in-app Browser that POS, cooker, client table, menu detail modal, and auth login render and respond using the dummy data.

## 2026-05-19 Mutation Runtime Slice

- Implemented DB-backed Next Route Handler mutations for client order create/cancel, admin order pay/cancel/complete, deposit matching, table create/update/remove/occupy/vacate, menu create/update/remove, and menu category create/update/remove.
- Added `apps/next/lib/server/d1-mutations.ts` as the D1 write compatibility layer. It detects the live legacy schema (`tableContext`, optional `userId`, payments with or without `orderId`, optional `method/bank/depositor`) and filters inserts/updates to existing columns.
- Client table mutations now reload admin table data after successful writes, so POS state follows D1 state without a manual refresh.
- Fixed POS table count to use active non-deleted tables for the total, avoiding `(2/5)` after soft-deleting a table.
- Fixed cart submission so failed validation or failed order creation resets the in-progress state instead of leaving the order button stuck.
- Fixed POS occupied-table amount calculation to multiply item price by quantity.
- Added mutation route tests that simulate D1 HTTP requests for order creation, deposit payment, and legacy `userId` table inserts.
- Browser-verified actual UI click/input flows against live D1 on `localhost:3000`:
  - client menu add-to-cart and `주문하기` created an unpaid D1 order, decremented stock, and appeared in POS
  - POS `결제` marked the matching payment paid and moved the order to cooking state
  - cooker `조리 완료` changed the menu order status to `SERVED`
  - POS table detail `비활성화` cleared the active table context after all menu orders were served
  - POS menu create/update/remove persisted a menu row and then soft-deleted it
  - POS table create/update/occupy/vacate/remove persisted table rows/contexts and then soft-deleted the table
