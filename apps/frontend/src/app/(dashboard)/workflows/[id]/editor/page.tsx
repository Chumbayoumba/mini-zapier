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
import { useExecutionStore } from '@/stores/execution-store';
import { useWorkflow, useUpdateWorkflowSilent } from '@/hooks/use-workflows';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useAutoSave } from '@/hooks/use-auto-save';
import { useExecutionSocket } from '@/hooks/use-execution-socket';
import { NDVDrawer } from '@/components/editor/ndv/ndv-drawer';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { ExecutionConsole } from '@/components/editor/execution-console';
import { NodeContextMenu } from '@/components/editor/node-context-menu';
import { NodePicker } from '@/components/editor/node-picker';
import { HandlePlusButton } from '@/components/editor/handle-plus-button';
import TriggerNode from '@/components/editor/nodes/trigger-node';
import ActionNode from '@/components/editor/nodes/action-node';
import LogicNode from '@/components/editor/nodes/logic-node';
import StickyNote from '@/components/editor/nodes/sticky-note';
import { AnimatedEdge } from '@/components/editor/edges/animated-edge';
import { MultiSelectToolbar } from '@/components/editor/multi-select-toolbar';
import { validateConnection, countTriggerNodes } from '@/lib/graph-validation';
import { getAutoLayout } from '@/lib/auto-layout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-handler';
import { Loader2, LayoutGrid, Plus, StickyNote as StickyNoteIcon } from 'lucide-react';
import api from '@/lib/api';

const TRIGGER_TYPES = [
  { type: 'WEBHOOK', label: 'Webhook', color: '#8B5CF6', icon: '🔗' },
  { type: 'CRON', label: 'Schedule', color: '#F59E0B', icon: '⏰' },
  { type: 'EMAIL', label: 'Email', color: '#EF4444', icon: '📧' },
  { type: 'TELEGRAM', label: 'Telegram', color: '#0EA5E9', icon: '💬' },
];

const LOGIC_TYPES = [
  { type: 'IF', label: 'If', color: '#EC4899', icon: '🔀' },
  { type: 'SWITCH', label: 'Switch', color: '#A855F7', icon: '🔀' },
  { type: 'FILTER', label: 'Filter', color: '#14B8A6', icon: '🔍' },
  { type: 'SET', label: 'Set', color: '#F97316', icon: '📝' },
  { type: 'CODE', label: 'Code', color: '#64748B', icon: '💻' },
  { type: 'MERGE', label: 'Merge', color: '#06B6D4', icon: '🔗' },
  { type: 'WAIT', label: 'Wait', color: '#EAB308', icon: '⏳' },
  { type: 'LOOP', label: 'Loop', color: '#84CC16', icon: '🔄' },
  { type: 'NOOP', label: 'No Operation', color: '#9CA3AF', icon: '➡️' },
];

const ACTION_TYPES = [
  { type: 'HTTP_REQUEST', label: 'HTTP Request', color: '#3B82F6', icon: '🌐' },
  { type: 'SEND_EMAIL', label: 'Send Email', color: '#10B981', icon: '✉️' },
  { type: 'TELEGRAM', label: 'Telegram', color: '#0EA5E9', icon: '💬' },
  { type: 'DATABASE', label: 'Database', color: '#F97316', icon: '🗄️' },
  { type: 'TRANSFORM', label: 'Transform', color: '#6366F1', icon: '🔄' },
];

const AI_TYPES = [
  { type: 'OPENAI', label: 'OpenAI', color: '#10A37F', icon: '🤖' },
  { type: 'ANTHROPIC', label: 'Anthropic', color: '#D97706', icon: '🧠' },
  { type: 'MISTRAL', label: 'Mistral', color: '#3B82F6', icon: '🌊' },
  { type: 'OPENROUTER', label: 'OpenRouter', color: '#8B5CF6', icon: '🔀' },
];

