# Feature Research — Mini-Zapier Workflow Automation Platform

> GSD Research | Dimension: FEATURES | Date: 2025-01-27
> Sources: n8n docs, Zapier guides, Make comparisons, React Flow docs, AWS/IBM retry patterns, industry UX benchmarks

---

## Table Stakes (Users Expect These)

These features are **non-negotiable** — every workflow platform (Zapier, Make, n8n) ships them. Missing any = perceived as broken/incomplete.

| # | Feature | Why Table Stakes | Our Status |
|---|---------|-----------------|------------|
| 1 | Visual drag-and-drop editor with node palette | Core value prop of any workflow builder | ✅ Have |
| 2 | Trigger → Action sequential execution | Fundamental workflow model | ✅ Have |
| 3 | Webhook trigger with unique URL | Every platform supports this day-1 | ✅ Have |
| 4 | Cron/Schedule trigger | Basic automation requires time-based triggers | ✅ Have |
| 5 | HTTP Request action | Universal integration primitive | ✅ Have |
| 6 | Email send action | Most common notification channel | ✅ Have |
| 7 | Step-level execution logs | Users need to debug why workflows fail | ✅ Have |
| 8 | Execution history list | Must see what ran and when | ⚠️ Basic (no filtering) |
| 9 | Retry on failure | Transient errors are normal; auto-retry expected | ❌ Broken |
| 10 | Error notifications | Users must know when automations break | ⚠️ Partial (code exists, not wired to UI) |
| 11 | Workflow activate/deactivate | Must control when workflows run | ✅ Have |
| 12 | Dashboard with key metrics | Overview of automation health | ⚠️ Basic (4 stat cards, no charts) |
| 13 | Zoom, pan, minimap in editor | Canvas navigation for complex workflows | ✅ Have |
| 14 | Node configuration panel | Configure each step without code | ✅ Have |
| 15 | Workflow CRUD + search | Basic management | ✅ Have |

---

## Differentiators (Impressive Extras)

Features that go **beyond expectations** for a тестовое задание. These impress reviewers and show depth of understanding.

| # | Feature | Wow Factor | Effort | Recommended |
|---|---------|-----------|--------|-------------|
| 1 | Undo/Redo (Ctrl+Z/Y) | Shows polished UX thinking | Medium | ✅ Yes |
| 2 | Workflow templates gallery | Instant "aha moment" on first use | Medium | ✅ Yes |
| 3 | Execution replay / debug-in-editor | n8n killer feature, shows engineering depth | High | ⚠️ Stretch |
| 4 | Real-time execution visualization on canvas | Steps light up green/red as they run | Medium | ✅ Yes |
| 5 | Connection validation (type-safe edges) | Prevents invalid workflows | Low | ✅ Yes |
| 6 | Keyboard shortcuts (copy-paste, delete, select-all) | Power user delight | Low | ✅ Yes |
| 7 | Dashboard with Recharts analytics | Charts already in deps, just need data | Medium | ✅ Yes |
| 8 | Test/dry-run mode with mock data | Test without side effects | High | ⚠️ Stretch |
| 9 | Workflow pause/resume | Operational control | Medium | ✅ Yes |
| 10 | Circuit breaker pattern | Enterprise-grade resilience | High | ❌ Overkill |

---

## Category Details

### 1. Visual Workflow Editor

**Current State:** React Flow canvas with drag-and-drop palette, custom nodes, minimap, controls, animated edges, context menu, basic keyboard shortcuts (Delete, Escape).

#### Table Stakes
- ✅ Drag-and-drop node palette (sidebar with triggers & actions)
- ✅ Custom node components (color-coded by type, config panels)
- ✅ Edge connections with animated flow visualization
- ✅ Zoom/pan/fit-view controls + minimap
- ✅ Right-click context menu (Configure, Duplicate, Delete)
- ❌ **Connection validation** — currently any node can connect to any node; need to enforce:
  - Triggers can only be source nodes (no incoming edges)
  - Actions must have at least one incoming edge
  - No self-loops, no duplicate connections
  - Maximum one trigger per workflow (or explicit multi-trigger support)

