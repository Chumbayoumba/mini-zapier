# COMPREHENSIVE INTEGRATIONS FRONTEND AUDIT REPORT

## EXECUTIVE SUMMARY

This monorepo implements a workflow automation platform with a React frontend connecting to a NestJS backend. The system supports 5 integration types (Telegram, SMTP, Webhook, HTTP API, Database) that can be added and used in workflows. The workflow editor uses ReactFlow for visual graph editing, with a node-based architecture (triggers + actions).

---

## 1. INTEGRATIONS PAGE - Complete Flow

### File: pps/frontend/src/app/(dashboard)/integrations/page.tsx

#### UI State Machine (3-Step Flow)
\\\
[List View] → Click "Add Integration" → [Type Select]
                                              ↓
                                   [Configuration Form]
                                   → Click "Verify"
                                   → Show Result
                                   → Click "Add Integration"
                                   → POST /api/integrations
                                   → Success → [List View Updated]
\\\

#### Step 1: List View
- Query: useQuery({ queryKey: ['integrations'], queryFn: GET /integrations })
- Display grid of integration cards
- Each card shows:
  - Type icon with background color
  - Integration name
  - Status: "Connected" (green checkmark) or "Inactive" (red X)
  - Creation date
  - Delete button
- Empty state: Shows onboarding with "Add Your First Integration" button

#### Step 2: Type Selection
- Grid of 5 cards, one per type
- Each card has icon, label, description
- User clicks to select type and enter form

#### Step 3: Configuration & Verification

**TELEGRAM**:
- Input field: Bot Token (placeholder: "123456:ABC-DEF1234...")
- Verify button calls: POST /api/integrations/telegram/verify { botToken }
- Response includes: botId, botName, botUsername, photoUrl
- Success shows bot avatar + username
- Add button creates: { type: 'TELEGRAM', name: '@botUsername', config: { botToken }, metadata: { botId, botName, botUsername, photoUrl } }

**SMTP**:
- Inputs: Name, Host, Port, Username, Password
- Verify calls: POST /api/integrations/smtp/verify { host, port, user, password, secure }
- Success shows confirmation message
- Add creates: { type: 'SMTP', name: 'User Email', config: { host, port, user, password }, metadata: { message } }

**WEBHOOK**:
- Input: Webhook Name, URL (optional - auto-generated)
- Verify calls: POST /api/integrations/webhook/verify { name, url }
- Response includes: webhookUrl (auto-generated), secret
- Success shows generated webhook URL
- Add creates: { type: 'WEBHOOK', name: 'My Webhook', config: { webhookUrl, secret }, metadata: { webhookUrl } }

**HTTP_API**:
- Inputs: Name (optional), Base URL, Auth Header Key, Auth Header Value
- Verify calls: POST /api/integrations/http-api/verify { baseUrl, headers }
- Response: statusCode, message
- Success shows connection status
- Add creates: { type: 'HTTP_API', name: 'API Name', config: { baseUrl, headers }, metadata: { statusCode, message } }

**DATABASE**:
- Inputs: Name (optional), Connection String
- Verify calls: POST /api/integrations/database/verify { connectionString }
- Response: message, connection info
- Add creates: { type: 'DATABASE', name: 'DB Name', config: { connectionString }, metadata: { message } }

#### Data Structure
\\\	ypescript
interface Integration {
  id: string;                    // UUID
  type: 'TELEGRAM'|'SMTP'|...; // Enum
  name: string;                  // User-friendly display name
  config: Record<string,any>;    // Type-specific credentials
  metadata: Record<string,any>;  // Additional info (bot photos, URLs)
  isActive: boolean;             // Connection status
  createdAt: string;             // ISO timestamp
}
\\\

#### API Endpoints Called
- GET /api/integrations - List all
- POST /api/integrations/{type}/verify - Verify before save
- POST /api/integrations - Create new
- DELETE /api/integrations/{id} - Delete

#### React Query Cache
- queryKey: ['integrations']
- On success: invalidateQueries(['integrations']) to refresh list
- On error: toast.error('Failed to ...')

