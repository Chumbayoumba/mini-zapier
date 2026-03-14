# REQUIREMENTS.md — Mini-Zapier Workflow Automation Platform

> Version: 1.0 | Created: 2025-01-27 | Milestone: v1.0

---

## v1 Requirements

### Security (SEC)

- [ ] **SEC-01**: System removes dual execution path — all workflow execution goes through single EngineService with validated action handlers
- [ ] **SEC-02**: HTTP Request action blocks internal IPs, metadata endpoints, and DNS rebinding attacks (SSRF protection)
- [ ] **SEC-03**: Database action uses restricted PostgreSQL role with separate schema, excludes sensitive tables (users), enforces row-level filtering by userId
- [ ] **SEC-04**: JWT secrets are loaded exclusively from environment variables with no hardcoded fallbacks; startup fails if secrets are missing
- [ ] **SEC-05**: Docker Compose production config uses environment variables for all credentials, no hardcoded passwords
- [ ] **SEC-06**: WebSocket gateway validates JWT token on connection and rejects unauthenticated clients
- [ ] **SEC-07**: User credentials (SMTP, IMAP, Telegram tokens) stored encrypted at rest using AES-256-GCM

### Triggers (TRG)

- [ ] **TRG-01**: User can create a Webhook trigger that receives HTTP POST requests and starts workflow execution with the request payload as input data
- [ ] **TRG-02**: User can create a Schedule (Cron) trigger with timezone support that executes workflow on defined schedule, with missed job recovery
- [ ] **TRG-03**: User can create an Email trigger (IMAP) that monitors an inbox and starts workflow when new email matching filter criteria arrives
- [ ] **TRG-04**: Each trigger type has a dedicated configuration panel in the workflow editor with input validation

### Actions (ACT)

- [ ] **ACT-01**: User can add an HTTP Request action that sends GET/POST/PUT/DELETE requests with configurable URL, headers, body, and timeout
- [ ] **ACT-02**: User can add an Email Send action that sends emails via SMTP with configurable recipients, subject, and HTML/text body
- [ ] **ACT-03**: User can add a Telegram Send action that sends messages to a Telegram chat via bot token with configurable chat ID and message text
- [ ] **ACT-04**: User can add a Database Query action that executes read-only SQL queries against a restricted user-data schema with parameterized inputs
- [ ] **ACT-05**: User can add a Data Transform action that transforms JSON data between steps using JSONata expressions with preview/test capability
- [ ] **ACT-06**: Each action receives output from previous step as input and passes its output to the next step (data flow between nodes)
- [ ] **ACT-07**: Each action type has a dedicated configuration panel in the workflow editor with input validation and help text

### Workflow Editor (EDT)

- [ ] **EDT-01**: User can drag action/trigger nodes from a sidebar palette onto the canvas to build workflow
- [ ] **EDT-02**: User can connect nodes by dragging edges between output and input ports with visual feedback
- [ ] **EDT-03**: User can select, move, delete, and duplicate nodes on the canvas
- [ ] **EDT-04**: User can undo/redo changes with Ctrl+Z/Ctrl+Y (at least 50 levels of undo history)
- [ ] **EDT-05**: User can zoom in/out, pan, and use minimap to navigate the canvas
- [ ] **EDT-06**: User can configure each node by clicking it and editing properties in a side panel
- [ ] **EDT-07**: Editor validates connections and prevents invalid edges (e.g., multiple triggers, circular references)
- [ ] **EDT-08**: Workflow is auto-saved as draft; user explicitly publishes to activate
- [ ] **EDT-09**: User can use keyboard shortcuts for common operations (Delete, Ctrl+C/V, Ctrl+A, Ctrl+S)

### Execution Engine (EXE)