#### Nice-to-Haves (Recommended for this project)
- ❌ **Undo/Redo** — snapshot-based history stack
  - Pattern: Store `{nodes, edges}` snapshots on each meaningful change
  - React Flow provides `useUndoRedo` example with `takeSnapshot()` before each mutation
  - Keybindings: `Ctrl+Z` (undo), `Ctrl+Shift+Z` / `Ctrl+Y` (redo)
  - Disable buttons when stack empty
- ❌ **Copy-Paste nodes** — `Ctrl+C/V` with offset positioning
  - Serialize selected nodes to clipboard, paste with +20px offset
  - Currently only "Duplicate" via context menu exists
- ❌ **Multi-select** — `Shift+click` or rubber-band selection
  - React Flow supports this natively via `selectionOnDrag` prop
- ❌ **Auto-layout** — ELKjs for automatic node arrangement
  - Useful when importing workflows or after many manual edits

#### UX Patterns from Industry
- **n8n:** Node palette as expandable sidebar with search, categorized by type
- **Make:** Circular node layout with radial connections
- **Zapier:** Linear step-by-step (simpler but limiting)
- **Best practice:** Progressive disclosure — simple for beginners, powerful for experts

#### Implementation Recommendations
```
Priority: connection-validation > undo-redo > keyboard-shortcuts > copy-paste > multi-select
```
- Connection validation: Use `isValidConnection` callback in React Flow
- Undo/redo: ~100 lines of code (history array + pointer)
- Keyboard shortcuts: Extend existing `useEffect` keydown handler

---

### 2. Triggers

**Current State:** Webhook ✅, Cron ✅, Email IMAP ❌(broken), Telegram ✅

#### Webhook Trigger — Security Best Practices

**Current:** Token-based (UUID in URL), no signature validation, no payload validation.

**Table Stakes:**
- ✅ Unique URL per workflow (`/webhooks/:token`)
- ✅ Only ACTIVE workflows accept webhooks
- ❌ **HMAC signature validation** — critical security feature
  - Sign with SHA-256 over raw body + secret
  - Header: `X-Webhook-Signature: sha256=<hex>`
  - Constant-time comparison (`crypto.timingSafeEqual`)
  - Per-workflow secret (auto-generated, shown once)
- ❌ **Payload schema validation** — prevent injection
  - Validate Content-Type (`application/json` only)
  - Size limits (e.g., 1MB max)
  - Optional JSON schema per webhook (Zod/Joi on backend)
- ❌ **Replay protection** — timestamp + event ID
  - Reject payloads older than 5 minutes
  - Deduplicate by event ID (store last N IDs)

**Nice-to-Haves:**
- IP allowlist (secondary defense)
- Rate limiting per webhook URL (already have Throttler)
- Webhook test endpoint (simulate payload from UI)

#### Cron Trigger — Best Practices

**Current:** `node-cron` with in-memory schedule map, no timezone handling, no missed job recovery.

**Table Stakes:**
- ✅ Cron expression validation
- ✅ Dynamic schedule management (start/stop on activate/deactivate)
- ❌ **Timezone support** — store all schedules in UTC, allow user to specify timezone
  - Config: `{ cronExpression: "0 9 * * MON-FRI", timezone: "Europe/Moscow" }`
  - `node-cron` supports `timezone` option natively
  - Display in user's local timezone on frontend
- ❌ **Missed job recovery** — after server restart, check last execution time
  - On startup: compare `lastTriggeredAt` with expected schedule
  - If missed: execute immediately (with flag `{ recovery: true }`)
  - Cap: only recover jobs missed within last hour (avoid flood)
- ❌ **Human-readable preview** — "Every weekday at 9:00 AM UTC"
  - Library: `cronstrue` (cron expression to human-readable text)

#### Email Trigger — Alternatives to IMAP

**Current:** IMAP polling every 60s — broken due to `imap` package issues.

**Recommended Approaches (in order of preference):**

1. **Fix IMAP with `imapflow` package** (recommended for ТЗ)
   - Modern async/await IMAP client, maintained actively
   - Supports IDLE (push notifications instead of polling)
   - `npm install imapflow` — drop-in replacement
   - Effort: ~2-3 hours to rewrite email-trigger.service.ts

2. **Polling with `mailparser` + `nodemailer/imap`**
   - Use `nodemailer`'s IMAP transport for reliable connection
   - Parse with `mailparser` for rich email parsing
   - Keep 60s polling (simpler than IDLE)