---

## 2. WORKFLOW EDITOR - Complete Architecture

### File: pps/frontend/src/app/(dashboard)/workflows/[id]/editor/page.tsx

### Component Structure
\\\
EditorPage (ReactFlowProvider wrapper)
├── EditorCanvas (main component)
│   ├── EditorToolbar (top bar: undo/redo, save, activate, run)
│   ├── ReactFlow Canvas
│   │   ├── Node Palette (left sidebar - drag sources)
│   │   ├── Canvas Area
│   │   ├── MiniMap (bottom right)
│   │   └── Controls (zoom/fit/center)
│   └── NodeConfigPanel (right sidebar - when node selected)
\\\

### Trigger Types (Max 1 per workflow)

#### WEBHOOK Trigger
**Config Fields**:
- secret (optional): HMAC secret for request validation

**Auto-Generated**: 
- Webhook URL: /api/webhooks/{triggerId}
- Shows in config panel with copy button

**When triggered**: External service POSTs to webhook URL → workflow executes

#### CRON Trigger
**Config Fields**:
- cronExpression (required): e.g., "*/5 * * * *"
- timezone (optional): e.g., "UTC"

**Quick Help**: Shows examples (Every 5 min, Every hour, Weekdays 9:00)

**When triggered**: Scheduler runs expression → workflow executes

#### EMAIL Trigger
**Config Fields**:
- imapHost (required): e.g., "imap.gmail.com"
- imapPort (required): e.g., "993"
- imapUser (required): email address
- imapPassword (required): app password
- filter (optional): Subject filter like "Order*"

**When triggered**: New matching email arrives → workflow executes

#### TELEGRAM Trigger
**Config Fields**:
- integrationId (required, dropdown): Select saved Telegram bot
- eventType (required, select): 
  - 🚀 /start command
  - ❓ /help command  
  - ⌨️ Any command
  - 💬 Text message (not commands)
  - 🔘 Button click (callback)
  - 📨 Any event

**Integration Lookup**:
- Queries: GET /api/integrations (filtered type=TELEGRAM)
- Populates dropdown with bot names
- Shows warning if no bots configured

**Available Trigger Data for Actions**:
`
{{trigger.text}}                  // Message text
{{trigger.chat.id}}              // Chat ID (auto-fills chatId in action)
{{trigger.from.first_name}}      // User's first name
{{trigger.from.username}}        // User's username
{{trigger.command}}              // Command name (without /)
{{trigger.commandArgs}}          // Command arguments as string
`

### Action Types (Multiple allowed)

#### HTTP_REQUEST Action
**Config Fields**:
- url (required): API endpoint, supports {{template}} variables
- method (required): GET/POST/PUT/DELETE/PATCH
- headers (optional): JSON object with headers
- body (optional): JSON request body
- timeout (optional): milliseconds

**Template Support**: Can reference {{trigger.field}} or {{steps.prevNode.output}}

**Execution**: Makes HTTP call, stores response in output

#### SEND_EMAIL Action
**Config Fields**:
- to (required): Comma-separated email list
- cc (optional): Comma-separated
- bcc (optional): Comma-separated
- subject (required): Email subject, supports {{template}}
- body (required): Email body, supports {{template}}
- isHtml (optional): Select "Plain Text" or "HTML"

**Execution**: Uses configured SMTP integration to send

#### TELEGRAM Action
**Config Fields**:
- integrationId (required, dropdown): Which bot to use
- chatId (optional): Auto-populated if Telegram trigger exists
- message (required): Message text, supports {{template}}
- parseMode (optional): HTML/Markdown/MarkdownV2

**Smart Features**:
- If connected to Telegram trigger: Shows auto-reply hint
- chatId auto-filled from trigger context
- Pre-made templates: greeting, help, echo, notification
- Clickable template variable buttons

**Template Variables**:
`
{{trigger.from.first_name}}      // Name
{{trigger.from.username}}        // Username
{{trigger.text}}                 // Message text
{{trigger.chat.id}}              // Chat ID
{{trigger.command}}              // Command name
{{trigger.commandArgs}}          // Arguments
`

