'use client';

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Save, Play, ArrowLeft, Maximize, Loader2 } from 'lucide-react';
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
  const router = useRouter();
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
        <div className="flex items-center gap-2 border-b px-3 py-2 bg-card">
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground mr-1" onClick={() => router.push('/workflows')}>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Back</span>
          </Button>
          <div className="w-px h-5 bg-border" />
          <h2 className="font-semibold text-sm flex-1 truncate px-1">
            {workflow?.name || 'Workflow Editor'}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => fitView({ padding: 0.2 })} title="Fit to view">
            <Maximize className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSave} disabled={updateWorkflow.isPending}>
            {updateWorkflow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button size="sm" className="gap-1.5 shadow-sm shadow-primary/20" onClick={handleRun}>
            <Play className="h-3.5 w-3.5" />
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
            <Controls className="!rounded-lg !border !shadow-sm" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-card !border !rounded-lg !shadow-sm"
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
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