3. **JMAP protocol** (future/overkill)
   - Modern replacement for IMAP (JSON over HTTP)
   - Very few providers support it yet
   - Not recommended for this project

**Recommendation:** Fix with `imapflow` + IDLE support for push-based email monitoring.

---

### 3. Actions — Extensible System

**Current State:** 5 action types hardcoded in EngineService with switch-case dispatch.

#### Table Stakes
- ✅ HTTP Request (with axios-retry for 5xx/network errors)
- ✅ Email Send (via nodemailer/SMTP)
- ✅ Telegram Send (via Telegram Bot API)
- ✅ Database Query (via Prisma raw SQL — ⚠️ SQL injection risk)
- ✅ Data Transform (via JSONata expressions)

#### Input/Output Mapping Between Nodes

**Current:** `context.stepResults[nodeId]` passes data between nodes, but no UI for mapping.

**Best Practice Pattern:**
```typescript
// Node config with template expressions referencing previous steps
{
  url: "https://api.example.com/users/{{steps.trigger.body.userId}}",
  headers: { "Authorization": "Bearer {{steps.http1.output.token}}" }
}
```

**Recommended Implementation:**
- Template syntax: `{{steps.<nodeId>.<path>}}` (Mustache-like)
- Autocomplete dropdown showing available step outputs
- JSONPath or dot notation for nested access
- Preview resolved values in test mode

#### Credential Management

**Current:** Credentials stored directly in workflow definition JSON (security risk).

**Best Practice:**
- Separate `Credential` entity in database (encrypted at rest)
- Reference by ID in node config: `{ credentialId: "cred_abc123" }`
- Decrypt only at execution time
- UI: Credential management page, dropdown selector in node config
- **For this project:** At minimum, move Telegram bot tokens and SMTP credentials out of workflow JSON into environment/user settings

#### Action System Extensibility

**Current:** Hardcoded switch-case in `EngineService.executeStep()`.

**Recommended Pattern:**
```typescript
// Action interface
interface IAction {
  type: string;
  execute(config: any, context: ExecutionContext): Promise<any>;
  validate(config: any): ValidationResult;
  getSchema(): JsonSchema; // For UI config panel generation
}

// Registry pattern
@Injectable()
class ActionRegistry {
  private actions = new Map<string, IAction>();
  register(action: IAction) { this.actions.set(action.type, action); }
  get(type: string) { return this.actions.get(type); }
}
```
- NestJS discovery: Use `@Injectable()` + `ModuleRef` to auto-register actions
- Each action self-describes its config schema (drives UI)
- Validation before execution (prevent runtime config errors)

---

### 4. Execution Engine

**Current State:** Sequential topological sort execution, status tracking (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED/PAUSED), step-level logging, BullMQ queue with 3 attempts.

#### Execution States — Best Practice FSM

```
                    ┌──────────┐
         ┌─────────│  PENDING  │─────────┐
         │         └──────────┘         │
         │              │               │
         │         start│          cancel│
         │              ▼               ▼
         │         ┌──────────┐    ┌───────────┐
         │         │ RUNNING  │───▶│ CANCELLED │
         │         └──────────┘    └───────────┘
         │          │    │    │
         │   success│    │    │pause
         │          ▼    │    ▼
         │   ┌──────────┐│  ┌────────┐
         │   │COMPLETED ││  │ PAUSED │
         │   └──────────┘│  └────────┘
         │               │    │
         │          fail │    │resume
         │               ▼    │
         │         ┌──────────┘
         └────────▶│  FAILED  │
                   └──────────┘
```

**Table Stakes:**
- ✅ PENDING → RUNNING → COMPLETED/FAILED state transitions
- ❌ **PAUSED state** — save execution context, resume from last completed step
  - Store `currentStepIndex` and `stepResults` in execution record
  - On resume: load context, continue from saved step
  - Auto-pause: on Nth consecutive failure (configurable)
- ❌ **CANCELLED state** — user-initiated abort of running execution
  - BullMQ job removal + execution status update
  - Grace period for current step to complete

#### Step-Level Logging — Enhancement

**Current:** Each step creates `ExecutionStepLog` with input/output/error/duration. ✅ Solid foundation.

**Enhancements Needed:**
- ❌ **Structured output** — store `output` as typed JSON (not just any)
- ❌ **Retry count tracking** — `retryCount` field exists but never incremented
- ❌ **Step-level retry** — retry individual steps, not entire workflow
- ❌ **Log levels** — DEBUG/INFO/WARN/ERROR for step internal operations

