'use client';

import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
import { ExecutionConsole } from '@/components/editor/execution-console';
import { NodeContextMenu } from '@/components/editor/node-context-menu';
import TriggerNode from '@/components/editor/nodes/trigger-node';
import ActionNode from '@/components/editor/nodes/action-node';
import { AnimatedEdge } from '@/components/editor/edges/animated-edge';
import { MultiSelectToolbar } from '@/components/editor/multi-select-toolbar';
import { validateConnection, countTriggerNodes } from '@/lib/graph-validation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-handler';
import { Loader2 } from 'lucide-react';
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
  const { data: workflow, isLoading, error, refetch } = useWorkflow(workflowId);
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
    } catch (err) {
      useEditorStore.setState({ isSaving: false });
      toast.error(getErrorMessage(err));
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
      const parsedNodes = Array.isArray(def.nodes) ? (def.nodes as Node[]) : [];
      const parsedEdges = Array.isArray(def.edges) ? (def.edges as typeof edges) : [];
      setNodes(parsedNodes);
      setEdges(parsedEdges);
      useEditorStore.temporal.getState().clear();
      useEditorStore.getState().markClean();
    }
  }, [workflow, setNodes, setEdges]);

  const handleRun = async () => {
    try {
      const currentNodes = useEditorStore.getState().nodes;
      const triggerNode = currentNodes.find(
        (n) => n.type === 'triggerNode' || n.id?.startsWith('trigger-'),
      );

      let testTriggerData: Record<string, unknown> = {};
      if (triggerNode) {
        const triggerType = triggerNode.data?.type as string;
        const cfg = (triggerNode.data?.config as Record<string, unknown>) || {};
        if (triggerType === 'EMAIL') {
          testTriggerData = {
            from: 'test@example.com',
            subject: 'Test Email',
            body: 'Manual test run',
            date: new Date().toISOString(),
          };
        } else if (triggerType === 'WEBHOOK') {
          testTriggerData = {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: { test: true, timestamp: Date.now() },
          };
        } else if (triggerType === 'TELEGRAM') {
          testTriggerData = {
            chatId: String(cfg.chatId || ''),
            from: 'TestUser',
            text: '/test manual run',
            messageId: Date.now(),
          };
        } else if (triggerType === 'CRON') {
          testTriggerData = {
            scheduledAt: new Date().toISOString(),
            cron: String(cfg.cron || '* * * * *'),
          };
        }
      }

      await api.post(`/workflows/${workflowId}/execute`, testTriggerData);
      toast.success('Workflow execution started');
      setConsoleOpen(true);
      setRunTrigger((prev) => prev + 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
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
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [runTrigger, setRunTrigger] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);

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

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  }, []);

  const handleContextMenuEdit = useCallback((node: Node) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  const handleContextMenuDuplicate = useCallback((node: Node) => {
    const newNode: Node = {
      id: `${node.type === 'triggerNode' ? 'trigger' : 'action'}-${Date.now()}`,
      type: node.type,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data },
    };
    addNode(newNode);
    toast.success('Node duplicated');
  }, [addNode]);

  const handleContextMenuDelete = useCallback((node: Node) => {
    const { nodes, edges } = useEditorStore.getState();
    useEditorStore.getState().setNodes(nodes.filter((n) => n.id !== node.id));
    useEditorStore.getState().setEdges(edges.filter((e) => e.source !== node.id && e.target !== node.id));
    setSelectedNode(null);
    toast.success('Node deleted');
  }, [setSelectedNode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const is404 = (error as any)?.response?.status === 404;
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">{is404 ? 'Workflow not found' : 'Failed to load workflow'}</p>
          <p className="text-sm text-muted-foreground">
            {is404 ? 'This workflow may have been deleted.' : 'Please try again later.'}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" asChild><Link href="/workflows">Back to Workflows</Link></Button>
            {!is404 && <Button onClick={() => refetch()}>Try Again</Button>}
          </div>
        </div>
      </div>
    );
  }

  const hasNodes = Array.isArray(nodes) && nodes.length > 0;

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
          workflowActive={workflow?.status === 'ACTIVE'}
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
            onPaneClick={() => { setSelectedNode(null); setContextMenu(null); }}
            onNodeContextMenu={handleNodeContextMenu}
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
              style={{ zIndex: 4 }}
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
          {!hasNodes && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
              <div className="text-center space-y-2 pointer-events-auto">
                <p className="text-lg font-semibold text-muted-foreground">Empty canvas</p>
                <p className="text-sm text-muted-foreground">Start building your workflow by dragging a trigger from the left panel</p>
              </div>
            </div>
          )}
          <MultiSelectToolbar />
          {contextMenu && (
            <NodeContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              node={contextMenu.node}
              onClose={() => setContextMenu(null)}
              onEdit={handleContextMenuEdit}
              onDuplicate={handleContextMenuDuplicate}
              onDelete={handleContextMenuDelete}
            />
          )}
        </div>

        {/* Execution Console */}
        <ExecutionConsole
          workflowId={workflowId}
          isOpen={consoleOpen}
          onClose={() => setConsoleOpen(false)}
          runTrigger={runTrigger}
        />
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
