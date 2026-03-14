'use client';

import { useCallback, useRef, useEffect } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEditorStore } from '@/stores/editor-store';
import { useWorkflow, useUpdateWorkflow } from '@/hooks/use-workflows';
import { Button } from '@/components/ui/button';
import { Save, Play, Zap } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const TRIGGER_TYPES = [
  { type: 'WEBHOOK', label: 'Webhook', color: '#8B5CF6' },
  { type: 'CRON', label: 'Schedule', color: '#F59E0B' },
  { type: 'EMAIL', label: 'Email', color: '#EF4444' },
];

const ACTION_TYPES = [
  { type: 'HTTP_REQUEST', label: 'HTTP Request', color: '#3B82F6' },
  { type: 'SEND_EMAIL', label: 'Send Email', color: '#10B981' },
  { type: 'TELEGRAM', label: 'Telegram', color: '#0EA5E9' },
  { type: 'DATABASE', label: 'Database', color: '#F97316' },
  { type: 'TRANSFORM', label: 'Transform', color: '#6366F1' },
];

function EditorCanvas() {
  const params = useParams();
  const workflowId = params.id as string;
  const { data: workflow } = useWorkflow(workflowId);
  const updateWorkflow = useUpdateWorkflow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setNodes, setEdges, addNode, setSelectedNode } = useEditorStore();

  useEffect(() => {
    if (workflow?.definition) {
      const def = typeof workflow.definition === 'string' ? JSON.parse(workflow.definition) : workflow.definition;
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
      const color = event.dataTransfer.getData('application/reactflow-color');

      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const isTrigger = ['WEBHOOK', 'CRON', 'EMAIL'].includes(type);

      const newNode: Node = {
        id: `${isTrigger ? 'trigger' : 'action'}-${Date.now()}`,
        type: 'default',
        position,
        data: { label: `${label}`, type, config: {}, color },
        style: {
          background: `${color}15`,
          border: `2px solid ${color}`,
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: 500,
        },
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
      <div className="w-64 border-r bg-card p-4 overflow-y-auto">
        <h3 className="font-semibold text-sm mb-3">Triggers</h3>
        {TRIGGER_TYPES.map((t) => (
          <div
            key={t.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow-type', t.type);
              e.dataTransfer.setData('application/reactflow-label', t.label);
              e.dataTransfer.setData('application/reactflow-color', t.color);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="mb-2 cursor-grab rounded-lg border-2 p-3 text-sm font-medium hover:shadow-md transition-shadow"
            style={{ borderColor: t.color, background: `${t.color}10` }}
          >
            <Zap className="h-3 w-3 inline mr-2" style={{ color: t.color }} />
            {t.label}
          </div>
        ))}

        <h3 className="font-semibold text-sm mb-3 mt-6">Actions</h3>
        {ACTION_TYPES.map((a) => (
          <div
            key={a.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow-type', a.type);
              e.dataTransfer.setData('application/reactflow-label', a.label);
              e.dataTransfer.setData('application/reactflow-color', a.color);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="mb-2 cursor-grab rounded-lg border-2 p-3 text-sm font-medium hover:shadow-md transition-shadow"
            style={{ borderColor: a.color, background: `${a.color}10` }}
          >
            {a.label}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <h2 className="font-semibold text-sm flex-1">{workflow?.name || 'Workflow Editor'}</h2>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
          <Button size="sm" onClick={handleRun}>
            <Play className="h-3 w-3 mr-1" /> Run
          </Button>
        </div>

        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
            defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>
      </div>
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
