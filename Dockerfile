FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/next/package.json ./apps/next/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app

COPY . .

ARG NEXT_PUBLIC_YONCOM_TRACE=0
ARG NEXT_PUBLIC_REALTIME_SOCKET_URL=
ENV NEXT_PUBLIC_YONCOM_TRACE=$NEXT_PUBLIC_YONCOM_TRACE
ENV NEXT_PUBLIC_REALTIME_SOCKET_URL=$NEXT_PUBLIC_REALTIME_SOCKET_URL
ENV NODE_ENV=production

RUN pnpm --filter web-next build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/apps/next/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/next/.next/static ./apps/next/.next/static

RUN rm -rf /app/apps/next/test

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/next/server.js"]
