'use client';

import { useCallback, useRef, useEffect, useMemo } from 'react';
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
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEditorStore } from '@/stores/editor-store';
import { useWorkflow, useUpdateWorkflow } from '@/hooks/use-workflows';
import { NodeConfigPanel } from '@/components/editor/node-config-panel';
import TriggerNode from '@/components/editor/nodes/trigger-node';
import ActionNode from '@/components/editor/nodes/action-node';
import { AnimatedEdge } from '@/components/editor/edges/animated-edge';
import { Button } from '@/components/ui/button';
import { Save, Play, Zap, Undo2, Redo2, Maximize } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const TRIGGER_TYPES = [
  { type: 'WEBHOOK', label: 'Webhook', color: '#8B5CF6', icon: '🔗' },
  { type: 'CRON', label: 'Schedule', color: '#F59E0B', icon: '⏰' },
  { type: 'EMAIL', label: 'Email', color: '#EF4444', icon: '📧' },
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
  const { screenToFlowPosition, fitView } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
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

  useEffect(() => {
    if (workflow?.definition) {
      const def =
        typeof workflow.definition === 'string'
          ? JSON.parse(workflow.definition)
          : workflow.definition;
      setNodes(def.nodes || []);
      setEdges(def.edges || []);
    }
  }, [workflow, setNodes, setEdges]);

  const handleSave = async () => {
    try {
      await updateWorkflow.mutateAsync({
        id: workflowId,
        definition: { nodes, edges },
      });
      toast.success('Workflow saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleRun = async () => {
    try {
      await api.post(`/workflows/${workflowId}/execute`);
      toast.success('Workflow execution started');
    } catch {
      toast.error('Failed to start execution');
    }
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow-type');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const isTrigger = ['WEBHOOK', 'CRON', 'EMAIL'].includes(type);

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
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Sidebar - Node Palette */}
      <div className="w-60 border-r bg-card p-4 overflow-y-auto shrink-0">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Triggers
        </h3>
        {TRIGGER_TYPES.map((t) => (
          <div
            key={t.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow-type', t.type);
              e.dataTransfer.setData('application/reactflow-label', t.label);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="mb-2 cursor-grab rounded-lg border-2 p-2.5 text-sm font-medium hover:shadow-md transition-all active:cursor-grabbing"
            style={{ borderColor: t.color, background: `${t.color}10` }}
          >
            <span className="mr-2">{t.icon}</span>
            {t.label}
          </div>
        ))}

        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3 mt-6">
          Actions
        </h3>
        {ACTION_TYPES.map((a) => (
          <div
            key={a.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow-type', a.type);
              e.dataTransfer.setData('application/reactflow-label', a.label);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="mb-2 cursor-grab rounded-lg border-2 p-2.5 text-sm font-medium hover:shadow-md transition-all active:cursor-grabbing"
            style={{ borderColor: a.color, background: `${a.color}10` }}
          >
            <span className="mr-2">{a.icon}</span>
            {a.label}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-4 py-2 bg-card">
          <h2 className="font-semibold text-sm flex-1 truncate">
            {workflow?.name || 'Workflow Editor'}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => fitView({ padding: 0.2 })}>
            <Maximize className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button size="sm" variant="outline" onClick={handleSave} disabled={updateWorkflow.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save
          </Button>
          <Button size="sm" onClick={handleRun}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Run
          </Button>
        </div>

        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
            defaultEdgeOptions={{ type: 'animated', animated: true }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-card !border !rounded-lg"
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>
      </div>

      {/* Node Config Panel */}
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