#### DATABASE Action
**Config Fields**:
- operation (locked): SELECT only
- table (required, dropdown): 
  - workflows
  - workflow_versions
  - triggers
  - workflow_executions
  - execution_step_logs
- where (optional): JSON filter conditions
- orderBy (optional): Column + direction
- limit (optional): Number of rows

**Execution**: Queries the database, stores result in output

#### TRANSFORM Action
**Config Fields**:
- expression (required, code editor): JSONata expression

**Example**: \$.data.items[price > 100]\

**Execution**: Transforms previous step output using JSONata

### Node Configuration Panel (components/editor/node-config-panel.tsx)

#### When Node Selected
Right sidebar opens showing:

**Header**:
- Settings icon + node label
- Node type badge (⚡ Trigger or ▶️ Action)
- Close button (X)

**General Section**:
- Node label (editable text input)
- For WEBHOOK: Copyable webhook URL with copy button
  - Shows full URL with /api/webhooks/... 
  - Copy button with feedback (changes to green checkmark)

**Integration Injection**:
`	ypescript
// Real-time query for integrations
const { data: integrations = [] } = useQuery({
  queryKey: ['integrations'],
  queryFn: async () => {
    const res = await api.get('/integrations');
    return res.data.data || res.data;
  },
});

// Filter for TELEGRAM nodes
const telegramBots = integrations.filter(i => i.type === 'TELEGRAM');

// Inject into field options
fields = fields.map(f => 
  f.key === 'integrationId' 
    ? { ...f, options: telegramBots.map(b => ({ value: b.id, label: b.name })) }
    : f
);
`

**Configuration Section** - Dynamic form rendering:

**Field Types**:
- text: Regular input
- password: Masked input
- number: Number input
- select: Dropdown (from options array)
- textarea: Multi-line text
- code: Code editor with monospace font

**Per-field**:
- Label + required asterisk if mandatory
- Input/textarea/select component
- Hint text below (gray, small)
- Error message if validation failed

**Helpers by Node Type**:

*CRON*:
- Shows quick-select buttons
- Clicking example auto-fills cronExpression field
- Examples: "Every 5 minutes", "Weekdays at 9:00"

*TELEGRAM Trigger*:
- Info box: "How it works" explanation
- Available variables table below config
- Shows {{trigger.text}}, {{trigger.chat.id}}, etc.

*TELEGRAM Action*:
- Auto-reply info box (if trigger is Telegram)
- Message template buttons (greeting, help, echo, notification)
- Clickable variable chips to insert into message field
- Full template variable reference

*Other Actions*:
- Generic template variables reference
- Shows {{trigger.field}} and {{steps.nodeId.output.field}} syntax

**Notes Section**:
- Optional description field for documentation

### State Management: stores/editor-store.ts (Zustand + Zundo)

**Core State**:
`	ypescript
interface EditorState {
  nodes: Node[];              // ReactFlow nodes
  edges: Edge[];              // ReactFlow edges
  selectedNode: Node | null;  // Currently selected
  isDirty: boolean;           // Has unsaved changes
  isSaving: boolean;          // Currently saving
  lastSavedAt: Date | null;   // Last save timestamp
  clipboard: ClipboardData;   // Copy/paste buffer
}
`

**Key Actions**:
- onNodesChange/onEdgesChange: ReactFlow updates
- onConnect: New edge created
- addNode: Add new node to canvas
- updateNodeData: Update node config
- setSelectedNode: Select for editing
- markDirty: Flag as unsaved
- markSaved: Clear unsaved flag
- deleteSelectedNodes: Remove selected + their edges
- copySelectedNodes/pasteNodes: Clipboard operations

**Undo/Redo**:
- Powered by zundo temporal middleware
- Tracks up to 50 history states
- Throttled 500ms between snapshots
- Undo: useEditorStore.temporal.getState().undo()
- Redo: useEditorStore.temporal.getState().redo()

### Workflow Definition Storage

