import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';

// Simple throttle utility
function throttle<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, ms - (now - lastCall));
    }
  }) as T;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

interface EditorState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  isDirty: boolean;
  clipboard: ClipboardData | null;

  // Existing actions (signatures preserved)
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  setSelectedNode: (node: Node | null) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  reset: () => void;

  // New actions
  deleteSelectedNodes: () => void;
  duplicateSelectedNodes: () => void;
  copySelectedNodes: () => void;
  pasteNodes: () => void;
  selectAllNodes: () => void;
  markDirty: () => void;
  markClean: () => void;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNode: null,
      isDirty: false,
      clipboard: null,

      // Existing actions — signatures preserved
      onNodesChange: (changes) =>
        set({ nodes: applyNodeChanges(changes, get().nodes), isDirty: true }),

      onEdgesChange: (changes) =>
        set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true }),

      onConnect: (connection) =>
        set({
          edges: addEdge(
            { ...connection, type: 'smoothstep', animated: true },
            get().edges,
          ),
          isDirty: true,
        }),

      setNodes: (nodes) => set({ nodes, isDirty: true }),
      setEdges: (edges) => set({ edges, isDirty: true }),
      addNode: (node) => set({ nodes: [...get().nodes, node], isDirty: true }),
      setSelectedNode: (node) => set({ selectedNode: node }),

      updateNodeData: (nodeId, data) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
          ),
          isDirty: true,
        }),

      reset: () => set({ nodes: [], edges: [], selectedNode: null, isDirty: false, clipboard: null }),

      // New actions
      deleteSelectedNodes: () => {
        const { nodes, edges } = get();
        const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
        const selectedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));

        const newEdges = edges.filter(
          (e) =>
            !selectedEdgeIds.has(e.id) &&
            !selectedNodeIds.has(e.source) &&
            !selectedNodeIds.has(e.target),
        );
        const newNodes = nodes.filter((n) => !selectedNodeIds.has(n.id));

        set({ nodes: newNodes, edges: newEdges, selectedNode: null, isDirty: true });
      },

      duplicateSelectedNodes: () => {
        const { nodes, edges } = get();
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedIds = new Set(selectedNodes.map((n) => n.id));
        const idMap = new Map<string, string>();

        const newNodes = selectedNodes.map((n) => {
          const newId = generateId(n.type || 'node');
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + 50, y: n.position.y + 50 },
            selected: true,
            data: { ...n.data },
          };
        });

        // Remap edges between duplicated nodes
        const internalEdges = edges.filter(
          (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
        );
        const newEdges = internalEdges.map((e) => ({
          ...e,
          id: generateId('edge'),
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

        // Deselect originals
        const deselectedNodes = nodes.map((n) =>
          n.selected ? { ...n, selected: false } : n,
        );

        set({
          nodes: [...deselectedNodes, ...newNodes],
          edges: [...edges, ...newEdges],
          isDirty: true,
        });
      },

      copySelectedNodes: () => {
        const { nodes, edges } = get();
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedIds = new Set(selectedNodes.map((n) => n.id));
        const internalEdges = edges.filter(
          (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
        );

        set({ clipboard: { nodes: selectedNodes, edges: internalEdges } });
      },

      pasteNodes: () => {
        const { clipboard, nodes, edges } = get();
        if (!clipboard || clipboard.nodes.length === 0) return;

        const idMap = new Map<string, string>();

        const newNodes = clipboard.nodes.map((n) => {
          const newId = generateId(n.type || 'node');
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + 50, y: n.position.y + 50 },
            selected: true,
            data: { ...n.data },
          };
        });

        const newEdges = clipboard.edges.map((e) => ({
          ...e,
          id: generateId('edge'),
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

        // Deselect existing nodes
        const deselectedNodes = nodes.map((n) =>
          n.selected ? { ...n, selected: false } : n,
        );

        set({
          nodes: [...deselectedNodes, ...newNodes],
          edges: [...edges, ...newEdges],
          isDirty: true,
        });
      },

      selectAllNodes: () => {
        set({
          nodes: get().nodes.map((n) => ({ ...n, selected: true })),
        });
      },

      markDirty: () => set({ isDirty: true }),
      markClean: () => set({ isDirty: false }),
    }),
    {
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      limit: 50,
      handleSet: (handleSet) =>
        throttle(handleSet, 500),
    },
  ),
);
