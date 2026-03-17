'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, X, Loader2, CheckCircle, XCircle, Clock, Terminal } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface StepLog {
  id: string;
  nodeId: string;
  nodeName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  input?: any;
  output?: any;
  error?: string;
}

interface Execution {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  createdAt?: string;
  error?: string;
  stepLogs: StepLog[];
}

interface ExecutionConsoleProps {
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
  runTrigger: number;
}

export function ExecutionConsole({ workflowId, isOpen, onClose, runTrigger }: ExecutionConsoleProps) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !workflowId || runTrigger === 0) return;

    setExecution(null);
    setIsLoading(true);
    setIsMinimized(false);

    // Small delay to let execution start on backend
    const startDelay = setTimeout(() => {
      const fetchExecution = async () => {
        try {
          // Step 1: get latest execution ID for this workflow
          const listRes = await api.get('/executions', { params: { workflowId, limit: 1 } });
          const execs = listRes.data?.executions || listRes.data?.data || (Array.isArray(listRes.data) ? listRes.data : []);
          if (execs.length > 0) {
            // Step 2: fetch full execution with stepLogs
            const detailRes = await api.get(`/executions/${execs[0].id}`);
            const fullExec = detailRes.data;
            setExecution(fullExec);
            setIsLoading(false);
            if (['COMPLETED', 'FAILED'].includes(fullExec.status)) {
              if (pollRef.current) clearInterval(pollRef.current);
            }
          }
        } catch {
          setIsLoading(false);
        }
      };

      fetchExecution();
      pollRef.current = setInterval(fetchExecution, 2000);
    }, 800);

    return () => {
      clearTimeout(startDelay);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen, workflowId, runTrigger]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [execution?.stepLogs]);

  if (!isOpen) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
      case 'COMPLETED': return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case 'FAILED': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'text-blue-500';
      case 'COMPLETED': return 'text-emerald-500';
      case 'FAILED': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const duration = (start?: string | null, end?: string | null) => {
    if (!start) return '';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const ms = e - s;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className={cn(
      'border-t bg-card flex flex-col transition-all duration-200 shrink-0',
      isMinimized ? 'h-10' : 'h-56'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Execution Console</span>
          {execution && (
            <>
              {statusIcon(execution.status)}
              <span className={cn('text-xs font-medium', statusColor(execution.status))}>
                {execution.status}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {duration(execution.startedAt || execution.createdAt, execution.completedAt)}
              </span>
            </>
          )}
          {isLoading && !execution && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="rounded p-0.5 hover:bg-accent transition-colors">
            {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-accent transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1 bg-background/50">
          {isLoading && !execution && (
            <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Starting execution...</span>
            </div>
          )}

          {execution && (
            <>
              <div className="text-muted-foreground">
                <span className="text-blue-400">[{new Date(execution.startedAt || execution.createdAt || Date.now()).toLocaleTimeString()}]</span>
                {' '}Execution started · ID: {execution.id.slice(0, 12)}...
              </div>

              {execution.stepLogs?.map((step, i) => (
                <div key={step.id || i} className="pl-2 border-l-2 border-muted ml-1">
                  <div className="flex items-center gap-1.5">
                    {statusIcon(step.status)}
                    <span className="font-semibold text-foreground">{step.nodeName || step.nodeId}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className={statusColor(step.status)}>{step.status}</span>
                    {step.startedAt && (
                      <span className="text-muted-foreground ml-auto">
                        {duration(step.startedAt, step.completedAt)}
                      </span>
                    )}
                  </div>
                  {step.error && (
                    <div className="text-red-400 pl-5 mt-0.5">Error: {step.error}</div>
                  )}
                  {step.output && (
                    <div className="text-emerald-400/80 pl-5 mt-0.5 truncate max-w-full" title={JSON.stringify(step.output)}>
                      Output: {typeof step.output === 'string' ? step.output : JSON.stringify(step.output).slice(0, 120)}
                    </div>
                  )}
                </div>
              ))}

              {execution.status === 'COMPLETED' && (
                <div className="text-emerald-400">
                  <span className="text-blue-400">[{execution.completedAt ? new Date(execution.completedAt).toLocaleTimeString() : '...'}]</span>
                  {' '}✓ Execution completed successfully · {duration(execution.startedAt, execution.completedAt)}
                </div>
              )}

              {execution.status === 'FAILED' && (
                <div className="text-red-400">
                  <span className="text-blue-400">[{execution.completedAt ? new Date(execution.completedAt).toLocaleTimeString() : '...'}]</span>
                  {' '}✗ Execution failed{execution.error ? `: ${execution.error}` : ''}
                </div>
              )}

              {execution.status === 'RUNNING' && (
                <div className="flex items-center gap-1.5 text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Running...
                </div>
              )}
            </>
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