**Structure**:
`	ypescript
interface WorkflowDefinition {
  nodes: [
    {
      id: string,                 // Unique ID
      type: 'triggerNode' | 'actionNode',
      position: { x: number, y: number },
      data: {
        label: string,            // Display name
        type: string,             // WEBHOOK, CRON, HTTP_REQUEST, etc.
        config: {                 // Type-specific config
          // Example for HTTP_REQUEST:
          url: string,
          method: string,
          headers: object,
          body: string
        },
        description: string       // User notes
      }
    }
  ],
  edges: [
    {
      id: string,
      source: string,             // Node ID
      target: string,             // Node ID
      type: 'animated',
      animated: boolean
    }
  ]
}
`

**Persistence**:
- Auto-save: useAutoSave hook, 2-second debounce after edit
- Manual save: Save button or Ctrl+S
- Sends: PATCH /api/workflows/{id} { definition: {...} }
- Silent save uses useUpdateWorkflowSilent (no toast)

### Workflow Execution Flow

1. User clicks "Run" button
2. POST /api/workflows/{id}/execute
3. Backend creates WorkflowExecution
4. Executes trigger (collects initial data)
5. Passes data to actions in sequence
6. Each action can use {{trigger.*}} and {{steps.*}} variables
7. Logs each step (input, output, errors)
8. Emits execution:completed via WebSocket
9. Dashboard updates via real-time listener

---

## 3. API HOOKS & CLIENT

### File: pps/frontend/src/lib/api.ts

**Base Configuration**:
`	ypescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' }
});
`

**Request Interceptor**:
- Reads accessToken from localStorage
- Adds header: Authorization: Bearer {token}

**Response Interceptor**:
- On 401 Unauthorized:
  - Reads refreshToken from localStorage
  - POSTs to /api/auth/refresh with refreshToken
  - Updates localStorage with new tokens
  - Retries original request
  - On refresh failure: clears tokens, redirects to /login

### File: pps/frontend/src/hooks/use-workflows.ts

**Queries**:
\\\	ypescript
useWorkflows(pageOrFilters)
// GET /workflows?page=1&search=&status=
// Returns: { workflows: [], total, page, limit, totalPages }
// Cache: ['workflows', filters]
// Refetch: On add/update/delete

useWorkflow(id)
// GET /workflows/{id}
// Returns: Workflow with full definition
// Cache: ['workflow', id]
// Enabled: Only when id provided
\\\

**Mutations**:
\\\	ypescript
useCreateWorkflow()
// POST /workflows { name, description? }
// Returns: Created workflow with ID
// Toast: "Workflow created"

useUpdateWorkflow()
// PATCH /workflows/{id} { ...data }
// Toast: "Workflow updated"
// Invalidates: ['workflow', id], ['workflows']

useUpdateWorkflowSilent()
// PATCH /workflows/{id} { ...data }
// NO TOAST (used for auto-save)

useDeleteWorkflow()
// DELETE /workflows/{id}
// Toast: "Workflow deleted"

useActivateWorkflow()
// POST /workflows/{id}/activate
// Toast: "Workflow activated"

useDeactivateWorkflow()
// POST /workflows/{id}/deactivate
// Toast: "Workflow paused"

useExecuteWorkflow()
// POST /workflows/{id}/execute { data? }
// Toast: "Workflow execution started"
// Invalidates: ['executions']
\\\

### File: pps/frontend/src/hooks/use-executions.ts

**Queries**:
\\\	ypescript
useExecutions(filters)
// GET /executions?page=1&status=&dateFrom=&dateTo=&workflowId=
// Returns: { executions: [], total, page, limit }
// Cache: ['executions', filters]

useExecution(id)
// GET /executions/{id}
// Returns: Execution with step logs
// Refetch: Every 3 seconds (for live updates)

useDashboardStats()
// GET /executions/stats
// Returns: { totalWorkflows, activeWorkflows, totalExecutions, successRate, ... }

useRecentExecutions()
// GET /executions?limit=10
// Returns: Last 10 executions

useChartData(period) // '7d' or '30d'
// GET /executions?limit=500&dateFrom=X
// Aggregates into daily { date, success, failed }
\\\

