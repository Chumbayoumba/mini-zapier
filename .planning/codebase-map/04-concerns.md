# Codebase Concerns

**Analysis Date:** 2025-01-20

---

## 🔴 Critical Issues

### 1. Sandboxed Processor Bypasses All Security Safeguards

- **Issue:** The BullMQ sandboxed processor at `apps/backend/src/engine/processors/workflow.processor.ts` duplicates workflow execution logic but **skips all safety checks** present in the main engine.
- **Files:** `apps/backend/src/engine/processors/workflow.processor.ts` (lines 126-134)
- **Impact:**
  - `HTTP_REQUEST` in the processor makes raw `axios` calls with **no SSRF protection** (no URL validation, no private IP blocking, no redirect limits). Compare with the safeguarded `apps/backend/src/engine/actions/http-request.action.ts` which validates URLs, blocks private IPs, and disables redirects.
  - `TRANSFORM` (JSONata) in the processor runs **without the 5-second timeout or 1MB input size limit** enforced in `apps/backend/src/engine/actions/transform.action.ts`.
  - `DATABASE` action returns a stub (`{ result: 'DB action executed in sandboxed processor' }`) — it silently does nothing instead of failing or executing, producing incorrect workflow results.
- **Fix approach:** Remove duplicated logic from the sandboxed processor. Either have the processor delegate to the same action classes (via a child process RPC pattern), or consolidate to a single execution path in `EngineService`.

### 2. Hardcoded Fallback JWT Secret in Frontend Middleware

- **Issue:** The Next.js middleware uses a hardcoded fallback JWT secret: `'super-secret-jwt-key-for-dev-32chars'`.
- **Files:** `apps/frontend/middleware.ts` (line 32)
- **Impact:** If `JWT_SECRET` env var is missing in production, the middleware will accept tokens signed with the well-known dev key. This means **anyone can forge valid JWTs** and bypass all frontend route protection.
- **Fix approach:** Remove the fallback. Throw an error at startup if `JWT_SECRET` is not set. Or better: rely solely on the backend for auth verification and remove JWT verification from the middleware entirely (just check for token presence).

### 3. Database Action Exposes Application Tables via Workflow SQL

- **Issue:** The `DatabaseAction` allows workflow users to run SELECT/INSERT/UPDATE/DELETE against the application's own tables (`users`, `workflows`, `workflow_executions`, etc.).
- **Files:** `apps/backend/src/engine/actions/database.action.ts` (lines 20-23)
- **Impact:** A user who can create workflows can **read all user records** (including `passwordHash`, `refreshToken`), **modify or delete other users' workflows and executions**, and **escalate privileges** by changing their `role` to `ADMIN`. This is a full privilege escalation vulnerability.
- **Fix approach:** The Database action should operate on a separate database/schema, or be restricted to a read-only connection to specific user-space tables. Alternatively, remove the `users` table from `ALLOWED_TABLES` at minimum, and add row-level security or a separate connection with limited privileges.

### 4. Hardcoded Database Credentials in docker-compose.yml

- **Issue:** The development `docker-compose.yml` hardcodes `POSTGRES_PASSWORD: minizapier123`. The production `docker-compose.prod.yml` uses env vars but with the **same weak default**: `${DB_PASSWORD:-minizapier123}`.
- **Files:** `docker-compose.yml` (line 8), `docker-compose.prod.yml` (line 8), `.env.example` (line 6)
- **Impact:** If prod is deployed without explicitly setting `DB_PASSWORD`, the database runs with a known weak password. The `.env.example` also ships the default connection string with this password.
- **Fix approach:** Remove default password fallbacks in `docker-compose.prod.yml`. Require `DB_PASSWORD` to be explicitly set (fail if missing). Keep defaults only in the dev compose file.

---

## 🟡 Important Issues

### 5. No CI/CD Pipeline

- **Issue:** No `.github/workflows/`, no Jenkinsfile, no CI configuration of any kind.
- **Files:** Entire repo root — no CI config files exist.
- **Impact:** No automated testing on PRs, no linting enforcement, no build verification. Tests may rot silently. No automated deployment pipeline.
- **Fix approach:** Add GitHub Actions workflow with steps: install → lint → test → build. Add branch protection rules requiring CI pass.

### 6. No E2E Tests

- **Issue:** The `test/jest-e2e.json` config exists but there are **zero e2e-spec.ts files** in the entire repo.
- **Files:** `apps/backend/test/jest-e2e.json` (config with no tests)
- **Impact:** No integration testing of the full HTTP request → response cycle. API contract changes can break the frontend silently. Critical flows like webhook→execution pipeline are only unit-tested with mocks.
- **Fix approach:** Write e2e tests for critical paths: auth flow, workflow CRUD, webhook trigger → execution, and the health endpoint. Use `@nestjs/testing` with a real test database.

