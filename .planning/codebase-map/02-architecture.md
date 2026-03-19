# Architecture

**Analysis Date:** 2025-01-30

## Pattern Overview

**Overall:** Modular Monorepo — NestJS (backend) + Next.js (frontend) with shared type package, orchestrated via Turborepo and pnpm workspaces.

**Key Characteristics:**
- Monorepo with 2 apps (`backend`, `frontend`) and 2 shared packages (`shared`, `config`)
- Backend follows NestJS modular architecture (Module → Controller → Service → Prisma)
- Frontend follows Next.js App Router pattern with Zustand stores and React Query hooks
- Workflow engine uses DAG-based topological execution with pluggable action types
- Real-time communication via Socket.IO (WebSocket) with event-emitter bridge
- BullMQ job queue backed by Redis for async workflow execution
- Nginx reverse proxy unifies both apps under one domain in production

---

## 1. Monorepo Structure

```
minizapierpraktika/
├── apps/
│   ├── backend/          # NestJS API + workflow engine (port 3001)
│   └── frontend/         # Next.js web app (port 3000)
├── packages/
│   ├── shared/           # Shared TypeScript types, constants, validation utils
│   └── config/           # Shared ESLint + TSConfig presets (empty dirs)
├── nginx/
│   └── nginx.conf        # Production reverse proxy config
├── package.json          # Root — Turborepo scripts
├── pnpm-workspace.yaml   # Workspace: apps/*, packages/*
├── turbo.json            # Build pipeline (build → test, dev persistent)
├── docker-compose.yml    # Dev infra: Postgres + Redis
└── docker-compose.prod.yml  # Prod: Postgres + Redis + backend + frontend + nginx
```

**Package manager:** pnpm 9.15.0 with workspaces  
**Build orchestrator:** Turborepo 2.x  
**Node requirement:** >=20.0.0

### Workspace packages

| Package | Name | Purpose |
|---------|------|---------|
| `apps/backend` | `@minizapier/backend` | NestJS REST API + WebSocket + workflow engine |
| `apps/frontend` | `@minizapier/frontend` | Next.js 15 web UI |
| `packages/shared` | `@minizapier/shared` | Shared types, enums, constants, Zod schemas |
| `packages/config` | — | ESLint/TSConfig presets (scaffolded, mostly empty) |

---

## 2. Backend Architecture

### Pattern: NestJS Module-based Architecture

Each domain concern is a self-contained NestJS module with Controller → Service → Prisma data access. Global guards, interceptors, and filters handle cross-cutting concerns.

### Module Map

```
apps/backend/src/
├── main.ts                        # Bootstrap: Helmet, CORS, ValidationPipe, Swagger, global prefix /api
├── app.module.ts                  # Root module — imports all feature modules
├── config/
│   ├── configuration.ts           # Typed config loader (port, db, redis, jwt, smtp, telegram, imap)
│   └── validation.ts              # Joi env validation schema
├── prisma/
│   ├── prisma.module.ts           # Global Prisma module
│   └── prisma.service.ts          # PrismaClient wrapper with lifecycle hooks
├── common/
│   ├── decorators/
│   │   ├── public.decorator.ts    # @Public() — skips JWT guard
│   │   ├── current-user.decorator.ts  # @CurrentUser() — extracts user from req
│   │   └── roles.decorator.ts     # @Roles('ADMIN') — role metadata
│   ├── guards/
│   │   ├── jwt-auth.guard.ts      # Global JWT guard (respects @Public)
│   │   └── roles.guard.ts         # RBAC guard
│   ├── filters/
│   │   └── all-exceptions.filter.ts   # Global exception → JSON response
│   ├── interceptors/
│   │   ├── transform.interceptor.ts   # Wraps responses in { status, data, timestamp }
│   │   └── logging.interceptor.ts     # HTTP request logging with timing
│   └── pipes/                     # (empty — uses built-in ValidationPipe)
├── auth/                          # Authentication module
├── users/                         # User management (admin CRUD)
├── workflows/                     # Workflow CRUD + versioning
├── executions/                    # Execution history, stats, chart data
├── engine/                        # Workflow execution engine (core)
├── triggers/                      # Trigger handlers (webhook, cron, email, telegram)
├── queue/                         # BullMQ queue for async execution
├── notifications/                 # Alert system for failed executions
├── websocket/                     # Socket.IO gateway for real-time updates
├── health/                        # Liveness + readiness endpoints
└── types/                         # Backend-specific types
```

