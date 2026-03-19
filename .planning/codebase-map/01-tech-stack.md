# Technology Stack

**Analysis Date:** 2025-01-27

## Languages

**Primary:**
- TypeScript ^5.7.0 — Used across all apps and packages

**Secondary:**
- SQL (PostgreSQL) — via Prisma schema (`apps/backend/prisma/schema.prisma`)
- CSS/Tailwind — frontend styling (`apps/frontend/tailwind.config.ts`)

## Runtime

**Environment:**
- Node.js >=20.0.0 (enforced via `engines` in root `package.json`; Dockerfiles use `node:20-alpine`)

**Package Manager:**
- pnpm 9.15.0 (declared in `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` present

**Monorepo Orchestrator:**
- Turborepo ^2.3.0 — config at `turbo.json`
- Workspace structure defined in `pnpm-workspace.yaml`: `apps/*` + `packages/*`

## Workspace Packages

| Package | Name | Purpose |
|---------|------|---------|
| `apps/backend` | `@minizapier/backend` | NestJS API server (port 3001) |
| `apps/frontend` | `@minizapier/frontend` | Next.js web app (port 3000) |
| `packages/shared` | `@minizapier/shared` | Shared types, constants, utils (Zod schemas) |
| `packages/config/eslint` | — | Shared ESLint configs (directory exists, contents empty/minimal) |
| `packages/config/tsconfig` | — | Shared TypeScript configs (directory exists, contents empty/minimal) |

## Frameworks

### Backend — NestJS 10

**Core Framework:**
- `@nestjs/common` ^10.4.0
- `@nestjs/core` ^10.4.0
- `@nestjs/platform-express` ^10.4.0

**NestJS Ecosystem Modules:**
- `@nestjs/config` ^3.3.0 — Environment/config management with Joi validation
- `@nestjs/jwt` ^10.2.0 — JWT token generation/verification
- `@nestjs/passport` ^10.0.3 — Authentication strategies
- `@nestjs/swagger` ^7.4.0 — OpenAPI docs at `/api/docs`
- `@nestjs/throttler` ^6.3.0 — Rate limiting (60s window, 100 req limit)
- `@nestjs/terminus` ^10.2.0 — Health checks at `/health`
- `@nestjs/event-emitter` ^2.1.0 — Internal event system
- `@nestjs/websockets` ^10.4.0 + `@nestjs/platform-socket.io` ^10.4.0 — Real-time WebSocket
- `@nestjs/bullmq` ^10.2.0 — Job queue integration

**CLI:**
- `@nestjs/cli` ^10.4.0 — Build/dev/scaffolding (`nest-cli.json`)

### Frontend — Next.js 15 + React 19

**Core:**
- `next` ^15.1.0 — App Router, standalone output for Docker
- `react` ^19.0.0 + `react-dom` ^19.0.0

**UI Component System:**
- Radix UI primitives (avatar, dialog, dropdown-menu, label, select, separator, slot, switch, tabs, tooltip)
- `class-variance-authority` ^0.7.0 — Variant-based component styling (shadcn/ui pattern)
- `clsx` ^2.1.0 + `tailwind-merge` ^2.6.0 — Class merging utilities
- `lucide-react` ^0.460.0 — Icon library
- Custom UI components at `apps/frontend/src/components/ui/` (button, card, input, label, badge, textarea)

**Styling:**
- Tailwind CSS ^3.4.0 — with CSS variables-based theming (shadcn/ui approach)
- PostCSS ^8.4.49 + Autoprefixer ^10.4.20
- Dark mode via `next-themes` ^0.4.0 (class strategy)

**State & Data:**
- `@tanstack/react-query` ^5.60.0 — Server state, 60s stale time, 1 retry
- `zustand` ^5.0.0 — Client state (stores at `apps/frontend/src/stores/`)
- `react-hook-form` ^7.53.0 + `@hookform/resolvers` ^3.9.0 — Form management
- `zod` ^3.24.0 — Schema validation (shared with backend via `@minizapier/shared`)

**Visual Workflow Editor:**
- `@xyflow/react` ^12.3.0 — Node-based graph editor for workflow design

**Charts:**
- `recharts` ^2.15.0 — Dashboard analytics

**Notifications:**
- `sonner` ^1.7.0 — Toast notifications (richColors, top-right position)

### Shared Package — `@minizapier/shared`

- `zod` ^3.24.0 — Validation schemas shared between frontend and backend
- Exports: types (workflow, action, execution, trigger, user), constants (node-types, status), utils (helpers, validation)
- Entry point: `packages/shared/src/index.ts`

## Database

**Primary Database:**
- PostgreSQL 15 (Alpine) — via `docker-compose.yml`
- Connection: `DATABASE_URL` env var

**ORM:**
- Prisma ^6.0.0 (`@prisma/client` + `prisma` CLI)
- Schema: `apps/backend/prisma/schema.prisma`
- Seed script: `apps/backend/prisma/seed.ts`
- Models: `User`, `Workflow`, `WorkflowVersion`, `Trigger`, `WorkflowExecution`, `ExecutionStepLog`
- Uses `cuid()` for IDs, `@@map` for snake_case table names
- Indexes on foreign keys and frequently queried columns

**Caching / Job Queue Backend:**
- Redis 7 (Alpine) — via `docker-compose.yml`
- Connection: `REDIS_HOST` + `REDIS_PORT` env vars
- Client: `ioredis` ^5.4.0

## Job Queue

- **BullMQ** ^5.25.0 — Backed by Redis
- Queue name: `workflow-execution`
- Worker: `apps/backend/src/queue/queue.service.ts` (`WorkflowProcessor`)
- Job config: 3 attempts, exponential backoff (5s base), keeps last 100 completed / 200 failed
- Integration: `@nestjs/bullmq` ^10.2.0

## Authentication

**Strategy:** JWT with refresh tokens
- `passport` ^0.7.0 + `passport-jwt` ^4.0.1 + `passport-local` ^1.0.0
- `@nestjs/jwt` ^10.2.0
- Access token: 15m expiry (configurable via `JWT_EXPIRES_IN`)
- Refresh token: 7d expiry (configurable via `JWT_REFRESH_EXPIRES_IN`)
- Password hashing: `bcrypt` ^5.1.1
- Frontend middleware: `jose` ^5.9.0 for edge-compatible JWT verification (`apps/frontend/middleware.ts`)
- Global `JwtAuthGuard` applied via `APP_GUARD` in `apps/backend/src/app.module.ts`

## Real-Time Communication

- **Socket.IO** ^4.8.0 (server) / `socket.io-client` ^4.8.0 (client)
- Gateway: `apps/backend/src/websocket/websocket.gateway.ts`
- Frontend provider: `apps/frontend/src/providers/websocket-provider.tsx`
- Nginx proxying for `/socket.io/` with WebSocket upgrade headers

## HTTP & External APIs

**Server-side HTTP client:**
- `axios` ^1.7.0 + `axios-retry` ^4.4.0 — Used for HTTP Request action nodes

**Frontend API client:**
- `axios` ^1.7.0 — Configured at `apps/frontend/src/lib/api.ts`
- Includes request interceptor (JWT token injection) and response interceptor (401 → auto-refresh)

## Workflow Engine Actions

| Action | Implementation | External Deps |
|--------|---------------|---------------|
| HTTP Request | `apps/backend/src/engine/actions/http-request.action.ts` | `axios`, `axios-retry` |
| Send Email | `apps/backend/src/engine/actions/email.action.ts` | `nodemailer` ^6.9.0 (SMTP) |
| Telegram | `apps/backend/src/engine/actions/telegram.action.ts` | `node-telegram-bot-api` ^0.66.0 |
| Database | `apps/backend/src/engine/actions/database.action.ts` | `@prisma/client` |
| Transform | `apps/backend/src/engine/actions/transform.action.ts` | `jsonata` ^2.0.5 |

## Workflow Triggers

| Trigger | Implementation |
|---------|---------------|
| Webhook | `apps/backend/src/triggers/webhook/` (controller + service + specs) |
| Cron | `apps/backend/src/triggers/cron/cron.service.ts` (uses `node-cron` ^3.0.3, `cron-parser` ^4.9.0) |
| Email (IMAP) | `apps/backend/src/triggers/email/email-trigger.service.ts` (uses `imap` ^0.8.19) |
| Telegram | `apps/backend/src/triggers/telegram/` (controller + service) |

## Security

- `helmet` ^8.0.0 — HTTP security headers (backend)
- `@nestjs/throttler` ^6.3.0 — Rate limiting: 100 req/min globally
- `class-validator` ^0.14.1 + `class-transformer` ^0.5.1 — DTO validation (whitelist, forbidNonWhitelisted, transform)
- Nginx security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy

## Testing

**Runner:** Jest ^29.7.0
- Config: inline in `apps/backend/package.json` (`jest` key)
- Transform: `ts-jest` ^29.2.0
- Path alias: `@/*` → `src/*`
- Test regex: `.*\.spec\.ts$`

**E2E:**
- Config: `apps/backend/test/jest-e2e.json`
- Regex: `.e2e-spec.ts$`
- HTTP testing: `supertest` ^7.0.0

**Existing test files (backend only, 8 spec files):**
- `apps/backend/src/auth/auth.controller.spec.ts`
- `apps/backend/src/auth/auth.service.spec.ts`
- `apps/backend/src/workflows/workflows.service.spec.ts`
- `apps/backend/src/users/users.service.spec.ts`
- `apps/backend/src/executions/executions.service.spec.ts`
- `apps/backend/src/triggers/webhook/webhook.service.spec.ts`
- `apps/backend/src/triggers/webhook/webhook.controller.spec.ts`
- `apps/backend/src/engine/engine.service.spec.ts`

**Frontend:** No test framework detected (no jest/vitest config, no test files)

## Build & Dev Tooling

**Turborepo Tasks** (`turbo.json`):
- `build` — depends on `^build`, outputs `dist/**`, `.next/**`
- `dev` — no cache, persistent
- `test` — depends on `^build`
- `test:cov` — depends on `^build`
- `lint` — no dependencies
- `clean` — no cache

**Formatting:**
- Prettier ^3.4.0 — config at `.prettierrc`
  - Single quotes, semicolons, trailing commas (all)
  - Print width: 100, tab width: 2, LF line endings
- Ignore: `.prettierignore` (node_modules, dist, .next, coverage, .turbo, pnpm-lock.yaml)

**Linting:**
- ESLint (backend): `eslint "{src,apps,libs,test}/**/*.ts" --fix`
- ESLint (frontend): `next lint` (Next.js built-in)
- Shared config directory exists at `packages/config/eslint/` (empty/minimal)

**TypeScript Configs:**
- Backend: `apps/backend/tsconfig.json` — target ES2022, CommonJS, strict, decorators enabled, path alias `@/*`
- Frontend: `apps/frontend/tsconfig.json` — target ES2017, ESNext modules, bundler resolution, Next.js plugin, path alias `@/*`
- Shared: `packages/shared/tsconfig.json` — target ES2022, CommonJS, strict, noUnusedLocals/Parameters

## Docker Setup

### Development (`docker-compose.yml`)
- **postgres** — `postgres:15-alpine`, exposed on :5432, with healthcheck
- **redis** — `redis:7-alpine`, exposed on :6379, with healthcheck
- Apps run locally outside Docker

### Production (`docker-compose.prod.yml`)
- **postgres** — same, no exposed ports, env-var-driven credentials
- **redis** — same, no exposed ports
- **backend** — Multi-stage build from `apps/backend/Dockerfile`
  - Base: `node:20-alpine`, pnpm 9.15.0
  - Runs `prisma migrate deploy` on startup, then `node dist/main`
  - Healthcheck: `GET /health`
  - Non-root user (`backend:1001`)
- **frontend** — Multi-stage build from `apps/frontend/Dockerfile`
  - Next.js standalone output
  - Non-root user (`nextjs:1001`)
  - Healthcheck: `GET /api/health`
- **nginx** — `nginx:alpine`, port 80
  - Config: `nginx/nginx.conf`
  - Reverse proxy: `/api/` → backend:3001, `/socket.io/` → backend:3001 (WebSocket upgrade), `/*` → frontend:3000
  - Gzip compression enabled
  - Static asset caching (30d)

## Environment Configuration

**Required env vars** (from `.env.example` and `apps/backend/src/config/validation.ts`):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** (min 32 chars) | — | Access token signing |
| `JWT_REFRESH_SECRET` | **Yes** (min 32 chars) | — | Refresh token signing |
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `3001` | Backend server port |
| `REDIS_HOST` | No | `localhost` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `JWT_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `SMTP_HOST` | No | — | SMTP server for email action |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASSWORD` | No | — | SMTP password |
| `IMAP_HOST` | No | — | IMAP server for email trigger |
| `IMAP_PORT` | No | `993` | IMAP port |
| `IMAP_USER` | No | — | IMAP username |
| `IMAP_PASSWORD` | No | — | IMAP password |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot token |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS origin |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001/api` | Frontend API base URL |
| `NEXT_PUBLIC_WS_URL` | No | `http://localhost:3001` | Frontend WebSocket URL |

**Env validation:** `apps/backend/src/config/validation.ts` — Joi schema validates all vars at startup.

## NPM Scripts (Root)

```bash
pnpm dev           # Start all apps in dev mode (turbo)
pnpm build         # Build all apps (turbo)
pnpm test          # Run all tests (turbo)
pnpm test:cov      # Run tests with coverage (turbo)
pnpm lint          # Lint all apps (turbo)
pnpm format        # Format all files with Prettier
pnpm db:migrate    # Run Prisma migrations (backend)
pnpm db:seed       # Seed database (backend)
pnpm db:studio     # Open Prisma Studio (backend)
pnpm clean         # Clean all build outputs + node_modules
```

## Key Dependency Summary

| Category | Package | Version | Location |
|----------|---------|---------|----------|
| Framework (BE) | NestJS | ^10.4.0 | `apps/backend` |
| Framework (FE) | Next.js | ^15.1.0 | `apps/frontend` |
| UI Library | React | ^19.0.0 | `apps/frontend` |
| ORM | Prisma | ^6.0.0 | `apps/backend` |
| DB | PostgreSQL | 15 | Docker |
| Cache/Queue backend | Redis | 7 | Docker |
| Job Queue | BullMQ | ^5.25.0 | `apps/backend` |
| Validation | Zod | ^3.24.0 | `packages/shared`, `apps/frontend` |
| Validation (BE) | class-validator | ^0.14.1 | `apps/backend` |
| Validation (config) | Joi | ^17.13.0 | `apps/backend` |
| Styling | Tailwind CSS | ^3.4.0 | `apps/frontend` |
| Flow Editor | @xyflow/react | ^12.3.0 | `apps/frontend` |
| State (server) | TanStack Query | ^5.60.0 | `apps/frontend` |
| State (client) | Zustand | ^5.0.0 | `apps/frontend` |
| Auth | Passport + JWT | ^0.7.0 | `apps/backend` |
| WebSocket | Socket.IO | ^4.8.0 | Both |
| HTTP Client | Axios | ^1.7.0 | Both |
| Data Transform | JSONata | ^2.0.5 | `apps/backend` |
| Email (send) | Nodemailer | ^6.9.0 | `apps/backend` |
| Email (receive) | imap | ^0.8.19 | `apps/backend` |
| Telegram | node-telegram-bot-api | ^0.66.0 | `apps/backend` |
| Scheduling | node-cron | ^3.0.3 | `apps/backend` |
| Logging | Pino | ^9.5.0 | `apps/backend` |
| API Docs | Swagger | ^7.4.0 | `apps/backend` |
| Testing | Jest | ^29.7.0 | `apps/backend` |
| Build | Turborepo | ^2.3.0 | Root |
| Formatting | Prettier | ^3.4.0 | Root |

---

*Stack analysis: 2025-01-27*