### 7. No Frontend Tests at All

- **Issue:** The `@minizapier/frontend` package has no test framework configured and zero test files.
- **Files:** `apps/frontend/package.json` — no test script, no jest/vitest config
- **Impact:** UI regressions go undetected. Complex state logic in `stores/editor-store.ts` and `stores/auth-store.ts` is completely untested.
- **Fix approach:** Add Vitest with React Testing Library. Start with critical paths: auth store, API interceptor token refresh logic, and editor store state transitions.

### 8. TLS Certificate Validation Disabled for IMAP

- **Issue:** The IMAP client connects with `rejectUnauthorized: false`, accepting any TLS certificate including self-signed or expired ones.
- **Files:** `apps/backend/src/triggers/email/email-trigger.service.ts` (line 95)
- **Impact:** Vulnerable to man-in-the-middle attacks on the IMAP connection. Email credentials could be intercepted.
- **Fix approach:** Remove `rejectUnauthorized: false`. If custom CAs are needed, configure them via `ca` option rather than disabling validation entirely.

### 9. Hardcoded Production Domain in Source Code

- **Issue:** The production base URL `https://zapier.egor-dev.ru` is hardcoded as a fallback in the workflow service.
- **Files:** `apps/backend/src/workflows/workflows.service.ts` (line 164)
- **Impact:** If `FRONTEND_URL` is not set, Telegram webhook registrations will point to this specific domain. This is environment-specific configuration baked into code.
- **Fix approach:** Move to a required env var. The Joi validation at `apps/backend/src/config/validation.ts` already defaults `FRONTEND_URL` to `http://localhost:3000` — use `configService.get('FRONTEND_URL')` consistently and remove the hardcoded domain fallback.

### 10. SMTP Transporter Uses `secure: false`

- **Issue:** Both email-related services create SMTP transports with `secure: false`.
- **Files:** `apps/backend/src/engine/actions/email.action.ts` (line 14), `apps/backend/src/notifications/notifications.service.ts` (line 30)
- **Impact:** Email communication may happen over unencrypted connections depending on the SMTP server configuration. STARTTLS upgrade is not explicitly enforced.
- **Fix approach:** Add `secure` as a configurable env var (default `true` for port 465, STARTTLS for port 587). Alternatively, set `requireTLS: true` for the Nodemailer transport.

### 11. No Redis Authentication

- **Issue:** Redis runs without a password in both dev and production docker-compose configurations.
- **Files:** `docker-compose.yml` (lines 20-28), `docker-compose.prod.yml` (lines 22-26)
- **Impact:** In production, Redis is accessible without authentication from any container on the Docker network. An attacker who gains access to the network could read queued job data, flush caches, or inject malicious jobs.
- **Fix approach:** Add `requirepass` to Redis config or use `--requirepass` flag. Update BullMQ and ioredis connections to include the password.

### 12. Token Storage in localStorage (XSS Risk)

- **Issue:** JWT access and refresh tokens are stored in `localStorage`, accessible to any JavaScript running on the page.
- **Files:** `apps/frontend/src/stores/auth-store.ts` (lines 26-27), `apps/frontend/src/lib/api.ts` (lines 10, 25)
- **Impact:** If an XSS vulnerability exists anywhere in the app (e.g., in workflow names rendered without sanitization, or via a dependency), an attacker can steal both access and refresh tokens.
- **Fix approach:** Store tokens in `httpOnly` cookies set by the backend. Use `sameSite: 'strict'` and `secure: true` flags. The frontend interceptor would no longer need to manage tokens manually.

### 13. Swagger Docs Exposed in Production

- **Issue:** Swagger UI is unconditionally mounted at `/api/docs` regardless of environment.
- **Files:** `apps/backend/src/main.ts` (lines 32-39)
- **Impact:** Full API documentation including endpoints, DTOs, and auth requirements is visible to anyone in production. This aids attackers in understanding the API surface.
- **Fix approach:** Conditionally enable Swagger only in development: `if (process.env.NODE_ENV !== 'production') { SwaggerModule.setup(...); }`

### 14. No Nginx HTTPS / TLS Configuration

