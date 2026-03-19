# Pitfalls Research — Mini-Zapier Workflow Automation Platform

> GSD Research | Dimension: PITFALLS | Date: 2025-01-27
> Scope: Brownfield rebuild of workflow automation platform (NestJS + Next.js + BullMQ + PostgreSQL)

---

## Critical Pitfalls (MUST prevent — project fails without these)

### P1. SSRF in HTTP Request Actions

**The Problem:** Workflow HTTP actions allow users to specify arbitrary URLs. Without rigorous validation, attackers craft requests to `http://169.254.169.254` (AWS metadata), `http://localhost:6379` (Redis), or internal services, turning the server into a proxy for internal network attacks.

**Current State:** The main `HttpRequestAction` class has solid SSRF protection (IP blocking, DNS resolution check, redirect disabled). BUT the sandboxed `workflow.processor.ts` duplicates HTTP logic with raw `axios` calls and **zero validation** — a complete bypass of all security.

**Warning Signs:**
- Two code paths for the same action (main engine vs. sandboxed processor)
- Raw `axios`/`fetch` calls without a shared validation layer
- No integration test that verifies internal IPs are blocked

**Prevention Strategy:**
1. **Single execution path** — Remove duplicated action logic from the sandboxed processor. The processor must delegate to the same `HttpRequestAction` class.
2. **DNS rebinding guard** — Resolve hostname → validate IP → make request (no TOCTOU gap). The current implementation does this but add a second check on response if redirects are ever re-enabled.
3. **Network-level isolation** — Run workflow execution in a Docker network with no access to internal services. Egress-only firewall rules.
4. **Allowlist approach** — For highest security, maintain a per-user allowlist of external domains.

**Phase:** Phase 1 (Security Hardening) — FIRST priority.

---

### P2. SQL Injection & Privilege Escalation in Database Actions

**The Problem:** The Database action lets workflow authors run SELECT/INSERT/UPDATE/DELETE against the application's own PostgreSQL tables, including `users` (with `passwordHash`, `refreshToken`), `workflows`, and `workflow_executions`.

**Current State:** SQL injection itself is mitigated (parameterized queries, column name validation). But the **authorization model is catastrophically wrong** — any user can read all password hashes, modify other users' data, and escalate to ADMIN role.

**Warning Signs:**
- `ALLOWED_TABLES` includes `users` — the most sensitive table
- No row-level security or ownership filtering
- No separate database/schema for user-space queries
- No audit trail for destructive operations

**Prevention Strategy:**
1. **Separate connection pool** — Database action must use a restricted PostgreSQL role with access to a `user_data` schema only, never the application schema.
2. **Remove `users` from ALLOWED_TABLES** immediately — this is a one-line fix that prevents the worst outcome.
3. **Row-level filtering** — All queries must be scoped to `WHERE userId = $currentUser`.
4. **Read-only by default** — Start with SELECT only. INSERT/UPDATE/DELETE require explicit user opt-in per workflow.
5. **Query audit log** — Log every SQL query executed through the Database action with user ID and timestamp.

**Phase:** Phase 1 (Security Hardening) — FIRST priority alongside SSRF.

---

### P3. Hardcoded JWT Secret Fallback

**The Problem:** The Next.js frontend middleware falls back to `'super-secret-jwt-key-for-dev-32chars'` when `JWT_SECRET` is not set. In production, if the env var is missing (common in misconfigured Docker deployments), anyone can forge valid JWTs and bypass authentication entirely.

**Current State:** Backend JWT strategy correctly requires the env var (no fallback). Frontend middleware has the hardcoded fallback. This mismatch means:
- Dev works fine (both use fallback)
- Prod with proper env: works fine
- Prod without env: frontend accepts forged tokens, backend rejects them → confusing auth failures OR full bypass if frontend routes are the only gate

**Warning Signs:**
- Any `|| 'default-secret'` pattern in JWT verification code
- Difference between frontend and backend JWT configuration
- No startup check that verifies JWT_SECRET is set and matches
- Tests that pass without setting JWT_SECRET

