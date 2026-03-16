'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Send,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  Link2,
  Mail,
  Globe,
  Database,
  Webhook,
  ArrowLeft,
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
  const [step, setStep] = useState<'list' | 'select' | 'form'>('list');
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Form fields
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await api.get('/integrations');
      return res.data.data || res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/integrations', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration added successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to add integration'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration removed');
    },
    onError: () => toast.error('Failed to remove integration'),
  });

  const resetForm = () => {
    setStep('list');
    setSelectedType(null);
    setFormData({});
    setVerifyResult(null);
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ---- Verify handlers per type ----
  const handleVerify = async () => {
    if (!selectedType) return;
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      let res: any;
      switch (selectedType) {
        case 'TELEGRAM':
          res = await api.post('/integrations/telegram/verify', { botToken: formData.botToken });
          break;
        case 'SMTP':
          res = await api.post('/integrations/smtp/verify', {
            host: formData.host,
            port: parseInt(formData.port || '587'),
            user: formData.user,
            password: formData.password,
            secure: formData.port === '465',
          });
          break;
        case 'WEBHOOK':
          res = await api.post('/integrations/webhook/verify', { name: formData.name, url: formData.url });
          break;
        case 'HTTP_API':
          res = await api.post('/integrations/http-api/verify', {
            baseUrl: formData.baseUrl,
            headers: formData.headerKey ? { [formData.headerKey]: formData.headerValue } : undefined,
          });
          break;
        case 'DATABASE':
          res = await api.post('/integrations/database/verify', { connectionString: formData.connectionString });
          break;
      }
      const data = res?.data?.data || res?.data;
      setVerifyResult(data);
      if (data?.ok) {
        toast.success('Verification successful');
      } else {
        toast.error(data?.message || 'Verification failed');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAdd = () => {
    if (!selectedType || !verifyResult?.ok) return;

    let name = '';
    let config: Record<string, any> = {};
    let metadata: Record<string, any> = {};

    switch (selectedType) {
      case 'TELEGRAM':
        name = `@${verifyResult.botUsername}`;
        config = { botToken: formData.botToken };
        metadata = {
          botId: verifyResult.botId,
          botName: verifyResult.botName,
          botUsername: verifyResult.botUsername,
          photoUrl: verifyResult.photoUrl,
        };
        break;
      case 'SMTP':
        name = formData.name || `${formData.user}@${formData.host}`;
        config = { host: formData.host, port: parseInt(formData.port || '587'), user: formData.user, password: formData.password };
        metadata = { message: verifyResult.message };
        break;
      case 'WEBHOOK':
        name = formData.name || 'Webhook';
        config = { webhookUrl: verifyResult.webhookUrl, secret: verifyResult.secret };
        metadata = { webhookUrl: verifyResult.webhookUrl };
        break;
      case 'HTTP_API':
        name = formData.name || new URL(formData.baseUrl).hostname;
        config = { baseUrl: formData.baseUrl, headers: formData.headerKey ? { [formData.headerKey]: formData.headerValue } : {} };
        metadata = { statusCode: verifyResult.statusCode, message: verifyResult.message };
        break;
      case 'DATABASE':
        name = formData.name || 'Database';
        config = { connectionString: formData.connectionString };
        metadata = { message: verifyResult.message };
        break;
    }

    createMutation.mutate({ type: selectedType, name, config, metadata });
  };

  const canVerify = (): boolean => {
    switch (selectedType) {
      case 'TELEGRAM': return !!formData.botToken?.trim();
      case 'SMTP': return !!(formData.host?.trim() && formData.port?.trim() && formData.user?.trim() && formData.password?.trim());
      case 'WEBHOOK': return !!formData.name?.trim();
      case 'HTTP_API': return !!formData.baseUrl?.trim();
      case 'DATABASE': return !!formData.connectionString?.trim();
      default: return false;
    }
  };

  // ---- Type-specific forms ----
  const renderForm = () => {
    const meta = selectedType ? getIntegrationMeta(selectedType) : null;
    if (!meta) return null;
    const Icon = meta.icon;

    return (
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setStep('select'); setVerifyResult(null); setFormData({}); }} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${meta.bgColor}`}>
            <Icon className={`h-5 w-5 ${meta.color}`} />
          </div>
          <div>
            <h3 className="font-semibold">Add {meta.label}</h3>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
        </div>

        <div className="space-y-3">
          {selectedType === 'TELEGRAM' && (
            <InputField label="Bot Token" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" value={formData.botToken || ''} onChange={(v) => updateField('botToken', v)} />
          )}

          {selectedType === 'SMTP' && (
            <>
              <InputField label="Name (optional)" placeholder="My Email Server" value={formData.name || ''} onChange={(v) => updateField('name', v)} />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="SMTP Host" placeholder="smtp.gmail.com" value={formData.host || ''} onChange={(v) => updateField('host', v)} />
                <InputField label="Port" placeholder="587" value={formData.port || ''} onChange={(v) => updateField('port', v)} />
              </div>
              <InputField label="Username" placeholder="user@gmail.com" value={formData.user || ''} onChange={(v) => updateField('user', v)} />
              <InputField label="Password" placeholder="App password" value={formData.password || ''} onChange={(v) => updateField('password', v)} type="password" />
            </>
          )}

          {selectedType === 'WEBHOOK' && (
            <>
              <InputField label="Webhook Name" placeholder="My Webhook" value={formData.name || ''} onChange={(v) => updateField('name', v)} />
              <InputField label="URL (optional, auto-generated if empty)" placeholder="https://example.com/webhook" value={formData.url || ''} onChange={(v) => updateField('url', v)} />
            </>
          )}

          {selectedType === 'HTTP_API' && (
            <>
              <InputField label="Name (optional)" placeholder="My API" value={formData.name || ''} onChange={(v) => updateField('name', v)} />
              <InputField label="Base URL" placeholder="https://api.example.com" value={formData.baseUrl || ''} onChange={(v) => updateField('baseUrl', v)} />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Auth Header Key" placeholder="X-API-Key" value={formData.headerKey || ''} onChange={(v) => updateField('headerKey', v)} />
                <InputField label="Auth Header Value" placeholder="your-api-key" value={formData.headerValue || ''} onChange={(v) => updateField('headerValue', v)} />
              </div>
            </>
          )}

          {selectedType === 'DATABASE' && (
            <>
              <InputField label="Name (optional)" placeholder="Production DB" value={formData.name || ''} onChange={(v) => updateField('name', v)} />
              <InputField label="Connection String" placeholder="postgresql://user:pass@localhost:5432/mydb" value={formData.connectionString || ''} onChange={(v) => updateField('connectionString', v)} />
            </>
          )}
        </div>

        {/* Verify result */}
        {verifyResult && (
          <div className={`flex items-center gap-3 rounded-lg border p-4 ${verifyResult.ok ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
            {verifyResult.ok ? (
              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {selectedType === 'TELEGRAM' && verifyResult.ok ? (
                <div className="flex items-center gap-3">
                  {verifyResult.photoUrl ? (
                    <img src={verifyResult.photoUrl} alt={verifyResult.botName} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <Bot className="h-5 w-5 text-sky-500" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{verifyResult.botName}</p>
                    <p className="text-xs text-muted-foreground">@{verifyResult.botUsername}</p>
                  </div>
                </div>
              ) : selectedType === 'WEBHOOK' && verifyResult.ok ? (
                <div>
                  <p className="font-semibold text-sm">Webhook URL Generated</p>
                  <p className="text-xs text-muted-foreground break-all">{verifyResult.webhookUrl}</p>
                </div>
              ) : (
                <p className="text-sm">{verifyResult.message || (verifyResult.ok ? 'Verified' : 'Failed')}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={resetForm} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
            Cancel
          </button>
          {!verifyResult?.ok ? (
            <button
              onClick={handleVerify}
              disabled={isVerifying || !canVerify()}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors ${meta.color.replace('text-', 'bg-').replace('500', '600')} hover:opacity-90`}
            >
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Verify
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Integration
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect external services to use in your workflows
          </p>
        </div>
        {step === 'list' && (
          <button
            onClick={() => setStep('select')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Integration
          </button>
        )}
      </div>

      {/* Type selector */}
      {step === 'select' && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={resetForm} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h3 className="font-semibold">Choose Integration Type</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATION_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.type}
                  onClick={() => { setSelectedType(t.type); setStep('form'); setFormData({}); setVerifyResult(null); }}
                  className="flex items-start gap-3 rounded-lg border p-4 text-left hover:bg-accent/50 hover:border-primary/30 transition-all"
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${t.bgColor} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${t.color}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Type-specific form */}
      {step === 'form' && renderForm()}

      {/* Integrations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : integrations.length === 0 && step === 'list' ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
            <Link2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No integrations yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Connect Telegram, SMTP, Webhook, HTTP API, or Database to power your workflows
          </p>
          <button
            onClick={() => setStep('select')}
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
                  <button
                    onClick={() => deleteMutation.mutate(integration.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {integration.isActive ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">Inactive</span>
                    </>
                  )}
                  <span className="text-muted-foreground ml-auto">
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, type = 'text' }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  );
}
