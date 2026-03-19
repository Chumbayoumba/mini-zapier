'use client';

import { useState, useMemo } from 'react';
import { useExecutionStore, type NodeExecInfo } from '@/stores/execution-store';
import { useEditorStore } from '@/stores/editor-store';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Check,
  Pin,
  PinOff,
  ChevronRight,
  ChevronDown,
  Table,
  Braces,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null || data === undefined) {
    return <span className="text-gray-500">null</span>;
  }

  if (typeof data === 'boolean') {
    return <span className="text-amber-500">{String(data)}</span>;
  }

  if (typeof data === 'number') {
    return <span className="text-blue-400">{data}</span>;
  }

  if (typeof data === 'string') {
    return <span className="text-green-400">&quot;{data}&quot;</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-500">[]</span>;

    return (
      <div className="ml-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex items-center gap-0.5 text-gray-400 hover:text-gray-200 text-xs"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span className="text-gray-500">Array[{data.length}]</span>
        </button>
        {!collapsed && (
          <div className="border-l border-gray-700 pl-3 ml-1">
            {data.map((item, i) => (
              <div key={i} className="py-0.5">
                <span className="text-gray-500 text-xs mr-1">{i}:</span>
                <JsonTree data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="text-gray-500">{'{}'}</span>;

    return (
      <div className="ml-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex items-center gap-0.5 text-gray-400 hover:text-gray-200 text-xs"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span className="text-gray-500">Object{`{${entries.length}}`}</span>
        </button>
        {!collapsed && (
          <div className="border-l border-gray-700 pl-3 ml-1">
            {entries.map(([key, value]) => (
              <div key={key} className="py-0.5">
                <span className="text-purple-400 text-xs">{key}:</span>{' '}
                <JsonTree data={value} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-400">{String(data)}</span>;
}

function TableView({ data }: { data: unknown[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground p-2">No items</p>;

  const sample = data[0];
  if (typeof sample !== 'object' || sample === null) {
    return (
      <div className="overflow-auto max-h-60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-2 py-1 text-left text-gray-400">Index</th>
              <th className="px-2 py-1 text-left text-gray-400">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i} className="border-b border-gray-800">
                <td className="px-2 py-1 text-gray-500">{i}</td>
                <td className="px-2 py-1 text-gray-200">{String(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const keys = Object.keys(sample);

  return (
    <div className="overflow-auto max-h-60">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700">
            {keys.map((k) => (
              <th key={k} className="px-2 py-1 text-left text-gray-400 whitespace-nowrap">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i} className="border-b border-gray-800">
              {keys.map((k) => (
                <td key={k} className="px-2 py-1 text-gray-200 whitespace-nowrap max-w-[200px] truncate">
                  {String((item as Record<string, unknown>)[k] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tab = 'output' | 'input' | 'settings';

export function NodeOutputPanel() {
  const selectedNode = useEditorStore((s) => s.selectedNode);
  const nodeId = selectedNode?.id || '';
  const execInfo: NodeExecInfo | undefined = useExecutionStore((s) => s.nodeStates[nodeId]);
  const pinnedData = useExecutionStore((s) => s.pinnedData[nodeId]);
  const pinNodeData = useExecutionStore((s) => s.pinNodeData);
  const unpinNodeData = useExecutionStore((s) => s.unpinNodeData);

  const [activeTab, setActiveTab] = useState<Tab>('output');
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json');
  const [copied, setCopied] = useState(false);

  const hasOutput = execInfo?.state === 'success' || execInfo?.state === 'error';
  const output = pinnedData ?? execInfo?.output;

  const isArray = useMemo(() => Array.isArray(output), [output]);
  const itemCount = isArray ? (output as unknown[]).length : null;

  if (!selectedNode || !hasOutput) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard failed
    }
  };

  const isPinned = pinnedData !== undefined;

  return (
    <div className="border-t border-border bg-card">
      {/* Tab header */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
        <button
          onClick={() => setActiveTab('output')}
          className={cn(
            'px-2 py-1 text-xs rounded font-medium transition-colors',
            activeTab === 'output'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Output
          {itemCount !== null && (
            <span className="ml-1 text-[10px] bg-primary/20 px-1 rounded">{itemCount} items</span>
          )}
        </button>

        <div className="flex-1" />

        {/* View toggles */}
        {isArray && activeTab === 'output' && (
          <div className="flex items-center gap-0.5 mr-2">
            <button
              onClick={() => setViewMode('json')}
              className={cn(
                'p-1 rounded',
                viewMode === 'json' ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )}
              title="JSON view"
            >
              <Braces className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1 rounded',
                viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )}
              title="Table view"
            >
              <Table className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs gap-1"
          onClick={() => (isPinned ? unpinNodeData(nodeId) : pinNodeData(nodeId, execInfo?.output))}
          title={isPinned ? 'Unpin data' : 'Pin data for future runs'}
        >
          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          {isPinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>

      {/* Content */}
      <div className="max-h-48 overflow-auto p-3 text-xs font-mono">
        {activeTab === 'output' && (
          <>
            {execInfo?.state === 'error' && execInfo.error && (
              <div className="mb-2 rounded bg-red-500/10 border border-red-500/20 p-2 text-red-400">
                {execInfo.error}
              </div>
            )}
            {output !== undefined ? (
              viewMode === 'table' && isArray ? (
                <TableView data={output as unknown[]} />
              ) : (
                <JsonTree data={output} />
              )
            ) : (
              <p className="text-muted-foreground">No output data</p>
            )}
          </>
        )}
      </div>

      {isPinned && (
        <div className="flex items-center gap-1 px-3 py-1 border-t border-border bg-amber-500/5">
          <Database className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] text-amber-500">Pinned — this data will be used in test runs</span>
        </div>
      )}
    </div>
  );
}
