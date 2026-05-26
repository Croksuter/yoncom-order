# YONCOM-ORDER

Next.js 기반 대학 축제 부스 운영용 주문/POS 시스템입니다. 현재 실행 경로는 Next.js App Router 단일 앱이며 고객 QR 주문, 관리자 POS, 주방 모니터, 재고/카테고리 관리, 결제/환불 상태 추적을 다룹니다.

## Active Workspace

- `apps/next`: Next.js App Router app, API routes, UI, tests, and dummy seed script.
- `apps/kb-bank-webhook`: standalone Python Selenium DOM watcher that reuses a manually logged-in KB browser screen and posts parsed deposit rows to the Yoncom deposit route.
- `packages/db`: Drizzle schema and migrations.
- `packages/shared`: shared request/response contracts used by the Next app.

## Core Flow

- Customer tables enter through `/client/table/:id` after an admin activates the table context.
- Admin operators use `/admin/pos` for orders, tables, inventory, deposit matching, pickup, and refund handling.
- Kitchen operators use `/admin/cooker` for paid pending menu orders.
- Payments use per-order `paymentCode` leases and `expectedTransferAmount = originalAmount - paymentCode`.
- Bank deposit ingestion can be driven by the standalone `apps/kb-bank-webhook` bridge, which clicks the KB query screen, parses deposit rows from the DOM, and posts parsed deposits to `/api/admin/deposit`.
- Menu and category records keep Korean `name`/`description` plus optional English `nameEn`/`descriptionEn`; the client table supports runtime Korean/English switching through `useTranslation` and `language.store`.

## Start Project

1. Install dependencies
   ```bash
   pnpm install
   ```

2. Copy and edit environment variables
   ```bash
   cp .env.example .env.local
   ```

3. Generate or apply DB migrations when schema changes
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

4. Seed realistic demo data when needed
   ```bash
   pnpm seed:dummy
   ```

5. Move existing menu image references into D1 when needed
   ```bash
   pnpm migrate:images
   ```

6. Run the app
   ```bash
   pnpm dev
   ```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm verify:realtime
git diff --check
```

Browser workflow verification should follow `docs/verification/realtime-verification-pipeline.md` and use the Codex in-app Browser surface.

## Docker and Dokploy

The deployable container is the Next.js web/API app only. The KB Bank Selenium bridge stays outside the image because it needs a user-operated Chrome session, a reusable browser profile, local state, and run logs.

Build and smoke locally:

```bash
docker build -t yoncom-order:local .
docker run --env-file .env.local -p 3000:3000 yoncom-order:local
curl http://localhost:3000/api
```

Dokploy should use a GitHub application with Dockerfile build type:

- Repository branch: `main`
- Dockerfile path: `/Dockerfile`
- Exposed port: `3000`
- Domain: `yoncom-order.croksuter.com`
- Health check: `GET /api`
- Auto Deploy: enabled

Keep secrets out of Docker build args and source control. In Dokploy, set runtime environment variables for:

```text
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=
REALTIME_NOTIFY_URL=
REALTIME_NOTIFY_SECRET=
```

Uploaded menu images are center-cropped to a square using the shorter original
side, converted to PNG, and stored in Cloudflare D1, so no container volume or
image upload directory is required.

Only public, client-bundled values may be provided as build args:

```text
NEXT_PUBLIC_YONCOM_TRACE=0
NEXT_PUBLIC_REALTIME_SOCKET_URL=
```

For the KB bridge worker, set `YONCOM_APP_BASE_URL=https://yoncom-order.croksuter.com`. The bridge uses Python `requests`, so browser CORS does not apply, but the app's Origin guard still requires the request URL and `Origin` header to use the same public Yoncom base URL.