#### Parallel Branch Execution

**Not needed for ТЗ** but worth noting the architecture supports it:
- Topological sort already handles DAG (not just linear chain)
- Could execute independent branches in parallel with `Promise.all()`
- Requires: no shared mutable state between branches

#### Conditional Logic

**Current:** Not implemented. All nodes execute sequentially.

**Recommended (if time permits):**
- IF/ELSE node type with JSONata expression evaluation
- Skip downstream nodes if condition not met (status: SKIPPED)
- UI: Two output handles (true/false) with separate edge paths

---

### 5. Error Handling

**Current State:** Errors caught at step/execution level, stored in DB, event emitted, BullMQ retries whole job 3x. Individual step retry broken.

#### Retry Strategies — Best Practices

**Exponential Backoff with Jitter:**
```typescript
// Recommended configuration
const retryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,     // 1 second
  maxDelay: 30000,     // 30 seconds cap
  backoffMultiplier: 2, // 1s → 2s → 4s
  jitterPercent: 25,    // ±25% randomness
};

// Calculate delay
function getRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  const jitter = delay * (config.jitterPercent / 100);
  return delay + (Math.random() * 2 - 1) * jitter;
}
```

**Per-Step Retry (Recommended Implementation):**
```typescript
async executeStepWithRetry(node, context, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.executeStep(node, context);
    } catch (error) {
      if (attempt === maxRetries || !this.isRetryable(error)) throw error;
      const delay = getRetryDelay(attempt, this.retryConfig);
      await new Promise(r => setTimeout(r, delay));
      // Update step log retryCount
    }
  }
}

isRetryable(error): boolean {
  // Retry: network errors, 5xx, timeouts, rate limits (429)
  // Don't retry: 4xx client errors, validation failures, auth errors
  if (error.response?.status) {
    return error.response.status >= 500 || error.response.status === 429;
  }
  return true; // Network errors are retryable
}
```

#### Circuit Breaker Pattern

**Not recommended for this project scope** — adds complexity without clear value for a тестовое задание. BullMQ's built-in retry + per-step retry is sufficient.

If implemented, pattern would be:
- Track failure count per action type per time window
- Open circuit after N failures → fast-fail without executing
- Half-open: allow one request through to test recovery
- Libraries: `opossum` (Node.js circuit breaker)

#### Dead Letter Queue

**Current:** BullMQ keeps last 200 failed jobs. Not surfaced in UI.

**Recommended:**
- ❌ Surface failed BullMQ jobs in admin UI (already stored in Redis)
- ❌ "Retry failed" button per execution (endpoint exists: `POST /executions/:id/retry`)
- ❌ Manual retry from UI — already re-executes entire workflow with same trigger data
- Consider: retry from specific failed step (advanced, store checkpoint)

#### Error Notifications

**Current:** `NotificationsService` listens to `execution.failed` events, sends Telegram/Email alerts. Config via env vars.

**Enhancements:**
- ❌ **UI notification bell** — show unread failure count in header
- ❌ **Per-workflow notification settings** — choose channels per workflow
- ❌ **Notification history page** — list of sent alerts
- ❌ **Digest mode** — batch errors into hourly/daily summaries (prevent spam)

---

### 6. Dashboard & Monitoring

**Current State:** 4 stat cards (total workflows, executions, completed, failed), recent executions list, basic execution detail page.

#### Key Metrics — What to Show

**Header KPI Cards (already have 4, enhance to include):**

| Metric | Current | Enhancement |
|--------|---------|-------------|
| Total Workflows | ✅ | Add trend arrow (↑↓) |
| Total Executions | ✅ | Add "today" / "this week" filter |
| Success Rate | ❌ | Calculate `completed / total * 100%` |
| Avg Duration | ❌ | Mean execution time |
| Active Workflows | ❌ | Count of status=ACTIVE |
| Failed (last 24h) | ❌ | Urgency metric with red highlight |

**Charts (Recharts already in dependencies):**
- ❌ **Execution timeline** — bar chart showing executions per day/hour (success vs failed stacked)
- ❌ **Success rate trend** — line chart over last 7/30 days
- ❌ **Duration distribution** — histogram or avg duration per workflow
- ❌ **Top failing workflows** — ranked list with failure counts

