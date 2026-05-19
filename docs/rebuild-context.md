# Yoncom Order Rebuild Context

## Current Source Of Truth

- `apps/next`: Next.js App Router application, API routes, UI, tests, and dummy seed script.
- `packages/db`: Drizzle schema and migration SQL.
- `packages/shared`: request/response contracts shared by the Next app.

The previous Worker API and Remix UI implementations have been removed from the active workspace. New work should be implemented in `apps/next` unless it is a shared schema/type change.

## Runtime

- App: `pnpm dev`
- Production build: `pnpm build`
- Tests: `pnpm test`
- Typecheck: `pnpm typecheck`
- Dummy data: `pnpm seed:dummy`
- DB schema generation/migration: `pnpm db:generate`, `pnpm db:migrate`

DB-backed routes and seed scripts require:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_DATABASE_ID`
- `CLOUDFLARE_D1_TOKEN`

## Implemented Operating Model

- Customer ordering uses `clientOrderId` idempotency.
- Payment requests use `expectedTransferAmount = originalAmount - paymentCode`.
- `paymentCode` leases use the smallest available code in `1..99` and are released on paid/cancelled/expired/refunded terminal flows where applicable.
- Bank deposits are ingested through `bankTransactions`; exact single matches can auto-pay, ambiguous matches require POS review.
- Menu order lifecycle is `PENDING -> READY -> PICKED_UP`.
- Unpaid `PENDING` menu rows are displayed as `입금 대기`, not kitchen work.
- Kitchen views only show active orders with `payment.status === "PAID"` and `menuOrder.status === "PENDING"`.
- Paid cancellation creates `REFUND_PENDING`; refund completion changes the payment to `REFUNDED`.
- `REFUND_PENDING` blocks table vacate until refund completion.
- Admin API routes and `/admin/*` pages require an admin session.

## Current Known Non-Core Features

These routes intentionally return `FEATURE_UNAVAILABLE` until a dedicated Next runtime storage/reporting design is added:

- `GET /image/:filename`
- `PUT /api/admin/image`
- `GET /api/admin/payout`
- `GET /api/admin/menu/:menuId`

They are no longer migration placeholders; they are disabled optional features outside the current festival POS core flow.