### File: pps/frontend/src/hooks/use-notifications.ts

**Queries**:
\\\	ypescript
useNotifications(page = 1, limit = 20)
// GET /notifications?page=1&limit=20
// Returns: { items, total, page, limit, totalPages }
// Refetch: Every 30 seconds
// Cache: ['notifications', page, limit]

useUnreadCount()
// GET /notifications/unread-count
// Returns: { count: number }
// Refetch: Every 15 seconds
// Cache: ['notifications', 'unread-count']
\\\

**Mutations**:
\\\	ypescript
useMarkAsRead(id)
// PATCH /notifications/{id}/read
// Invalidates: ['notifications']

useMarkAllAsRead()
// PATCH /notifications/read-all
// Invalidates: ['notifications']

useDeleteNotification(id)
// DELETE /notifications/{id}
// Invalidates: ['notifications']
\\\

**Notification Schema**:
\\\	ypescript
interface Notification {
  id: string;
  userId: string;
  type: string;              // execution_failed, execution_completed, workflow_activated, workflow_deactivated
  title: string;             // "Workflow Completed"
  message: string;           // "Your workflow 'Daily Sync' completed successfully"
  data: Record<string, any>; // { workflowId, executionId, ... }
  isRead: boolean;
  createdAt: string;         // ISO timestamp
}
\\\

---

## 4. NOTIFICATION SYSTEM

### File: components/layout/notification-dropdown.tsx

**Component Flow**:

1. **Bell Icon Button**
   - Displays bell icon
   - Red badge in corner showing unread count (9+ display)
   - Toggles dropdown on click

2. **Dropdown Popup**
   - Position: Absolute right-aligned below bell
   - Width: 384px (w-96)
   - Max height: 400px with scroll
   - Shadow: shadow-xl shadow-black/20
   - Z-index: 50

3. **Header**
   - Title: "Notifications"
   - "Mark all read" button (if unread > 0)
   - Close button (X)

4. **Notification List**
   - Scrollable area with max-height: 400px
   - Each item shows:
     - Type icon (AlertCircle/CheckCircle2/Info) in colored box
     - Bold title (if unread) or gray (if read)
     - Subtle message below
     - Time ago (relative: "2m ago", "3h ago")
     - Mark read button (if unread)
     - Delete button
   - Empty state: Bell icon + "No notifications yet"

5. **Footer**
   - Shows "Showing X of Y notifications"

### Notification Types & Styling

\\\	ypescript
const typeConfig = {
  execution_failed: { 
    icon: AlertCircle, 
    color: 'text-red-400',
    bg: 'bg-red-500/10' 
  },
  execution_completed: { 
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10' 
  },
  workflow_activated: { 
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10' 
  },
  workflow_deactivated: { 
    icon: Info,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10' 
  },
};
\\\

### Real-time Updates

**WebSocket Integration**:
\\\	ypescript
const { on, connected } = useWebSocket();

useEffect(() => {
  if (!connected) return;
  
  const unsub = on('notification:new', () => {
    // Invalidate notifications query to refetch
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });
  
  return () => unsub?.();
}, [connected, on, queryClient]);
\\\

**Polling Fallback**:
- useUnreadCount() refetches every 15 seconds
- useNotifications() refetches every 30 seconds

---

## 5. WEBSOCKET & LIVE UPDATES

### File: hooks/use-websocket.ts

**Configuration**:
\\\	ypescript
const socket = io(wsUrl, {
  auth: { token: accessToken },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});
\\\

**Core Methods**:
- on(event, handler): Subscribe to event
- emit(event, data): Emit event
- joinExecution(id): Subscribe to execution updates
- leaveExecution(id): Unsubscribe

**Events Emitted by Backend**:
- execution:completed
- execution:started
- execution:failed
- notification:new

**Usage in Dashboard**:
\\\	ypescript
const { on, connected } = useWebSocket();

