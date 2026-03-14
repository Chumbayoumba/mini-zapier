# Phase 6 — Editor UX Polish: RESEARCH

> Generated: 2026-03-14 | Phase: 06-editor-ux-polish | Requirements: EDT-01..EDT-09

---

## 1. Current State Audit

### 1.1 Files Inventory

| File | Purpose | LOC |
|------|---------|-----|
| `apps/frontend/src/app/(dashboard)/workflows/[id]/editor/page.tsx` | Main editor page — canvas, sidebar, toolbar | ~260 |
| `apps/frontend/src/stores/editor-store.ts` | Zustand store — nodes, edges, CRUD | ~44 |
| `apps/frontend/src/components/editor/node-config-panel.tsx` | Side panel for node configuration | ~286 |
| `apps/frontend/src/components/editor/nodes/trigger-node.tsx` | Trigger node component (WEBHOOK, CRON, EMAIL) | ~68 |
| `apps/frontend/src/components/editor/nodes/action-node.tsx` | Action node component (HTTP, Email, Telegram, DB, Transform) | ~82 |
| `apps/frontend/src/components/editor/edges/animated-edge.tsx` | Animated edge with pulse dot | ~39 |
| `apps/frontend/src/hooks/use-workflows.ts` | React Query hooks for CRUD | ~127 |
| `apps/frontend/src/types/index.ts` | WorkflowNode, WorkflowEdge, WorkflowDefinition types | ~121 |

### 1.2 Per-Requirement Status

| REQ | Requirement | Status | What Exists | What's Missing |
|-----|-------------|--------|-------------|----------------|
| **EDT-01** | Drag-and-drop from sidebar | ✅ ~90% done | Sidebar palette with drag, `onDrop` handler, `screenToFlowPosition` | Drop indicator feedback (ghost preview on canvas) |
| **EDT-02** | Edge connection with visual feedback | ✅ ~70% done | `onConnect` in store, `AnimatedEdge` component, `smoothstep` edges | Connection line styling during drag, `connectionLineStyle` prop, handle hover states |
| **EDT-03** | Select, move, delete, duplicate | ⚠️ ~40% done | Select (via `onNodeClick`), move (default React Flow), `selected` visual style | No delete button/action, no duplicate, no multi-select toolbar, no context menu |
| **EDT-04** | Undo/redo (50 levels) | ❌ Not started | — | zundo middleware, keyboard bindings, UI buttons, history limit |
| **EDT-05** | Zoom, pan, minimap | ✅ ~95% done | `Controls`, `MiniMap` (zoomable, pannable), `Background`, `fitView` | Minor: zoom level indicator in toolbar |
| **EDT-06** | Node config side panel | ✅ ~85% done | Full panel with per-type fields, validation, cron examples, template hints | Panel animation (slide-in), panel resize, description field → textarea |
| **EDT-07** | Connection validation | ❌ Not started | — | `isValidConnection` callback, cycle detection, multi-trigger guard, visual error feedback |
| **EDT-08** | Auto-save draft, explicit publish | ❌ Not started | Manual `handleSave` button exists | Auto-save debounce, dirty state tracking, save indicator, publish vs draft flow |
| **EDT-09** | Keyboard shortcuts | ❌ Not started | — | `useKeyPress` bindings, clipboard state, Ctrl+S/Z/Y/C/V/A/Delete handlers |

---

## 2. Implementation Approach Per Requirement

### EDT-01: Drag-and-Drop Nodes (Minor Polish)

**Current state:** Fully working. Sidebar items are draggable, `onDrop` creates nodes.

**Remaining work:**
- Add drop indicator (canvas border highlight when dragging over)
- Optional: ghost preview showing node shape at cursor during drag

**API needed:**
- `onDragOver` already handles `event.preventDefault()` ✓
- CSS class on `reactFlowWrapper` during drag-over

**Effort:** S (small) — cosmetic only

---

