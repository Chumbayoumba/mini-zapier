FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY . .
RUN cd apps/backend && npx prisma generate && pnpm run build

FROM base AS runner

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 backend

ENV NODE_ENV=production

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
