# AUDIT SUMMARY - Integrations Frontend

## What You Get

✅ **FRONTEND_AUDIT_COMPLETE.md** (29 KB, 800 lines)
   - Complete architectural documentation
   - Every integration type explained
   - All trigger/action types documented
   - API hooks with full signatures
   - State management patterns
   - Real-time/WebSocket integration
   - 3 end-to-end scenario flows
   - Critical integration points

✅ **QUICK_REFERENCE.md** (9 KB, 250+ lines)
   - File locations and sizes
   - Quick data flow diagrams
   - Integration types table
   - Node types list
   - Template variables reference
   - API endpoints summary
   - WebSocket events
   - Configuration notes

---

## Key Findings

### Architecture Overview
- **Frontend**: React 18 + Next.js (app router)
- **State**: Zustand for editor, TanStack Query for API
- **Graph Editor**: ReactFlow with Undo/Redo support
- **Real-time**: Socket.io + polling fallback
- **Styling**: Tailwind CSS + shadcn/ui components
- **HTTP**: Axios with auth interceptor

### Integration System
- **5 types** supported: Telegram, SMTP, Webhook, HTTP API, Database
- **Verification required** before save (type-specific endpoint)
- **Per-node selection** - integrations chosen at action/trigger level
- **Metadata storage** - separate from credentials for display data

### Workflow Editor
- **Node-based**: Triggers (1 max) + Actions (unlimited)
- **Visual canvas**: Drag-drop components, ReactFlow
- **Auto-save**: 2-second debounce, silent mutations
- **Template variables**: {{trigger.*}} and {{steps.*}} injection
- **Validation**: Connection prevention for invalid patterns

### Notification System
- **Real-time**: WebSocket listener for notification:new events
- **Polling**: 30s for notifications, 15s for unread count
- **Types**: execution_failed, execution_completed, workflow_activated, etc.
- **Dropdown**: Beautiful UI in header with mark-read/delete actions

### Data Flow Highlights

1. **Integration Add**
   - 3-step modal: Select → Configure → Verify → Save
   - Type-specific verification endpoints
   - Metadata stored separately from credentials

2. **Workflow Create**
   - Drag triggers/actions to canvas
   - Click to configure right sidebar panel
   - Auto-save on every 2-second silence
   - Undo/Redo with Zundo middleware

3. **Execution Flow**
   - Trigger fires (webhook/cron/email/telegram)
   - Backend extracts trigger data {{trigger.*}}
   - Actions execute sequentially using template variables
   - WebSocket emits completion → notifications appear
   - Dashboard updates live

### Critical Patterns

**Query Cache Invalidation**:
- On integration create/delete: Invalidate ['integrations']
- On workflow update: Invalidate ['workflow', id], ['workflows']
- On execution complete: Invalidate ['executions'], ['dashboard-stats']
- On notification create: Invalidate ['notifications']

**Template Variables**:
- {{trigger.text}}, {{trigger.chat.id}}, {{trigger.from.*}} etc.
- {{steps.nodeId.output.field}} for previous actions
- Substituted at execution time, not edit time

**Verification Flow**:
- User enters config → Click Verify
- POST /integrations/{type}/verify with test credentials
- Response: { ok: boolean, ...typeData }
- If ok: Show result + Add button enables
- Save: POST /integrations with all data

---

## File Structure

### High-Level
`
apps/frontend/src/
├── app/(dashboard)/
│   ├── integrations/
│   │   └── page.tsx (525 lines) ⭐ Integration management
│   └── workflows/
│       ├── page.tsx - List workflows
│       ├── new/page.tsx - Create workflow
│       ├── [id]/
│       │   ├── page.tsx - Workflow detail
│       │   └── editor/page.tsx (306 lines) ⭐ Main editor
│
├── components/
│   ├── editor/
│   │   ├── node-config-panel.tsx (494 lines) ⭐ Right sidebar
│   │   ├── editor-toolbar.tsx (113 lines) - Top bar
│   │   ├── nodes/
│   │   │   ├── trigger-node.tsx (72 lines)
│   │   │   └── action-node.tsx (82 lines)
│   │   └── edges/animated-edge.tsx
│   │
│   ├── layout/
│   │   └── notification-dropdown.tsx (210 lines) ⭐ Real-time notifications
│   │
│   └── ui/
│       ├── button, input, select, textarea, card, badge...
│
├── hooks/
│   ├── use-workflows.ts (141 lines) ⭐ Workflow API
│   ├── use-executions.ts (108 lines) ⭐ Execution API
│   ├── use-notifications.ts (85 lines) ⭐ Notification API
│   ├── use-websocket.ts (91 lines) ⭐ Real-time connection
│   ├── use-auto-save.ts (48 lines) ⭐ Auto-save logic
│   ├── use-editor-keyboard-shortcuts.ts (keyboard shortcuts)
│   └── use-auth.ts (authentication)
│
├── stores/
│   ├── editor-store.ts (255 lines) ⭐ State + Undo/Redo
│   └── auth-store.ts
│
├── lib/
│   ├── api.ts (48 lines) ⭐ Axios client
│   ├── utils.ts (formatting, validation)
│   └── graph-validation.ts
│
├── types/
│   └── index.ts (121 lines) ⭐ TypeScript interfaces
│
└── constants/
    └── index.ts (EXECUTION_STATUS_VARIANTS, etc.)
`

