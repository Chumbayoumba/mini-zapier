# QUICK REFERENCE - Integrations Frontend Architecture

## 📍 File Locations

### Integrations Management
- **Page**: apps/frontend/src/app/(dashboard)/integrations/page.tsx (525 lines)
  - 3-step form: List → Select Type → Configure
  - Supported: TELEGRAM, SMTP, WEBHOOK, HTTP_API, DATABASE
  - Verify → Save flow

### Workflow Editor
- **Main**: apps/frontend/src/app/(dashboard)/workflows/[id]/editor/page.tsx (306 lines)
  - ReactFlow canvas + Zustand state
- **Left Panel**: apps/frontend/src/components/editor/editor-toolbar.tsx (113 lines)
- **Right Panel**: apps/frontend/src/components/editor/node-config-panel.tsx (494 lines)
  - Dynamic config forms
  - Integration selection dropdown
  - Template variable helpers

### Node Rendering
- **Triggers**: apps/frontend/src/components/editor/nodes/trigger-node.tsx (72 lines)
- **Actions**: apps/frontend/src/components/editor/nodes/action-node.tsx (82 lines)

### Notifications & Real-time
- **Dropdown**: apps/frontend/src/components/layout/notification-dropdown.tsx (210 lines)
- **WebSocket**: apps/frontend/src/hooks/use-websocket.ts (91 lines)
- **Auto-save**: apps/frontend/src/hooks/use-auto-save.ts (48 lines)

### API Layer
- **Client**: apps/frontend/src/lib/api.ts (48 lines) - Axios + auth interceptor
- **Hooks**: 
  - apps/frontend/src/hooks/use-workflows.ts (141 lines)
  - apps/frontend/src/hooks/use-executions.ts (108 lines)
  - apps/frontend/src/hooks/use-notifications.ts (85 lines)

### State & Types
- **Store**: apps/frontend/src/stores/editor-store.ts (255 lines) - Zustand + Zundo
- **Types**: apps/frontend/src/types/index.ts (121 lines)

---

## 🔄 Data Flow Summary

### Adding Integration
`
User → "Add Integration" → Select Type → Fill Form → Verify → Save
         ↓
    GET /integrations
         ↓
    [Type-specific] /verify endpoint
         ↓
    POST /integrations { type, name, config, metadata }
         ↓
    Invalidate cache → List refreshes
`

### Editing Workflow
`
User → Drag node to canvas → Click to config → Edit fields → Auto-save
         ↓
    Node config updates store (isDirty=true)
         ↓
    2-second debounce
         ↓
    PATCH /workflows/{id} { definition: {nodes, edges} }
         ↓
    Store marks clean (isDirty=false)
`