**Prevention Strategy:**
1. **Remove all fallbacks** — Frontend middleware must throw at build time or startup if `JWT_SECRET` is not set.
2. **Startup validation** — Both frontend and backend must validate required env vars on boot. Use Joi/Zod schema validation.
3. **Backend-only auth verification** — Consider removing JWT verification from the frontend middleware entirely. Check only for token presence; let the backend be the single source of auth truth.
4. **Secret rotation readiness** — Support `JWT_SECRET_OLD` for graceful rotation.

**Phase:** Phase 1 (Security Hardening).

---

### P4. Credential Leakage via Docker Compose & Environment

**The Problem:** `docker-compose.prod.yml` has `${DB_PASSWORD:-minizapier123}` — a weak default that becomes the production password if env vars aren't set. Redis has no authentication. SMTP credentials are in plaintext env vars.

**Current State:**
- PostgreSQL: weak default password in both dev and prod compose files
- Redis: zero authentication — any container on the Docker network can access it
- SMTP: `IMAP_PASSWORD` in plaintext environment
- `.env.example` ships with the actual weak password

**Warning Signs:**
- Default/fallback values for passwords in compose files
- No `.env.production` template with empty values
- Redis `command: redis-server` without `--requirepass`
- Secrets visible in `docker inspect` output

**Prevention Strategy:**
1. **No default passwords in prod compose** — Remove all `:-fallback` for secrets. Use Docker secrets or require explicit `.env`.
2. **Redis authentication** — Add `--requirepass ${REDIS_PASSWORD}` to Redis service. Update all BullMQ/ioredis connections.
3. **Startup secret validation** — Backend must verify all required secrets are set and non-trivial (length > 16, not equal to known defaults).
4. **Docker secrets** — For production, use `docker secret` instead of environment variables.
5. **`.env.production.example`** — Ship a template with comments, NOT with values.

**Phase:** Phase 1 (Security Hardening).

---

### P5. Job Loss on Server Restart (No Graceful Shutdown)

**The Problem:** When the NestJS server shuts down (deploy, crash, restart), in-flight workflow executions are abandoned. Executions remain in `RUNNING` status forever. Webhook-triggered executions (which bypass the queue) are completely lost. BullMQ queued jobs may be partially processed.

**Current State:**
- No `app.enableShutdownHooks()` in `main.ts`
- No `beforeApplicationShutdown` or `onApplicationShutdown` hooks
- No queue drain mechanism
- No stale execution cleanup on startup
- Webhooks execute synchronously (no queue) — lost on crash

**Warning Signs:**
- Executions stuck in `RUNNING` status after restart
- Webhook responses timing out during deploys
- BullMQ jobs completed but execution status not updated
- Memory usage growing (no cleanup of in-flight state)

**Prevention Strategy:**
1. **Enable shutdown hooks** — `app.enableShutdownHooks()` in `main.ts`.
2. **Queue drain** — On SIGTERM, pause BullMQ workers, wait for active jobs (30s timeout), then exit.
3. **Stale execution cleanup** — On startup, mark any `RUNNING` executions as `FAILED` with reason "Server restarted during execution".
4. **All executions through queue** — Route webhook/telegram trigger executions through BullMQ. Return job ID immediately. This is the single most important reliability fix.
5. **Health check during shutdown** — Return 503 from health endpoint during graceful shutdown to stop load balancer from sending new requests.

**Phase:** Phase 2 (Reliability) — Critical for production use.

---

### P6. Webhook Execution Bypasses Queue (Synchronous Execution)

**The Problem:** Webhook and Telegram trigger endpoints call `engineService.executeWorkflow()` directly, blocking the HTTP response until the entire workflow completes. This means:
- Long workflows cause webhook timeout (most webhook callers have 10-30s timeout)
- No BullMQ retry on failure
- Burst of webhooks overwhelms the server (no backpressure)
- Job lost if server crashes during execution

**Current State:** Issue #15 in concerns document. `WebhookService.handleWebhook()` calls engine directly. `TelegramTriggerService` also calls engine directly.

