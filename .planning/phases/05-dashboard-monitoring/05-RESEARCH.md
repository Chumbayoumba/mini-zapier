# Phase 5: Dashboard & Monitoring — Research

> Generated: auto | Project: FlowForge (mini-Zapier)

---

## 1. Current State

### 1.1 Frontend Pages (Next.js App Router)

| Route | File | Status | Description |
|-------|------|--------|-------------|
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | ✅ Exists | Basic stats (4 cards), quick actions CTA, recent executions list |
| `/workflows` | `app/(dashboard)/workflows/page.tsx` | ✅ Exists | Workflow grid with search, sort (name/status/updatedAt), pagination, activate/deactivate/delete |
| `/workflows/[id]` | `app/(dashboard)/workflows/[id]/page.tsx` | ✅ Exists | Workflow detail page |
| `/workflows/[id]/editor` | `app/(dashboard)/workflows/[id]/editor/page.tsx` | ✅ Exists | Visual workflow editor (XYFlow) |
| `/executions` | `app/(dashboard)/executions/page.tsx` | ✅ Exists | Basic paginated list with status badges. **No filters, no search** |
| `/executions/[id]` | `app/(dashboard)/executions/[id]/page.tsx` | ✅ Exists | Execution detail: info cards (started, completed, duration, steps), error section with failed step context (input, stack trace), step log list with expandable input/output/stack |
| `/settings` | `app/(dashboard)/settings/page.tsx` | ✅ Exists | Settings page |

### 1.2 Frontend Components

| Component | File | Status |
|-----------|------|--------|
| `StatsCards` | `components/dashboard/stats-cards.tsx` | ✅ Exists — 6-card grid (Total, Active, Executions, Success Rate, Failed, Avg Duration). **Not used** on main dashboard page (page has its own 4-card inline implementation) |
| `WorkflowStatusChart` (Pie) | `components/dashboard/workflow-status-chart.tsx` | ✅ Exists — Recharts PieChart, donut style |
| `ExecutionBarChart` | `components/dashboard/workflow-status-chart.tsx` | ✅ Exists — Recharts BarChart (7 days, success/failed) |
| `RecentExecutions` | `components/dashboard/recent-executions.tsx` | ✅ Exists — list with status dots, duration, time. **Not imported** on dashboard page |
| `ExecutionTimeline` | `components/dashboard/execution-timeline.tsx` | ✅ Exists — vertical timeline with step status dots, error display. **Not imported** on execution detail page |
| `WorkflowList` | `components/workflows/workflow-list.tsx` | ✅ Exists — grid of WorkflowCards |
| `WorkflowCard` | `components/workflows/workflow-card.tsx` | ✅ Exists — card with status, version, trigger badge, run/edit/delete |
| `Sidebar` | `components/layout/sidebar.tsx` | ✅ Exists — nav: Dashboard, Workflows, Executions, Settings |

### 1.3 Hooks

| Hook | File | Description |
|------|------|-------------|
| `useExecutions(page, status?)` | `hooks/use-executions.ts` | Paginated execution list, optional status filter |
| `useExecution(id)` | `hooks/use-executions.ts` | Single execution detail, **refetchInterval: 3000ms** (polling) |
| `useDashboardStats()` | `hooks/use-executions.ts` | GET `/executions/stats` |
| `useRecentExecutions()` | `hooks/use-executions.ts` | GET `/executions?limit=10` (no dedicated recent endpoint used) |
| `useWorkflows(page)` | `hooks/use-workflows.ts` | Paginated workflow list |
| `useWorkflow(id)` | `hooks/use-workflows.ts` | Single workflow detail |
| `useWebSocket()` | `hooks/use-websocket.ts` | Socket.IO client, join/leave execution rooms |

### 1.4 Backend API Endpoints

