# Phase 5 — Dashboard & Monitoring: Plan Validation

## Overview
Phase 5 consists of 3 execution plans covering 7 requirements (DSH-01..06 + EXE-03).

| Plan | Title | Tasks | Dependencies |
|------|-------|-------|-------------|
| 05-01 | Backend API Enhancements | 8 | None |
| 05-02 | Dashboard & Charts Page | 7 | 05-01 |
| 05-03 | Execution Filters, Detail & Workflow Enrichment | 8 | 05-01 |

**Execution Order**: 05-01 → (05-02 ∥ 05-03)

Plans 05-02 and 05-03 can execute in **parallel** after 05-01 completes.

## Requirement Coverage Matrix

| Requirement | Description | 05-01 | 05-02 | 05-03 | Status |
|-------------|-------------|:-----:|:-----:|:-----:|--------|
| **DSH-01** | Dashboard metrics (total, active, 24h, success rate) | ✅ API | ✅ UI | — | ✅ Full |
| **DSH-02** | Execution charts (bar, pie, line via Recharts) | — | ✅ UI | — | ✅ Full |
| **DSH-03** | Workflow list with status, last exec, success rate | ✅ API | — | ✅ UI | ✅ Full |
| **DSH-04** | Search & filter workflows | ✅ API | — | ✅ UI | ✅ Full |
| **DSH-05** | Execution history with status/date filtering | ✅ API | — | ✅ UI | ✅ Full |
| **DSH-06** | Execution detail with step-by-step log | — | — | ✅ UI | ✅ Full |
| **EXE-03** | Real-time execution progress via WebSocket | — | ✅ Dashboard | ✅ Detail | ✅ Full |

**Coverage**: 7/7 requirements fully covered (100%)

## Backend ↔ Frontend Contract

### Plan 05-01 Provides → Plans 05-02 & 05-03 Consume

| API Endpoint | Method | New Params / Fields | Consumer |
|-------------|--------|---------------------|----------|
| `GET /api/stats` | Enhanced | `successRate`, `avgDuration`, `executions24h`, `activeWorkflows` | 05-02 (StatsCards) |
| `GET /api/executions` | Enhanced | `?dateFrom`, `?dateTo`, `?workflowId`, `?status`, `?page`, `?limit` | 05-03 (Executions page) |
| `GET /api/workflows` | Enhanced | `?search`, `?status`; enriched with `lastExecution`, `successRate`, `executionCount` | 05-03 (Workflows page) |

### WebSocket Events (Existing, Newly Wired)

| Event | Payload | Consumer |
|-------|---------|----------|
| `execution:started` | `{ executionId, workflowId }` | 05-02 (dashboard refresh) |
| `execution:completed` | `{ executionId, status, duration }` | 05-02 (dashboard refresh), 05-03 (list refresh) |
| `execution:{id}:step` | `{ stepId, status, output }` | 05-03 (detail page live updates) |

## Risk Assessment

| Risk | Mitigation | Plan |
|------|-----------|------|
| Stats query slow on large datasets | Use Prisma `aggregate` + `groupBy`, add DB indexes if needed | 05-01 |
| WebSocket events not firing | Verify backend emits events; fallback to polling (30s interval) | 05-02, 05-03 |
| Chart rendering issues on mobile | Use Recharts `ResponsiveContainer`, test at 320px width | 05-02 |
| Search debounce causing stale results | Use React Query's `keepPreviousData` option | 05-03 |
| Existing components props mismatch | Adapter pattern or update component interfaces | 05-02 |

## File Change Summary

### Plan 05-01 (Backend Only)
- `apps/backend/src/executions/executions.service.ts` — Modify
- `apps/backend/src/executions/executions.controller.ts` — Modify
- `apps/backend/src/executions/dto/execution-filter.dto.ts` — Create
- `apps/backend/src/workflows/workflows.service.ts` — Modify
- `apps/backend/src/workflows/workflows.controller.ts` — Modify
- `apps/backend/src/workflows/dto/workflow-filter.dto.ts` — Create
- `apps/backend/src/executions/executions.service.spec.ts` — Create
- `apps/backend/src/workflows/workflows.service.spec.ts` — Create

### Plan 05-02 (Dashboard Page)
- `apps/frontend/src/app/(dashboard)/dashboard/page.tsx` — Modify
- `apps/frontend/src/components/dashboard/stats-cards.tsx` — Modify
- `apps/frontend/src/components/dashboard/execution-line-chart.tsx` — Create
- `apps/frontend/src/hooks/use-executions.ts` — Modify
- `apps/frontend/src/hooks/use-websocket.ts` — Modify
- `apps/frontend/src/lib/api.ts` — Modify

### Plan 05-03 (Remaining Pages)
- `apps/frontend/src/app/(dashboard)/executions/page.tsx` — Modify
- `apps/frontend/src/app/(dashboard)/executions/[id]/page.tsx` — Modify
- `apps/frontend/src/app/(dashboard)/workflows/page.tsx` — Modify
- `apps/frontend/src/components/workflows/workflow-card.tsx` — Modify
- `apps/frontend/src/components/executions/execution-filters.tsx` — Create
- `apps/frontend/src/hooks/use-executions.ts` — Modify
- `apps/frontend/src/hooks/use-workflows.ts` — Modify
- `apps/frontend/src/hooks/use-websocket.ts` — Modify

**Total**: 8 backend files + 14 frontend files = 22 files (4 create, 18 modify)

### Shared Files (Modified by Multiple Plans)
| File | Plans | Conflict Risk |
|------|-------|--------------|
| `use-executions.ts` | 05-02, 05-03 | Low — 05-02 adds `useStats()`/`useChartData()`, 05-03 adds filter params. Different exports, no overlap. |
| `use-websocket.ts` | 05-02, 05-03 | Low — 05-02 adds `useDashboardLive()`, 05-03 adds `useExecutionProgress()`. Different exports, no overlap. |

## Phase Completion Checklist
- [ ] All 7 requirements (DSH-01..06, EXE-03) implemented
- [ ] Backend unit tests passing
- [ ] Dashboard page renders with live data and real-time updates
- [ ] All 3 chart types (bar, pie, line) render correctly
- [ ] Execution filtering works with all parameter combinations
- [ ] Execution detail shows step-by-step timeline with live WebSocket updates
- [ ] Workflow search and status filter work
- [ ] Workflow cards show execution stats
- [ ] All pages responsive (mobile/tablet/desktop)
- [ ] No TypeScript errors, no console errors
- [ ] Integration test: create workflow → execute → observe dashboard update → view execution detail
