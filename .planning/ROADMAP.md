# ROADMAP.md — Mini-Zapier Workflow Automation Platform

> Version: 1.0 | Created: 2025-01-27 | Phases: 8

---

## Milestone: v1.0 — Complete ТЗ Requirements

### Phase 1: Security Hardening & Architecture Cleanup
**Goal:** Eliminate all 4 critical security vulnerabilities, remove dual execution path, establish Action Registry pattern.

| REQ | Description |
|-----|-------------|
| SEC-01 | Remove sandboxed processor, single EngineService execution path |
| SEC-02 | SSRF protection in HTTP Request action |
| SEC-03 | Database action restricted schema + role |
| SEC-04 | JWT secrets from env only, fail on missing |
| SEC-05 | Docker Compose prod env vars, no hardcoded passwords |
| SEC-06 | WebSocket JWT auth on connection |
| SEC-07 | Credential encryption AES-256-GCM |

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — ActionRegistry pattern + dead code removal (SEC-01) ✅ 2025-01-30
- [x] 01-02-PLAN.md — SSRF protection, DB restriction, JWT hardening, Docker secrets (SEC-02, SEC-03, SEC-04, SEC-05) ✅ 2025-01-30
- [x] 01-03-PLAN.md — WebSocket room authorization + credential encryption (SEC-06, SEC-07) ✅ 2025-01-30

**Status: ✅ COMPLETE**

**Success Criteria:**
- [x] `sandboxed.processor.ts` removed, all actions execute through EngineService ✅
- [x] ActionRegistry with Map<string, ActionHandler> replaces switch-case ✅
- [x] HTTP action rejects internal IPs (127.0.0.1, 10.x, 169.254.x, ::1, fc00::/7) ✅
- [x] DB action restricts to SELECT-only on non-sensitive tables (`users` excluded) ✅
- [x] No hardcoded secrets in any committed file ✅
- [x] WebSocket rejects connections without valid JWT, room-join verifies ownership ✅
- [x] CredentialService with AES-256-GCM encrypt/decrypt available (wired into actions in Phase 4) ✅

---

### Phase 2: Engine Reliability & Error Handling
**Goal:** Fix broken execution features, add pause/resume, implement robust retry and error notifications.

| REQ | Description |
|-----|-------------|
| EXE-01 | DAG topological execution via BullMQ |
| EXE-02 | Step logging (status, I/O, duration, errors) |
| EXE-04 | Workflow pause (suspend after current step) |
| EXE-05 | Resume paused workflow |
| EXE-06 | Exponential backoff retry (configurable) |
| EXE-07 | Manual retry from failed step |
| EXE-08 | Graceful shutdown for workers |
| ERR-01 | Fail notifications (in-app + email) |
| ERR-02 | Per-workflow error config |
| ERR-03 | Clear error display with context |
| ERR-04 | Structured logging (Pino) |
| INF-01 | Pino logger with correlation IDs |

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Foundation: Pino logging, schema migration, graceful shutdown, shared types ✅ 2025-01-30
- [x] 02-02-PLAN.md — Core engine: per-step retry, pause/resume, manual retry from failed step ✅ 2025-01-31
- [x] 02-03-PLAN.md — Error handling: per-user notifications, error display, logging context ✅ 2025-01-31

**Status: ✅ COMPLETE**

**Success Criteria:**
- [x] Retry with exponential backoff works (test with failing HTTP endpoint)
- [x] Paused workflow resumes from correct step with preserved data
- [x] Worker completes in-progress job before shutting down (SIGTERM test)
- [x] Failed execution sends toast notification to connected user
- [x] All execution logs have correlationId, actionType, duration

---

### Phase 3: Triggers — Fix & Complete
**Goal:** Fix broken Email trigger, harden Cron trigger, ensure all 3 trigger types work reliably.

| REQ | Description |
|-----|-------------|
| TRG-01 | Webhook trigger with payload forwarding |
| TRG-02 | Cron trigger with timezone, missed job recovery |
| TRG-03 | Email IMAP trigger with filtering |
| TRG-04 | Trigger configuration panels in editor |

**Success Criteria:**
- [ ] Webhook receives POST, starts execution with request body as input
- [ ] Cron fires on schedule (test with */1 * * * *), recovers missed jobs
- [ ] Email trigger connects to IMAP, detects new emails, passes subject/body/from
- [ ] Each trigger type has UI panel with validation (cron expression validator, URL validator, IMAP connection test)

---

### Phase 4: Actions — Complete & Harden
**Goal:** Ensure all 5 action types work correctly with proper configuration UI and data flow.

| REQ | Description |
|-----|-------------|
| ACT-01 | HTTP Request (GET/POST/PUT/DELETE, headers, body, timeout) |
| ACT-02 | Email Send via SMTP |
| ACT-03 | Telegram Send via Bot API |
| ACT-04 | Database Query (restricted, parameterized) |
| ACT-05 | Data Transform (JSONata with preview) |
| ACT-06 | Data flow between steps (output → input chaining) |
| ACT-07 | Action configuration panels with validation |