useEffect(() => {
  if (!connected) return;
  
  const unsubs = [
    on('execution:completed', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-executions'] });
      queryClient.invalidateQueries({ queryKey: ['chart-data'] });
    }),
    on('execution:started', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }),
    on('execution:failed', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-executions'] });
    }),
  ];
  
  return () => unsubs.forEach(unsub => unsub?.());
}, [connected, on, queryClient]);
\\\

---

## 6. AUTO-SAVE MECHANISM

### File: hooks/use-auto-save.ts

**Trigger Logic**:
\\\	ypescript
export function useAutoSave(workflowId: string) {
  const updateWorkflow = useUpdateWorkflowSilent();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (!state.isDirty) return;
      
      // Clear existing timer
      if (timerRef.current) clearTimeout(timerRef.current);
      
      // Set new timer: wait 2 seconds of no edits
      timerRef.current = setTimeout(() => {
        const { nodes, edges, isSaving } = useEditorStore.getState();
        if (isSaving) return;
        
        // Save without toast
        updateWorkflow.mutateAsync({
          id: workflowId,
          definition: { nodes, edges }
        }).then(() => {
          useEditorStore.getState().markSaved();
        }).catch(() => {
          useEditorStore.setState({ isSaving: false });
        });
      }, 2000);
    });
    
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workflowId, updateWorkflow]);
}
\\\

**Flow**:
1. User edits node config → updateNodeData() called
2. Zustand state updates (isDirty = true)
3. Store subscription fires
4. 2-second timer starts
5. If more edits before timer: timer reset
6. After 2s silence: PATCH /workflows/{id} with definition
7. Mark saved (isDirty = false)

---

## END-TO-END DATA FLOW EXAMPLES

### Scenario 1: Creating Telegram Integration

\\\
FRONTEND                           BACKEND                    EXTERNAL
User clicks                        
"Add Integration"                  
    ↓                              
Selects "Telegram Bot"             
    ↓                              
Enters bot token                   
    ↓                              
Clicks "Verify"                    
    ↓                              
POST /integrations/telegram/verify {botToken}
                                   ├→ Calls Telegram API
                                   ├→ Gets bot info
                                   ← { ok: true, botId, botName, botUsername, photoUrl }
    ↓                              
Display bot avatar + name          
    ↓                              
User clicks "Add Integration"      
    ↓                              
POST /integrations                 
  { type: 'TELEGRAM',             
    name: '@mybot',                
    config: { botToken },          
    metadata: { botId, botName, botUsername, photoUrl } }
                                   ├→ Save to DB
                                   ← { id, type, name, config, metadata, isActive, createdAt }
    ↓                              
Invalidate query ['integrations']  
    ↓                              
Integration appears in list        
\\\

### Scenario 2: Using Telegram in Workflow

\\\
FRONTEND                           BACKEND                    TELEGRAM
Editor loads                       
    ↓                              
GET /integrations                  
  ← [{ id: 'int_1', type: 'TELEGRAM', name: '@mybot', ... }]
    ↓                              
User drags Telegram trigger        
    ↓                              
User clicks trigger node           
    ↓                              
Config panel loads                 
    ↓                              
Telegram bots populate dropdown    
    ↓                              
User selects bot + /start event   
    ↓                              
Config saved to node               
{ integrationId: 'int_1',          
  eventType: 'command_start' }     
    ↓                              
User adds HTTP_REQUEST action      
    ↓                              
Connects trigger → action          
    ↓                              
Auto-save fires                    
    ↓                              
PATCH /workflows/{id}              
  { definition: { nodes, edges } }
                                   ├→ Save to DB
                                   ← 200 OK
    ↓                              
WORKFLOW READY FOR USE
\\\

### Scenario 3: Workflow Execution

\\\
User sends                                     
"/start" to bot
         ├───────────────────────────────────→ Telegram receives message
                                              ├→ Bot passes webhook
    ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
Backend receives                              
POST /webhooks/{triggerId}
  { from: { first_name: "Ivan", username: "ivan" },
    text: "/start",
    chat: { id: 12345 },
    command: "start" }
    ↓                                         
Create WorkflowExecution
    ↓                                         