#### Execution History — Filtering & Search

**Current:** Paginated list with status badge, workflow name, date, duration.

**Enhancements:**
- ❌ **Filter by status** — dropdown: All / Running / Completed / Failed
- ❌ **Filter by workflow** — dropdown with workflow names
- ❌ **Date range picker** — from/to date filter
- ❌ **Search by execution ID** — for debugging specific runs
- ❌ **Bulk retry** — select multiple failed executions, retry all

#### Real-Time Status

**Current:** Polling every 3 seconds on execution detail page. Socket.IO available but not used for live updates.

**Recommended:**
- ❌ **WebSocket for live execution updates** — Socket.IO already integrated
  - Emit step completion events → update execution detail in real-time
  - Show running indicator on dashboard for active executions
  - Remove 3-second polling (anti-pattern, wastes resources)
- ❌ **Live activity feed** — last 10 events scrolling on dashboard
  - "Workflow X step 3/5 completed" → "Workflow Y triggered by webhook"

---

### 7. UX Polish

#### Onboarding

**Current:** None. User lands on empty dashboard.

**Recommended:**
- ❌ **Empty state CTAs** — "Create your first workflow" button on empty dashboard
- ❌ **Quickstart guide** — 3-step overlay: "1. Create workflow → 2. Add trigger → 3. Add actions → Activate!"
- ❌ **Tooltip hints** — first-visit tooltips on key UI elements (editor palette, node config, activate button)

#### Workflow Templates

**Current:** None.

**Recommended Templates (3-5 pre-built):**
1. **"Webhook → Email Notification"** — simplest possible workflow
2. **"Scheduled Data Transform"** — Cron → HTTP GET → Transform → Database
3. **"Telegram Bot Command Handler"** — Telegram trigger → Transform → Telegram reply
4. **"API Health Check"** — Cron every 5min → HTTP Request → IF status != 200 → Email alert
5. **"Data Pipeline"** — Webhook → Transform → Database → Email confirmation

**Implementation:**
- Store as JSON in `public/templates/` or database seed
- Template gallery page with preview cards
- "Use this template" → creates new workflow with pre-configured nodes
- Can be done without backend changes (frontend-only JSON import)

#### Test/Debug Mode

**Current:** Execute runs live with real side effects.

**Recommended (realistic scope):**
- ❌ **Test with sample data** — button to run workflow with mock trigger payload
  - UI: "Test" button → modal with JSON editor for trigger data
  - Backend: same execution path but flagged as `test: true`
  - Show results inline without affecting execution history (or mark as "test")
- ❌ **Node-level test** — test individual action with sample input
  - "Test this step" button in node config panel
  - Returns output preview without executing downstream nodes
- ⚠️ **Pinned data (n8n-style)** — freeze a node's output for repeated testing
  - Advanced feature, skip for ТЗ

#### Execution Replay

**Current:** Can view past execution details but cannot replay or debug.

**Recommended (stretch goal):**
- Load past execution data into editor canvas
- Highlight each step with its result (success/fail)
- Click step to see input/output data
- "Re-run from here" button on any failed step
- This is an impressive differentiator but high effort (~2-3 days)

---

## Prioritized Feature List

### P0 — Must Fix (Broken Features)

| # | Feature | Category | Effort | Impact |
|---|---------|----------|--------|--------|
| 1 | Fix retry logic (per-step exponential backoff) | Error Handling | 4h | Critical — ТЗ requires working retry |
| 2 | Fix Email IMAP trigger (switch to `imapflow`) | Triggers | 3h | Critical — ТЗ requires 3 triggers |
| 3 | Fix ESLint configuration | Dev Quality | 1h | Required for clean codebase |
| 4 | Wire error notifications to UI | Error Handling | 2h | ТЗ requires error notifications |

### P1 — Must Have (Missing ТЗ Requirements)

| # | Feature | Category | Effort | Impact |
|---|---------|----------|--------|--------|
| 5 | Workflow pause/resume | Execution Engine | 4h | ТЗ explicit requirement |
| 6 | Dashboard statistics with charts | Dashboard | 6h | ТЗ: "полноценный дашборд" |
| 7 | Execution history filtering (status, workflow, date) | Dashboard | 4h | ТЗ: execution history |
| 8 | Connection validation in editor | Editor | 2h | Prevent invalid workflows |
| 9 | Cron timezone support | Triggers | 2h | Expected for any scheduler |
| 10 | Webhook HMAC signature validation | Triggers | 3h | Security requirement |