**Warning Signs:**
- Webhook response time equals workflow execution time
- Server CPU spikes during webhook bursts
- Webhook callers report timeouts on complex workflows
- No BullMQ job ID in webhook response

**Prevention Strategy:**
1. **Route through queue** — `webhookService.handleWebhook()` must call `queueService.addExecution()` and return the execution ID immediately.
2. **Idempotency key** — Accept `X-Idempotency-Key` header to prevent duplicate executions on webhook retries.
3. **Webhook response** — Return `{ executionId, status: 'QUEUED' }` with HTTP 202 Accepted.
4. **Webhook timeout** — If caller needs synchronous result, offer a polling endpoint: `GET /api/executions/:id/status`.
5. **Backpressure** — Rate limit per webhook token (e.g., 10 req/s).

**Phase:** Phase 2 (Reliability).

---

### P7. WebSocket Room Authorization Bypass

**The Problem:** The WebSocket gateway authenticates users on connection (JWT), but `join:execution` and `join:workflow` room handlers don't verify ownership. Any authenticated user can subscribe to any execution's real-time updates, leaking data across users.

**Current State:** Issue #22 in concerns. Authentication exists but authorization doesn't.

**Warning Signs:**
- Room join handlers that don't query the database
- No ownership check before `client.join(room)`
- Tests that only verify "client joins room" without "client is denied foreign room"

**Prevention Strategy:**
1. **Ownership verification** — Before `client.join()`, query the execution/workflow and verify `userId` matches `client.data.userId`.
2. **Error response** — Emit `error` event with "Access denied" on unauthorized join attempt.
3. **Audit logging** — Log all room join attempts with user ID and resource ID.

**Phase:** Phase 1 (Security Hardening).

---

## Common Pitfalls (SHOULD prevent — causes ongoing pain)

### P8. Duplicate Execution Logic (Engine vs. Processor)

**The Problem:** Workflow execution logic exists in two places: `EngineService` (main process) and `workflow.processor.ts` (BullMQ sandboxed worker). They've already diverged — the processor skips SSRF checks, has no JSONata timeout, and stubs the database action.

**Warning Signs:**
- Two files with similar switch/case on action types
- Bug fixes applied to one but not the other
- New action types added to engine but not processor
- Different error handling between the two paths

**Prevention Strategy:**
1. **Single execution path** — Consolidate to `EngineService` as the sole executor. The BullMQ processor should call `engineService.executeWorkflow()` via module reference.
2. **If sandboxing is needed** — Use `forked()` processor that imports the shared engine module, not a standalone file with copy-pasted logic.
3. **Action registry pattern** — All actions registered in a map/factory. Both paths use the same registry.

**Phase:** Phase 2 (Architecture cleanup, prerequisite for adding new actions).

---

### P9. N+1 Queries in Execution Logs

**The Problem:** Loading execution history with step logs can trigger N+1 queries — one query per execution to load its steps. With hundreds of executions, this kills dashboard performance.

**Warning Signs:**
- Dashboard page load time grows linearly with execution count
- Database CPU high on execution list page
- Prisma queries without `include` or `select` optimization
- No pagination or cursor-based loading for step logs

**Prevention Strategy:**
1. **Eager loading with `include`** — Use Prisma `include: { steps: true }` when steps are needed.
2. **Separate endpoints** — List executions (lightweight) vs. get execution detail (with steps).
3. **Cursor-based pagination** — Don't use offset pagination for large datasets. Use `cursor` with `createdAt` index.
4. **Database indexes** — Ensure `workflowExecution.workflowId`, `executionStepLog.executionId`, and `workflowExecution.createdAt` are indexed.
5. **Aggregation queries** — For dashboard stats, use `COUNT`/`GROUP BY` instead of loading all rows.

**Phase:** Phase 3 (Dashboard & UX).

---

### P10. Unbounded Memory in Large Workflows

**The Problem:** `EngineService.executeWorkflow()` accumulates `stepResults: Record<string, any>` for all completed steps. For workflows with many steps or large JSON payloads (e.g., HTTP responses), this can exhaust memory.