- [ ] **EXE-01**: System executes workflow steps sequentially following DAG topological order through BullMQ job queue
- [ ] **EXE-02**: Each execution step is logged with status (pending/running/completed/failed/skipped), input data, output data, duration, and error details
- [ ] **EXE-03**: User can view real-time execution progress via WebSocket — nodes on canvas show live status (running spinner, green check, red X)
- [ ] **EXE-04**: System supports workflow pause — user can pause a running workflow, which suspends execution after current step completes
- [ ] **EXE-05**: User can resume a paused workflow from where it stopped
- [ ] **EXE-06**: System retries failed steps with configurable exponential backoff (max attempts, base delay, jitter)
- [ ] **EXE-07**: User can manually retry a failed execution from the failed step
- [ ] **EXE-08**: System handles graceful shutdown — in-progress jobs are completed before worker stops

### Error Handling (ERR)

- [ ] **ERR-01**: System sends notification (in-app toast + optional email) when a workflow execution fails after all retry attempts
- [ ] **ERR-02**: User can configure per-workflow error behavior: retry count, notification preferences
- [ ] **ERR-03**: Failed executions show clear error message with step context (which node failed, what input caused it, stack trace)
- [ ] **ERR-04**: System logs all errors with structured format (Pino logger) including execution ID, step ID, action type, and timestamp

### Dashboard (DSH)

- [ ] **DSH-01**: User sees a dashboard homepage with key metrics: total workflows, active workflows, total executions (24h), success rate (24h)
- [ ] **DSH-02**: Dashboard shows execution charts (Recharts): executions over time (bar chart), success/failure ratio (pie chart), average duration trend (line chart)
- [ ] **DSH-03**: User can view list of all workflows with status (active/inactive/draft), last execution time, success rate, and execution count
- [ ] **DSH-04**: User can search and filter workflows by name, status, and trigger type
- [ ] **DSH-05**: User can view execution history for a specific workflow with filtering by status (success/failed/running) and date range
- [ ] **DSH-06**: User can click on an execution to see step-by-step log with timing, input/output data, and errors

### API & Documentation (API)

- [ ] **API-01**: All backend endpoints are documented in Swagger with request/response schemas, authentication requirements, and example values
- [ ] **API-02**: API follows REST conventions: proper HTTP methods, status codes, pagination (cursor-based), error format
- [ ] **API-03**: API returns consistent error responses with code, message, and details fields

### Testing & Quality (TST)

- [ ] **TST-01**: Backend unit tests cover all services with >80% line coverage
- [ ] **TST-02**: Backend integration tests verify trigger-to-execution flow end-to-end
- [ ] **TST-03**: Frontend has component tests for critical flows (workflow editor, dashboard, auth)
- [ ] **TST-04**: ESLint is properly configured and passes for both backend and frontend
- [ ] **TST-05**: All existing tests pass without modification to new code

### Infrastructure (INF)

- [ ] **INF-01**: Pino logger replaces NestJS default logger with structured JSON output and correlation IDs per execution
- [ ] **INF-02**: Docker production setup works end-to-end (build, migrate, seed, start) with a single `docker compose up`
- [ ] **INF-03**: Environment variables are validated at startup with clear error messages for missing required values

---

## v2 Requirements (Deferred)

- [ ] OAuth login (Google, GitHub)
- [ ] Workflow import/export (JSON)
- [ ] Conditional branching (if/else nodes)
- [ ] Parallel execution branches
- [ ] Custom action plugins
- [ ] Team collaboration (shared workflows)
- [ ] Execution replay/debug mode
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Rate limiting per user
- [ ] Webhook signature verification

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenancy | Single-user focus for тестовое задание |
| Payment/billing | Not relevant to ТЗ |
| Custom code execution (JS/Python) | Security risk, not in ТЗ |
| Mobile responsive editor | Desktop-first is fine for тестовое |
| i18n/l10n | Russian + English is enough |
| Circuit breaker pattern | Overkill for test assignment |

---

## Traceability

> Filled by roadmap — maps each REQ to a phase.

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SEC-01..07 | TBD | Pending |
| TRG-01..04 | TBD | Pending |
| ACT-01..07 | TBD | Pending |
| EDT-01..09 | TBD | Pending |
| EXE-01..08 | TBD | Pending |
| ERR-01..04 | TBD | Pending |
| DSH-01..06 | TBD | Pending |
| API-01..03 | TBD | Pending |
| TST-01..05 | TBD | Pending |
| INF-01..03 | TBD | Pending |