### Global Middleware Chain

Configured in `apps/backend/src/main.ts` and `apps/backend/src/app.module.ts`:

1. **Helmet** — security headers
2. **CORS** — allows `FRONTEND_URL` origin with credentials
3. **Global prefix** — all routes under `/api`
4. **ValidationPipe** — whitelist + forbidNonWhitelisted + transform
5. **JwtAuthGuard** (global APP_GUARD) — all routes require JWT unless `@Public()`
6. **ThrottlerGuard** (global APP_GUARD) — 100 requests per 60s per IP
7. **Swagger** — OpenAPI docs at `/api/docs`

### Feature Modules Detail

#### Auth (`apps/backend/src/auth/`)
- **Controller:** `auth.controller.ts` — POST `/auth/register`, POST `/auth/login`, POST `/auth/refresh`, POST `/auth/logout`, GET `/auth/me`
- **Service:** `auth.service.ts` — bcrypt password hashing, JWT access + refresh token generation
- **Strategies:** `jwt.strategy.ts` (bearer token), `jwt-refresh.strategy.ts`, `local.strategy.ts`
- **DTOs:** `register.dto.ts`, `login.dto.ts`
- Access token: 15m expiry, refresh token: 7d expiry, refresh token stored hashed in DB

#### Workflows (`apps/backend/src/workflows/`)
- **Controller:** `workflows.controller.ts` — full CRUD + activate/deactivate/execute/versions
- **Service:** `workflows.service.ts` — ownership checks, auto-creates trigger records on activate, manages Telegram webhook registration
- **DTOs:** `create-workflow.dto.ts`, `update-workflow.dto.ts`
- Workflow `definition` stored as JSON in DB (`{ nodes: [], edges: [], integrations: {} }`)
- Versioning: auto-creates `WorkflowVersion` on definition updates

#### Executions (`apps/backend/src/executions/`)
- **Controller:** `executions.controller.ts` — list, detail, stats, chart, cancel, retry
- **Service:** `executions.service.ts` — paginated queries, aggregation stats, chart data builder
- User-scoped via `workflow.userId` join