**Warning Signs:**
- OOM kills during large workflow execution
- Memory usage grows during execution and doesn't drop after completion
- Large `triggerData` or step results stored entirely in memory

**Prevention Strategy:**
1. **Result size limits** — Truncate step results to max 1MB before storing in context.
2. **Streaming execution** — Don't hold all results in memory. Write step results to DB immediately, read from DB when needed as input to next step.
3. **Memory budget** — Set `--max-old-space-size` for the Node.js process. Monitor with `process.memoryUsage()`.
4. **Lazy result loading** — Step N only loads results from steps it actually references, not all previous steps.

**Phase:** Phase 4 (Performance optimization, if needed based on testing).

---

### P11. Redis Memory Leaks from BullMQ

**The Problem:** BullMQ stores job data in Redis. Without proper cleanup, completed/failed jobs accumulate and consume Redis memory. The current config keeps 100 completed and 200 failed jobs, but Redis also stores repeat job metadata, event streams, and queue metrics.

**Warning Signs:**
- Redis memory growing over time (`INFO memory`)
- `KEYS bull:*` returns thousands of keys
- BullMQ repeat jobs not cleaned up on workflow deactivation
- No Redis `maxmemory` policy set

**Prevention Strategy:**
1. **Set Redis maxmemory** — Configure `maxmemory` and `maxmemory-policy allkeys-lru` as safety net.
2. **Clean up on workflow deactivation** — When a workflow is deactivated, remove its repeat jobs from BullMQ.
3. **Monitor Redis memory** — Add Redis memory to health check endpoint.
4. **Tune retention** — `removeOnComplete: { age: 86400, count: 50 }` to cap both count and age.

**Phase:** Phase 2 (Reliability) — Part of queue management improvements.

---

### P12. Socket.IO Connection Storms

**The Problem:** If the frontend reconnects aggressively (default Socket.IO behavior), server restarts or network blips cause all clients to reconnect simultaneously, overwhelming the WebSocket server with authentication checks and room re-joins.

**Warning Signs:**
- CPU spike on server restart as all WebSocket clients reconnect
- Authentication service overloaded during mass reconnection
- `EMFILE` (too many open files) errors
- Client-side "disconnected" state persists

**Prevention Strategy:**
1. **Exponential backoff with jitter** — Configure Socket.IO client: `reconnectionDelay: 1000, reconnectionDelayMax: 30000, randomizationFactor: 0.5`.
2. **Connection rate limiting** — Limit WebSocket connections per user (e.g., max 3 tabs).
3. **Server-side connection throttle** — Use Socket.IO middleware to limit connection rate.
4. **Graceful degradation** — Frontend should work (read-only) without WebSocket. Show "reconnecting" indicator.

**Phase:** Phase 3 (UX polish) — Affects user experience during deploys.

---

### P13. Cron Trigger Race Conditions (Multi-Instance)

**The Problem:** `CronService` stores scheduled tasks in memory (`Map<string, ScheduledTask>`). If multiple server instances run (horizontal scaling), each instance schedules the same cron jobs, causing duplicate executions.

**Current State:** Single-instance deployment works fine. Problem emerges only with scaling.

**Warning Signs:**
- Same workflow executed N times per cron interval (N = instance count)
- Execution logs show near-simultaneous entries for cron-triggered workflows
- No distributed lock mechanism

**Prevention Strategy:**
1. **Redis-based cron** — Use BullMQ's built-in repeat jobs instead of `node-cron`. BullMQ handles distributed deduplication via Redis.
2. **Leader election** — If keeping `node-cron`, implement leader election via Redis `SET NX EX` so only one instance runs cron.
3. **Idempotency** — Add execution deduplication: `executionKey = hash(workflowId + cronExpression + scheduledTime)`. Skip if key exists in Redis.

**Phase:** Phase 2 (Reliability) — Essential if ever scaling beyond 1 instance.

---

### P14. Email Trigger Connection Drops

**The Problem:** The email trigger reconnects to IMAP every 60 seconds (polling). If the IMAP server is temporarily unavailable, the trigger silently fails with no retry backoff, no alert, and no user notification.