- **Issue:** Nginx listens only on port 80 (HTTP). No TLS configuration, no redirect to HTTPS.
- **Files:** `nginx/nginx.conf` (line 22), `docker-compose.prod.yml` (line 68: only port 80)
- **Impact:** All traffic (including JWT tokens, credentials, and webhook payloads) travels unencrypted. In a production deployment, this requires an external TLS termination proxy, which is not documented.
- **Fix approach:** Add TLS configuration to nginx with cert/key, or document explicitly that an external reverse proxy (e.g., Cloudflare, AWS ALB) must handle TLS. Add HTTP → HTTPS redirect.

### 15. Webhook Execution Runs Synchronously (No Queue)

- **Issue:** Webhook and Telegram trigger endpoints call `engineService.executeWorkflow()` directly, bypassing the BullMQ queue entirely.
- **Files:** `apps/backend/src/triggers/webhook/webhook.service.ts` (line 26), `apps/backend/src/triggers/telegram/telegram-trigger.service.ts` (line 68), `apps/backend/src/workflows/workflows.controller.ts` (line 83)
- **Impact:** The HTTP response is blocked until the entire workflow completes. Long-running workflows cause webhook timeouts. No retry via BullMQ. A burst of webhook calls can overwhelm the server.
- **Fix approach:** Route all executions through `QueueService.addExecution()` instead of calling `engineService.executeWorkflow()` directly. Return immediately with a job/execution ID. The `WorkflowProcessor` already handles queue processing.

### 16. No Pagination Limit Validation

- **Issue:** The `page` and `limit` query parameters are accepted as-is without upper-bound validation.
- **Files:** `apps/backend/src/workflows/workflows.controller.ts` (lines 30-36), `apps/backend/src/executions/executions.controller.ts` (lines 17-23), `apps/backend/src/users/users.controller.ts` (line 18)
- **Impact:** A client can request `?limit=999999` and force the database to return all records in one query, causing memory pressure and slow responses.
- **Fix approach:** Add `@Max(100)` validation to limit parameters. Create a shared `PaginationDto` with validated defaults.

---

## 🟡 Tech Debt

### 17. Duplicated Workflow Execution Logic

- **Issue:** Workflow execution logic (topological sort, node type detection, action dispatching) is implemented twice: once in `EngineService` and again in `workflow.processor.ts`.
- **Files:** `apps/backend/src/engine/engine.service.ts` (lines 59-71, 177-192), `apps/backend/src/engine/processors/workflow.processor.ts` (lines 22-51, 118-188)
- **Impact:** Bug fixes or new action types must be applied in two places. The processor version has already diverged (missing security checks, different action implementations).
- **Fix approach:** Consolidate to a single execution path. Either remove the sandboxed processor and use only `EngineService`, or refactor shared logic into a common module.

### 18. Pervasive Use of `any` Types

- **Issue:** Extensive use of `any` for workflow definitions, node configs, trigger data, and event payloads throughout the backend.
- **Files:** 
  - `apps/backend/src/engine/engine.service.ts` — `ExecutionContext.triggerData: any`, `stepResults: Record<string, any>`, `node: any`
  - `apps/backend/src/workflows/dto/create-workflow.dto.ts` — `definition?: any`
  - `apps/backend/src/websocket/websocket.gateway.ts` — all event handler payloads typed as `any`
  - `apps/backend/src/auth/auth.controller.ts` — `@Req() req: any`, `@CurrentUser() user: any`
- **Impact:** TypeScript provides no compile-time safety for the most critical data structures. Runtime errors from malformed workflow definitions are possible and hard to diagnose.
- **Fix approach:** Define proper types in `packages/shared/src/types/` (which already has skeleton types for workflows, actions, etc.) and use them across the backend. Start with `WorkflowDefinition`, `NodeConfig`, and `TriggerData`.

### 19. No Database Migrations Committed

- **Issue:** No Prisma migration files exist in the repository (`apps/backend/prisma/migrations/` is empty).
- **Files:** `apps/backend/prisma/schema.prisma` (schema exists), but `apps/backend/prisma/migrations/` has zero migration files.
- **Impact:** Database changes are applied via `prisma migrate dev` which auto-generates migrations locally. There's no version-controlled migration history, making production deployments unpredictable and schema rollbacks impossible.
- **Fix approach:** Run `prisma migrate dev --name init` to create the initial migration. Commit migration files to git. The production Dockerfile already runs `prisma migrate deploy`.

### 20. Email Trigger Doesn't Fire Workflow Execution

