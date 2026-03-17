# SYSTEM ARCHITECTURE DIAGRAMS

## 1. INTEGRATIONS PAGE FLOW

\\\
┌─────────────────────────────────────────────────────────────────┐
│                      INTEGRATIONS PAGE                           │
└─────────────────────────────────────────────────────────────────┘

Step 1: LIST VIEW
│
├─ GET /api/integrations
│  └─ Return: [{ id, type, name, config, metadata, isActive, createdAt }]
│
└─ Display Cards
   ├─ [Telegram Bot] @mybot - Connected - 2024-03-15 [Delete]
   ├─ [SMTP] user@gmail.com - Inactive - 2024-03-14 [Delete]
   └─ [Add Integration +]

Step 2: TYPE SELECTION
│
└─ Click [Add Integration]
   ├─ Show 5 Types:
   │  ├─ Telegram Bot (Send)
   │  ├─ SMTP Email (Mail)
   │  ├─ Webhook (Link)
   │  ├─ HTTP API (Globe)
   │  └─ Database (DB)
   │
   └─ Click type (e.g., Telegram) → Step 3

Step 3: CONFIGURATION & VERIFICATION
│
├─ Show Type-Specific Form
│  ├─ Input Fields (per type)
│  └─ Verify Button
│
├─ POST /api/integrations/telegram/verify { botToken }
│  └─ Backend: Calls Telegram API, validates token
│
├─ Response: { ok: true, botId, botName, botUsername, photoUrl }
│  └─ Display: Bot avatar + name (success UI)
│
└─ Click [Add Integration]
   └─ POST /api/integrations
      { type: 'TELEGRAM', 
        name: '@mybot',
        config: { botToken },
        metadata: { botId, botName, botUsername, photoUrl } }
      │
      └─ Response: { id, type, name, ... }
         └─ Invalidate cache ['integrations']
         └─ List refreshes with new integration
\\\

---

## 2. WORKFLOW EDITOR ARCHITECTURE

\\\
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW EDITOR (ReactFlow)                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────────────────────┐  ┌────────────────┐
│ LEFT PANEL   │  │    CENTER CANVAS (ReactFlow) │  │  RIGHT PANEL   │
│              │  │                              │  │                │
│ TRIGGERS ⚡ │  │  ┌─────────┐                 │  │ CONFIGURATION  │
│ · Webhook   │  │  │Trigger  │                 │  │ PANEL          │
│ · CRON      │  │  │WEBHOOK  │                 │  │                │
│ · Email     │  │  └────┬────┘                 │  │ [Node Label]   │
│ · Telegram  │  │       │                      │  │ ⚡ TRIGGER     │
│             │  │       │                      │  │ WEBHOOK        │
│ ACTIONS ▶  │  │  ┌────▼────┐   ┌────────┐   │  │ ───────────    │
│ · HTTP_REQ │  │  │HTTP_REQ │   │Telegram│   │  │ URL:           │
│ · Email    │  │  │ ACTION  ├──>│ACTION  │   │  │ /api/webhooks/ │
│ · Telegram │  │  └─────────┘   └────────┘   │  │ {id}           │
│ · Database │  │                             │  │ [Copy]         │
│ · Transform│  │                             │  │ ───────────    │
│             │  │ (MiniMap in corner)        │  │ Settings:      │
│ [Controls]  │  │ (Zoom buttons)             │  │ Secret:        │
│             │  │                             │  │ [input]        │
└──────────────┘  └──────────────────────────────┘  └────────────────┘

TOOLBAR (Top)
├─ Back | Undo Redo | [Workflow Name] [Save Status] | Zoom Controls | Activate | Save | Run
└─ All buttons connected to editor actions

STATE MANAGEMENT (Zustand + Zundo)
├─ nodes: Node[]
├─ edges: Edge[]
├─ selectedNode: Node | null
├─ isDirty: boolean → Auto-save trigger
├─ isSaving: boolean
└─ History: 50 states with 500ms throttle (Undo/Redo)

AUTO-SAVE FLOW
├─ User edits node config
├─ updateNodeData() called
├─ Zustand state updated (isDirty = true)
├─ 2-second timer starts
├─ If more edits: timer resets
└─ After 2s silence: 
   └─ PATCH /workflows/{id} { definition: {nodes, edges} }
   └─ Mark saved (isDirty = false)
\\\

---

## 3. NODE CONFIGURATION PANEL

\\\
┌─────────────────────────────────────────────────────────┐
│           NODE CONFIGURATION PANEL (Right Sidebar)       │
└─────────────────────────────────────────────────────────┘