#### Engine (`apps/backend/src/engine/`)
- **EngineService:** `engine.service.ts` — core orchestrator
  - Topological sort (Kahn's algorithm) on workflow DAG
  - Sequential step execution in sorted order
  - Emits events: `execution.started`, `execution.completed`, `execution.failed`, `step.started`, `step.completed`, `step.failed`
- **Actions** (`apps/backend/src/engine/actions/`):
  - `http-request.action.ts` — Axios with retry, SSRF protection (blocks private IPs, localhost)
  - `email.action.ts` — Nodemailer via SMTP
  - `telegram.action.ts` — Telegram Bot API (`sendMessage`)
  - `database.action.ts` — Raw SQL via Prisma `$queryRawUnsafe` with table allowlist and column validation
  - `transform.action.ts` — JSONata expression evaluation with 1MB input limit and 5s timeout
- **Processor:** `processors/workflow.processor.ts` — BullMQ sandboxed processor (runs in separate process)

#### Triggers (`apps/backend/src/triggers/`)
- **Webhook:** `webhook/webhook.controller.ts` — POST `/api/webhooks/:token` (public), looks up trigger by token, executes workflow
- **Cron:** `cron/cron.service.ts` — `node-cron` scheduler, loads active cron triggers on startup, schedules/stops dynamically
- **Email:** `email/email-trigger.service.ts` — IMAP polling every 60s, matches emails by subject filter, emits `trigger.fired` events
- **Telegram:** `telegram/telegram-trigger.controller.ts` — POST `/api/telegram/webhook/:token` (public), receives Telegram updates, executes workflow

#### Queue (`apps/backend/src/queue/`)
- **QueueService:** `queue.service.ts` — BullMQ queue `workflow-execution` with exponential backoff (3 attempts, 5s base delay)
- **WorkflowProcessor:** In-process processor that delegates to `EngineService.executeWorkflow()`

#### WebSocket (`apps/backend/src/websocket/`)
- **Gateway:** `websocket.gateway.ts` — Socket.IO on namespace `/executions`
- JWT-authenticated connections (token from `handshake.auth.token` or `Authorization` header)
- Room-based: clients join `execution:{id}` or `workflow:{id}`
- Listens to `@nestjs/event-emitter` events and broadcasts to rooms

#### Notifications (`apps/backend/src/notifications/`)
- **NotificationsService:** `notifications.service.ts` — event listener for `execution.failed`
- Sends alerts via Telegram (`TELEGRAM_ALERT_CHAT_ID`) and/or email (`ALERT_EMAIL`)

#### Health (`apps/backend/src/health/`)
- GET `/api/health` — liveness (always 200)
- GET `/api/health/ready` — readiness (Prisma DB ping + memory heap < 256MB)

---

## 3. Frontend Architecture

### Pattern: Next.js App Router + Zustand + React Query

```
apps/frontend/src/
├── app/
│   ├── layout.tsx                 # Root: Inter font, <Providers>
│   ├── page.tsx                   # Redirects to /dashboard
│   ├── globals.css                # Tailwind + CSS vars for theming
│   ├── error.tsx                  # Error boundary
│   ├── global-error.tsx           # Global error boundary
│   ├── not-found.tsx              # 404 page
│   ├── (auth)/
│   │   ├── layout.tsx             # Auth layout (centered)
│   │   ├── login/                 # Login page
│   │   └── register/              # Register page
│   └── (dashboard)/
│       ├── layout.tsx             # Dashboard shell: <Sidebar> + <Header> + <main>
│       ├── dashboard/page.tsx     # Stats cards, chart, recent executions
│       ├── workflows/
│       │   ├── page.tsx           # Workflow list
│       │   ├── new/               # Create workflow
│       │   └── [id]/
│       │       ├── page.tsx       # Workflow detail
│       │       └── editor/page.tsx # Visual DAG editor
│       ├── executions/
│       │   ├── page.tsx           # Execution list
│       │   └── [id]/             # Execution detail with step timeline
│       └── settings/              # Settings page
├── components/
│   ├── ui/                        # shadcn/ui primitives (Radix-based)
│   ├── layout/                    # Sidebar, Header
│   ├── auth/                      # Login/register forms
│   ├── dashboard/                 # StatsCards, WorkflowStatusChart, RecentExecutions, ExecutionTimeline
│   ├── workflows/                 # WorkflowCard, WorkflowList, CreateWorkflowDialog
│   └── editor/
│       ├── nodes/
│       │   ├── trigger-node.tsx   # Trigger node component (Webhook, Cron, Email, Telegram)
│       │   └── action-node.tsx    # Action node component
│       ├── edges/                 # Custom edge components
│       └── node-config-panel.tsx  # Side panel for node configuration
├── hooks/
│   ├── use-auth.ts                # Auth mutations (login, register, logout)
│   ├── use-workflows.ts           # Workflow CRUD + activate/deactivate/execute (React Query)
│   ├── use-executions.ts          # Execution queries + dashboard stats
│   └── use-websocket.ts           # Socket.IO connection hook
├── stores/
│   ├── auth-store.ts              # Zustand + persist: user, tokens in localStorage
│   └── editor-store.ts            # Zustand: nodes, edges, selectedNode, integrations
├── lib/
│   ├── api.ts                     # Axios instance with auth interceptor + token refresh
│   └── utils.ts                   # cn() helper (clsx + tailwind-merge)
├── providers/
│   ├── providers.tsx              # ThemeProvider + QueryClient + Toaster + ReactQueryDevtools
│   └── websocket-provider.tsx     # WebSocket context
├── constants/                     # Frontend-specific constants
└── types/                         # Frontend-specific types
```

### Key Frontend Patterns

**State management split:**
- **Server state:** React Query (`@tanstack/react-query`) — all API data (workflows, executions, stats)
- **Client state:** Zustand stores — auth state (`auth-store.ts`), editor canvas state (`editor-store.ts`)

**API layer:** Single Axios instance (`apps/frontend/src/lib/api.ts`) with:
- Auto-attach JWT from `localStorage`
- Auto-refresh on 401 (calls `/auth/refresh` with refresh token, retries original request)
- Redirect to `/login` on failed refresh

**Middleware:** `apps/frontend/middleware.ts` — Edge middleware validates JWT (via `jose`) on all non-public routes. Public paths: `/login`, `/register`. Redirects unauthenticated users to `/login`.

**Visual workflow editor:** Uses `@xyflow/react` (React Flow v12) for DAG editing. The editor store (`editor-store.ts`) manages nodes, edges, and integrations state. Two custom node types: `trigger-node.tsx` and `action-node.tsx`.

---

## 4. API Design

### REST API Endpoints

All endpoints prefixed with `/api`. JWT required unless marked `@Public`.

| Method | Path | Auth | Module | Purpose |
|--------|------|------|--------|---------|
| POST | `/auth/register` | Public | Auth | Register new user |
| POST | `/auth/login` | Public | Auth | Login, returns tokens |
| POST | `/auth/refresh` | JWT-Refresh | Auth | Refresh access token |
| POST | `/auth/logout` | JWT | Auth | Logout, clear refresh token |
| GET | `/auth/me` | JWT | Auth | Current user info |
| GET | `/workflows` | JWT | Workflows | List user's workflows (paginated) |
| POST | `/workflows` | JWT | Workflows | Create workflow |
| GET | `/workflows/:id` | JWT | Workflows | Get workflow + trigger |
| PATCH | `/workflows/:id` | JWT | Workflows | Update workflow (creates version) |
| DELETE | `/workflows/:id` | JWT | Workflows | Delete workflow |
| POST | `/workflows/:id/activate` | JWT | Workflows | Activate (auto-creates trigger) |
| POST | `/workflows/:id/deactivate` | JWT | Workflows | Pause workflow |
| POST | `/workflows/:id/execute` | JWT | Workflows | Manual execution |
| GET | `/workflows/:id/versions` | JWT | Workflows | Version history |
| GET | `/executions` | JWT | Executions | List executions (paginated, filterable) |
| GET | `/executions/stats` | JWT | Executions | Aggregate stats |
| GET | `/executions/recent` | JWT | Executions | Last 10 executions |
| GET | `/executions/chart` | JWT | Executions | Daily chart data |
| GET | `/executions/:id` | JWT | Executions | Execution detail + step logs |
| POST | `/executions/:id/cancel` | JWT | Executions | Cancel running execution |
| POST | `/executions/:id/retry` | JWT | Executions | Retry failed execution |
| GET | `/users` | JWT+Admin | Users | List all users |
| GET | `/users/:id` | JWT+Admin | Users | Get user |
| PATCH | `/users/:id` | JWT+Admin | Users | Update user |
| DELETE | `/users/:id` | JWT+Admin | Users | Delete user |
| POST | `/webhooks/:token` | Public | Triggers | Webhook trigger endpoint |
| POST | `/telegram/webhook/:token` | Public | Triggers | Telegram bot update endpoint |
| POST | `/telegram/validate-token` | JWT | Triggers | Validate Telegram bot token |
| GET | `/health` | Public | Health | Liveness probe |
| GET | `/health/ready` | Public | Health | Readiness probe (DB + memory) |

### WebSocket API

**Namespace:** `/executions`  
**Auth:** JWT token in `handshake.auth.token`

**Client → Server:**
- `join:execution` — join room for execution updates
- `leave:execution` — leave room
- `join:workflow` — join room for workflow-level events

**Server → Client (room broadcasts):**
- `execution:started` — `{ executionId, workflowId }`
- `execution:completed` — `{ executionId, workflowId }`
- `execution:failed` — `{ executionId, workflowId, error }`
- `step:started` — `{ executionId, stepId, nodeId }`
- `step:completed` — `{ executionId, stepId, nodeId, result }`
- `step:failed` — `{ executionId, stepId, nodeId, error }`

### Swagger

OpenAPI docs generated at `/api/docs` via `@nestjs/swagger`.

---

## 5. Database Layer

### ORM: Prisma 6.x

**Schema:** `apps/backend/prisma/schema.prisma`  
**Database:** PostgreSQL 15 (Alpine)  
**Migrations:** Prisma Migrate (`npx prisma migrate dev`, deployed via `npx prisma migrate deploy` in Docker CMD)  
**Seed:** `apps/backend/prisma/seed.ts` — creates admin + demo user + sample workflow

### Entity-Relationship Model

```
User (1) ──────────── (N) Workflow
                              │
                     (1)──────┤──────(1) Trigger
                              │
                     (N)──────┘
                 WorkflowVersion
                              │
                     (N)──────┘
               WorkflowExecution
                              │
                     (N)──────┘
               ExecutionStepLog
```

### Models

| Model | Table | Key Fields | Notes |
|-------|-------|------------|-------|
| `User` | `users` | id (cuid), email (unique), passwordHash, name, role (ADMIN/USER), refreshToken | Cascade deletes workflows |
| `Workflow` | `workflows` | id (cuid), userId (FK), name, description, status (DRAFT/ACTIVE/PAUSED/ARCHIVED), version, definition (JSON) | JSON stores full DAG: `{ nodes, edges, integrations }` |
| `WorkflowVersion` | `workflow_versions` | id (cuid), workflowId (FK), version, definition (JSON), changelog | Unique constraint on `[workflowId, version]` |
| `Trigger` | `triggers` | id (cuid), workflowId (unique FK), type (WEBHOOK/CRON/EMAIL/TELEGRAM), config (JSON), webhookToken (unique), isActive | 1:1 with Workflow |
| `WorkflowExecution` | `workflow_executions` | id (cuid), workflowId (FK), triggerData (JSON), status, startedAt, completedAt, duration, error | Indexed on workflowId, status, createdAt |
| `ExecutionStepLog` | `execution_step_logs` | id (cuid), executionId (FK), nodeId, nodeName, nodeType, status, input/output (JSON), error, retryCount, duration | One per node execution |

### Prisma Service

`apps/backend/src/prisma/prisma.service.ts` — extends `PrismaClient` as NestJS injectable. Connects on module init, disconnects on destroy. Globally provided via `PrismaModule`.

---

## 6. Authentication Flow

### Token-based JWT with Refresh Rotation

```
Client                          Backend (NestJS)                    PostgreSQL
  │                                   │                                │
  │── POST /auth/login ──────────────>│                                │
  │   { email, password }             │── findByEmail ────────────────>│
  │                                   │<── user record ────────────────│
  │                                   │── bcrypt.compare ──────>       │
  │                                   │── generate JWT pair ──>        │
  │                                   │── hash refresh token ──────────>│ (store in users.refreshToken)
  │<── { user, accessToken, ─────────│                                │
  │     refreshToken }                │                                │
  │                                   │                                │
  │── GET /workflows ─────────────────>│                                │
  │   Authorization: Bearer <access>  │── JwtStrategy.validate() ──>   │
  │                                   │   (extracts sub, email, role)  │
  │                                   │                                │
  │── POST /auth/refresh ─────────────>│                                │
  │   Authorization: Bearer <refresh> │── JwtRefreshStrategy ──────────>│
  │                                   │── bcrypt.compare(refresh, hash)│
  │                                   │── generate new JWT pair ───────>│ (rotate)
  │<── { accessToken, refreshToken } ─│                                │
```

**Key details:**
- Access token payload: `{ sub: userId, email, role }`, 15m expiry
- Refresh token: 7d expiry, hashed (bcrypt) in DB for revocation
- Global `JwtAuthGuard` on all routes — `@Public()` decorator to exempt
- Frontend stores tokens in `localStorage` (not HttpOnly cookies)
- Frontend middleware (`middleware.ts`) verifies JWT on edge for SSR route protection
- Auto-refresh: Axios interceptor catches 401, calls `/auth/refresh`, retries

---

## 7. Shared Code (`packages/shared`)

**Package:** `@minizapier/shared`  
**Entry:** `packages/shared/src/index.ts`  
**Dependency:** `zod` (for validation schemas)

### Contents

```
packages/shared/src/
├── index.ts                 # Re-exports everything
├── types/
│   ├── index.ts             # Re-exports all types
│   ├── workflow.ts           # WorkflowStatus, TriggerType, ActionType enums; Node/Edge/Definition interfaces
│   ├── execution.ts          # Execution-related types
│   ├── trigger.ts            # Trigger-related types
│   ├── action.ts             # Action config types
│   └── user.ts               # User-related types
├── constants/
│   ├── index.ts              # Re-exports
│   ├── node-types.ts         # TRIGGER_NODE_TYPES, ACTION_NODE_TYPES (label, description, color, icon)
│   └── status.ts             # Status labels/colors for executions and workflows
└── utils/
    ├── index.ts              # Re-exports
    ├── helpers.ts            # Shared utility functions
    └── validation.ts         # Zod schemas
```

**Consumed via:** Direct TypeScript imports (`"main": "./src/index.ts"`, no build step required in dev)

---

## 8. Communication Patterns

### Frontend ↔ Backend

```
┌──────────────────┐         ┌──────────────────┐
│                  │  HTTP    │                  │
│    Next.js       │────────→│    NestJS         │
│    Frontend      │  REST   │    Backend        │
│    (port 3000)   │←────────│    (port 3001)    │
│                  │         │                  │
│                  │  WS     │                  │
│                  │────────→│  Socket.IO        │
│                  │←────────│  /executions      │
└──────────────────┘         └──────────────────┘
```

- **REST:** All CRUD via Axios → `/api/*` endpoints
- **WebSocket:** Socket.IO for real-time execution progress updates
- **In production:** Nginx proxies both under one domain (`:80`)

### Backend Internal Communication

```
┌─────────────┐    EventEmitter2     ┌──────────────────┐
│  Engine      │────────────────────→│  WebSocket GW    │ (broadcasts to clients)
│  Service     │────────────────────→│  Notifications   │ (alerts on failure)
│              │                     │  Service         │
└──────┬───────┘                     └──────────────────┘
       │
       │  BullMQ (Redis)
       ▼
┌─────────────┐
│  Queue       │
│  Processor   │──→ EngineService.executeWorkflow()
└─────────────┘
```

- **Event Emitter:** `@nestjs/event-emitter` (in-process) — Engine emits execution/step events → WebSocket gateway and Notifications service subscribe
- **BullMQ Queue:** `workflow-execution` queue in Redis — QueueService enqueues, WorkflowProcessor dequeues and calls EngineService
- **No inter-service HTTP calls** — everything is in-process within the single NestJS backend

### External Triggers → Backend

```
External World                         Backend
──────────────                         ───────
Webhook POST ──→ /api/webhooks/:token ──→ EngineService.executeWorkflow()
Telegram API ──→ /api/telegram/webhook/:token ──→ EngineService.executeWorkflow()
node-cron tick ──→ CronService ──→ EngineService.executeWorkflow()
IMAP poll ──→ EmailTriggerService ──→ EventEmitter (trigger.fired)
```

---

## 9. Data Flow: Request Lifecycle

### Manual Workflow Execution (end-to-end)

```
1. User clicks "Execute" in frontend editor
2. Frontend: useExecuteWorkflow() → POST /api/workflows/:id/execute
3. Backend: WorkflowsController.execute()
   ├── Verify ownership (findById)
   └── Call EngineService.executeWorkflow(workflowId, body)
4. EngineService.executeWorkflow():
   ├── Load workflow + definition from Postgres
   ├── Create WorkflowExecution record (status: RUNNING)
   ├── Emit 'execution.started' event
   ├── Parse definition: { nodes, edges, integrations }
   ├── Topological sort nodes (Kahn's algorithm)
   ├── For each node in order:
   │   ├── Skip trigger nodes (store triggerData as result)
   │   ├── Create ExecutionStepLog (status: RUNNING)
   │   ├── Emit 'step.started' event
   │   ├── executeAction(type, input) → dispatch to action handler
   │   ├── Store result in context.stepResults[nodeId]
   │   ├── Update ExecutionStepLog (status: COMPLETED, output)
   │   └── Emit 'step.completed' event
   ├── Update WorkflowExecution (status: COMPLETED, duration)
   └── Emit 'execution.completed' event
5. WebSocket Gateway receives events → broadcasts to room
6. Frontend: useWebSocket() receives 'step:completed' / 'execution:completed'
7. React Query invalidates execution queries → UI updates
```

### Webhook Trigger Execution

```
1. External system: POST /api/webhooks/:token { body }
2. WebhookController (public endpoint) → WebhookService.processWebhook()
3. Lookup Trigger by webhookToken, verify workflow is ACTIVE
4. Call EngineService.executeWorkflow(workflowId, { body, headers, receivedAt })
5. Same execution flow as above (steps 4-7)
6. Return { executionId, status: 'triggered' } to caller
```

---

## 10. Workflow Engine Internals

### Execution Model

Workflows are stored as a DAG (Directed Acyclic Graph):
```json
{
  "nodes": [
    { "id": "trigger-1", "type": "triggerNode", "data": { "label": "...", "type": "WEBHOOK", "config": {} } },
    { "id": "action-1", "type": "actionNode", "data": { "label": "...", "type": "HTTP_REQUEST", "config": { "url": "..." } } }
  ],
  "edges": [
    { "id": "e1", "source": "trigger-1", "target": "action-1" }
  ],
  "integrations": {
    "telegram": { "botToken": "...", "botName": "..." }
  }
}
```

### Action Registry

Defined in `apps/backend/src/engine/engine.service.ts`:

| Action Type | Handler | Key Config |
|-------------|---------|------------|
| `HTTP_REQUEST` | `HttpRequestAction` | url, method, headers, body, timeout, retries |
| `SEND_EMAIL` | `EmailAction` | to, subject, body, isHtml |
| `TELEGRAM` | `TelegramAction` | botToken, chatId, message, parseMode |
| `DATABASE` | `DatabaseAction` | operation (SELECT/INSERT/UPDATE/DELETE), table, fields, where |
| `TRANSFORM` | `TransformAction` | expression (JSONata), data |

### Context Propagation

Each action receives input config enriched with `_context`:
```typescript
const input = {
  ...node.data.config,
  _context: {
    ...context.stepResults,     // all previous step outputs, keyed by nodeId
    triggerData: context.triggerData,
    integrations: context.integrations
  }
};
```

### Dual Execution Paths

1. **In-process (EngineService):** Used by direct controller calls, webhook triggers, cron triggers. Full access to NestJS DI container and action services.
2. **Sandboxed (BullMQ processor):** `apps/backend/src/engine/processors/workflow.processor.ts` — runs in separate Node.js process. Re-implements action execution inline (no DI). Used for queued async execution.

---

## 11. Deployment Architecture

### Development

```
docker-compose.yml → Postgres:5432 + Redis:6379
pnpm dev → Turborepo runs both:
  - NestJS watch mode (port 3001)
  - Next.js dev server (port 3000)
```

### Production

```
docker-compose.prod.yml:

┌──────────────────────────────────────────────────────────┐
│                    Nginx (:80)                            │
│                                                          │
│   /api/*  ──→ backend:3001                               │
│   /socket.io/* ──→ backend:3001 (WebSocket upgrade)      │
│   /api/docs ──→ backend:3001                             │
│   *.js,*.css,*.png ──→ frontend:3000 (30d cache)         │
│   /* ──→ frontend:3000                                   │
│   /nginx-health → 200 OK                                 │
└──────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │ Backend  │        │ Frontend │
   │ Node.js  │        │ Next.js  │
   │ :3001    │        │ :3000    │
   └────┬─────┘        └──────────┘
        │
   ┌────┼──────────────┐
   ▼    ▼              │
┌─────┐ ┌─────┐       │
│ PG  │ │Redis│       │
│:5432│ │:6379│       │
└─────┘ └─────┘       │
```

### Docker Builds

Both apps use multi-stage builds (`apps/backend/Dockerfile`, `apps/frontend/Dockerfile`):
1. **base** — Node 20 Alpine + pnpm
2. **deps** — Install dependencies
3. **builder** — Build app (Prisma generate + NestJS build / Next.js build)
4. **runner** — Minimal production image, non-root user

**Backend CMD:** `npx prisma migrate deploy && node dist/main` (auto-runs migrations on startup)  
**Frontend CMD:** `node server.js` (Next.js standalone output)

### Health Checks

| Service | Endpoint | Type |
|---------|----------|------|
| Postgres | `pg_isready -U minizapier` | Docker healthcheck |
| Redis | `redis-cli ping` | Docker healthcheck |
| Backend | `GET /health` → 200 | Docker healthcheck + nginx depends_on |
| Frontend | Started | nginx depends_on |
| Nginx | `/nginx-health` → 200 | Self-check |

### Service Dependencies

```
nginx → depends_on → backend (healthy) + frontend (started)
backend → depends_on → postgres (healthy) + redis (healthy)
frontend → depends_on → backend (healthy)
```

---

## 12. Cross-Cutting Concerns

### Error Handling

**Backend:**
- Global `AllExceptionsFilter` (`apps/backend/src/common/filters/all-exceptions.filter.ts`) catches all exceptions → JSON `{ statusCode, message, timestamp, path }`
- NestJS built-in exceptions used: `NotFoundException`, `ForbiddenException`, `UnauthorizedException`, `ConflictException`, `BadRequestException`
- Engine errors update execution/step status to FAILED and emit failure events

**Frontend:**
- `apps/frontend/src/app/error.tsx` and `apps/frontend/src/app/global-error.tsx` — React error boundaries
- `sonner` toast notifications for mutation success/failure

### Logging

**Backend:** NestJS `Logger` class (per-service instances). `LoggingInterceptor` logs HTTP method/url/status/duration.  
**Note:** `pino` + `pino-http` are installed as dependencies but the codebase uses NestJS built-in logger.

### Validation

**Backend:** Class-validator + class-transformer via global `ValidationPipe` (whitelist + transform).  
**Config:** Joi schema (`apps/backend/src/config/validation.ts`) validates env vars on startup.  
**Frontend:** Zod for form validation.  
**Shared:** Zod schemas in `packages/shared/src/utils/validation.ts`.

### Response Format

`TransformInterceptor` (`apps/backend/src/common/interceptors/transform.interceptor.ts`) wraps all successful responses:
```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2025-01-30T..."
}
```

Frontend hooks handle both wrapped (`res.data.data`) and unwrapped (`res.data`) responses for compatibility.

---

*Architecture analysis: 2025-01-30*
