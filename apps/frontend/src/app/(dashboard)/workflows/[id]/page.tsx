'use client';

import { useParams, useRouter } from 'next/navigation';
import { useWorkflow, useActivateWorkflow, useDeactivateWorkflow, useDeleteWorkflow, useExecuteWorkflow } from '@/hooks/use-workflows';
import { useExecutions } from '@/hooks/use-executions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EXECUTION_STATUS_VARIANTS } from '@/constants';
import { formatDate, formatDuration } from '@/lib/utils';
import {
  ArrowLeft,
  Edit3,
  Play,
  Pause,
  Trash2,
  Clock,
  Calendar,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Link2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { WorkflowExecution } from '@/types';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  DRAFT: { variant: 'secondary', label: 'Draft' },
  ACTIVE: { variant: 'default', label: 'Active' },
  PAUSED: { variant: 'outline', label: 'Paused' },
  ARCHIVED: { variant: 'destructive', label: 'Archived' },
};

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: workflow, isLoading, error, refetch } = useWorkflow(id);
  const { data: executionsData } = useExecutions(1);
  const activateMutation = useActivateWorkflow();
  const deactivateMutation = useDeactivateWorkflow();
  const deleteMutation = useDeleteWorkflow();
  const executeMutation = useExecuteWorkflow();

  const handleRun = async () => {
    try {
      // Build test trigger data based on trigger node type (same as editor)
      const defNodes = (workflow?.definition as any)?.nodes || [];
      const triggerNode = defNodes.find(
        (n: any) =>
          n.type === 'triggerNode' ||
          n.id?.startsWith('trigger-') ||
          ['WEBHOOK', 'CRON', 'EMAIL', 'TELEGRAM'].includes(n.data?.type || n.type),
      );
      let testTriggerData: Record<string, unknown> = {};
      if (triggerNode) {
        const tType = triggerNode.data?.type || triggerNode.type;
        const cfg = triggerNode.data?.config || triggerNode.config || {};
        if (tType === 'EMAIL') {
          testTriggerData = {
            from: 'test@example.com',
            subject: 'Test Email',
            body: 'Manual test run',
            date: new Date().toISOString(),
          };
        } else if (tType === 'WEBHOOK') {
          testTriggerData = {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: { test: true, timestamp: Date.now() },
          };
        } else if (tType === 'TELEGRAM') {
          testTriggerData = {
            chatId: String(cfg.chatId || ''),
            from: 'TestUser',
            text: '/test manual run',
            messageId: Date.now(),
          };
        } else if (tType === 'CRON') {
          testTriggerData = {
            scheduledAt: new Date().toISOString(),
            cron: String(cfg.cron || '* * * * *'),
          };
        }
      }
      await executeMutation.mutateAsync({ id, data: testTriggerData });
      refetch();
    } catch {
      toast.error('Failed to start execution');
    }
  };

  const handleToggleActive = async () => {
    try {
      if (workflow?.status === 'ACTIVE') {
        await deactivateMutation.mutateAsync(id);
      } else {
        await activateMutation.mutateAsync(id);
      }
      refetch();
    } catch {
      toast.error('Failed to update workflow status');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      router.push('/workflows');
    } catch {
      toast.error('Failed to delete workflow');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Workflow not found</p>
        <Link href="/workflows">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Workflows
          </Button>
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[workflow.status] || STATUS_BADGE.DRAFT;
  const nodes = workflow.definition?.nodes || [];
  const edges = workflow.definition?.edges || [];
  const triggerCount = nodes.filter((n: { type?: string }) => n.type?.includes('trigger')).length;
  const actionCount = nodes.filter((n: { type?: string }) => !n.type?.includes('trigger')).length;

  const recentExecutions: WorkflowExecution[] = (executionsData?.executions || executionsData || [])
    .filter((e: WorkflowExecution) => e.workflowId === id)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/workflows" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{workflow.name}</h1>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          {workflow.description && (
            <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            {workflow.status === 'ACTIVE' ? (
              <><Pause className="h-4 w-4 mr-1" /> Pause</>
            ) : (
              <><Play className="h-4 w-4 mr-1" /> Activate</>
            )}
          </Button>
          <Button size="sm" onClick={handleRun} disabled={executeMutation.isPending}>
            {executeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            Run
          </Button>
          <Link href={`/workflows/${id}/editor`}>
            <Button variant="outline" size="sm">
              <Edit3 className="h-4 w-4 mr-1" /> Edit
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
              <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nodes</p>
              <p className="text-lg font-bold">{nodes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
              <ExternalLink className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Connections</p>
              <p className="text-lg font-bold">{edges.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">{formatDate(workflow.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="text-sm font-medium">{formatDate(workflow.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook URL - shown when trigger type is WEBHOOK and workflow is ACTIVE */}
      {workflow.trigger?.type === 'WEBHOOK' && workflow.trigger?.webhookToken && workflow.status === 'ACTIVE' && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium">Webhook URL</span>
              <Badge variant="outline" className="text-[10px]">ACTIVE</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Send a POST request to this URL to trigger the workflow. The request body will be available as <code className="text-violet-400">{'{{trigger.body.*}}'}</code>
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background/80 rounded-md px-3 py-2 border overflow-x-auto select-all">
                {`${typeof window !== 'undefined' ? window.location.origin : 'https://zapier.egor-dev.ru'}/api/webhooks/${workflow.trigger.webhookToken}`}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/api/webhooks/${workflow.trigger?.webhookToken}`;
                  navigator.clipboard.writeText(url);
                  toast.success('Webhook URL copied!');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Structure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Workflow Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500" />
              <span className="text-muted-foreground">{triggerCount} trigger{triggerCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">{actionCount} action{actionCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-muted-foreground">{edges.length} connection{edges.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="mt-4">
            <Link href={`/workflows/${id}/editor`}>
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                <Edit3 className="h-4 w-4" />
                Open in Editor
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Executions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Executions</CardTitle>
            <Link href="/executions" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentExecutions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No executions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Run the workflow to see results here</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentExecutions.map((exec) => (
                <Link key={exec.id} href={`/executions/${exec.id}`}>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {exec.status === 'COMPLETED' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : exec.status === 'FAILED' ? (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{formatDate(exec.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {exec.duration != null && (
                        <span className="text-xs text-muted-foreground">{formatDuration(exec.duration)}</span>
                      )}
                      <Badge
                        variant={EXECUTION_STATUS_VARIANTS[exec.status] || 'secondary'}
                        className="text-[10px] px-2"
                      >
                        {exec.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