Header
├─ [⚙] [Label] [⚡ TRIGGER · TELEGRAM] [×]
└─ (When node clicked, panel animates in from right)

GENERAL SECTION
├─ Label: [Telegram Trigger________] (editable)
└─ (For WEBHOOK: Shows copyable URL)

SMART INTEGRATIONS INJECTION
├─ Query: GET /api/integrations in real-time
├─ Filter: type = 'TELEGRAM'
├─ Map to dropdown options:
│  ├─ [{ id: 'int_1', name: '@mybot' }]
│  ├─ [{ id: 'int_2', name: '@anotherbot' }]
│  └─ (Or: "⚠️ No bots configured. Go to Integrations")

CONFIGURATION SECTION
├─ Telegram Bot: [Dropdown ▼] (populated above)
├─ Event Type: [Dropdown ▼] (hardcoded options)
│  ├─ 🚀 /start command
│  ├─ ❓ /help command
│  ├─ ⌨️ Any command
│  ├─ 💬 Text message
│  ├─ 🔘 Button click
│  └─ 📨 Any event
├─ Hint: "What type of message should trigger this workflow?"
└─ (Form validation: required fields have red border)

TYPE-SPECIFIC HELPERS
├─ Info Box: "How it works"
│  └─ "Webhook receives HTTP POST → executes workflow"
│
├─ Data Variables (for passing to actions)
│  ├─ {{trigger.text}} - Message text
│  ├─ {{trigger.chat.id}} - Chat ID
│  ├─ {{trigger.from.first_name}} - User name
│  ├─ {{trigger.command}} - Command name
│  └─ {{trigger.commandArgs}} - Arguments
│
└─ Message Templates (for TELEGRAM action nodes)
   ├─ [👋 Greeting] - "Hello {{trigger.from.first_name}}!"
   ├─ [❓ Help] - "Here are my commands..."
   ├─ [💬 Echo] - "You said: {{trigger.text}}"
   └─ [Click to insert in message field]

NOTES SECTION
├─ Description: [Optional notes for documentation]
└─ (Free-text field)

Footer: [Scroll area with max-height]
\\\

---

## 4. WORKFLOW EXECUTION FLOW

\\\
┌─────────────────────────────────────────────────────────────────┐
│                   WORKFLOW EXECUTION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

TRIGGER ACTIVATION
├─ User sends message to Telegram bot
│  └─ Bot receives: { text: "/help", from: { first_name: "Ivan" }, chat: { id: 12345 } }
│
├─ Bot calls webhook
│  └─ POST /api/webhooks/{triggerId}
│
└─ Backend receives trigger payload

WORKFLOW EXECUTION
├─ Create WorkflowExecution in database
├─ Extract trigger data:
│  ├─ trigger.text = "/help"
│  ├─ trigger.from.first_name = "Ivan"
│  ├─ trigger.chat.id = 12345
│  └─ trigger.command = "help"
│
├─ Execute trigger node (TELEGRAM)
│  └─ Extract: Match event_type (e.g., "command_help")
│
├─ Pass to first action (HTTP_REQUEST)
│  ├─ Config: { url: "https://api.example.com/notify?user={{trigger.from.first_name}}" }
│  ├─ Substitute: url = "https://api.example.com/notify?user=Ivan"
│  ├─ Make request
│  └─ Store output in step result
│
├─ Pass to second action (TELEGRAM)
│  ├─ Config: { 
  │    integrationId: 'int_1',
  │    message: "Hey {{trigger.from.first_name}}, I processed your request",
  │    chatId: "{{trigger.chat.id}}" (optional, auto-filled)
  │  }
│  ├─ Substitute: message = "Hey Ivan, I processed your request"
│  ├─ Substitute: chatId = "12345"
│  ├─ Send via Telegram API
│  └─ Store output
│
└─ Mark execution complete

POST-EXECUTION
├─ Emit WebSocket event: execution:completed
│  └─ Dashboard listener catches event
│  └─ Invalidates cache: ['dashboard-stats', 'recent-executions']
│  └─ Dashboard data refetches automatically
│
├─ Create Notification
│  ├─ Type: 'execution_completed'
│  ├─ Title: 'Workflow Completed'
│  ├─ Message: 'Your workflow finished successfully'
│  └─ Data: { workflowId, executionId, duration }
│
├─ Emit WebSocket event: notification:new
│  └─ Notification dropdown listener catches
│  └─ Invalidates cache: ['notifications']
│  └─ Dropdown refetches and shows new notification
│
└─ Real-time UI updates
   ├─ Execution status: COMPLETED
   ├─ Dashboard stats updated
   ├─ Execution card shows result
   └─ User sees notification in dropdown + optional toast

