# Phase 6 — Editor UX Polish: Requirement Coverage Matrix

> Generated: 2025-03-14 | Phase: 06-editor-ux-polish | Plans: 3

---

## Requirement → Plan Mapping

| REQ-ID | Requirement | Plan(s) | Coverage | Notes |
|--------|-------------|---------|----------|-------|
| **EDT-01** | Drag-and-drop nodes from sidebar | **06-02** (Task 6) | ✅ 100% | Existing: ~90% done. Plan adds drop indicator (dashed outline on canvas) |
| **EDT-02** | Edge connection with visual feedback | **06-02** (Tasks 2, 5, 7, 8) | ✅ 100% | connectionLineStyle, connectionLineType, handle hover glow, selected edge highlight |
| **EDT-03** | Select, move, delete, duplicate | **06-01** (Tasks 3, 4), **06-02** (Tasks 9, 10) | ✅ 100% | Delete+duplicate in store (06-01), multi-select toolbar (06-02), box selection (06-01 Task 7) |
| **EDT-04** | Undo/redo (50 levels) | **06-01** (Tasks 2, 6, 8, 9) | ✅ 100% | zundo temporal middleware, limit:50, throttle drag, toolbar buttons, clear on load |
| **EDT-05** | Zoom, pan, minimap | **06-03** (Task 4/5) | ✅ 100% | Existing: ~95% done. Plan adds zoom level indicator in toolbar ("125%") |
| **EDT-06** | Node config side panel | **06-03** (Task 8) | ✅ 100% | Existing: ~85% done. Plan adds slide-in animation, Escape close |
| **EDT-07** | Connection validation | **06-02** (Tasks 1, 2, 3, 4) | ✅ 100% | Cycle detection (DFS), duplicate edge, self-loop, multi-trigger guard, visual feedback |
| **EDT-08** | Auto-save draft, explicit publish | **06-03** (Tasks 1-3, 6, 7, 9) | ✅ 100% | 2s debounce auto-save, isDirty/isSaving state, SaveIndicator, Publish button, leave guard |
| **EDT-09** | Keyboard shortcuts | **06-01** (Tasks 5, 6, 7) | ✅ 100% | Delete, Ctrl+Z/Y/C/V/A/S/D, Escape — all via useEditorKeyboardShortcuts hook |

---

## Plan → Requirement Mapping

### Plan 06-01: Store Refactor + Undo/Redo + Keyboard Shortcuts
| Task | REQ Coverage |
|------|-------------|
| Task 1: Install zundo | EDT-04 (infra) |
| Task 2: Refactor store with temporal | EDT-04 |
| Task 3: deleteSelectedNodes | EDT-03 |
| Task 4: duplicateSelectedNodes | EDT-03 |
| Task 5: Clipboard (copy/paste) | EDT-09 |
| Task 6: Keyboard shortcuts hook | EDT-09 |
| Task 7: Wire shortcuts into editor | EDT-09, EDT-03 |
| Task 8: Undo/redo toolbar buttons | EDT-04 |
| Task 9: Clear undo on load | EDT-04 |
| Task 10: Integration testing | EDT-03, EDT-04, EDT-09 |

### Plan 06-02: Connection Validation + Edge Polish + Node Interactions
| Task | REQ Coverage |
|------|-------------|
| Task 1: graph-validation.ts | EDT-07 |
| Task 2: isValidConnection | EDT-07 |
| Task 3: Invalid connection toast | EDT-07 |
| Task 4: Multi-trigger guard | EDT-07 |
| Task 5: Connection line + handle CSS | EDT-02 |
| Task 6: Drop indicator | EDT-01 |
| Task 7: AnimatedEdge selected state | EDT-02 |
| Task 8: Handle hover classes | EDT-02 |
| Task 9: Multi-select toolbar | EDT-03 |
| Task 10: Wire toolbar into editor | EDT-03 |

### Plan 06-03: Auto-Save + Publish + Panel Polish + Zoom Indicator
| Task | REQ Coverage |
|------|-------------|
| Task 1: Save state in store | EDT-08 |
| Task 2: useAutoSave hook | EDT-08 |
| Task 3: SaveIndicator component | EDT-08 |
| Task 4: EditorToolbar extraction | EDT-05, EDT-08 |
| Task 5: Zoom indicator | EDT-05 |
| Task 6: Wire toolbar + auto-save | EDT-08 |
| Task 7: Silent update mutation | EDT-08 |
| Task 8: Panel slide-in animation | EDT-06 |
| Task 9: Leave guard (beforeunload) | EDT-08 |
| Task 10: Integration testing | EDT-05, EDT-06, EDT-08 |