### By Purpose

**Integration Management**:
- integrations/page.tsx (525 lines)
- API: GET/POST/DELETE /integrations
- Verify endpoints per type

**Workflow Editing**:
- workflows/[id]/editor/page.tsx (306 lines)
- components/editor/{toolbar, node-config-panel, nodes/} (679 lines)
- stores/editor-store.ts (255 lines)
- Workflows API hooks

**Real-time Features**:
- components/layout/notification-dropdown.tsx (210 lines)
- hooks/use-websocket.ts (91 lines)
- Notifications API hooks

**Auto-save**:
- hooks/use-auto-save.ts (48 lines)
- 2-second debounce timer

**State & API**:
- stores/editor-store.ts (255 lines) - Zustand + Zundo
- hooks/use-*.ts (334 lines total) - TanStack Query
- lib/api.ts (48 lines) - Axios client

---

## Quick Facts

📦 **Total Frontend Code**: ~2,500 lines (excluding tests, UI components)

🎯 **Main Pages**: 
- /integrations - Add/list integrations
- /workflows - List workflows
- /workflows/new - Create workflow
- /workflows/{id} - Workflow detail
- /workflows/{id}/editor - Edit workflow

🔌 **Integration Types**: 5
- TELEGRAM (bot token)
- SMTP (email server)
- WEBHOOK (receive HTTP)
- HTTP_API (call API)
- DATABASE (query DB)

⚡ **Trigger Types**: 4
- WEBHOOK (HTTP POST)
- CRON (schedule)
- EMAIL (IMAP)
- TELEGRAM (messages)

▶️ **Action Types**: 5
- HTTP_REQUEST (call API)
- SEND_EMAIL (SMTP)
- TELEGRAM (send message)
- DATABASE (query)
- TRANSFORM (JSONata)

📡 **API Calls**: 20+ endpoints
- /api/integrations/* (verify per type)
- /api/workflows/* (CRUD + actions)
- /api/executions/* (queries + stats)
- /api/notifications/* (CRUD + status)
- /api/webhooks/* (external triggers)

🔄 **WebSocket Events**: 4 main
- execution:completed
- execution:started
- execution:failed
- notification:new

⏱️ **Auto-save**: 2-second debounce after edit

🔐 **Auth**: 
- Access token in Authorization header
- Refresh on 401 with refreshToken
- localStorage persistence

---

## Integration Points You Need to Know

1. **Adding Integration to Node**
   `
   → Node config panel queries GET /api/integrations
   → Filters by type (e.g., TELEGRAM)
   → Populates dropdown with { value: id, label: name }
   → User selects → stored in node.data.config.integrationId
   → Saved in workflow definition JSON
   `

2. **Template Variable Injection**
   `
   → Trigger outputs: {{trigger.text}}, {{trigger.chat.id}}, etc.
   → Action receives config: { message: "Hello {{trigger.from.first_name}}" }
   → At execution: Backend substitutes with actual trigger data
   → Can reference previous actions: {{steps.httpAction.output.status}}
   `

3. **Webhook URL Generation**
   `
   → WEBHOOK trigger auto-generates: /api/webhooks/{triggerId}
   → Shown in node config panel
   → User copies and provides to external system
   → External system POSTs to trigger workflow
   `

4. **Real-time Updates**
   `
   → Execution completes → backend emits execution:completed
   → WebSocket listener catches event
   → Invalidates React Query cache
   → Dashboard/notifications refetch automatically
   → UI updates in real-time
   `

5. **Verification Before Save**
   `
   → User enters credentials for integration
   → Clicks Verify → POST /integrations/{type}/verify
   → Backend tests (connects to service, validates token, etc.)
   → Response: { ok: true, ...metadata } or { ok: false, message: "..." }
   → Only if ok: Add Integration button enabled
   → Save: POST /integrations with full data
   `

---

## Performance Optimizations

✅ **Query Caching**: TanStack Query prevents unnecessary API calls
✅ **Auto-save**: Silent mutations don't interrupt user
✅ **WebSocket**: Real-time updates without polling (with fallback)
✅ **Debouncing**: 2-second debounce on auto-save
✅ **Pagination**: Workflows and notifications paginated
✅ **Throttling**: Editor store history throttled 500ms
✅ **Component Memoization**: Nodes use React.memo

---

## Testing Recommendations

- Integration form verification per type
- Workflow graph validation (one trigger, valid connections)
- Template variable substitution
- Auto-save timing and conflicts
- WebSocket reconnection scenarios
- Notification real-time vs polling
- Auth token refresh on 401

---

## Known Limitations

- Only SELECT supported for DATABASE queries (no INSERT/UPDATE/DELETE)
- One trigger per workflow (by design)
- Webhook URLs copied manually (no auto-share)
- No integration credentials encryption at rest (backend concern)
- Notifications paginated, not infinite scroll

---

## Getting Started as a Developer

1. Read: FRONTEND_AUDIT_COMPLETE.md for deep understanding
2. Check: QUICK_REFERENCE.md for quick lookups
3. Explore: Start with integrations/page.tsx (simpler flow)
4. Then: workflows/[id]/editor/page.tsx (more complex)
5. Test: Auto-save, real-time updates, verification flows

---

Generated: 03/17/2026 02:58:28
Repository: minizapierpraktika
Scope: Frontend integrations & workflow editor only
