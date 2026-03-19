import { create } from 'zustand';

export type NodeExecutionState = 'idle' | 'waiting' | 'running' | 'success' | 'error' | 'skipped';

export interface NodeExecInfo {
  state: NodeExecutionState;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  output?: unknown;
  error?: string;
}

interface ExecutionStore {
  executionId: string | null;
  isRunning: boolean;
  nodeStates: Record<string, NodeExecInfo>;
  nodeResults: Record<string, any>;
  executionError: string | null;

  startExecution: (executionId: string, nodeIds: string[]) => void;
  setNodeRunning: (nodeId: string) => void;
  setNodeSuccess: (nodeId: string, output: unknown, duration: number) => void;
  setNodeError: (nodeId: string, error: string) => void;
  setNodeSkipped: (nodeId: string) => void;
  completeExecution: () => void;
  failExecution: (error: string) => void;
  resetExecution: () => void;
  setNodeResult: (nodeId: string, data: any) => void;

  pinnedData: Record<string, unknown>;
  pinNodeData: (nodeId: string, data: unknown) => void;
  unpinNodeData: (nodeId: string) => void;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  executionId: null,
  isRunning: false,
  nodeStates: {},
  nodeResults: {},
  executionError: null,
  pinnedData: {},

  startExecution: (executionId, nodeIds) => {
    const nodeStates: Record<string, NodeExecInfo> = {};
    for (const id of nodeIds) {
      nodeStates[id] = { state: 'waiting' };
    }
    set({ executionId, isRunning: true, nodeStates, executionError: null });
  },

  setNodeRunning: (nodeId) => {
    const { nodeStates } = get();
    set({
      nodeStates: {
        ...nodeStates,
        [nodeId]: { ...nodeStates[nodeId], state: 'running', startedAt: Date.now() },
      },
    });
  },

  setNodeSuccess: (nodeId, output, duration) => {
    const { nodeStates, nodeResults } = get();
    set({
      nodeStates: {
        ...nodeStates,
        [nodeId]: {
          ...nodeStates[nodeId],
          state: 'success',
          output,
          duration,
          completedAt: Date.now(),
        },
      },
      nodeResults: { ...nodeResults, [nodeId]: output },
    });
  },

  setNodeError: (nodeId, error) => {
    const { nodeStates } = get();
    set({
      nodeStates: {
        ...nodeStates,
        [nodeId]: {
          ...nodeStates[nodeId],
          state: 'error',
          error,
          completedAt: Date.now(),
        },
      },
    });
  },

  setNodeSkipped: (nodeId) => {
    const { nodeStates } = get();
    set({
      nodeStates: {
        ...nodeStates,
        [nodeId]: { ...nodeStates[nodeId], state: 'skipped', completedAt: Date.now() },
      },
    });
  },

  completeExecution: () => {
    set({ isRunning: false });
  },

  failExecution: (error) => {
    set({ isRunning: false, executionError: error });
  },

  resetExecution: () => {
    set({ executionId: null, isRunning: false, nodeStates: {}, nodeResults: {}, executionError: null });
  },

  setNodeResult: (nodeId, data) => {
    set({ nodeResults: { ...get().nodeResults, [nodeId]: data } });
  },

  pinNodeData: (nodeId, data) => {
    set({ pinnedData: { ...get().pinnedData, [nodeId]: data } });
  },

  unpinNodeData: (nodeId) => {
    const { [nodeId]: _, ...rest } = get().pinnedData;
    set({ pinnedData: rest });
  },
}));
