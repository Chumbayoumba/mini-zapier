'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-handler';
import { testIntegration } from '@/lib/integration-test';
import { IntegrationWizard } from '@/components/integrations/integration-wizard';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  Mail,
  Globe,
  Database,
  Webhook,
  Pencil,
  Zap,
  AlertCircle,
  Link2,
  Send,
} from 'lucide-react';

interface Integration {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: string;
}

type IntegrationType = 'TELEGRAM' | 'SMTP' | 'WEBHOOK' | 'HTTP_API' | 'DATABASE';

const INTEGRATION_TYPES: {
  type: IntegrationType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}[] = [
  {
    type: 'TELEGRAM',
    label: 'Telegram Bot',
    description: 'Send messages and receive commands via Telegram',
    icon: Send,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
  },
  {
    type: 'SMTP',
    label: 'SMTP Email',
    description: 'Send emails through any SMTP server',
    icon: Mail,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    type: 'WEBHOOK',
    label: 'Webhook',
    description: 'Receive events via incoming webhooks',
    icon: Webhook,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
  },
  {
    type: 'HTTP_API',
    label: 'HTTP API',
    description: 'Connect to any REST API endpoint',
    icon: Globe,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    type: 'DATABASE',
    label: 'Database',
    description: 'Connect to PostgreSQL or MySQL databases',
    icon: Database,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
  },
];

function getIntegrationMeta(type: string) {
  return INTEGRATION_TYPES.find((t) => t.type === type) || INTEGRATION_TYPES[0];
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await api.get('/integrations');
      return res.data.data || res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration removed');
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const handleTestIntegration = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testIntegration(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
      if (result.success) {
        toast.success('Connection test passed');
      } else {
        toast.error(result.message || 'Connection test failed');
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: 'Test failed' } }));
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const openWizard = (integration?: Integration) => {
    setEditingIntegration(integration || null);
    setWizardOpen(true);
  };

  const getConnectionStatus = (integration: Integration): 'connected' | 'error' | 'unknown' => {
    const result = testResults[integration.id];
    if (result) return result.success ? 'connected' : 'error';
    return integration.isActive ? 'connected' : 'unknown';
  };

  return (
    <div className="space-y-6">
      {/* Integration Wizard Dialog */}
      <IntegrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editIntegration={editingIntegration}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect external services to use in your workflows
          </p>
        </div>
        <Button
          onClick={() => openWizard()}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Integration
        </Button>
      </div>

      {/* Integrations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
            <Link2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No integrations yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Connect Telegram, SMTP, Webhook, HTTP API, or Database to power your workflows
          </p>
          <button
            onClick={() => openWizard()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Your First Integration
          </button>
        </div>
      ) : integrations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => {
            const meta = getIntegrationMeta(integration.type);
            const Icon = meta.icon;
            return (
              <div
                key={integration.id}
                className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${meta.bgColor} overflow-hidden`}>
                      {integration.type === 'TELEGRAM' && (integration.metadata as any)?.photoUrl ? (
                        <img
                          src={(integration.metadata as any).photoUrl}
                          alt={integration.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <Icon className={`h-5 w-5 ${meta.color}`} />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{meta.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openWizard(integration)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(integration.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {(() => {
                    const status = getConnectionStatus(integration);
                    if (status === 'connected') return (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          Connected
                        </span>
                      </>
                    );
                    if (status === 'error') return (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          Error
                        </span>
                      </>
                    );
                    return (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          <AlertCircle className="h-3 w-3" />
                          Unknown
                        </span>
                      </>
                    );
                  })()}
                  <span className="text-muted-foreground ml-auto">
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {/* Test button */}
                <div className="mt-3 pt-3 border-t">
                  <button
                    onClick={() => handleTestIntegration(integration.id)}
                    disabled={testingId === integration.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {testingId === integration.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Test Connection
                  </button>
                  {testResults[integration.id] && (
                    <p className={`text-[10px] mt-1 ${testResults[integration.id].success ? 'text-emerald-500' : 'text-red-500'}`}>
                      {testResults[integration.id].message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