**Success Criteria:**
- [ ] HTTP action: request sent, response captured, timeout works
- [ ] Email action: sends via SMTP with HTML body
- [ ] Telegram action: sends message, handles rate limits
- [ ] DB action: executes SELECT with parameters, rejects DROP/INSERT
- [ ] Transform action: JSONata expression evaluated, preview shows result
- [ ] Each action receives previous step output via `{{steps.prev.output}}` template syntax
- [ ] All config panels have validation and help text

---

### Phase 5: Dashboard & Monitoring
**Goal:** Build comprehensive dashboard with analytics, filtering, and execution drill-down.

| REQ | Description |
|-----|-------------|
| DSH-01 | Dashboard metrics (total, active, executions 24h, success rate) |
| DSH-02 | Execution charts (bar, pie, line via Recharts) |
| DSH-03 | Workflow list with status, last exec, success rate |
| DSH-04 | Search & filter workflows |
| DSH-05 | Execution history with status/date filtering |
| DSH-06 | Execution detail with step-by-step log |
| EXE-03 | Real-time execution progress via WebSocket |

**Success Criteria:**
- [ ] Dashboard loads in <2s with metrics cards
- [ ] Charts render with real data (executions/day, success ratio, avg duration)
- [ ] Workflow list supports search by name and filter by status/trigger type
- [ ] Execution history: filterable by status (success/failed/running) and date range
- [ ] Click execution → step timeline with expand for input/output/error data
- [ ] Running execution shows live spinner on active step, green check on completed

---

### Phase 6: Editor UX Polish
**Goal:** Elevate editor experience with undo/redo, keyboard shortcuts, validation, and templates.

| REQ | Description |
|-----|-------------|
| EDT-01 | Drag-and-drop nodes from sidebar |
| EDT-02 | Edge connection with visual feedback |
| EDT-03 | Select, move, delete, duplicate nodes |
| EDT-04 | Undo/redo (50 levels) |
| EDT-05 | Zoom, pan, minimap |
| EDT-06 | Node config side panel |
| EDT-07 | Connection validation (no circular, no multi-trigger) |
| EDT-08 | Auto-save draft, explicit publish |
| EDT-09 | Keyboard shortcuts (Del, Ctrl+C/V/A/S/Z/Y) |

**Success Criteria:**
- [ ] Drag node from sidebar → appears on canvas at drop position
- [ ] Ctrl+Z undoes last 50 actions, Ctrl+Y redoes
- [ ] Invalid connection (creating cycle) shows red feedback, edge rejected
- [ ] Minimap shows workflow overview, clickable for navigation
- [ ] Ctrl+S saves, Ctrl+C/V copies/pastes nodes, Delete removes selected
- [ ] Config panel updates node data in real-time

---

### Phase 7: API Documentation & Quality
**Goal:** Complete Swagger docs, ensure API consistency, fix ESLint, add comprehensive tests.

| REQ | Description |
|-----|-------------|
| API-01 | Swagger docs for all endpoints |
| API-02 | REST conventions (methods, status codes, pagination, errors) |
| API-03 | Consistent error response format |
| TST-01 | Backend unit tests >80% coverage |
| TST-02 | Integration tests (trigger → execution flow) |
| TST-03 | Frontend component tests |
| TST-04 | ESLint configured and passing |
| TST-05 | Existing tests pass |

**Success Criteria:**
- [ ] Swagger UI shows all endpoints with examples and auth requirements
- [ ] All endpoints return `{ data, meta }` on success, `{ error: { code, message, details } }` on failure
- [ ] `npm run test` passes with >80% backend coverage
- [ ] Frontend tests: editor renders, dashboard loads, auth flow works
- [ ] `npm run lint` passes for both packages

---

### Phase 8: Production Readiness
**Goal:** Docker hardening, environment validation, final integration testing.

| REQ | Description |
|-----|-------------|
| INF-02 | Docker Compose prod works end-to-end |
| INF-03 | Env var validation at startup |
| ERR-02 | Per-workflow error configuration |

**Success Criteria:**
- [ ] `docker compose -f docker-compose.prod.yml up` builds and starts all services
- [ ] App starts successfully with all required env vars
- [ ] App fails fast with clear error if required env vars are missing
- [ ] Complete workflow test: create → configure trigger → add actions → publish → trigger → see execution → verify logs

---

## Traceability Matrix

| REQ-ID | Phase | Category |
|--------|-------|----------|
| SEC-01..07 | 1 | Security |
| EXE-01..02, EXE-04..08 | 2 | Execution |
| ERR-01, ERR-03..04 | 2 | Error Handling |
| INF-01 | 2 | Infrastructure |
| TRG-01..04 | 3 | Triggers |
| ACT-01..07 | 4 | Actions |
| DSH-01..06, EXE-03 | 5 | Dashboard |
| EDT-01..09 | 6 | Editor |
| API-01..03, TST-01..05 | 7 | Quality |
| INF-02..03, ERR-02 | 8 | Production |