### EDT-02: Edge Connection Visual Feedback (Minor Polish)

**Current state:** Edges connect with animated smoothstep. AnimatedEdge has pulse animation.

**Remaining work:**
- Custom `connectionLineStyle` for in-progress connection drag
- Handle hover glow effect (CSS on `.react-flow__handle`)
- Optional: connection line component via `connectionLineComponent`

**API needed:**
```tsx
<ReactFlow
  connectionLineStyle={{ stroke: '#6366F1', strokeWidth: 2 }}
  connectionLineType={ConnectionLineType.SmoothStep}
/>
```

**Effort:** S — CSS + 2 props

---

### EDT-03: Select, Move, Delete, Duplicate

**Current state:** Selection works on click, movement is default. No delete/duplicate.

**Implementation plan:**
1. **Delete:** Add `deleteElements` from `useReactFlow()`, wire to Delete key + toolbar button
2. **Duplicate:** Copy selected nodes with offset position, generate new IDs, preserve edges between copied nodes
3. **Multi-select:** Already supported by React Flow (Shift+click, drag selection). Need toolbar showing count
4. **Context menu:** Optional right-click menu with Delete/Duplicate/Copy

**Key APIs:**
- `useReactFlow().deleteElements({ nodes, edges })`
- `useReactFlow().getNodes().filter(n => n.selected)`
- `onSelectionChange` callback for tracking multi-select
- `selectionOnDrag` prop for box selection

**Store additions:**
```ts
deleteSelectedNodes: () => void;
duplicateSelectedNodes: () => void;
```

**Effort:** M (medium)

---

### EDT-04: Undo/Redo (50 levels) — New Feature

**Approach:** Use `zundo` (v2.3.0+) Zustand temporal middleware.

**Integration plan:**

1. **Install:** `pnpm add zundo --filter @minizapier/frontend`

2. **Refactor `editor-store.ts`:**
```ts
import { temporal } from 'zundo';

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      // ... all existing state
    }),
    {
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      limit: 50,
      // Debounce rapid changes (drag = many position updates)
      handleSet: (handleSet) =>
        throttle<typeof handleSet>((state) => {
          handleSet(state);
        }, 500),
    }
  )
);
```

3. **Access undo/redo:**
```ts
const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState();
```

4. **Keyboard bindings:** Ctrl+Z → undo, Ctrl+Y / Ctrl+Shift+Z → redo

5. **UI:** Undo/Redo buttons in toolbar with disabled state based on `pastStates.length === 0`

**Critical considerations:**
- `partialize` only tracks `nodes` and `edges` — `selectedNode` and other UI state excluded
- `handleSet` with throttle (500ms) prevents undo history pollution during node drag
- `limit: 50` caps memory usage
- `onNodesChange` and `onEdgesChange` must go through store for zundo to capture

**zundo + Zustand 5 compatibility:** zundo 2.3.0 officially supports Zustand v5 ✓

**Effort:** L (large) — store refactor, careful throttle tuning, keyboard integration

---

### EDT-05: Zoom, Pan, Minimap (Minor Polish)

**Current state:** `Controls` + `MiniMap` already rendered with styling.

**Remaining work:**
- Add zoom level indicator in toolbar (e.g., "125%")
- `useViewport()` hook for reactive zoom display
- Optional: fit-view button already exists (`Maximize` button) ✓

**API needed:**
```ts
const { zoom } = useViewport();
// Display: <span>{Math.round(zoom * 100)}%</span>
```

**Effort:** XS

---

### EDT-06: Node Config Side Panel (Minor Polish)

**Current state:** Full working panel with per-type fields, validation, cron helper, template vars.

**Remaining work:**
- Slide-in animation (CSS transition or `framer-motion`)
- Close on Escape key
- Description field → Textarea for longer notes
- Optional: panel width resize handle

**Effort:** S

---

### EDT-07: Connection Validation — New Feature

**Implementation plan:**

