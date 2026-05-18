# Next.js Migration Analysis

Generated on 2026-05-18 for the `yoncom-order` fork.

This document is the migration memory for moving the deprecated Remix/Hono project into a single-maintainer-friendly Next.js application. Treat this as the compatibility contract until a newer migration document replaces it.

## Source Of Truth

- Current repo state, not older ctx memories, is the source of truth.
- Current fork remote: `https://github.com/Croksuter/yoncom-order`
- Current upstream remote: `https://github.com/jhyunwoo/yoncom-order`
- Active migration branch: `codex/nextjs-migration`
- Current baseline commit: `b0d5aba fix multiple ordering-problem`
- Existing generated graph wiki: `.code-review-graph/wiki`
- Existing rebuild baseline: `docs/rebuild-context.md`

Official Next.js references checked:

- App Router: https://nextjs.org/docs/app
- Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Fetching Data: https://nextjs.org/docs/app/getting-started/fetching-data
- Cookies: https://nextjs.org/docs-wip/app/api-reference/functions/cookies
- Proxy: https://nextjs.org/docs/app/getting-started/proxy

## Current Architecture

The project is currently a pnpm monorepo:

- `apps/web`: Remix + Vite + React UI.
- `apps/api`: Hono API on Cloudflare Workers via Wrangler.
- `packages/db`: Drizzle schema and Cloudflare D1 migrations.
- `packages/shared`: Zod request schemas, response types, and constants.

Runtime assumptions today:

- API expects Cloudflare bindings: `DB` and `R2_BUCKET`.
- DB is Cloudflare D1 through Drizzle.
- Image upload/read depends on Cloudflare R2.
- Auth/session uses Lucia with session storage in the D1 `sessions` table.
- Web calls API through `ky` and `queryStore`.
- The shared constants currently hard-code production URLs:
  - `API_BASE_URL = PROD_API_BASE_URL`
  - `WEB_BASE_URL = PROD_WEB_BASE_URL`

Detected code graph baseline:

- 125 files, 325 nodes, 3112 edges.
- 61 execution flows and 14 communities.
- Risk score: medium.
- No test files detected.

Largest communities:

- `table-handle`: admin POS table/inventory/order UI.
- `order-handle`: client table ordering UI.
- `lib-query`: API DB/query helpers.
- `components-menu`: admin cooker UI.
- `lib-filter`: web auth/query/filter utilities.
- `admin-admin`: admin API controllers.

## Current Web Route Contract

Preserve these user-facing routes unless the migration explicitly adds redirects:

| Current Remix file | Current path | Next.js App Router target |
| --- | --- | --- |
| `apps/web/app/routes/_index.tsx` | `/` | `app/page.tsx` |
| `apps/web/app/routes/auth/route.tsx` | `/auth` | `app/auth/page.tsx` |
| `apps/web/app/routes/admin/route.tsx` | `/admin` | `app/admin/layout.tsx` or `app/admin/page.tsx` |
| `apps/web/app/routes/admin.pos/route.tsx` | `/admin/pos` | `app/admin/pos/page.tsx` |
| `apps/web/app/routes/admin.cooker/route.tsx` | `/admin/cooker` | `app/admin/cooker/page.tsx` |
| `apps/web/app/routes/client.table.$id/route.tsx` | `/client/table/:id` | `app/client/table/[id]/page.tsx` |

The main product surfaces are:

- Customer table ordering: `/client/table/:id`
- Admin POS: `/admin/pos`
- Admin cooker monitor: `/admin/cooker`
- Auth screen: `/auth`

## Current API Contract

Preserve these API paths during migration or provide compatibility redirects/adapters:

| Method | Path | Current owner |
| --- | --- | --- |
| `GET` | `/api` | `apps/api/src/index.ts` |
| `GET` | `/image/:filename` | `apps/api/src/index.ts` |
| `POST` | `/api/auth/sign-up` | `apps/api/src/routes/auth.ts` |
| `POST` | `/api/auth/sign-in` | `apps/api/src/routes/auth.ts` |
| `POST` | `/api/auth/sign-out` | `apps/api/src/routes/auth.ts` |
| `GET` | `/api/auth/session` | `apps/api/src/routes/auth.ts` |
| `GET` | `/api/menu` | `apps/api/src/routes/menu.ts` |
| `GET` | `/api/table` | `apps/api/src/routes/table.ts` |
| `POST` | `/api/order` | `apps/api/src/routes/order.ts` |
| `GET` | `/api/order/:tableId` | `apps/api/src/routes/order.ts` |
| `GET` | `/api/order/:tableId/:orderId` | `apps/api/src/routes/order.ts` |
| `DELETE` | `/api/order` | `apps/api/src/routes/order.ts` |
| `GET` | `/api/admin/menu` | `apps/api/src/routes/admin/menu.ts` |
| `GET` | `/api/admin/menu/:menuId` | `apps/api/src/routes/admin/menu.ts` |
| `POST` | `/api/admin/menu` | `apps/api/src/routes/admin/menu.ts` |
| `PUT` | `/api/admin/menu` | `apps/api/src/routes/admin/menu.ts` |
| `DELETE` | `/api/admin/menu` | `apps/api/src/routes/admin/menu.ts` |
| `POST` | `/api/admin/menuCategory` | `apps/api/src/routes/admin/menuCategory.ts` |
| `PUT` | `/api/admin/menuCategory` | `apps/api/src/routes/admin/menuCategory.ts` |
| `DELETE` | `/api/admin/menuCategory` | `apps/api/src/routes/admin/menuCategory.ts` |
| `GET` | `/api/admin/table` | `apps/api/src/routes/admin/table.ts` |
| `POST` | `/api/admin/table` | `apps/api/src/routes/admin/table.ts` |
| `PUT` | `/api/admin/table` | `apps/api/src/routes/admin/table.ts` |
| `PUT` | `/api/admin/table/occupy` | `apps/api/src/routes/admin/table.ts` |
| `PUT` | `/api/admin/table/vacate` | `apps/api/src/routes/admin/table.ts` |
| `DELETE` | `/api/admin/table` | `apps/api/src/routes/admin/table.ts` |
| `PUT` | `/api/admin/order` | `apps/api/src/routes/admin/order.ts` |
| `PUT` | `/api/admin/order/cancel` | `apps/api/src/routes/admin/order.ts` |
| `PUT` | `/api/admin/order/complete` | `apps/api/src/routes/admin/order.ts` |
| `DELETE` | `/api/admin/order` | `apps/api/src/routes/admin/order.ts` |
| `POST` | `/api/admin/deposit` | `apps/api/src/routes/admin/deposit.ts` |
| `GET` | `/api/admin/payout` | `apps/api/src/routes/admin/payout.ts` |
| `PUT` | `/api/admin/image` | `apps/api/src/routes/admin/image.ts` |

Important API mismatch points:

- `GET /api` currently mutates every user to `ADMIN`. This is marked `TODO: Remove this line in production`. Do not port this side effect.
- `GET /image/:filename` is outside `/api` and reads from `R2_BUCKET`. Keep the URL or redirect existing image URLs.
- `/api/admin/image` returns image URLs under `https://image.yoncomorder.moveto.kr/`.
- Admin routes import `protectRoute`, but detected usage shows the import only. Authorization is likely incomplete and must be fixed during migration, not preserved as-is.

## Database Model

Current Drizzle schema tables:

- `sessions`
- `users`
- `menuCategories`
- `menus`
- `tables`
- `tableContexts`
- `orders`
- `payments`
- `menuOrders`

Domain semantics to preserve:

- Soft delete is represented through `deletedAt`.
- Table occupancy is represented by active/inactive `tableContexts`, also checked through `deletedAt`.
- Orders link to a `tableContext`.
- Payments link to an order and track `paid`, `amount`, `bank`, and `depositor`.
- Menu stock is decremented when orders are created and restored when orders/menuOrders are removed or cancelled.
- Admin cooker flow uses `menuOrders.status` values such as order progress/completion.

Migration warning:

- Cloudflare D1 bindings do not exist automatically in a normal Next.js deployment. Before implementing all API routes in Next, choose one runtime strategy:
  - Deploy Next.js where D1/R2 bindings are available through a Cloudflare-compatible adapter/runtime.
  - Move persistence/object storage to a provider that works naturally with the chosen Next host.
  - Use a phased migration where Next.js first replaces the web app while the Hono API remains external.

## Auth And Session Behavior

Current behavior:

- `authProvider` runs globally in Hono.
- Lucia validates the session cookie and sets `session` and `user` on Hono context.
- Fresh sessions rewrite `Set-Cookie`.
- `createSession` sets `sameSite = "none"` and `secure = true`.
- Web `requireUser(request)` forwards the incoming cookie to `/api/auth/session`.
- Web auth actions call `/api/auth/sign-in`, `/api/auth/sign-up`, and `/api/auth/sign-out` through `queryStore`.

Next.js migration rules:

- Implement session logic as server-only helpers and Route Handlers.
- Use Next's `cookies()` in Server Components, Server Functions, and Route Handlers.
- Do not put slow DB-backed auth checks in `proxy.ts`. Next Proxy is suitable for lightweight request checks and redirects, not full authorization.
- Admin authorization must be explicit on every admin server action/route handler/page loader equivalent.
- Cookie attributes must be reviewed because same-site behavior may change when the API and UI become same-origin.

## Shared Contracts

`packages/shared` is valuable and should remain the migration contract:

- Request schemas are Zod-based.
- Response types exist for client/admin menu, table, order, auth, deposit, image, and error flows.
- Existing route validators use schemas such as:
  - `AuthRequest.signUpValidation`
  - `AuthRequest.signInValidation`
  - `ClientMenuRequest.getValidation`
  - `ClientOrderRequest.createValidation`
  - `AdminTableRequest.occupyValidation`
  - `AdminOrderRequest.completeValidation`
  - `AdminImageRequest.uploadValidation`

Next.js target:

- Keep schema validation at the Route Handler/Server Action boundary.
- Preserve request and response type names during the first migration pass.
- Only rename contracts after parity tests exist.

## Client State And UI Behavior

Current UI relies heavily on client-side interactivity:

- Zustand stores under `apps/web/app/stores`.
- Modal-heavy admin POS and customer cart/order flows.
- `queryStore` wraps `ky` calls and centralizes error handling.
- `toast` is a graph bridge node and used across many flows.
- Radix UI primitives and custom UI components are used throughout.

Next.js mismatch risks:

- App Router pages/layouts are Server Components by default.
- Components using Zustand, hooks, event handlers, browser APIs, or modal state must be Client Components with `"use client"`.
- Do not put `"use client"` at the root layout unless necessary; it will pull too much into the client bundle.
- Prefer Server Components for initial table/menu/order loads, then pass serializable props into Client Components for interactive modals.
- Mutations can be kept as API Route Handler calls initially, then considered for Server Actions after behavior is covered by tests.

## Business Logic Hotspots

Protect these flows first:

- `createOrder` in `apps/api/src/controller/order.controller.ts`
  - Checks active table context.
  - Rejects new orders when unpaid order exists.
  - Reads menus and decrements quantities.
  - Inserts order, menuOrders, and payment.
  - Currently large and highly connected.
- `removeOrder` and admin order delete/cancel flows
  - Restore menu quantities.
  - Soft-delete orders/menuOrders.
  - Reject deletion of paid orders.
- Admin table flows
  - Create/remove/update table.
  - Occupy/vacate table through table context state.
- Client cart/order modals
  - `CartModal`, `CartAddModal`, `OrderModal`, `OrderUpdateModal`, and `OrderHistoryModal`.
- Admin POS modals
  - Inventory create/detail, table create/update/detail, order detail/cancel.

Known graph hotspots and bridge nodes:

- `createOrder`
- `CartModal`
- `InventoryDetailModal`
- `InventoryCreateModal`
- `OrderHistoryModal`
- `toast`
- `queryStore`
- `kyErrorHandler`
- `useValidateOrder`
- `cn`
- `initializeDb`

## Current Problems And Gaps

Critical:

- No tests were detected.
- `GET /api` has a production-dangerous side effect that promotes users to admin.
- Admin route authorization appears incomplete: `protectRoute` is imported but not applied.
- DB/order creation behavior appears non-transactional despite stock decrement + order/payment writes.

High:

- Production API/web base URLs are hard-coded in shared constants.
- Cloudflare-specific bindings (`DB`, `R2_BUCKET`) are tightly coupled to API implementation.
- Route handlers return mixed error shapes and status behavior through controller results.
- Large modal components combine UI, form state, API calls, and domain branching.

Medium:

- Several console logs/debug statements remain in API/domain helpers.
- TODO markers remain for Toss transfer account configuration.
- File upload/image URL behavior is coupled to a dedicated image domain.
- `node_modules` is not installed at analysis time, so type/build state is unknown.

## Next.js Migration Strategy

Use App Router. Do not migrate to the legacy Pages Router.

Migration has started in `apps/next`:

- Next.js version: `16.2.6`
- React version: `19.2.6`
- Route contracts have skeleton Route Handlers under `apps/next/app/api` and `apps/next/app/image/[filename]/route.ts`.
- User-facing route shells exist for `/`, `/auth`, `/admin`, `/admin/pos`, `/admin/cooker`, and `/client/table/[id]`.
- `pnpm --filter web-next typecheck` passes.
- `pnpm --filter web-next build` passes.
- Browser smoke check passed for `/`, `/admin/pos`, `/client/table/demo-table`, and `/api`.
- `GET /api` now returns a non-mutating migration health response in the Next workspace.
- `POST /api/order` currently returns a typed `501 NEXT_MIGRATION_NOT_IMPLEMENTED` placeholder that marks `createOrder` as the protected hotspot.
- Full `pnpm install` currently fails on Node `26.0.0` because existing root dependency `better-sqlite3@11.10.0` fails native compilation. The Next workspace was linked with `pnpm install --filter web-next --ignore-scripts` for migration verification.

Recommended structure for a low-risk migration:

```text
app/
  page.tsx
  auth/page.tsx
  admin/layout.tsx
  admin/pos/page.tsx
  admin/cooker/page.tsx
  client/table/[id]/page.tsx
  api/
    auth/sign-in/route.ts
    auth/sign-up/route.ts
    auth/sign-out/route.ts
    auth/session/route.ts
    menu/route.ts
    table/route.ts
    order/route.ts
    order/[tableId]/route.ts
    order/[tableId]/[orderId]/route.ts
    admin/...
  image/[filename]/route.ts
lib/
  server/
    db.ts
    auth.ts
    storage.ts
    orders.ts
    tables.ts
  client/
    query.ts
    stores/
components/
  ui/
  client/
  admin/
```

Implementation principles:

- Extract business logic from Hono controllers into framework-agnostic server functions before wiring Next Route Handlers.
- Keep Zod schemas from `packages/shared` as the validation layer.
- Initialize DB/storage clients lazily inside server-only getter functions, not at module scope.
- Use relative same-origin API paths after web and API are unified.
- Keep API endpoint parity first; refactor UI after route behavior matches.
- Add characterization tests before changing order/table/payment logic.

## Phased Plan

Phase 0: Baseline

- Run `pnpm install`.
- Run current typecheck/build commands and record failures.
- Add smoke tests or characterization tests around order creation, table lookup, auth/session, and admin authorization.

Phase 1: Create Next app without deleting old apps

- Prefer creating a new `apps/next` or `apps/web-next` until parity is reached.
- Reuse `packages/db` and `packages/shared`.
- Configure TypeScript path aliases deliberately.
- Add server-only DB/auth/storage wrappers.

Phase 2: API parity

- Port Hono endpoints to Next Route Handlers.
- Preserve URL contracts.
- Remove the `/api` admin-promotion side effect.
- Add explicit admin authorization checks.
- Keep response shapes compatible with existing stores.

Phase 3: Web route parity

- Port `/auth`.
- Port `/client/table/[id]`.
- Port `/admin/pos`.
- Port `/admin/cooker`.
- Keep modal/state behavior in Client Components.
- Move initial data loading to Server Components where it reduces client fetch complexity.

Phase 4: Runtime consolidation

- Decide final deployment runtime and DB/storage provider.
- Replace hard-coded shared constants with environment-driven config or relative same-origin paths.
- Remove old Remix/Hono apps only after the Next app passes route/API parity checks.

Phase 5: Cleanup

- Split large modal components only after behavior is covered.
- Normalize error response shapes.
- Remove debug logs.
- Re-run code graph and update this document.

## Acceptance Checklist

Before considering migration equivalent:

- `/auth` can sign up, sign in, preserve session, and sign out.
- `/client/table/:id` loads table/menu data.
- Customer can add menu items to cart and create an order.
- Unpaid-order guard still prevents duplicate active unpaid orders.
- Menu quantities decrement on order creation and restore on cancellation/deletion.
- Admin can create/update/delete menu categories and menus.
- Admin can upload menu images and existing image URLs still resolve.
- Admin can create/update/remove/occupy/vacate tables.
- Admin POS can inspect/cancel/pay/complete orders.
- Cooker screen can see and update menu order status.
- Admin routes reject unauthenticated/non-admin users.
- Health endpoint has no data mutation.
- Typecheck and production build pass.

## Do Not Forget

- Current app has no tests; tests are not optional for the order/payment/table migration.
- The old API relies on Cloudflare bindings. A plain Next/Vercel deployment will not magically have `c.env.DB` or `c.env.R2_BUCKET`.
- The old Remix route file names encode actual URLs through dots and `$id`; preserve the resulting URLs, not the filenames.
- The current shared constants force production URLs. This will break local Next development unless changed.
- Proxy/middleware is not a full auth replacement. Keep real auth checks inside server code that can read sessions and roles.
- Do not make every migrated component a Client Component by default. Use Client Components only for interactive boundaries.