Execute trigger (extract data)
    ↓                                         
Pass to HTTP_REQUEST action
    config.url = "https://api.example.com/webhook?user={{trigger.from.first_name}}"
    → rendered as "https://api.example.com/webhook?user=Ivan"
    ↓                                         
Make HTTP request
    ← { status: 200, data: { ... } }
    ↓                                         
Log step success
    ↓                                         
Emit: execution:completed
    ↓                                         
WebSocket listener notified
    ↓                                         
Query cache invalidated
    ↓                                         
Dashboard updates live
    ↓                                         
Create notification:
    { type: 'execution_completed',
      title: 'Telegram Workflow Completed',
      message: 'Workflow executed successfully' }
    ↓                                         
Emit: notification:new
    ↓                                         
Notification dropdown refreshes
    ↓                                         
User sees new notification
\\\

---

## KEY FILES REFERENCE

| Path | Lines | Purpose |
|------|-------|---------|
| apps/frontend/src/app/(dashboard)/integrations/page.tsx | 525 | Integrations add/list/delete UI |
| apps/frontend/src/app/(dashboard)/workflows/[id]/editor/page.tsx | 306 | Main editor component & canvas |
| apps/frontend/src/components/editor/node-config-panel.tsx | 494 | Right sidebar node config |
| apps/frontend/src/components/editor/nodes/trigger-node.tsx | 72 | Rendered trigger node |
| apps/frontend/src/components/editor/nodes/action-node.tsx | 82 | Rendered action node |
| apps/frontend/src/components/editor/editor-toolbar.tsx | 113 | Top toolbar (undo/redo/save/run) |
| apps/frontend/src/components/layout/notification-dropdown.tsx | 210 | Notification UI & real-time |
| apps/frontend/src/hooks/use-workflows.ts | 141 | Workflow API queries/mutations |
| apps/frontend/src/hooks/use-executions.ts | 108 | Execution queries & charts |
| apps/frontend/src/hooks/use-notifications.ts | 85 | Notification queries/mutations |
| apps/frontend/src/hooks/use-websocket.ts | 91 | WebSocket connection & events |
| apps/frontend/src/hooks/use-auto-save.ts | 48 | Auto-save logic |
| apps/frontend/src/stores/editor-store.ts | 255 | Zustand editor state |
| apps/frontend/src/lib/api.ts | 48 | Axios client with interceptors |
| apps/frontend/src/types/index.ts | 121 | TypeScript interfaces |

---

## CRITICAL INTEGRATION POINTS

1. **Integration Selection in Nodes**
   - Query: GET /api/integrations in node-config-panel
   - Filter by type matching node
   - Populate dropdown with integration names
   - Store integrationId in node.data.config

2. **Template Variables in Actions**
   - {{trigger.*}}: Data from trigger node output
   - {{steps.nodeId.output.*}}: Data from previous actions
   - Rendered at execution time

3. **Webhook URL Generation**
   - Auto-generated: /api/webhooks/{triggerId}
   - Displayed and copyable in node config
   - User provides to external system

4. **Configuration Persistence**
   - Stored in node.data.config
   - Serialized in workflow.definition JSON
   - Persisted via PATCH /workflows/{id}

5. **Verification Endpoints**
   - Each integration type has verify endpoint
   - Called before saving
   - Returns confirmation + metadata

6. **Real-time Features**
   - WebSocket namespace: /executions
   - Events: execution:*, notification:new
   - Query cache invalidation on event

---

## NOTES & OBSERVATIONS

- **No explicit integration selection in workflows**: Integrations are selected at the NODE level, not workflow level
- **Node-centric architecture**: Each node independently references integrations it needs
- **Template variables**: Enable dynamic data passing between nodes
- **Webhook URLs**: Pre-generated per trigger, not per integration
- **Verification required**: All integration types must pass verification before saving
- **Metadata storage**: Separate from config, stores display/reference data (bot photos, URLs)
- **Polling + WebSocket**: Dual approach for reliability and real-time updates
- **Silent auto-save**: Uses mutation without toast to avoid UI clutter