- **Issue:** The `EmailTriggerService` emits a `trigger.fired` event when matching emails are found, but **no listener handles this event** to actually execute the workflow.
- **Files:** `apps/backend/src/triggers/email/email-trigger.service.ts` (line 73)
- **Impact:** Email triggers will detect incoming emails but silently do nothing. The email trigger feature is non-functional.
- **Fix approach:** Add an `@OnEvent('trigger.fired')` handler (in the engine or queue module) that calls `engineService.executeWorkflow()` or `queueService.addExecution()`.

### 21. Retry Creates Execution Record But Never Executes It

- **Issue:** The `ExecutionsService.retry()` method creates a new execution record with status `PENDING` but never enqueues or executes it.
- **Files:** `apps/backend/src/executions/executions.service.ts` (lines 57-72)
- **Impact:** Clicking "Retry" in the UI creates a stuck `PENDING` execution that never runs. The user sees a pending record with no progress.
- **Fix approach:** After creating the new execution record, call `queueService.addExecution()` or `engineService.executeWorkflow()` to actually run it.

### 22. WebSocket Room Join Has No Authorization

- **Issue:** The WebSocket gateway authenticates users on connection, but the `join:execution` and `join:workflow` room handlers don't verify that the user owns the execution/workflow they're subscribing to.
- **Files:** `apps/backend/src/websocket/websocket.gateway.ts` (lines 67-72, 81-84)
- **Impact:** An authenticated user can subscribe to real-time updates for any execution or workflow, including those belonging to other users, leaking execution data and step results.
- **Fix approach:** In `handleJoinExecution`, verify `client.data.userId` matches the execution's workflow owner before allowing the join. Same for `handleJoinWorkflow`.

### 23. No Request Body Size Limit on Webhook Endpoint

- **Issue:** The webhook controller (`POST /api/webhooks/:token`) accepts arbitrary body sizes. NestJS defaults to ~100KB via Express, but there's no explicit limit enforced.
- **Files:** `apps/backend/src/triggers/webhook/webhook.controller.ts`, `apps/backend/src/main.ts`
- **Impact:** An attacker could send large payloads that get stored as `triggerData` (JSON) in the database, consuming storage.
- **Fix approach:** Add `app.use(json({ limit: '1mb' }))` or use a NestJS interceptor to limit webhook payload size.

---

## 🟢 Nice-to-Have Improvements

### 24. Missing `@IsEnum` Validation on Status Filter

- **Issue:** The `status` query param in `ExecutionsController.findAll()` and `WorkflowsController.findAll()` accepts any string value, not just valid enum values.
- **Files:** `apps/backend/src/executions/executions.controller.ts` (line 22), `apps/backend/src/workflows/workflows.controller.ts`
- **Impact:** Invalid status values produce empty results without error feedback. Not a security issue but poor DX.
- **Fix approach:** Create a query DTO with `@IsEnum(ExecutionStatus)` and `@IsOptional()`.

### 25. Shared Package Types Not Used by Backend

- **Issue:** `packages/shared/src/types/` defines types for workflows, actions, triggers, etc., but the backend doesn't import them.
- **Files:** `packages/shared/src/types/` (all files), vs `apps/backend/src/` (uses local `any` types)
- **Impact:** The shared package exists but serves no purpose for the backend. Types drift between frontend and backend.
- **Fix approach:** Import and use `@minizapier/shared` types in backend DTOs, services, and engine.

### 26. Cron Service Doesn't Refresh on Workflow Changes

- **Issue:** `CronService` loads active cron triggers only on module init. When a workflow with a CRON trigger is activated or deactivated, the cron schedule is not updated.
- **Files:** `apps/backend/src/triggers/cron/cron.service.ts` (line 16-18)
- **Impact:** Cron triggers require a server restart to take effect after activation/deactivation.
- **Fix approach:** Listen for `workflow.activated` and `workflow.deactivated` events. Call `scheduleCron()` or `stopCron()` accordingly.

### 27. No Graceful Shutdown for Long-Running Workflow Executions

- **Issue:** There's no mechanism to gracefully complete in-flight workflow executions when the server shuts down.
- **Files:** `apps/backend/src/engine/engine.service.ts`, `apps/backend/src/queue/queue.service.ts`
- **Impact:** If the server restarts during a workflow execution, the execution will remain stuck in `RUNNING` status forever with no completion or failure recorded. BullMQ has its own retry for queued jobs, but direct executions (from webhooks) have no recovery.
- **Fix approach:** Implement a `beforeApplicationShutdown` hook that waits for active executions to complete (with timeout). Add a startup cleanup that marks stale `RUNNING` executions as `FAILED`.

### 28. No Rate Limiting on Webhook Endpoints

