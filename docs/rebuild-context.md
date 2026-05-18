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
- Runtime data is not migrated yet: most `/api/*` route handlers still return `NEXT_MIGRATION_NOT_IMPLEMENTED`, so migrated screens render structure but do not load real DB-backed rows.
- Read-only menu/table API handlers have been started in Next with a lazy Cloudflare D1 HTTP adapter. After correcting `CLOUDFLARE_ACCOUNT_ID`, menu/admin-menu/admin-table list routes return 200. The live D1 schema still has legacy `tableContext`, so Next currently bridges it to the app-facing `tableContexts` shape in read-only queries.
- Next migration notes and the next API-porting order are recorded in `docs/nextjs-migration-analysis.md`.
