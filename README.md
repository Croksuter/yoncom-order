# YONCOM-ORDER

Next.js 기반 대학 축제 부스 운영용 주문/POS 시스템입니다.

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

## Active Workspace

- `apps/next`: Next.js App Router app, API routes, UI, tests, and dummy seed script.
- `packages/db`: Drizzle schema and migrations.
- `packages/shared`: shared request/response contracts used by the Next app.