\\\

---

## 5. REAL-TIME UPDATE FLOW

\\\
┌─────────────────────────────────────────────────────────────────┐
│               REAL-TIME NOTIFICATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

WEBSOCKET INITIALIZATION
├─ Frontend: useWebSocket() hook
├─ Connects to: /executions namespace
├─ Auth: Sends accessToken in auth payload
├─ Transports: WebSocket first, polling fallback
└─ Reconnection: Auto-reconnect with exponential backoff

EVENT SUBSCRIPTION
├─ Notification Dropdown:
│  └─ on('notification:new', () => {
│     invalidateQueries(['notifications'])
│     })
│
├─ Dashboard:
│  └─ on('execution:completed', () => {
│     invalidateQueries(['dashboard-stats', 'recent-executions'])
│     })

EXECUTION COMPLETION EVENT FLOW
│
├─ Backend: Execution completes
├─ Backend: emit('execution:completed', { executionId, status, ... })
│
├─ Frontend WebSocket listener:
│  ├─ Catches 'execution:completed' event
│  ├─ Calls: queryClient.invalidateQueries(['dashboard-stats'])
│  └─ TanStack Query: Auto-refetch dashboard data
│
├─ Response: GET /api/executions/stats
│  └─ Updated stats with new execution
│
├─ React: Components using useDashboardStats() re-render
│  └─ UI updates live (no manual refresh needed)
│
└─ User sees updated stats without page reload

NOTIFICATION CREATION EVENT FLOW
│
├─ Backend: Create notification
├─ Backend: emit('notification:new', { notificationId })
│
├─ Frontend WebSocket listener:
│  ├─ Catches 'notification:new' event
│  ├─ Calls: queryClient.invalidateQueries(['notifications'])
│  └─ TanStack Query: Auto-refetch notifications
│
├─ Response: GET /api/notifications?page=1&limit=20
│  └─ New notification in list
│
├─ React: NotificationDropdown re-renders
│  ├─ Unread count badge updates
│  ├─ New notification appears at top
│  └─ Animation: Slides in from top
│
└─ User sees real-time notification in dropdown

POLLING FALLBACK
├─ If WebSocket disconnects:
│  ├─ useUnreadCount(): Refetch every 15 seconds
│  ├─ useNotifications(): Refetch every 30 seconds
│  └─ Still updates UI, just with delay
│
└─ When WebSocket reconnects:
   └─ Seamless switch back to real-time

\\\

---

## 6. INTEGRATION SELECTION IN NODES

\\\
┌─────────────────────────────────────────────────────────────────┐
│         INTEGRATION SELECTION IN NODE CONFIG PANEL               │
└─────────────────────────────────────────────────────────────────┘

SCENARIO: Creating TELEGRAM Action Node
│
├─ User drags "Telegram" action to canvas
├─ User clicks node to select
└─ Config panel opens on right

IN CONFIG PANEL:
├─ Fields defined: TELEGRAM_ACTION_FIELDS
│  ├─ integrationId (select, required)
│  ├─ chatId (text, optional)
│  ├─ message (textarea, required)
│  └─ parseMode (select, optional)
│
├─ Real-time Integration Query
│  └─ useQuery({
│     queryKey: ['integrations'],
│     queryFn: GET /api/integrations
│     })
│
├─ Response: [
│    { id: 'int_1', type: 'TELEGRAM', name: '@mybot' },
│    { id: 'int_2', type: 'TELEGRAM', name: '@anotherbot' },
│    { id: 'int_3', type: 'SMTP', name: 'user@gmail.com' },
│    { id: 'int_4', type: 'HTTP_API', name: 'api.example.com' }
│  ]
│
├─ Filter for Type:
│  ├─ For TELEGRAM node: Filter type='TELEGRAM'
│  └─ Telegram bots: [int_1, int_2]
│
├─ Populate Dropdown:
│  └─ integrationId field gets options:
│     ├─ [{ value: 'int_1', label: '@mybot' }]
│     └─ [{ value: 'int_2', label: '@anotherbot' }]
│
├─ User selects: @mybot
│  ├─ Node config updated:
│  │  ├─ node.data.config.integrationId = 'int_1'
│  │  ├─ Store isDirty = true
│  │  └─ Auto-save timer started
│  │
│  └─ Auto-save after 2 seconds:
│     ├─ PATCH /workflows/{workflowId}
│     ├─ { definition: { nodes: [...updated...], edges: [...] } }
│     └─ Saved to database