1. **`isValidConnection` callback on ReactFlow:**
```ts
const isValidConnection = useCallback((connection: Connection) => {
  const { source, target } = connection;
  
  // Rule 1: No self-loops
  if (source === target) return false;
  
  // Rule 2: No circular references (DFS from target)
  const edges = get().edges;
  const visited = new Set<string>();
  
  function wouldCreateCycle(nodeId: string): boolean {
    if (nodeId === source) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    return edges
      .filter(e => e.source === nodeId)
      .some(e => wouldCreateCycle(e.target));
  }
  
  if (wouldCreateCycle(target!)) return false;
  
  // Rule 3: No multi-trigger (max 1 trigger per workflow)
  // Trigger nodes should only have source handles, not target
  // This is already enforced by TriggerNode having no target Handle
  
  // Rule 4: No duplicate edges
  const duplicate = edges.some(
    e => e.source === source && e.target === target
  );
  if (duplicate) return false;
  
  return true;
}, []);
```

2. **Visual feedback for invalid connections:**
- `connectionLineStyle` changes color to red when connection is invalid
- Use `onConnectStart` / `onConnectEnd` for tracking connection state
- Show toast or inline error when connection rejected

3. **Multi-trigger guard:**
- TriggerNode already has only `source` Handle (no target) — partially prevents incoming edges to triggers ✓
- Need to add: prevent connecting trigger → trigger
- Need to validate on drop: warn if >1 trigger node exists

**Store addition:**
```ts
validateConnection: (connection: Connection) => boolean;
```

**Effort:** M

---

### EDT-08: Auto-Save Draft, Explicit Publish — New Feature

**Backend analysis:**
- `PATCH /workflows/:id` accepts `{ definition }` and increments version ✓
- `POST /workflows/:id/activate` changes status to ACTIVE ✓
- Status enum: `DRAFT | ACTIVE | PAUSED | ARCHIVED` ✓
- No separate "publish" endpoint — activating a DRAFT workflow = publish

**Implementation plan:**

1. **Dirty state tracking in store:**
```ts
isDirty: boolean;
lastSavedAt: Date | null;
isSaving: boolean;
markDirty: () => void;
markSaved: () => void;
```

2. **Auto-save hook (`useAutoSave`):**
```ts
function useAutoSave(workflowId: string) {
  const { nodes, edges, isDirty, markSaved } = useEditorStore();
  const updateWorkflow = useUpdateWorkflow();
  const [debouncedNodes] = useDebounce(nodes, 2000);
  const [debouncedEdges] = useDebounce(edges, 2000);
  
  useEffect(() => {
    if (!isDirty) return;
    updateWorkflow.mutate(
      { id: workflowId, definition: { nodes: debouncedNodes, edges: debouncedEdges } },
      { onSuccess: () => markSaved() }
    );
  }, [debouncedNodes, debouncedEdges]);
}
```

3. **Save indicator in toolbar:**
- "Saving..." spinner during mutation
- "All changes saved" with timestamp
- "Unsaved changes" warning

4. **Explicit publish:**
- "Publish" button in toolbar → calls `POST /workflows/:id/activate`
- Shows confirmation dialog
- Disabled if no nodes/edges or validation errors exist

