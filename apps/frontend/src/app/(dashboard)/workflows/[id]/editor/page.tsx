'use client';

import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  ConnectionLineType,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEditorStore } from '@/stores/editor-store';
import { useWorkflow, useUpdateWorkflow } from '@/hooks/use-workflows';
import { useEditorKeyboardShortcuts } from '@/hooks/use-editor-keyboard-shortcuts';
import { useAutoSave } from '@/hooks/use-auto-save';
import { NodeConfigPanel } from '@/components/editor/node-config-panel';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import TriggerNode from '@/components/editor/nodes/trigger-node';
import ActionNode from '@/components/editor/nodes/action-node';
import { AnimatedEdge } from '@/components/editor/edges/animated-edge';
import { MultiSelectToolbar } from '@/components/editor/multi-select-toolbar';
import { validateConnection, countTriggerNodes } from '@/lib/graph-validation';
import { toast } from 'sonner';
import api from '@/lib/api';

const TRIGGER_TYPES = [
  { type: 'WEBHOOK', label: 'Webhook', color: '#8B5CF6', icon: '🔗' },
  { type: 'CRON', label: 'Schedule', color: '#F59E0B', icon: '⏰' },
  { type: 'EMAIL', label: 'Email', color: '#EF4444', icon: '📧' },
  { type: 'TELEGRAM', label: 'Telegram', color: '#0EA5E9', icon: '💬' },
];

const ACTION_TYPES = [
  { type: 'HTTP_REQUEST', label: 'HTTP Request', color: '#3B82F6', icon: '🌐' },
  { type: 'SEND_EMAIL', label: 'Send Email', color: '#10B981', icon: '✉️' },
  { type: 'TELEGRAM', label: 'Telegram', color: '#0EA5E9', icon: '💬' },
  { type: 'DATABASE', label: 'Database', color: '#F97316', icon: '🗄️' },
  { type: 'TRANSFORM', label: 'Transform', color: '#6366F1', icon: '🔄' },
];

function EditorCanvas() {
  const params = useParams();
  const workflowId = params.id as string;
  const { data: workflow } = useWorkflow(workflowId);
  const updateWorkflow = useUpdateWorkflow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  useAutoSave(workflowId);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    addNode,
    setSelectedNode,
    selectedNode,
  } = useEditorStore();

  const nodeTypes: NodeTypes = useMemo(
    () => ({ triggerNode: TriggerNode, actionNode: ActionNode }),
    [],
  );

  const edgeTypes: EdgeTypes = useMemo(() => ({ animated: AnimatedEdge }), []);

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const { nodes, edges } = useEditorStore.getState();
    return validateConnection(connection as Connection, edges, nodes).valid;
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    const { edges, nodes } = useEditorStore.getState();
    const result = validateConnection(connection, edges, nodes);
    if (!result.valid) {
      toast.error(result.reason || 'Invalid connection');
      return;
    }
    useEditorStore.getState().onConnect(connection);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      useEditorStore.getState().markSaving();
      await updateWorkflow.mutateAsync({
        id: workflowId,
        definition: { nodes, edges },
      });
      useEditorStore.getState().markSaved();
      toast.success('Workflow saved');
    } catch {
      useEditorStore.setState({ isSaving: false });
      toast.error('Failed to save');
    }
  }, [workflowId, nodes, edges, updateWorkflow]);

  useEditorKeyboardShortcuts({ onSave: handleSave });

  useEffect(() => {
    if (workflow?.definition) {
      let def: { nodes?: unknown[]; edges?: unknown[] } = { nodes: [], edges: [] };
      try {
        def = typeof workflow.definition === 'string'
          ? JSON.parse(workflow.definition)
          : (workflow.definition as typeof def);
      } catch {
        // Invalid JSON definition, use empty
      }
      setNodes((def.nodes as Node[]) || []);
      setEdges((def.edges as typeof edges) || []);
      useEditorStore.temporal.getState().clear();
      useEditorStore.getState().markClean();
    }
  }, [workflow, setNodes, setEdges]);

  const handleRun = async () => {
    try {
      await api.post(`/workflows/${workflowId}/execute`);
      toast.success('Workflow execution started');
    } catch {
      toast.error('Failed to start execution');
    }
  };

  // Leave guard — warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const type = event.dataTransfer.getData('application/reactflow-type');
      const label = event.dataTransfer.getData('application/reactflow-label');
      const category = event.dataTransfer.getData('application/reactflow-category');

      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const isTrigger = category === 'trigger';

      if (isTrigger) {
        const currentTriggers = countTriggerNodes(useEditorStore.getState().nodes);
        if (currentTriggers >= 1) {
          toast.warning('Workflow can only have one trigger. Remove the existing trigger first.');
          return;
        }
      }

      const newNode: Node = {
        id: `${isTrigger ? 'trigger' : 'action'}-${Date.now()}`,
        type: isTrigger ? 'triggerNode' : 'actionNode',
        position,
        data: { label, type, config: {}, description: '' },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Node Palette */}
      <div className="w-60 border-r bg-card overflow-y-auto shrink-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Components</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Drag to canvas to add</p>
        </div>

        <div className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Triggers
          </p>
          {TRIGGER_TYPES.map((t) => (
            <div
              key={t.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow-type', t.type);
                e.dataTransfer.setData('application/reactflow-label', t.label);
                e.dataTransfer.setData('application/reactflow-category', 'trigger');
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="mb-1.5 cursor-grab rounded-lg border p-2.5 text-sm font-medium hover:shadow-md transition-all active:cursor-grabbing flex items-center gap-2"
              style={{ borderColor: `${t.color}40`, background: `${t.color}08` }}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span>{t.label}</span>
              <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
            </div>
          ))}

          <div className="my-3 border-t" />

          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Actions
          </p>
          {ACTION_TYPES.map((a) => (
            <div
              key={a.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow-type', a.type);
                e.dataTransfer.setData('application/reactflow-label', a.label);
                e.dataTransfer.setData('application/reactflow-category', 'action');
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="mb-1.5 cursor-grab rounded-lg border p-2.5 text-sm font-medium hover:shadow-md transition-all active:cursor-grabbing flex items-center gap-2"
              style={{ borderColor: `${a.color}40`, background: `${a.color}08` }}
            >
              <span className="text-base leading-none">{a.icon}</span>
              <span>{a.label}</span>
              <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <EditorToolbar
          workflowId={workflowId}
          workflowName={workflow?.name}
          workflowActive={workflow?.isActive}
          onSave={handleSave}
          onRun={handleRun}
          isSaving={updateWorkflow.isPending}
        />

        <div ref={reactFlowWrapper} className={`flex-1 relative ${isDragOver ? 'drag-over' : ''}`} onDragLeave={() => setIsDragOver(false)}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            onDrop={onDrop}
            onDragOver={onDragOver}
            selectionOnDrag
            fitView
            defaultEdgeOptions={{ type: 'animated', animated: true }}
            proOptions={{ hideAttribution: true }}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: '#6366F1', strokeWidth: 2, strokeDasharray: '5 5' }}
            deleteKeyCode={null}
          >
            <Controls className="!rounded-lg !border !shadow-sm" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-card !border !rounded-lg !shadow-sm"
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
          <MultiSelectToolbar />
        </div>
      </div>

      {/* Config Panel */}
      {selectedNode && <NodeConfigPanel />}
    </div>
  );
}

export default function EditorPage() {
  return (
    <ReactFlowProvider>
      <EditorCanvas />
    </ReactFlowProvider>
  );
}