**Current State:** Email trigger is marked as broken. The `imap` package has issues. TLS validation is disabled.

**Warning Signs:**
- Silent failure — no error surfaced to user
- Polling model causes high latency (up to 60s delay)
- No connection pooling (reconnects every poll)
- `rejectUnauthorized: false` in production

**Prevention Strategy:**
1. **Use `imapflow` package** — Modern, maintained alternative to `imap`. Supports persistent connections with auto-reconnect.
2. **IDLE support** — Use IMAP IDLE for near-instant email detection instead of polling.
3. **Exponential backoff** — On connection failure: 5s → 10s → 30s → 60s → 5min.
4. **Health status per trigger** — Show trigger connection status in the UI (connected/disconnected/error).
5. **Alert on prolonged failure** — If email trigger fails for >5 minutes, notify user.

**Phase:** Phase 2 (Fix broken features).

---

### P15. Workflow Editor UX Confusions

**The Problem:** Workflow editors are notoriously hard to use. Common UX pitfalls:
- New users don't know where to start (empty canvas syndrome)
- No visual distinction between trigger and action nodes
- Losing work on navigation (no auto-save)
- Unclear error messages when workflow validation fails
- No undo/redo
- Connection between nodes is unintuitive

**Warning Signs:**
- High bounce rate on editor page
- Users create workflows but never add nodes
- Support requests about "how to connect nodes"
- Workflows saved in invalid state

**Prevention Strategy:**
1. **Templates/examples** — Pre-built workflow templates users can start from.
2. **Guided onboarding** — First-time tutorial overlay: "Drag a trigger here → add an action → connect them".
3. **Auto-save** — Save draft every 30 seconds. Show "Saved" indicator. Warn before navigation.
4. **Undo/redo** — Use Zustand temporal middleware for state history.
5. **Validation feedback** — Real-time validation with inline error messages on invalid nodes.
6. **Visual hierarchy** — Trigger nodes visually distinct (different color/shape) from action nodes.

**Phase:** Phase 3 (UX Polish) — High impact on user perception.

---

### P16. Testing Async Job Processing

**The Problem:** BullMQ jobs are processed asynchronously in a separate worker. Testing the full flow (trigger → queue → process → complete) requires either:
- Real Redis + real queue processing (slow, flaky)
- Mocking BullMQ (misses integration bugs)
- Inline processing (bypasses the queue entirely)

**Warning Signs:**
- Tests that mock `queueService.addExecution()` but never verify the job is processed
- Integration tests that `await new Promise(r => setTimeout(r, 5000))` to wait for jobs
- Tests pass locally but fail in CI due to Redis timing
- No test coverage for retry/failure scenarios

**Prevention Strategy:**
1. **Test strategy per layer:**
   - **Unit tests:** Mock QueueService, test EngineService execution logic directly
   - **Integration tests:** Use `bullmq`'s `Queue.process()` with in-memory or test Redis
   - **E2E tests:** Real Redis, real queue, poll for completion with timeout
2. **`QueueService.processInline()`** — Add a test mode that processes jobs synchronously for deterministic testing.
3. **`testcontainers`** — Use Testcontainers for Redis in CI. Isolated per test suite.
4. **Event-driven assertions** — Listen for `execution.completed` events instead of polling.

**Phase:** Phase 2 (Testing infrastructure).

---

### P17. Flaky Integration Tests with PostgreSQL/Redis

**The Problem:** Integration tests sharing a database cause flakiness: parallel tests conflict, leftover data from previous runs, connection pool exhaustion.

**Warning Signs:**
- Tests pass individually but fail when run together
- Random "unique constraint violation" in tests
- "Too many connections" errors in test suite
- Test order dependency

**Prevention Strategy:**
1. **Transaction rollback** — Wrap each test in a transaction, rollback after. Fastest approach.
2. **Test database per suite** — Create/drop database per test file using `beforeAll`/`afterAll`.
3. **Deterministic seeds** — Use factories with unique identifiers (UUID) instead of fixed values.
4. **Connection pool limits** — Set `connection_limit=5` in test Prisma config.
5. **Cleanup hooks** — `afterEach` truncates all tables in dependency order.