INTEGRATION REFERENCE IN EXECUTION:
├─ Backend reads workflow definition
├─ Finds action node: { config: { integrationId: 'int_1', message: "..." } }
├─ Looks up integration 'int_1': { type: 'TELEGRAM', config: { botToken: '...' } }
├─ Uses integration credentials to execute action
└─ Sends Telegram message using bot token from integration

KEY POINT: Integration selected at NODE level, not workflow level!
         Each action independently chooses which integration to use.

\\\

---

## 7. TEMPLATE VARIABLES SUBSTITUTION

\\\
┌─────────────────────────────────────────────────────────────────┐
│          TEMPLATE VARIABLES SUBSTITUTION AT EXECUTION            │
└─────────────────────────────────────────────────────────────────┘

EDIT TIME (Frontend - What User Sees)
├─ Config panel shows:
│  └─ Message: "Hello {{trigger.from.first_name}}, your request was processed"
│     (Variables NOT substituted - user can see the template)
│
└─ No actual substitution happens during editing

STORAGE
├─ Node config saved with template variables as-is:
│  └─ node.data.config = { 
│     message: "Hello {{trigger.from.first_name}}, your request was processed"
│     }
│
└─ Workflow definition JSON stores template literally

EXECUTION TIME (Backend - What Gets Substituted)
├─ Execution receives trigger data:
│  ├─ { text: "/help", from: { first_name: "Ivan" }, chat: { id: 12345 } }
│  │
│  └─ Backend process:
│     ├─ Read action config: message = "Hello {{trigger.from.first_name}}, ..."
│     ├─ Extract trigger data: first_name = "Ivan"
│     ├─ Substitute: message = "Hello Ivan, your request was processed"
│     └─ Send via Telegram API
│
└─ Output stored in execution logs

AVAILABLE VARIABLES
├─ From Current Trigger:
│  ├─ {{trigger.text}} - From Telegram: message text
│  ├─ {{trigger.from.first_name}} - From Telegram: user name
│  ├─ {{trigger.chat.id}} - From Telegram: chat ID
│  ├─ {{trigger.command}} - From Telegram: command name
│  └─ Similar for other trigger types
│
├─ From Previous Steps:
│  ├─ {{steps.http-action-123.output.statusCode}}
│  ├─ {{steps.http-action-123.output.data.userId}}
│  └─ Can chain: access output of any previous action
│
└─ Nesting works:
   └─ {{steps.database-query.output[0].email}} (access array element)

HELPER UI
├─ Frontend shows variable reference:
│  ├─ Tooltip: Hover over variable to see description
│  ├─ Clickable chips: Click to insert variable name
│  └─ Code examples: Shows available variables for current node

\\\

---

## 8. AUTO-SAVE TIMING DIAGRAM

\\\
┌─────────────────────────────────────────────────────────────────┐
│              AUTO-SAVE 2-SECOND DEBOUNCE                        │
└─────────────────────────────────────────────────────────────────┘

Timeline (Time in milliseconds)
│
├─ 0ms: User types in message field
│  └─ updateNodeData() called
│  └─ Store: isDirty = true
│  └─ Auto-save timer: SET for 2000ms
│
├─ 500ms: User continues typing
│  └─ Store: isDirty = true (still)
│  └─ Auto-save timer: RESET to 2000ms
│
├─ 1000ms: More edits
│  └─ Store: isDirty = true (still)
│  └─ Auto-save timer: RESET to 2000ms
│
├─ 1500ms: Edits stop, user clicks elsewhere
│  └─ Store: isDirty = true (still)
│  └─ Auto-save timer: Running (500ms left)
│
├─ 2500ms: Timer fired!
│  ├─ Check: isDirty === true? YES
│  ├─ Check: isSaving === false? YES
│  ├─ Mark: isSaving = true
│  ├─ API Call: PATCH /workflows/{id} { definition }
│  └─ No toast notification (silent save)
│
├─ 2750ms: API response received
│  ├─ Mark: isSaving = false
│  ├─ Mark: isDirty = false
│  ├─ Store: lastSavedAt = now
│  └─ UI: SaveIndicator shows checkmark briefly
│
└─ 3000ms: Ready for next edit

EDGE CASES:

Case 1: User clicks Save button before auto-save
├─ Explicit save: PATCH immediately
├─ Cancel auto-save timer
├─ Mark saved
└─ Same flow as auto-save but user-triggered

Case 2: Multiple rapid edits
├─ Each edit resets 2-second timer
├─ Example: Type 10 chars = 10 resets
├─ Net result: Saves ~2 seconds after LAST keystroke
└─ Prevents flood of API calls

Case 3: Network error during save
├─ Mark isSaving = false
├─ isDirty remains true
├─ User sees error indicator
└─ Auto-save retries on next change

\\\

---

