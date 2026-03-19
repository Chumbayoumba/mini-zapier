'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useExecutionStore } from '@/stores/execution-store';
import { NodeConfigPanel } from '../node-config-panel';
import { cn } from '@/lib/utils';
import {
  X,
  Settings2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Play,
  Pin,
  GripVertical,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';

type Tab = 'parameters' | 'input' | 'output';

interface NDVDrawerProps {
  workflowId: string;
}

export function NDVDrawer({ workflowId }: NDVDrawerProps) {
  const { selectedNode, setSelectedNode, nodes, edges } = useEditorStore();
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const [activeTab, setActiveTab] = useState<Tab>('parameters');
  const [width, setWidth] = useState(420);
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<any>(null);
  const [pinnedInput, setPinnedInput] = useState<any>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    setActiveTab('parameters');
    setTestOutput(null);
  }, [selectedNode?.id]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setWidth(Math.max(360, Math.min(800, dragRef.current.startW + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [width]);

  const handleTestStep = async () => {
    if (!selectedNode || !workflowId) return;
    setTesting(true);
    try {
      const inputData = pinnedInput || getInputData();
      const res = await api.post(`/workflows/${workflowId}/test-node`, {
        nodeId: selectedNode.id,
        inputData,
      });
      setTestOutput(res.data);
      setActiveTab('output');
      toast.success('Test completed');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Test failed';
      setTestOutput({ error: typeof msg === 'string' ? msg : msg[0] });
      setActiveTab('output');
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  const getInputData = () => {
    if (!selectedNode) return null;
    // Find parent node's output from execution results
    const incomingEdge = edges.find((e) => e.target === selectedNode.id);
    if (incomingEdge && nodeResults[incomingEdge.source]) {
      return nodeResults[incomingEdge.source];
    }
    return null;
  };

  if (!selectedNode) return null;

  const nodeLabel = (selectedNode.data?.label as string) || selectedNode.id;
  const nodeType = (selectedNode.data?.type as string) || '';
  const inputData = pinnedInput || getInputData();
  const outputData = testOutput || nodeResults[selectedNode.id] || null;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'parameters', label: 'Parameters', icon: Settings2 },
    { id: 'input', label: 'Input', icon: ArrowDownToLine },
    { id: 'output', label: 'Output', icon: ArrowUpFromLine },
  ];

  return (
    <div
      className="flex flex-col border-l bg-card h-full shrink-0 relative"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-10 flex items-center"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/30 -ml-1.5" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-semibold truncate">{nodeLabel}</div>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {nodeType}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleTestStep}
            disabled={testing}
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Test
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setSelectedNode(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const hasData = tab.id === 'input' ? !!inputData : tab.id === 'output' ? !!outputData : false;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary -mb-px'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {hasData && (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'parameters' && <NodeConfigPanel embedded />}

        {activeTab === 'input' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Input Data</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => {
                  if (pinnedInput) {
                    setPinnedInput(null);
                    toast.info('Input unpinned');
                  } else if (inputData) {
                    setPinnedInput(inputData);
                    toast.success('Input pinned for testing');
                  }
                }}
              >
                <Pin className={cn('h-3 w-3', pinnedInput && 'text-primary fill-primary')} />
                {pinnedInput ? 'Unpin' : 'Pin'}
              </Button>
            </div>
            {inputData ? (
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words">
                {JSON.stringify(inputData, null, 2)}
              </pre>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No input data yet</p>
                <p className="text-xs mt-1">Run the workflow or connect a previous node</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'output' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Output Data</span>
              {outputData && !outputData.error && (
                <div className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-[10px]">Success</span>
                </div>
              )}
              {outputData?.error && (
                <div className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  <span className="text-[10px]">Error</span>
                </div>
              )}
            </div>
            {outputData ? (
              outputData.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive font-medium">{outputData.error}</p>
                </div>
              ) : (
                <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words">
                  {JSON.stringify(outputData, null, 2)}
                </pre>
              )
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <ArrowUpFromLine className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No output data yet</p>
                <p className="text-xs mt-1">Click &quot;Test&quot; to execute this node</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