**Phase:** Phase 2 (Testing infrastructure).

---

### P18. Database Migrations Breaking Running Jobs

**The Problem:** Running `prisma migrate deploy` during a deployment can lock tables or change schema while BullMQ jobs are mid-execution, causing execution failures or data corruption.

**Warning Signs:**
- Executions fail during deployment window
- `ALTER TABLE` locks cause query timeouts
- New columns with `NOT NULL` break in-flight INSERT queries
- Migration rolls forward but jobs use old schema

**Prevention Strategy:**
1. **Expand-then-contract** — Never remove/rename columns in one step. Step 1: Add new column (nullable). Step 2: Migrate data. Step 3: Remove old column (next release).
2. **Migration before code** — Run migrations as a separate init container in Docker, before starting the app.
3. **Queue drain before migration** — Pause BullMQ workers → wait for active jobs → run migration → restart workers.
4. **Online DDL** — For PostgreSQL, most `ALTER TABLE ADD COLUMN` are non-blocking. Avoid `ALTER TABLE ... SET NOT NULL` on large tables without `USING`.
5. **Test migrations** — Run migrations against a copy of production data in CI.

**Phase:** Phase 5 (Production deployment) — Plan from Phase 1.

---

### P19. No Circuit Breaker for External Services

**The Problem:** HTTP actions call external APIs. If an external API is down, every workflow using it will fail, retries will pile up, and the queue becomes clogged with doomed jobs.

**Warning Signs:**
- Queue depth growing while external API is down
- Same error repeated in thousands of execution logs
- BullMQ retry exhausting all attempts against a dead endpoint
- Cascading timeouts slowing down unrelated workflows

**Prevention Strategy:**
1. **Circuit breaker per destination** — Track failure rate per host. Open circuit after N consecutive failures. Fail fast without making the request.
2. **BullMQ job grouping** — Group jobs by destination host. Pause group when circuit opens.
3. **User notification** — Alert workflow owner when their HTTP action's target is unreachable.
4. **Backoff multiplication** — Increase backoff for jobs hitting the same failed endpoint.

**Phase:** Phase 4 (Advanced reliability) — Nice-to-have but prevents cascading failures.

---

### P20. Pervasive `any` Types Hide Runtime Errors

**The Problem:** The codebase uses `any` extensively for workflow definitions, node configs, trigger data, and event payloads. This eliminates TypeScript's compile-time safety for the most critical data structures.

**Warning Signs:**
- Runtime `TypeError: Cannot read property 'x' of undefined` in production
- Workflow definition changes break execution silently
- No IDE autocomplete for workflow configuration
- Frontend and backend diverge on expected types

**Prevention Strategy:**
1. **Shared types package** — `packages/shared/src/types/` already has skeleton types. Use them.
2. **Runtime validation** — Use Zod schemas for workflow definition validation at API boundary.
3. **Incremental typing** — Start with `WorkflowDefinition`, `NodeConfig`, `TriggerData`. Don't try to type everything at once.
4. **`strict: true`** in tsconfig — Enable gradually. Start with `noImplicitAny` in new files.

**Phase:** Phase 2 (Architecture) — Ongoing throughout all phases.

---

## Phase Mapping

| Phase | Pitfalls to Address | Priority |
|-------|-------------------|----------|
| **Phase 1: Security Hardening** | P1 (SSRF), P2 (SQL/Privilege), P3 (JWT), P4 (Credentials), P7 (WebSocket auth) | 🔴 CRITICAL |
| **Phase 2: Reliability & Testing** | P5 (Graceful shutdown), P6 (Queue all executions), P8 (Consolidate execution), P11 (Redis memory), P13 (Cron races), P14 (Email trigger), P16 (Async testing), P17 (Flaky tests), P20 (Types) | 🟡 HIGH |
| **Phase 3: UX & Dashboard** | P9 (N+1 queries), P12 (Socket.IO storms), P15 (Editor UX) | 🟡 MEDIUM |
| **Phase 4: Performance & Advanced** | P10 (Memory), P19 (Circuit breakers) | 🟢 LOWER |
| **Phase 5: Production Deployment** | P4 (Secrets management, revisit), P18 (Migration safety) | 🟡 HIGH |