function EditorCanvas() {
  const params = useParams();
  const workflowId = params.id as string;
  const { data: workflow, isLoading, error, refetch } = useWorkflow(workflowId);
  const updateWorkflow = useUpdateWorkflowSilent();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport } = useReactFlow();

  useAutoSave(workflowId);
  useExecutionSocket(workflowId);

  const isExecutionRunning = useExecutionStore((s) => s.isRunning);

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

  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [nodePickerConnectFrom, setNodePickerConnectFrom] = useState<{ nodeId: string; handleId?: string } | null>(null);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      triggerNode: TriggerNode,
      actionNode: ActionNode,
      logicNode: LogicNode,
      stickyNote: StickyNote,
    }),
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
      const { nodes: currentNodes, edges: currentEdges } = useEditorStore.getState();
      useEditorStore.getState().markSaving();
      await updateWorkflow.mutateAsync({
        id: workflowId,
        definition: { nodes: currentNodes, edges: currentEdges },
      });
      useEditorStore.getState().markSaved();
    } catch (err) {
      useEditorStore.setState({ isSaving: false });
      toast.error(getErrorMessage(err));
    }
  }, [workflowId, updateWorkflow]);

  const [isDragOver, setIsDragOver] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [runTrigger, setRunTrigger] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);

  const handleRun = useCallback(async () => {
    try {
      // Save before running to ensure latest config is persisted
      const { nodes: currentNodes, edges: currentEdges } = useEditorStore.getState();
      await updateWorkflow.mutateAsync({
        id: workflowId,
        definition: { nodes: currentNodes, edges: currentEdges },
      });

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
          const botIntegrationId = cfg.integrationId as string;
          testTriggerData = {
            chat: { id: cfg.chatId || 0 },
            chatId: String(cfg.chatId || '0'),
            from: { first_name: 'Test User', username: 'testuser', id: 123456 },
            text: 'Hello bot!',
            command: 'test',
            messageId: Date.now(),
            _testMode: true,
            _integrationId: botIntegrationId,
          };
        } else if (triggerType === 'CRON') {
          testTriggerData = {
            scheduledAt: new Date().toISOString(),
            cron: String(cfg.cron || '* * * * *'),
          };
        }
      }

      await api.post(`/workflows/${workflowId}/execute`, testTriggerData);
      toast.success('Test started');
      useExecutionStore.getState().resetExecution();
      setConsoleOpen(true);
      setRunTrigger((prev) => prev + 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [workflowId]);

  const openNodePicker = useCallback(() => {
    setNodePickerConnectFrom(null);
    setNodePickerOpen(true);
  }, []);

  const openNodePickerFrom = useCallback((connectFrom: { nodeId: string; handleId?: string }) => {
    setNodePickerConnectFrom(connectFrom);
    setNodePickerOpen(true);
  }, []);

  useKeyboardShortcuts({
    onSave: handleSave,
    onRun: handleRun,
    onOpenNodePicker: openNodePicker,
  });

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
      const isLogic = category === 'logic';
      const isAi = category === 'ai';

      if (isTrigger) {
        const currentTriggers = countTriggerNodes(useEditorStore.getState().nodes);
        if (currentTriggers >= 1) {
          toast.warning('Workflow can only have one trigger. Remove the existing trigger first.');
          return;
        }
      }

      let nodeFlowType = 'actionNode';
      let idPrefix = 'action';
      if (isTrigger) { nodeFlowType = 'triggerNode'; idPrefix = 'trigger'; }
      else if (isLogic) { nodeFlowType = 'logicNode'; idPrefix = 'logic'; }
      else if (isAi) { idPrefix = 'ai'; }

      const newNode: Node = {
        id: `${idPrefix}-${Date.now()}`,
        type: nodeFlowType,
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
    let idPrefix = 'action';
    if (node.type === 'triggerNode') idPrefix = 'trigger';
    else if (node.type === 'logicNode') idPrefix = 'logic';
    const newNode: Node = {
      id: `${idPrefix}-${Date.now()}`,
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

  const handleContextMenuAddNodeAfter = useCallback((node: Node) => {
    openNodePickerFrom({ nodeId: node.id });
  }, [openNodePickerFrom]);

  const handleAutoLayout = useCallback(() => {
    const { nodes, edges } = useEditorStore.getState();
    if (nodes.length === 0) return;
    const layouted = getAutoLayout(nodes, edges);
    setNodes(layouted);
    toast.success('Layout applied');
  }, [setNodes]);

  const handleAddStickyNote = useCallback(() => {
    const vp = getViewport();
    const centerX = (-vp.x + 400) / vp.zoom;
    const centerY = (-vp.y + 300) / vp.zoom;
    const newNode: Node = {
      id: `sticky-${Date.now()}`,
      type: 'stickyNote',
      position: { x: centerX - 100, y: centerY - 75 },
      data: { text: '', color: 'yellow' },
      style: { width: 200, height: 150 },
    };
    addNode(newNode);
  }, [addNode, getViewport]);

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
            Logic
          </p>
          {LOGIC_TYPES.map((l) => (
            <div
              key={l.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow-type', l.type);
                e.dataTransfer.setData('application/reactflow-label', l.label);
                e.dataTransfer.setData('application/reactflow-category', 'logic');
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="mb-1.5 cursor-grab rounded-lg border p-2.5 text-sm font-medium hover:shadow-md transition-all active:cursor-grabbing flex items-center gap-2"
              style={{ borderColor: `${l.color}40`, background: `${l.color}08` }}
            >
              <span className="text-base leading-none">{l.icon}</span>
              <span>{l.label}</span>
              <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
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

          <div className="my-3 border-t" />

          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            AI
          </p>
          {AI_TYPES.map((a) => (
            <div
              key={a.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow-type', a.type);
                e.dataTransfer.setData('application/reactflow-label', a.label);
                e.dataTransfer.setData('application/reactflow-category', 'ai');
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
          isRunning={isExecutionRunning}
          onAutoLayout={handleAutoLayout}
          onAddStickyNote={handleAddStickyNote}
          onOpenNodePicker={openNodePicker}
          onToggleMinimap={() => setShowMinimap((v) => !v)}
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
            
            {showMinimap && (
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-card !border !rounded-lg !shadow-sm"
              style={{ zIndex: 4 }}
            />
            )}
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
          <HandlePlusButton isOpen={nodePickerOpen} onOpenNodePicker={openNodePickerFrom} />
          {contextMenu && (
            <NodeContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              node={contextMenu.node}
              onClose={() => setContextMenu(null)}
              onEdit={handleContextMenuEdit}
              onDuplicate={handleContextMenuDuplicate}
              onDelete={handleContextMenuDelete}
              onAddNodeAfter={handleContextMenuAddNodeAfter}
            />
          )}
        </div>

        {/* Node Picker */}
        <NodePicker
          isOpen={nodePickerOpen}
          onClose={() => { setNodePickerOpen(false); setNodePickerConnectFrom(null); }}
          connectFrom={nodePickerConnectFrom}
        />

        {/* Execution Console */}
        <ExecutionConsole
          workflowId={workflowId}
          isOpen={consoleOpen}
          onClose={() => setConsoleOpen(false)}
          runTrigger={runTrigger}
        />
      </div>

      {/* NDV Drawer */}
      {selectedNode && (
        <NDVDrawer workflowId={workflowId} />
      )}
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