5. **Leave guard:**
- `beforeunload` event listener when `isDirty === true`
- `useRouter` navigation guard (Next.js doesn't have native one — use `window.onbeforeunload`)

**Effort:** L

---

### EDT-09: Keyboard Shortcuts — New Feature

**Implementation plan:**

Create `useEditorKeyboardShortcuts()` hook:

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| `Delete` / `Backspace` | Delete selected nodes/edges | `deleteElements()` from `useReactFlow()` |
| `Ctrl+C` | Copy selected nodes | Store in clipboard state |
| `Ctrl+V` | Paste from clipboard | Create nodes with offset, new IDs |
| `Ctrl+A` | Select all nodes | `setNodes(nodes.map(n => ({ ...n, selected: true })))` |
| `Ctrl+S` | Save workflow | Trigger `handleSave()` + `event.preventDefault()` |
| `Ctrl+Z` | Undo | `useEditorStore.temporal.getState().undo()` |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo | `useEditorStore.temporal.getState().redo()` |
| `Escape` | Deselect all / close panel | `setSelectedNode(null)` |

**Approach options:**
1. **`useKeyPress` from @xyflow/react** — simple boolean hooks per key, but limited for combos
2. **Custom `useEffect` with `keydown` listener** — more control, handles `preventDefault`, combo detection
3. **Recommendation:** Custom hook with `keydown` because we need `preventDefault()` for Ctrl+S

```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // Skip if user is typing in input/textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedNodes();
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    // ... etc
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

**Clipboard state in store:**
```ts
clipboard: { nodes: Node[]; edges: Edge[] } | null;
copySelectedNodes: () => void;
pasteNodes: () => void;
```

**Paste logic:** Duplicate nodes with position offset (+50, +50), remap edge source/target to new IDs, remap internal references.

**Effort:** M-L

---

## 3. Key @xyflow/react APIs & Hooks Summary

| API/Hook | Used For | EDT |
|----------|----------|-----|
| `screenToFlowPosition()` | Drop position calculation | EDT-01 ✓ |
| `connectionLineStyle`, `connectionLineType` | Edge drag feedback | EDT-02 |
| `deleteElements()` | Delete nodes/edges | EDT-03, EDT-09 |
| `getNodes()`, `getEdges()` | Read current graph state | EDT-03, EDT-07, EDT-09 |
| `onSelectionChange` | Track multi-selection | EDT-03 |
| `selectionOnDrag` | Box-select by dragging | EDT-03 |
| `useViewport()` | Zoom level display | EDT-05 |
| `isValidConnection` | Connection validation | EDT-07 |
| `onConnectStart`, `onConnectEnd` | Connection attempt tracking | EDT-07 |
| `useKeyPress` | Keyboard shortcut detection | EDT-09 |
| `fitView()` | Fit all nodes to viewport | EDT-05 ✓ |
| `MiniMap`, `Controls`, `Background` | Canvas chrome | EDT-05 ✓ |

---

## 4. zundo Integration Plan

### Installation
```bash
pnpm add zundo --filter @minizapier/frontend
```

### Store Refactor Pattern
```ts
// editor-store.ts — BEFORE
export const useEditorStore = create<EditorState>((set, get) => ({ ... }));

// editor-store.ts — AFTER
import { temporal } from 'zundo';
import { throttle } from '@/lib/utils'; // or lodash-es

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      // === Undo-tracked state ===
      nodes: [],
      edges: [],
      
      // === UI state (NOT tracked by undo) ===
      selectedNode: null,
      isDirty: false,
      isSaving: false,
      clipboard: null,
      
      // All existing actions...
      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes), isDirty: true }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true }),
      // ...
    }),
    {
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      limit: 50,
      handleSet: (handleSet) =>
        throttle<typeof handleSet>((state) => handleSet(state), 500),
    }
  )
);
```

### Key Risk: `onNodesChange` Flooding
React Flow fires `onNodesChange` on every pixel during drag. Without throttle, undo history fills with position micro-changes. The `handleSet` throttle (500ms) batches drag movement into ~1 undo entry per drag action.

### Accessing Temporal API
```ts
// Non-reactive (for callbacks)
const { undo, redo, clear } = useEditorStore.temporal.getState();