### P2 — Should Have (High Impact Polish)

| # | Feature | Category | Effort | Impact |
|---|---------|----------|--------|--------|
| 11 | Undo/Redo in editor | Editor | 3h | Major UX improvement |
| 12 | Keyboard shortcuts (Ctrl+C/V, Ctrl+Z, Ctrl+A) | Editor | 2h | Power user experience |
| 13 | Workflow templates (3-5 pre-built) | UX Polish | 4h | Impressive onboarding |
| 14 | Real-time execution via WebSocket (replace polling) | Dashboard | 3h | Performance + wow factor |
| 15 | Empty states with CTAs | UX Polish | 2h | First-time user experience |
| 16 | Test workflow with sample data | UX Polish | 3h | Debug without side effects |

### P3 — Nice to Have (Differentiators)

| # | Feature | Category | Effort | Impact |
|---|---------|----------|--------|--------|
| 17 | Execution visualization on canvas (live step status) | Editor | 6h | Impressive demo feature |
| 18 | Multi-select nodes (rubber-band) | Editor | 1h | React Flow native support |
| 19 | Notification bell in header | Dashboard | 2h | Professional feel |
| 20 | Auto-layout (ELKjs) | Editor | 4h | Complex workflow support |
| 21 | Cron missed job recovery | Triggers | 2h | Production robustness |
| 22 | Human-readable cron preview (`cronstrue`) | Editor | 1h | Small UX win |
| 23 | Execution replay in editor | UX Polish | 12h | n8n-level feature |
| 24 | Conditional IF/ELSE node | Execution Engine | 8h | Advanced workflows |

### Effort Summary

| Priority | Items | Total Effort | Value |
|----------|-------|-------------|-------|
| P0 — Must Fix | 4 | ~10h | Unblock ТЗ requirements |
| P1 — Must Have | 6 | ~21h | Complete ТЗ scope |
| P2 — Should Have | 6 | ~17h | Polish & impress |
| P3 — Nice to Have | 8 | ~36h | Differentiators |
| **Total Recommended (P0+P1+P2)** | **16** | **~48h** | **Complete + impressive** |

---

## Key Technical Decisions

### 1. Retry: Per-Step vs Per-Workflow
**Decision:** Per-step retry with exponential backoff
**Rationale:** Current BullMQ retry re-executes entire workflow (wasteful). Per-step retry only re-attempts the failed action, preserving completed step results.

### 2. Email Trigger: IMAP Fix vs Alternative
**Decision:** Replace `imap` package with `imapflow`
**Rationale:** Modern async/await API, IDLE support (push instead of poll), actively maintained. Minimal code change (~100 lines).

### 3. Real-time Updates: Polling vs WebSocket
**Decision:** Migrate to Socket.IO (already installed)
**Rationale:** 3-second polling is wasteful and delayed. Socket.IO infrastructure exists, just needs event wiring.

### 4. Templates: Database vs Static JSON
**Decision:** Static JSON files in frontend
**Rationale:** Simplest approach, no backend changes needed. Templates are read-only reference workflows.

### 5. Dashboard Charts: Custom vs Library
**Decision:** Use Recharts (already in dependencies)
**Rationale:** Already installed, well-integrated with React. Need to add aggregation API endpoints on backend.

---

## References

- [React Flow Undo/Redo Example](https://reactflow.dev/examples/interaction/undo-redo)
- [React Flow Connection Validation](https://reactflow.dev/examples)
- [AWS Retry with Backoff Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
- [IBM Robust Retry Mechanism](https://developer.ibm.com/articles/microservices_retry/)
- [n8n Debug and Re-run Executions](https://docs.n8n.io/workflows/executions/debug/)
- [Webhook Security: HMAC + Replay Protection](https://hooque.io/guides/webhook-security/)
- [Workflow Automation Metrics](https://latenode.com/blog/workflow-automation-business-processes/automation-roi-metrics/top-metrics-for-workflow-performance-monitoring)
- [n8n vs Zapier vs Make Comparison](https://www.allaboutai.com/comparison/n8n-vs-zapier-vs-make/)