---

## Dependency Graph

```
Plan 06-01 (Store + Undo + Shortcuts)
    ├──→ Plan 06-02 (Validation + Edges + Nodes)
    └──→ Plan 06-03 (Auto-Save + Publish + Polish)
```

**Execution order:** 06-01 → 06-02 → 06-03 (sequential recommended)
**Alternative:** 06-01 → (06-02 ∥ 06-03) (parallel possible but higher merge conflict risk on `page.tsx`)

---

## Files Impact Matrix

| File | 06-01 | 06-02 | 06-03 | Total Plans |
|------|-------|-------|-------|-------------|
| `stores/editor-store.ts` | **Major** | Minor | Minor | 3 |
| `app/(dashboard)/workflows/[id]/editor/page.tsx` | Moderate | Moderate | **Major** | 3 |
| `hooks/use-editor-keyboard-shortcuts.ts` | **Create** | — | — | 1 |
| `hooks/use-auto-save.ts` | — | — | **Create** | 1 |
| `hooks/use-workflows.ts` | — | — | Minor | 1 |
| `lib/graph-validation.ts` | — | **Create** | — | 1 |
| `components/editor/editor-toolbar.tsx` | — | — | **Create** | 1 |
| `components/editor/save-indicator.tsx` | — | — | **Create** | 1 |
| `components/editor/multi-select-toolbar.tsx` | — | **Create** | — | 1 |
| `components/editor/node-config-panel.tsx` | — | — | Minor | 1 |
| `components/editor/nodes/trigger-node.tsx` | — | Minor | — | 1 |
| `components/editor/nodes/action-node.tsx` | — | Minor | — | 1 |
| `components/editor/edges/animated-edge.tsx` | — | Minor | — | 1 |
| `app/globals.css` | — | Minor | — | 1 |

---

## New Dependencies

| Package | Version | Plan | Purpose |
|---------|---------|------|---------|
| `zundo` | ^2.3.0 | 06-01 | Zustand temporal middleware for undo/redo |

No other new dependencies. All features use existing @xyflow/react v12 APIs, Zustand, React Query, Sonner, Lucide, and shadcn/ui.

---

## New Files Created (Total: 5)

| # | File | Plan |
|---|------|------|
| 1 | `apps/frontend/src/hooks/use-editor-keyboard-shortcuts.ts` | 06-01 |
| 2 | `apps/frontend/src/lib/graph-validation.ts` | 06-02 |
| 3 | `apps/frontend/src/components/editor/multi-select-toolbar.tsx` | 06-02 |
| 4 | `apps/frontend/src/hooks/use-auto-save.ts` | 06-03 |
| 5 | `apps/frontend/src/components/editor/save-indicator.tsx` | 06-03 |
| 6 | `apps/frontend/src/components/editor/editor-toolbar.tsx` | 06-03 |

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total EDT requirements | 9 (EDT-01..EDT-09) |
| Fully covered | **9 / 9 (100%)** |
| Partially covered | 0 |
| Not covered | 0 |
| Total tasks across plans | 30 |
| New files to create | 6 |
| Files to modify | 8 |
| New dependencies | 1 (zundo) |
| Backend changes | **0** (frontend only) |

---

## Phase 6 Success Criteria (from ROADMAP.md)

| Criterion | Plan(s) | Status |
|-----------|---------|--------|
| Drag node from sidebar → appears on canvas at drop position | 06-02 (existing + polish) | ✅ Covered |
| Ctrl+Z undoes last 50 actions, Ctrl+Y redoes | 06-01 | ✅ Covered |
| Invalid connection (creating cycle) shows red feedback, edge rejected | 06-02 | ✅ Covered |
| Minimap shows workflow overview, clickable for navigation | Existing | ✅ Already done |
| Ctrl+S saves, Ctrl+C/V copies/pastes nodes, Delete removes selected | 06-01, 06-03 | ✅ Covered |
| Config panel updates node data in real-time | Existing + 06-03 polish | ✅ Covered |