// Reactive (for UI — disable buttons when no history)
import { useStoreWithEqualityFn } from 'zustand/traditional';
function useTemporalStore<T>(selector: (state: TemporalState) => T) {
  return useStoreWithEqualityFn(useEditorStore.temporal, selector);
}
const canUndo = useTemporalStore(s => s.pastStates.length > 0);
const canRedo = useTemporalStore(s => s.futureStates.length > 0);
```

---

## 5. Shared File Risks

### High-Risk Files (Modified by Multiple Features)

| File | Modified By | Risk |
|------|-------------|------|
| `editor-store.ts` | EDT-03, EDT-04, EDT-07, EDT-08, EDT-09 | **CRITICAL** — central store, touched by everything |
| `editor/page.tsx` | EDT-01, EDT-02, EDT-03, EDT-05, EDT-07, EDT-08, EDT-09 | **HIGH** — main editor layout, all features add props/hooks |
| `node-config-panel.tsx` | EDT-06 | LOW — isolated changes |
| `trigger-node.tsx` / `action-node.tsx` | EDT-02 (handle styling) | LOW |

### Mitigation Strategy
1. **Plan 1** refactors `editor-store.ts` with zundo — all subsequent plans build on this
2. **Plan 2** adds all ReactFlow props to `editor/page.tsx` — later plans don't change this file
3. Keyboard shortcuts extracted to a **separate hook file** to avoid editor page bloat
4. Auto-save extracted to a **separate hook file**
5. Connection validation extracted to a **utility function** in `lib/`

---

## 6. New Dependencies

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `zundo` | ^2.3.0 | Zustand undo/redo temporal middleware | <1 KB |

No other new dependencies required. All other functionality uses existing @xyflow/react APIs.

---

## 7. New Files to Create

| File | Purpose |
|------|---------|
| `hooks/use-editor-keyboard-shortcuts.ts` | Keyboard shortcut handler hook |
| `hooks/use-auto-save.ts` | Auto-save debounce hook |
| `lib/graph-validation.ts` | Cycle detection, connection validation utilities |
| `components/editor/editor-toolbar.tsx` | Extracted toolbar with undo/redo/save state buttons |
| `components/editor/save-indicator.tsx` | "Saving..." / "All changes saved" component |

---

## 8. Backend Requirements

No backend changes needed. Existing APIs sufficient:

| Endpoint | Used For |
|----------|----------|
| `PATCH /workflows/:id` with `{ definition }` | Auto-save draft |
| `POST /workflows/:id/activate` | Publish (DRAFT → ACTIVE) |
| `POST /workflows/:id/deactivate` | Unpublish (ACTIVE → PAUSED) |

The `update` service already:
- Creates a version snapshot when definition changes ✓
- Increments version number ✓
- Returns updated workflow ✓

---

## 9. Recommended Plan Split

### Plan 06-01: Store Refactor + Undo/Redo + Keyboard Shortcuts
**Scope:** EDT-04, EDT-09, EDT-03 (delete/duplicate)
**Why first:** zundo refactor is foundational — all other plans depend on the new store shape.

**Tasks:**
1. Install `zundo`
2. Refactor `editor-store.ts` with temporal middleware
3. Add clipboard state, delete/duplicate actions
4. Create `use-editor-keyboard-shortcuts.ts` hook
5. Wire Ctrl+Z/Y, Delete, Ctrl+C/V/A, Escape
6. Add undo/redo buttons to toolbar
7. Test: undo 50 levels, keyboard combos, copy/paste nodes with edges

**Files modified:** `editor-store.ts` (major), `editor/page.tsx` (minor), new hook file
**Estimated tasks:** 8-10

---

### Plan 06-02: Connection Validation + Edge Polish + Node Interactions
**Scope:** EDT-07, EDT-02, EDT-03 (remaining), EDT-01 (polish)
**Why second:** Builds on store from Plan 1, adds graph integrity.

**Tasks:**
1. Create `lib/graph-validation.ts` (cycle detection, duplicate edge check)
2. Add `isValidConnection` to ReactFlow
3. Add visual feedback for invalid connections (red line, toast)
4. Multi-trigger guard (prevent >1 trigger, trigger→trigger connection)
5. Connection line styling during drag
6. Handle hover effects (CSS)
7. Drop indicator for EDT-01
8. Multi-select toolbar (selection count, bulk delete)

**Files modified:** `editor/page.tsx`, new util file, node CSS
**Estimated tasks:** 8-10

---

### Plan 06-03: Auto-Save + Publish + Panel Polish + Zoom Indicator
**Scope:** EDT-08, EDT-06 (polish), EDT-05 (zoom indicator)
**Why last:** Depends on dirty-state tracking from Plan 1, isolated from graph features.

**Tasks:**
1. Create `use-auto-save.ts` hook with debounce (2s)
2. Add `isDirty`, `isSaving`, `lastSavedAt` to store
3. Create `save-indicator.tsx` component
4. Extract toolbar to `editor-toolbar.tsx` (refactor)
5. Add "Publish" button with confirmation dialog
6. Add zoom level indicator via `useViewport()`
7. Panel slide-in animation
8. Leave guard (`beforeunload`) when dirty
9. Ctrl+S handler integration with auto-save

**Files modified:** `editor/page.tsx` (toolbar extraction), store (state additions), new files
**Estimated tasks:** 9-11

---

## 10. Dependency Graph Between Plans

```
Plan 06-01 (Store + Undo + Shortcuts)
    ├──→ Plan 06-02 (Validation + Edges + Nodes)
    └──→ Plan 06-03 (Auto-Save + Publish + Polish)