### Executing Workflow
`
Trigger fires (webhook/cron/email/telegram) → Backend creates execution
         ↓
    Extracts trigger data ({{trigger.*}})
         ↓
    Executes actions in sequence
         ↓
    Each action uses template variables
         ↓
    Emits execution:completed via WebSocket
         ↓
    Cache invalidation → Dashboard updates
         ↓
    Notification created → Real-time dropdown update

---

## 🎯 Integration Types

| Type | Verify Endpoint | Config Fields | Use In |
|------|-----------------|---------------|--------|
| TELEGRAM | POST /integrations/telegram/verify | botToken | Trigger + Action |
| SMTP | POST /integrations/smtp/verify | host,port,user,pass | Action (send email) |
| WEBHOOK | POST /integrations/webhook/verify | name,url | Trigger (receive HTTP) |
| HTTP_API | POST /integrations/http-api/verify | baseUrl,headers | Action (call API) |
| DATABASE | POST /integrations/database/verify | connectionString | Action (query DB) |

---

## 🎮 Node Types

### Triggers (only 1 per workflow)
- WEBHOOK: Receive HTTP POST, auto-generate URL
- CRON: Scheduled execution, cron expression
- EMAIL: Monitor inbox (IMAP)
- TELEGRAM: Receive Telegram messages (integrationId required)

### Actions (unlimited)
- HTTP_REQUEST: Call REST API (integrationId optional)
- SEND_EMAIL: Send email (integrationId = SMTP config)
- TELEGRAM: Send message (integrationId required)
- DATABASE: Query database (integrationId = DB connection)
- TRANSFORM: JSONata expression

---

## 📋 Template Variables

**From Trigger**:
- {{trigger.text}} - Message text
- {{trigger.chat.id}} - Chat ID (auto-populates in actions)
- {{trigger.from.first_name}} - Sender name
- {{trigger.command}} - Command name
- {{trigger.commandArgs}} - Command arguments

**From Previous Steps**:
- {{steps.nodeId.output.field}} - Access output of any node

---

## 🌐 API Endpoints Used

**Integrations**:
- GET /api/integrations - List all
- POST /api/integrations/{type}/verify - Verify (type-specific)
- POST /api/integrations - Create
- DELETE /api/integrations/{id} - Delete

**Workflows**:
- GET /api/workflows - List with filters
- GET /api/workflows/{id} - Get one
- POST /api/workflows - Create
- PATCH /api/workflows/{id} - Update (auto-save)
- DELETE /api/workflows/{id} - Delete
- POST /api/workflows/{id}/activate - Activate
- POST /api/workflows/{id}/deactivate - Deactivate
- POST /api/workflows/{id}/execute - Start execution

**Executions**:
- GET /api/executions - List with filters
- GET /api/executions/{id} - Get details (refetch every 3s)
- GET /api/executions/stats - Dashboard stats
- GET /api/executions/stats - Chart data

**Notifications**:
- GET /api/notifications - List (refetch every 30s)
- GET /api/notifications/unread-count - Count (refetch every 15s)
- PATCH /api/notifications/{id}/read - Mark read
- PATCH /api/notifications/read-all - Mark all
- DELETE /api/notifications/{id} - Delete

**Webhooks** (external):
- POST /api/webhooks/{triggerId} - Trigger workflow

---

## 🔌 WebSocket Events

**Listen to**:
- execution:completed
- execution:started
- execution:failed
- notification:new

**Emit to**:
- join:execution {executionId}
- leave:execution {executionId}

---

## ⚙️ Configuration

**Environment Variables**:
- NEXT_PUBLIC_API_URL - Backend API base (default: http://localhost:3001/api)
- NEXT_PUBLIC_WS_URL - WebSocket URL (optional, namespace fallback)

**Auth**:
- Token stored: localStorage.accessToken / localStorage.refreshToken
- Request header: Authorization: Bearer {token}
- Auto-refresh on 401 Unauthorized

---

## 🔑 Key Libraries

- **ReactFlow**: Graph visualization & editing
- **Zustand + Zundo**: State management with undo/redo
- **TanStack Query**: API caching & synchronization
- **Socket.io**: Real-time WebSocket events
- **Axios**: HTTP client
- **React Hook Form**: Form handling
- **Zod**: Schema validation
- **Sonner**: Toast notifications
- **Tailwind CSS**: Styling

---

## 📊 State Management Patterns

**Query Cache Keys**:
- ['integrations'] - All integrations
- ['workflows', filters] - Filtered workflows
- ['workflow', id] - Single workflow
- ['executions', filters] - Filtered executions
- ['execution', id] - Single execution (auto-refetch 3s)
- ['notifications', page, limit] - Paginated (refetch 30s)
- ['notifications', 'unread-count'] - Unread count (refetch 15s)

**Editor Store** (Zustand + Zundo):
- State: nodes, edges, selectedNode, isDirty, isSaving, lastSavedAt
- Undo/Redo: Up to 50 states, throttled 500ms
- Subscribe: Watch isDirty for auto-save

---

## 🎨 UI Components

**Integrations Page**:
- 3-step modal flow
- Integration cards with icon/status/date
- Type-specific input fields
- Verification result display

**Workflow Editor**:
- Left sidebar: Draggable node palette
- Center: ReactFlow canvas with nodes/edges
- Right sidebar: Dynamic config form
- Toolbar: Undo/Redo/Save/Run/Activate

**Notification Dropdown**:
- Bell icon with unread badge
- Scrollable list of notifications
- Type-specific icons & colors
- Real-time updates via WebSocket

---

## 🚀 Critical Flows

**1. Integration Setup to Usage**
`
Create Integration → Verify → Save → Query in Node Config → Select in Dropdown
`

**2. Workflow Edit to Execution**
`
Edit Config → Auto-save (2s debounce) → Execute → Trigger Data → Action Vars → Result
`

**3. Execution to Notification**
`
Webhook → Backend Executes → emits execution:completed → Cache Invalidate → Toast + Notification
`

---

## ⚠️ Important Notes

- Only ONE trigger per workflow (validated)
- Integration selection is PER NODE, not per workflow
- Template variables substituted at execution time
- Auto-save is silent (no toast) every 2 seconds
- WebSocket fallback to polling if connection lost
- All integrations require verification before save
- Webhook URLs are auto-generated per trigger
- Real-time updates via WebSocket + polling for resilience

