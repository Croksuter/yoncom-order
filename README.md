# YONCOM-ORDER

Next.js 기반 대학 축제 부스 운영용 주문/POS 시스템입니다. 현재 실행 경로는 Next.js App Router 단일 앱이며 고객 QR 주문, 관리자 POS, 주방 모니터, 재고/카테고리 관리, 결제/환불 상태 추적을 다룹니다.

## Active Workspace

- `apps/next`: Next.js App Router app, API routes, UI, tests, and dummy seed script.
- `packages/db`: Drizzle schema and migrations.
- `packages/shared`: shared request/response contracts used by the Next app.

## Core Flow

- Customer tables enter through `/client/table/:id` after an admin activates the table context.
- Admin operators use `/admin/pos` for orders, tables, inventory, deposit matching, pickup, and refund handling.
- Kitchen operators use `/admin/cooker` for paid pending menu orders.
- Payments use per-order `paymentCode` leases and `expectedTransferAmount = originalAmount - paymentCode`.
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

5. Run the app
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
