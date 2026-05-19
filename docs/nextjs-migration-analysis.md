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
- Root `pnpm run dev` now starts `web-next`.
- Legacy Remix/Hono dev commands are preserved as `pnpm run dev:legacy` and `pnpm run dev:legacy:local`.
- Root `pnpm run build` now builds `web-next`; the old concurrent build is preserved as `pnpm run build:legacy`.
- `pnpm --filter web-next typecheck` passes.
- `pnpm --filter web-next build` passes.
- `pnpm run dev` starts successfully at `http://localhost:3000`.
- `pnpm run build` passes.
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

## Migration Progress - 2026-05-18 UI Slice

Started the real UI migration on `codex/nextjs-migration`.

Migrated into `apps/next`:

- Legacy Tailwind/shadcn-style UI foundation: `components/ui`, `hooks`, `stores`, `lib/date`, `lib/utils`, `lib/ky-error-handler`.
- Next-compatible same-origin client query/auth helpers: `apps/next/lib/query.ts`, `apps/next/lib/auth.ts`.
- Route UI parity shells for `/auth`, `/client/table/[id]`, `/admin/pos`, and `/admin/cooker`.
- Admin polling wrapper via `app/admin/layout.tsx` and `app/admin/admin-data-loader.tsx`.
- Tailwind v3/PostCSS config for the copied legacy class names.
- Initial DB-backed read-only API ports for `GET /api/menu`, `GET /api/table`, `GET /api/admin/menu`, and `GET /api/admin/table`.
- Lazy Cloudflare D1 HTTP adapter in `apps/next/lib/server/db.ts` for Next server runtimes that do not expose Wrangler `c.env.DB`.

Current behavior:

- The routes now render the actual legacy screen structure instead of the previous migration status panels.
- Client stores call same-origin `/api/*` paths instead of `shared/constants` production API URLs.
- `NEXT_MIGRATION_NOT_IMPLEMENTED` responses are treated as expected migration placeholders in the app toast handler.
- Read-only menu/table API handlers are implemented. After correcting `CLOUDFLARE_ACCOUNT_ID`, `GET /api/menu`, `GET /api/admin/menu`, and `GET /api/admin/table` return 200 against D1.
- The live D1 database uses legacy `tableContext` while the current schema expects `tableContexts`; the Next read-only table query now detects both names and returns the app-facing `tableContexts` relation shape.
- Core mutation API handlers are now DB-backed for order creation/cancellation, admin payment/deposit/complete/cancel, table create/update/remove/occupy/vacate, menu create/update/remove, and menu category create/update/remove.
- Remaining explicit placeholders include image upload, payout, and the legacy read-only order detail/list routes that are not yet used by the migrated primary screens.
- Auth sign-in, sign-up, sign-out, and session checks are now implemented in the Next workspace with a local `yoncom_session` cookie.
- `/` redirects directly to `/admin/pos`; the migration/status landing copy is removed from the runtime path.
- Invalid client table IDs are rejected in the client route before calling `/api/table`, which avoids noisy invalid-request errors for malformed URLs and clears stale client table state.
- Admin POS keeps the legacy three-column layout on desktop and stacks orders, tables, and inventory at narrow in-app Browser widths.
- `pnpm run seed:dummy` upserts a realistic `demo_` D1 fixture: admin user, menus, menu categories, tables, active/closed contexts, paid/unpaid orders, payments, and menu-order states.
- Cooker now auto-monitors paid pending menu orders and uses a responsive narrow-width layout.
- The new D1 mutation compatibility layer detects live schema differences before writes, including singular `tableContext`, legacy `userId` columns, and payments with either `orderId` or order-id-as-payment-id.
- POS table count now excludes soft-deleted tables from the denominator; table mutations reload the store after successful writes.

Verification:

- Added Vitest network/unit tests for the Next migration workspace:
  - client-side `queryStore` API request/response behavior
  - Cloudflare D1 HTTP request/response adapter behavior
  - invalid D1 account id rejection and D1 client rebuild when env values change during a dev session
  - table relation query simulation, including legacy `tableContext` compatibility
  - implemented Next route handler response behavior
  - all not-yet-migrated API route contracts returning explicit 501 placeholders
- `pnpm --filter web-next typecheck` passed.
- `pnpm --filter web-next build` passed.
- `pnpm run test` passed with 23 tests after replacing migrated placeholder contracts with focused mutation route tests.
- Codex in-app Browser smoke verified `/auth` login, `/admin/pos`, `/admin/cooker`, `/client/table/demo_table_win1`, menu detail modal opening, and image loading under the Next dev server at `http://localhost:3000`.
- Codex in-app Browser interaction verification confirmed click/input-to-D1 write paths for client order creation, POS payment, cooker completion, table occupy/vacate/create/update/remove, and menu create/update/remove.
- `next start --port 3001` verified the read-only route handlers load root env variables and return 200 for menu/table list routes.
- A later localhost:3000 DBQuery error was traced to the long-running dev server keeping stale D1 env/client state after `.env.local` changed. `apps/next/lib/server/db.ts` now reloads local root `.env`/`.env.local` D1 keys in non-production server runtime and rebuilds the cached D1 client when the config changes.

Next migration slice:

- Port the remaining non-primary API routes: image upload/storage, payout, and legacy order list/detail reads.
- Add real admin authorization checks to all admin write routes. The current auth screen works, but admin route enforcement is still incomplete.
- Decide final storage/runtime target for menu image uploads before replacing the image placeholder.

## Do Not Forget

- Current app has no tests; tests are not optional for the order/payment/table migration.
- The old API relies on Cloudflare bindings. A plain Next/Vercel deployment will not magically have `c.env.DB` or `c.env.R2_BUCKET`.
- The old Remix route file names encode actual URLs through dots and `$id`; preserve the resulting URLs, not the filenames.
- The current shared constants force production URLs. This will break local Next development unless changed.
- Proxy/middleware is not a full auth replacement. Keep real auth checks inside server code that can read sessions and roles.
- Do not make every migrated component a Client Component by default. Use Client Components only for interactive boundaries.