**Workflows Controller** (`/api/workflows`):
| Method | Path | Description |
|--------|------|-------------|
| POST | `/workflows` | Create workflow |
| GET | `/workflows` | List workflows (page, limit) |
| GET | `/workflows/:id` | Get by ID |
| PATCH | `/workflows/:id` | Update workflow |
| DELETE | `/workflows/:id` | Delete workflow |
| POST | `/workflows/:id/activate` | Activate |
| POST | `/workflows/:id/deactivate` | Deactivate |
| POST | `/workflows/:id/execute` | Manual execute |
| GET | `/workflows/:id/versions` | Version history |

**Executions Controller** (`/api/executions`):
| Method | Path | Description |
|--------|------|-------------|
| GET | `/executions` | List (page, limit, status filter) |
| GET | `/executions/stats` | Dashboard stats |
| GET | `/executions/recent` | Recent executions (limit=10) |
| GET | `/executions/chart` | Chart data (days param, default 7) |
| GET | `/executions/:id` | Execution detail with stepLogs |
| POST | `/executions/:id/cancel` | Cancel |
| POST | `/executions/:id/pause` | Pause |
| POST | `/executions/:id/resume` | Resume |
| POST | `/executions/:id/retry` | Retry (fresh execution via BullMQ) |
| POST | `/executions/:id/retry-from-failed` | Retry from failed step |

### 1.5 WebSocket Gateway

- **Namespace**: `/executions`
- **Auth**: JWT token from `handshake.auth.token` or `Authorization` header
- **Rooms**: `user:{userId}`, `execution:{executionId}`, `workflow:{workflowId}`
- **Client events**: `join:execution`, `leave:execution`, `join:workflow`
- **Server events** (via EventEmitter2):
  - `execution:started`, `execution:completed`, `execution:failed`
  - `step:started`, `step:completed`, `step:failed`
  - `execution:paused`, `execution:resumed`
- **Broadcast**: `emitToRoom()` sends to both execution room AND broadcast (for dashboard)

### 1.6 Data Models (Prisma)

- **Workflow**: id, userId, name, description, status (DRAFT/ACTIVE/PAUSED/ARCHIVED), version, definition (JSON), errorConfig (JSON), timestamps
- **WorkflowExecution**: id, workflowId, triggerData, status (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED/PAUSED), startedAt, completedAt, error, duration, lastCompletedNodeId, pausedAt, resumedAt, correlationId, createdAt
- **ExecutionStepLog**: id, executionId, nodeId, nodeName, nodeType, status, input, output, error, errorStack, retryCount, startedAt, completedAt, duration
- **Indexes**: workflowExecution — workflowId, status, createdAt

---

## 2. Backend API Gaps

### 2.1 Missing Endpoints

| Requirement | Endpoint Needed | Status |
|-------------|----------------|--------|
| DSH-01: Executions in last 24h | Need `executions24h` in stats | ❌ **Missing** — `getStats()` returns total/completed/failed/running but no 24h window |
| DSH-01: Success rate | Need `successRate` in stats | ❌ **Missing** — service computes counts but does NOT compute `successRate` or `avgDuration` |
| DSH-03: Workflow list with last exec + success rate | Need per-workflow execution stats | ❌ **Missing** — `findAllByUser` returns `_count.executions` but no lastExecution, no per-workflow successRate |
| DSH-04: Server-side search/filter | Need `search`, `status` params in GET `/workflows` | ⚠️ **Partial** — no search/status query params on backend; frontend does client-side filter |
| DSH-05: Date range filter on executions | Need `dateFrom`, `dateTo` query params | ❌ **Missing** — only `status` filter exists |
| DSH-05: Workflow filter on executions | Need `workflowId` query param | ❌ **Missing** |

### 2.2 Stats Endpoint Enhancement Needed

Current `getStats()` returns:
```typescript
{ totalExecutions, completed, failed, running, totalWorkflows, activeWorkflows }
```

Required for DSH-01:
```typescript
{
  totalWorkflows,
  activeWorkflows,
  totalExecutions,
  executions24h,      // NEW: count in last 24 hours
  successRate,        // NEW: (completed / total) * 100
  failedExecutions,   // rename from 'failed'
  avgDuration,        // NEW: avg duration of completed
  running,
}
```