---

## Prevention Checklist

### Before Phase 1 (Security)
- [ ] Remove hardcoded JWT secret fallback from `apps/frontend/middleware.ts`
- [ ] Remove `users` from `ALLOWED_TABLES` in `database.action.ts`
- [ ] Remove duplicated HTTP logic from `workflow.processor.ts` — use shared `HttpRequestAction`
- [ ] Add Redis authentication to docker-compose files
- [ ] Remove default password fallbacks from `docker-compose.prod.yml`
- [ ] Add ownership check to WebSocket room join handlers
- [ ] Add startup validation: fail if `JWT_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD` are unset or default
- [ ] Enable TLS certificate validation for IMAP (`rejectUnauthorized: true`)
- [ ] Disable Swagger in production (`NODE_ENV !== 'production'`)

### Before Phase 2 (Reliability)
- [ ] Enable `app.enableShutdownHooks()` in `main.ts`
- [ ] Implement queue drain on SIGTERM (pause workers, wait 30s, exit)
- [ ] Add startup cleanup: mark stale `RUNNING` executions as `FAILED`
- [ ] Route ALL executions through BullMQ queue (webhook, telegram, cron)
- [ ] Consolidate execution logic to single `EngineService` path
- [ ] Fix retry: call `queueService.addExecution()` after creating retry record
- [ ] Fix email trigger: add `@OnEvent('trigger.fired')` handler
- [ ] Add Cron service refresh on workflow activation/deactivation
- [ ] Set Redis `maxmemory` and `maxmemory-policy`
- [ ] Add pagination limit cap (`@Max(100)`) to all list endpoints

### Before Phase 3 (UX)
- [ ] Add workflow templates for new users
- [ ] Implement auto-save in workflow editor (30s interval + on blur)
- [ ] Add undo/redo to editor (Zustand temporal)
- [ ] Use cursor-based pagination for execution history
- [ ] Add `include` optimization to Prisma queries for step logs
- [ ] Configure Socket.IO reconnection with exponential backoff + jitter
- [ ] Add visual distinction between trigger and action nodes
- [ ] Show real-time execution progress with clear status indicators

### Before Phase 4 (Performance)
- [ ] Add step result size limits (1MB max per step)
- [ ] Monitor Redis memory in health check endpoint
- [ ] Profile N+1 queries in dashboard with Prisma query logging
- [ ] Add `--max-old-space-size` to production Docker CMD

### Before Phase 5 (Production Deploy)
- [ ] Commit Prisma migration files to git
- [ ] Add migration init container in Docker Compose
- [ ] Document expand-then-contract migration strategy
- [ ] Set up `.env.production.example` with all required vars (no values)
- [ ] Add HTTPS/TLS to nginx or document external proxy requirement
- [ ] Set `FRONTEND_URL` in production compose
- [ ] Add CI/CD pipeline: lint → test → build → deploy

---

## Key Insight: The #1 Architectural Mistake

The single biggest pitfall in this codebase is **duplicated execution paths**. The sandboxed processor (`workflow.processor.ts`) reimplements the engine with different behavior, fewer safety checks, and stub actions. This creates a situation where:

1. Security fixes to `HttpRequestAction` don't protect queue-processed workflows
2. New action types must be added in two places
3. The two paths diverge silently over time
4. Testing one path doesn't validate the other

**The fix:** One execution engine. One code path. Whether a workflow is triggered by webhook, cron, or manual run — it goes through BullMQ queue → `EngineService.executeWorkflow()`. The sandboxed processor becomes a thin wrapper that calls the shared engine, not a copy of it.

This single architectural change prevents P1, P5, P6, P8, and simplifies P16 — five pitfalls eliminated by one fix.

---

*Research completed: 2025-01-27 | Sources: Codebase audit (04-concerns.md), direct code analysis, workflow automation industry patterns*