```

Plan 02 and 03 can be executed in parallel after Plan 01, but sequential execution is recommended to minimize merge conflicts in `editor/page.tsx`.

---

## 11. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| zundo throttle too aggressive → loses undo entries | Medium | Test with 300ms, 500ms, 1000ms; tune based on UX feel |
| onNodesChange floods undo → 50 entries = 1 drag | High | `handleSet` throttle is critical; test drag scenarios |
| Copy/paste breaks with complex edge graphs | Medium | Remap all edge source/target IDs in paste logic |
| Auto-save conflicts with manual save | Low | Debounce auto-save, cancel pending on manual save |
| `isValidConnection` perf on large graphs (cycle DFS) | Low | Our workflows are small (<50 nodes); DFS is O(V+E) |
| Input fields capture keyboard shortcuts | Medium | Check `e.target.tagName` in handler, skip INPUT/TEXTAREA |

---

## 12. Testing Strategy

| Test | Type | Coverage |
|------|------|----------|
| Undo/redo: add node → undo → node removed | Integration | EDT-04 |
| Undo limit: >50 actions → oldest dropped | Unit | EDT-04 |
| Cycle detection: A→B→C→A rejected | Unit | EDT-07 |
| Multi-trigger: 2 triggers → second connection rejected | Unit | EDT-07 |
| Ctrl+S saves, shows indicator | Integration | EDT-08, EDT-09 |
| Copy/paste: 2 connected nodes → paste produces 2 new | Integration | EDT-09 |
| Auto-save fires after 2s inactivity | Integration | EDT-08 |
| Delete key removes selected node | Integration | EDT-09 |
| Keyboard shortcuts don't fire in text inputs | Integration | EDT-09 |

---

## References

- [@xyflow/react Drag & Drop Example](https://reactflow.dev/examples/interaction/drag-and-drop)
- [@xyflow/react Undo/Redo Example](https://reactflow.dev/examples/interaction/undo-redo)
- [@xyflow/react Copy/Paste Example](https://reactflow.dev/examples/interaction/copy-paste)
- [@xyflow/react Validation Example](https://reactflow.dev/examples/interaction/validation)
- [@xyflow/react isValidConnection API](https://reactflow.dev/api-reference/types/is-valid-connection)
- [@xyflow/react useKeyPress Hook](https://reactflow.dev/api-reference/hooks/use-key-press)
- [zundo GitHub (v2.3.0)](https://github.com/charkour/zundo)
- [zundo npm](https://www.npmjs.com/package/zundo)
- [React Flow 12 Migration Guide](https://reactflow.dev/learn/troubleshooting/migrate-to-v12)