### 2.3 Chart Endpoint

`getChartData()` — **already exists**, returns `{ date, completed, failed, total }[]` for N days. Mostly sufficient. May want to add `running` count per day.

### 2.4 Workflow Stats Enrichment

For DSH-03, `findAllByUser` needs enrichment. Each workflow should include:
- `lastExecution`: `{ id, status, createdAt, duration }` — last execution
- `executionStats`: `{ total, completed, failed, successRate }` — aggregate per workflow

**Implementation approach**: Either add a raw SQL aggregate or do sub-queries in Prisma. Raw SQL is more performant for this.

---

## 3. Frontend Gaps

### 3.1 Dashboard Page (`/dashboard`) — DSH-01, DSH-02

**Current state**: 4 stat cards + recent executions list. No charts.

**Missing**:
- [ ] **DSH-01**: Update stat cards to show: Total Workflows, Active, Executions (24h), Success Rate. The `StatsCards` component exists but isn't used — it expects `successRate` and `avgDuration` which backend doesn't provide yet
- [ ] **DSH-02**: No charts on dashboard page. Components `ExecutionBarChart` and `WorkflowStatusChart` exist in `components/dashboard/` but are NOT imported/rendered anywhere
- [ ] **DSH-02**: Missing **line chart** component (Recharts `LineChart`) for execution trends
- [ ] Wire up `useDashboardStats()` to feed correct data including 24h metrics
- [ ] Wire up `useChartData()` hook (doesn't exist yet) to feed chart components

### 3.2 Workflows Page (`/workflows`) — DSH-03, DSH-04

**Current state**: Grid of workflow cards with client-side search/sort/pagination.

**Missing for DSH-03**:
- [ ] Workflow cards don't show: last execution time, per-workflow success rate
- [ ] Need a "table view" option alongside grid view for dense data (status, last exec, success rate columns)

**Missing for DSH-04**:
- [ ] Status filter dropdown (DRAFT/ACTIVE/PAUSED/ARCHIVED) — currently only sort by status
- [ ] Search works client-side only (fine for small datasets, but need backend support for production)

### 3.3 Executions Page (`/executions`) — DSH-05

**Current state**: Simple paginated list. No filters, no search.

**Missing**:
- [ ] **Status filter** (tabs or dropdown: All/Running/Completed/Failed/Cancelled/Paused)
- [ ] **Date range filter** (last 24h, 7 days, 30 days, custom)
- [ ] **Workflow filter** (dropdown to filter by specific workflow)
- [ ] **Search** by workflow name or execution ID

### 3.4 Execution Detail (`/executions/[id]`) — DSH-06

**Current state**: Good baseline — info cards, error display with stack trace, step logs with expandable I/O.

**Missing**:
- [ ] `ExecutionTimeline` component exists but is NOT used on this page — should replace or complement the inline step list
- [ ] Real-time step progress via WebSocket (currently polls every 3s)
- [ ] Visual progress indicator (step X of Y, progress bar)
- [ ] Step duration visualization (timeline bar chart)

### 3.5 Real-time (EXE-03)

**Current state**: `useWebSocket` hook exists with `joinExecution`/`leaveExecution`. WebSocket gateway emits step-level events. But **no page uses WebSocket for live updates**.

**Missing**:
- [ ] `useExecutionLive(executionId)` hook that combines initial REST fetch + WebSocket updates
- [ ] Dashboard should subscribe to `user:${userId}` room for live stat updates
- [ ] Execution detail should join execution room and update step statuses in real-time
- [ ] Visual indication of live connection status

---

## 4. WebSocket Integration

### 4.1 Current Backend State

The `WebsocketGateway` is **fully functional**:
- JWT auth on connection ✅
- Room-based isolation (user, execution, workflow) ✅
- Event-driven via `@OnEvent()` decorators ✅
- Events: execution started/completed/failed/paused/resumed, step started/completed/failed ✅
- Broadcasts to both room and global namespace (for dashboard) ✅

### 4.2 Current Frontend State

`useWebSocket` hook:
- Connects to `/executions` namespace ✅
- Sends JWT auth token ✅
- Provides `on()`, `emit()`, `joinExecution()`, `leaveExecution()` ✅
- Tracks `connected` state ✅

**Gap**: The hook is not used anywhere in the application. No page subscribes to events.

### 4.3 What's Needed

1. **`useExecutionLive(executionId)` hook**:
   - Fetch initial data via REST
   - Join execution room via WebSocket
   - Listen for `step:started`, `step:completed`, `step:failed`, `execution:completed`, `execution:failed`
   - Update React Query cache or local state in real-time
   - Leave room on unmount

2. **Dashboard live updates**:
   - Subscribe to user room (already auto-joined on connect)
   - Listen for `execution:started`, `execution:completed`, `execution:failed`
   - Invalidate React Query cache for stats/recent on events
   - Optionally show toast for new completions/failures

3. **Connection status indicator**:
   - Small dot in header/sidebar showing WebSocket connection status
   - Auto-reconnect on disconnect (already handled by socket.io-client config)

---

## 5. Data Model

### 5.1 Prisma Models — Sufficient

All required data is already in the schema:
- `WorkflowExecution.status` — for filtering ✅
- `WorkflowExecution.createdAt` — for date range filtering ✅
- `WorkflowExecution.duration` — for performance metrics ✅
- `WorkflowExecution.workflowId` — for per-workflow filtering ✅
- `ExecutionStepLog.*` — for step-by-step detail ✅
- Indexes on `status`, `createdAt`, `workflowId` — performance ✅

### 5.2 Computed Fields Needed (Backend Service Layer)

| Field | Computation | Where Used |
|-------|-------------|------------|
| `successRate` | `(completed / total) * 100` | Dashboard stats, per-workflow stats |
| `executions24h` | `COUNT WHERE createdAt >= NOW() - 24h` | Dashboard stats |
| `avgDuration` | `AVG(duration) WHERE status = COMPLETED` | Dashboard stats |
| `lastExecution` | `MAX(createdAt) per workflow` | Workflow list enrichment |
| `perWorkflowSuccessRate` | Per-workflow `(completed / total) * 100` | Workflow list |

### 5.3 No Schema Migrations Required

The existing Prisma schema has all necessary fields and indexes. All new requirements can be satisfied with queries on existing tables.

---

## 6. Dependencies

### 6.1 Already Installed ✅

| Package | Version | Used For |
|---------|---------|----------|
| `recharts` | `^2.15.0` | Charts (Bar, Pie already used in components) |
| `socket.io-client` | `^4.8.0` | WebSocket client |
| `@tanstack/react-query` | `^5.60.0` | Data fetching, caching |
| `date-fns` | `^4.1.0` | Date formatting |
| `lucide-react` | `^0.460.0` | Icons |
| `zustand` | `^5.0.0` | State management |
| `sonner` | `^1.7.0` | Toast notifications |
| `@radix-ui/*` | various | UI primitives (Select, Tabs, Dialog, etc.) |
| `axios` | `^1.7.0` | HTTP client |

### 6.2 Nothing New Needed

All required libraries are already installed:
- **Recharts** — for Bar, Pie, Line charts ✅
- **socket.io-client** — for WebSocket ✅
- **date-fns** — for date manipulation/formatting ✅
- **Radix UI Select/Tabs** — for filter dropdowns and tab navigation ✅

---

## 7. Architecture Recommendations

### 7.1 Backend Changes

#### A. Enhance `getStats()` in `ExecutionsService`

```
Add to existing getStats():
- executions24h: COUNT where createdAt >= 24h ago
- successRate: (completed / max(total, 1)) * 100
- avgDuration: AVG of completed execution durations
```

#### B. Enhance `findAllByUser()` in `WorkflowsService`

Option 1 (Prisma sub-select — simpler):
```
For each workflow, include:
- Last execution (orderBy createdAt desc, take 1)
- Execution counts by status (completed, failed, total)
```

Option 2 (Raw SQL — more performant for large datasets):
```sql
SELECT w.*, 
  (SELECT COUNT(*) FROM workflow_executions we WHERE we."workflowId" = w.id) as total_executions,
  (SELECT COUNT(*) FROM workflow_executions we WHERE we."workflowId" = w.id AND we.status = 'COMPLETED') as completed_executions
FROM workflows w WHERE w."userId" = $1
```

**Recommendation**: Start with Prisma sub-selects. Optimize to raw SQL only if performance is an issue.

#### C. Add Execution Filters

Enhance `findAllByUser()` in `ExecutionsService`:
- Add `workflowId` filter
- Add `dateFrom` / `dateTo` date range filter  
- Add `search` param (search by workflow name via JOIN)

#### D. No new modules needed

All changes fit within existing `WorkflowsService` and `ExecutionsService`.

### 7.2 Frontend Architecture

#### A. Dashboard Page Restructure

```
/dashboard
├── StatsCards (4-6 metrics from /executions/stats)
├── Charts Row
│   ├── ExecutionBarChart (from /executions/chart)
│   ├── WorkflowStatusChart (pie, from /executions/stats)
│   └── ExecutionLineChart (NEW — trend line from /executions/chart)
├── RecentExecutions (from /executions?limit=10)
└── WebSocket listener (invalidate queries on events)
```

#### B. New/Enhanced Hooks

```
hooks/
├── use-executions.ts          (enhance: add chart data hook, add filter params)
├── use-workflows.ts           (enhance: enriched workflow data with exec stats)
├── use-websocket.ts           (exists — no changes)
├── use-execution-live.ts      (NEW: REST + WebSocket hybrid for live updates)
└── use-dashboard-live.ts      (NEW: WebSocket listener for dashboard auto-refresh)
```

#### C. Execution Detail Enhancement

```
/executions/[id]
├── Header (workflow name, status badge, action buttons)
├── Info Cards (started, completed, duration, steps count)
├── Error Panel (if failed — with stack trace)
├── Progress Bar (step X of Y — for RUNNING)
├── ExecutionTimeline (USE EXISTING component — currently unused!)
│   └── Each step: status dot, name, type, duration, expandable I/O
└── WebSocket integration (join room, update steps live)
```

#### D. Executions List Enhancement

```
/executions
├── Header + Filters Row
│   ├── Status Tabs (All / Running / Completed / Failed)
│   ├── Date Range Select (24h / 7d / 30d / Custom)
│   ├── Workflow Select (dropdown from /workflows)
│   └── Search Input (workflow name / execution ID)
├── Execution Table/List
│   └── Paginated, sortable
└── Pagination Controls
```

### 7.3 Component Reuse Strategy

Several dashboard components already exist but aren't used:
1. **`StatsCards`** → Adopt on dashboard page (replace inline stat cards)
2. **`ExecutionBarChart`** → Import on dashboard page
3. **`WorkflowStatusChart`** → Import on dashboard page  
4. **`RecentExecutions`** → Import on dashboard page (replace inline list)
5. **`ExecutionTimeline`** → Import on execution detail page (replace inline step list)

This means less new code — mostly wiring, data flow, and adding filters.

### 7.4 State Management

- **React Query** for all server state (stats, executions, workflows) — already the pattern
- **WebSocket events** → `queryClient.invalidateQueries()` to trigger refetch
- **Filter state** → URL search params (via `useSearchParams`) for shareable URLs
- **No new Zustand stores needed** — React Query + URL params is sufficient

---

## 8. Risk Areas

### 8.1 Performance

| Risk | Impact | Mitigation |
|------|--------|------------|
| Per-workflow execution stats may be slow with many workflows | Medium | Use Prisma `include` with select, add indexes. Move to raw SQL if needed |
| Chart data endpoint loads all executions in memory | Low | Already limited to N days. Add `LIMIT` for safety |
| Dashboard polling + WebSocket may cause duplicate updates | Low | Use WebSocket for invalidation only (not data), let React Query handle dedup |

### 8.2 UX

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dashboard page already has inline implementations that differ from component library | Medium | Refactor to use existing `StatsCards`, `RecentExecutions` components |
| `DashboardStats` type expects `successRate` and `avgDuration` that backend doesn't return | High | Must update backend `getStats()` FIRST, or frontend will show 0% and 0s |
| `ExecutionTimeline` component exists but isn't used — may have stale props | Low | Test component after wiring up |

### 8.3 WebSocket

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebSocket reconnection may miss events during disconnect | Medium | On reconnect, refetch current state via REST, then resume WS |
| JWT token expiry while WS connected | Low | socket.io-client handles reconnect; interceptor handles token refresh |
| Broadcast to all users on `emitToRoom()` plus global emit could leak data | **High** | Review `emitToRoom()` — it broadcasts to global namespace. Fix: only emit to user rooms, not global |

### 8.4 Data Consistency

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stats endpoint counts all-time, but dashboard may want 24h/7d/30d | Medium | Add time-window params to stats endpoint |
| `useRecentExecutions` calls `/executions?limit=10` instead of `/executions/recent` | Low | Switch to dedicated endpoint for cleaner API |

### 8.5 Security Note

The `emitToRoom()` method in `websocket.gateway.ts` line 113 does:
```typescript
this.server?.emit(event, payload); // broadcast for dashboard
```
This broadcasts execution events to ALL connected clients on the namespace, which could leak execution data across users. **Must fix**: only emit to `user:{userId}` room, not global broadcast.

---

## 9. Implementation Priority

Based on dependency analysis:

1. **Backend stats enhancement** (getStats → add successRate, executions24h, avgDuration) — blocks DSH-01
2. **Backend execution filters** (workflowId, dateFrom/dateTo, search) — blocks DSH-05
3. **Backend workflow enrichment** (lastExecution, per-workflow successRate) — blocks DSH-03
4. **Frontend dashboard page** (wire charts + stats components) — DSH-01, DSH-02
5. **Frontend execution filters** (status tabs, date range, workflow dropdown) — DSH-05
6. **Frontend execution detail** (wire ExecutionTimeline, progress bar) — DSH-06
7. **WebSocket integration** (live execution hook, dashboard auto-refresh) — EXE-03
8. **Security fix** (remove global broadcast in WebSocket gateway) — Critical

---

## 10. File Map

### Backend files to modify:
- `apps/backend/src/executions/executions.service.ts` — enhance getStats(), add filters
- `apps/backend/src/executions/executions.controller.ts` — add query params
- `apps/backend/src/workflows/workflows.service.ts` — enrich findAllByUser()
- `apps/backend/src/websocket/websocket.gateway.ts` — fix security issue

### Frontend files to modify:
- `apps/frontend/src/app/(dashboard)/dashboard/page.tsx` — full restructure
- `apps/frontend/src/app/(dashboard)/executions/page.tsx` — add filters
- `apps/frontend/src/app/(dashboard)/executions/[id]/page.tsx` — wire timeline + WS
- `apps/frontend/src/hooks/use-executions.ts` — add chart hook, filter params

### Frontend files to create:
- `apps/frontend/src/hooks/use-execution-live.ts` — REST + WebSocket hybrid
- `apps/frontend/src/hooks/use-dashboard-live.ts` — Dashboard WS listener
- `apps/frontend/src/components/dashboard/execution-line-chart.tsx` — LineChart component
- `apps/frontend/src/components/executions/execution-filters.tsx` — Filter bar component

### Files that exist and just need wiring (no changes):
- `apps/frontend/src/components/dashboard/stats-cards.tsx`
- `apps/frontend/src/components/dashboard/workflow-status-chart.tsx` (Bar + Pie)
- `apps/frontend/src/components/dashboard/recent-executions.tsx`
- `apps/frontend/src/components/dashboard/execution-timeline.tsx`
- `apps/frontend/src/hooks/use-websocket.ts`