- **Issue:** The global `ThrottlerGuard` is applied, but public webhook endpoints are marked `@Public()`. The throttler guard likely applies globally, but webhook-specific limits may be needed.
- **Files:** `apps/backend/src/triggers/webhook/webhook.controller.ts` (line 14), `apps/backend/src/app.module.ts` (line 30: 100 req/60s)
- **Impact:** A single webhook URL could be flooded with requests, triggering hundreds of workflow executions and overwhelming the system.
- **Fix approach:** Apply specific rate limits to webhook endpoints (e.g., 10 requests per second per token). Consider per-webhook throttling.

### 29. No Execution Data Retention/Cleanup Policy

- **Issue:** Workflow executions and step logs accumulate indefinitely. No TTL, no cleanup job, no archival strategy.
- **Files:** `apps/backend/prisma/schema.prisma` (WorkflowExecution, ExecutionStepLog models), `apps/backend/src/queue/queue.service.ts` (only BullMQ jobs have `removeOnComplete: 100`)
- **Impact:** Database will grow unbounded. Over time, queries on `workflow_executions` and `execution_step_logs` will slow down, especially for dashboard stats and charts.
- **Fix approach:** Add a scheduled cleanup job (cron-based) that archives or deletes executions older than N days. Add DB indexes on `createdAt` (already present on `workflow_executions`).

### 30. Missing `FRONTEND_URL` in Production Docker Config

- **Issue:** The `docker-compose.prod.yml` backend service doesn't set `FRONTEND_URL`, which controls CORS origin.
- **Files:** `docker-compose.prod.yml` (lines 33-39), `apps/backend/src/main.ts` (line 14)
- **Impact:** CORS will default to `http://localhost:3000` in production, which will block legitimate cross-origin requests from the actual production domain. However, since nginx proxies both frontend and backend under the same origin, CORS may not matter. But WebSocket connections at `apps/backend/src/websocket/websocket.gateway.ts` (line 20) also use this env var.
- **Fix approach:** Add `FRONTEND_URL` to the backend service environment in `docker-compose.prod.yml`.

---

## Summary Table

| # | Category | Priority | Description |
|---|----------|----------|-------------|
| 1 | Security | 🔴 Critical | Sandboxed processor bypasses SSRF protection |
| 2 | Security | 🔴 Critical | Hardcoded JWT secret fallback in frontend |
| 3 | Security | 🔴 Critical | Database action exposes all app tables |
| 4 | Security | 🔴 Critical | Hardcoded DB password defaults in prod docker |
| 5 | Infrastructure | 🟡 Important | No CI/CD pipeline |
| 6 | Testing | 🟡 Important | No E2E tests |
| 7 | Testing | 🟡 Important | No frontend tests |
| 8 | Security | 🟡 Important | TLS validation disabled for IMAP |
| 9 | Configuration | 🟡 Important | Hardcoded production domain |
| 10 | Security | 🟡 Important | SMTP secure: false |
| 11 | Security | 🟡 Important | No Redis authentication |
| 12 | Security | 🟡 Important | Tokens in localStorage (XSS risk) |
| 13 | Security | 🟡 Important | Swagger exposed in production |
| 14 | Infrastructure | 🟡 Important | No HTTPS in nginx |
| 15 | Architecture | 🟡 Important | Webhook execution bypasses queue |
| 16 | Validation | 🟡 Important | No pagination limit cap |
| 17 | Tech Debt | 🟡 Important | Duplicated execution logic |
| 18 | Tech Debt | 🟡 Important | Pervasive `any` types |
| 19 | Data Integrity | 🟡 Important | No committed DB migrations |
| 20 | Bug | 🟡 Important | Email trigger doesn't execute workflows |
| 21 | Bug | 🟡 Important | Retry creates record but never executes |
| 22 | Security | 🟡 Important | WebSocket room join lacks authorization |
| 23 | Security | 🟡 Important | No body size limit on webhooks |
| 24 | Validation | 🟢 Nice-to-have | Missing enum validation on query params |
| 25 | Tech Debt | 🟢 Nice-to-have | Shared types unused by backend |
| 26 | Bug | 🟢 Nice-to-have | Cron doesn't refresh on workflow changes |
| 27 | Reliability | 🟢 Nice-to-have | No graceful shutdown for executions |
| 28 | Security | 🟢 Nice-to-have | No webhook-specific rate limiting |
| 29 | Scalability | 🟢 Nice-to-have | No execution data retention policy |
| 30 | Configuration | 🟢 Nice-to-have | Missing FRONTEND_URL in prod docker |

---

*Concerns audit: 2025-01-20*