## 9. AUTHENTICATION FLOW

\\\
┌─────────────────────────────────────────────────────────────────┐
│               AUTHENTICATION & TOKEN REFRESH                     │
└─────────────────────────────────────────────────────────────────┘

INITIAL LOGIN
├─ User submits email/password
├─ POST /api/auth/login
├─ Response: { accessToken, refreshToken }
├─ Store: localStorage.accessToken & localStorage.refreshToken
└─ Ready for API calls

AUTHENTICATED API CALL
├─ Any API request:
│  ├─ Read: localStorage.accessToken
│  ├─ Add header: Authorization: Bearer {token}
│  ├─ Send: GET /api/workflows
│  └─ Backend validates token
│
└─ Response: 200 OK + data

TOKEN EXPIRATION & REFRESH
├─ After time: Backend rejects token
├─ Response: 401 Unauthorized
│
├─ Axios interceptor catches 401:
│  ├─ Read: localStorage.refreshToken
│  ├─ POST /api/auth/refresh { headers: { Authorization: Bearer {refreshToken} } }
│  └─ Response: { accessToken, refreshToken } (both new)
│
├─ Update tokens:
│  ├─ localStorage.accessToken = newAccessToken
│  ├─ localStorage.refreshToken = newRefreshToken
│  └─ Continue with original request using new token
│
└─ Original request retried: GET /api/workflows (with new token)
   └─ Response: 200 OK + data

REFRESH FAILURE
├─ Refresh token also expired or invalid
├─ POST /api/auth/refresh → 401
│
├─ Interceptor detects refresh failure:
│  ├─ Clear: localStorage.accessToken
│  ├─ Clear: localStorage.refreshToken
│  ├─ Redirect: window.location.href = '/login'
│  └─ User forced to re-login
│
└─ Session ended

\\\

---

## 10. CACHE INVALIDATION PATTERNS

\\\
┌─────────────────────────────────────────────────────────────────┐
│              REACT QUERY CACHE INVALIDATION                      │
└─────────────────────────────────────────────────────────────────┘

Integration CRUD
├─ POST /integrations (create)
│  └─ Invalidate: ['integrations']
│
├─ DELETE /integrations/{id} (delete)
│  └─ Invalidate: ['integrations']
│
└─ GET /integrations (auto-refetch on next read)

Workflow CRUD
├─ POST /workflows (create)
│  └─ Invalidate: ['workflows']
│
├─ PATCH /workflows/{id} (update/auto-save)
│  ├─ Invalidate: ['workflow', id]
│  └─ Invalidate: ['workflows'] (list may have updated date)
│
├─ DELETE /workflows/{id} (delete)
│  └─ Invalidate: ['workflows']
│
└─ GET /workflows (auto-refetch on next read)

Workflow Activation/Deactivation
├─ POST /workflows/{id}/activate
│  ├─ Invalidate: ['workflow', id]
│  └─ Invalidate: ['workflows']
│
├─ POST /workflows/{id}/deactivate
│  ├─ Invalidate: ['workflow', id]
│  └─ Invalidate: ['workflows']
│
└─ GET /workflows (refreshes status badge)

Execution CRUD
├─ POST /workflows/{id}/execute (run workflow)
│  └─ Invalidate: ['executions']
│
├─ GET /executions (auto-refetch on next read)
│  └─ Shows new execution in list
│
└─ GET /executions/{id} (auto-refetch every 3s while running)
   └─ Live updates during execution

Notifications
├─ WebSocket 'notification:new' event
│  └─ Invalidate: ['notifications']
│
├─ GET /notifications (auto-refetch)
│  └─ Shows new notification
│
├─ PATCH /notifications/{id}/read (mark as read)
│  └─ Invalidate: ['notifications']
│  └─ Invalidate: ['notifications', 'unread-count']
│
└─ GET /notifications/unread-count (auto-refetch)
   └─ Badge updates

Dashboard Stats
├─ WebSocket 'execution:completed' event
│  └─ Invalidate: ['dashboard-stats']
│
├─ GET /executions/stats (auto-refetch)
│  └─ Cards update with new stats
│
└─ Dashboard re-renders live

CACHE PERSISTENCE
├─ Defaults (if not specified):
│  ├─ staleTime: 0 (immediately stale)
│  ├─ cacheTime: 5 minutes (garbage collected after)
│  └─ refetchInterval: none (unless specified)
│
├─ Custom (where specified):
│  ├─ useExecutions: refetch every 3s
│  ├─ useNotifications: refetch every 30s
│  ├─ useUnreadCount: refetch every 15s
│  └─ useWebSocket integrations: real-time invalidation

\\\

---

