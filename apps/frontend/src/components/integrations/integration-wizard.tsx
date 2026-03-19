'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-handler';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';
import {
  Send,
  Mail,
  Database,
  Globe,
  Webhook,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Bot,
  Sparkles,
  Save,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

export type IntegrationType = 'TELEGRAM' | 'SMTP' | 'WEBHOOK' | 'HTTP_API' | 'DATABASE';

interface Integration {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: string;
}

interface IntegrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editIntegration?: Integration | null;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password' | 'number';
  required?: boolean;
  help?: string;
  helpUrl?: string;
  helpLinkText?: string;
  half?: boolean;
  selectOptions?: Array<{ value: string; label: string }>;
}

type WizardStep = 'type' | 'config' | 'test' | 'save';

// ─── Integration Type Definitions ────────────────────────

const INTEGRATION_TYPES: {
  type: IntegrationType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    type: 'SMTP',
    label: 'SMTP Email',
    description: 'Send emails through any SMTP server',
    icon: Mail,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    type: 'TELEGRAM',
    label: 'Telegram Bot',
    description: 'Send and receive messages via Telegram',
    icon: Send,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    type: 'DATABASE',
    label: 'Database',
    description: 'Connect to PostgreSQL or MySQL',
    icon: Database,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  {
    type: 'HTTP_API',
    label: 'HTTP / API Key',
    description: 'Connect to any REST API endpoint',
    icon: Globe,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  {
    type: 'WEBHOOK',
    label: 'Webhook',
    description: 'Receive incoming webhook events',
    icon: Webhook,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
];

// ─── Field definitions per type ──────────────────────────

const TYPE_FIELDS: Record<IntegrationType, FieldDef[]> = {
  SMTP: [
    { key: 'host', label: 'SMTP Host', placeholder: 'smtp.gmail.com', required: true, help: 'The hostname of your SMTP server (e.g. smtp.gmail.com, smtp.mail.ru)' },
    { key: 'port', label: 'Port', placeholder: '587', type: 'number', required: true, half: true, help: 'Common ports: 587 (TLS), 465 (SSL), 25 (unencrypted)' },
    { key: 'secure', label: 'SSL/TLS', placeholder: '', half: true, selectOptions: [{ value: 'auto', label: 'Auto-detect' }, { value: 'true', label: 'Yes (port 465)' }, { value: 'false', label: 'No (port 587/25)' }], help: 'Enable SSL/TLS encryption. Auto-detect enables for port 465' },
    { key: 'user', label: 'Username', placeholder: 'user@gmail.com', required: true, help: 'Usually your email address' },
    { key: 'password', label: 'Password', placeholder: 'App password', type: 'password', required: true, help: 'For Gmail, use App Password (not your regular password)', helpUrl: 'https://myaccount.google.com/apppasswords', helpLinkText: 'Get App Password' },
    { key: 'from', label: 'From Address (optional)', placeholder: 'noreply@example.com', help: 'Sender address. Defaults to username if empty' },
  ],
  TELEGRAM: [
    { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', type: 'password', required: true, help: 'Get your bot token from @BotFather on Telegram', helpUrl: 'https://t.me/BotFather', helpLinkText: 'Open @BotFather' },
    { key: 'chatId', label: 'Default Chat ID (optional)', placeholder: '-1001234567890', help: 'Default chat to send messages to. Leave empty to use trigger chat ID', helpUrl: 'https://t.me/userinfobot', helpLinkText: 'How to find Chat ID' },
  ],
  DATABASE: [
    { key: 'host', label: 'Host', placeholder: 'localhost', required: true, help: 'Database server hostname or IP address' },
    { key: 'port', label: 'Port', placeholder: '5432', type: 'number', half: true, required: true, help: 'Default ports: PostgreSQL 5432, MySQL 3306' },
    { key: 'dbType', label: 'Type', placeholder: '', half: true, selectOptions: [{ value: 'postgres', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL' }], help: 'Database engine type' },
    { key: 'database', label: 'Database', placeholder: 'mydb', required: true, help: 'Name of the database to connect to' },
    { key: 'username', label: 'Username', placeholder: 'postgres', required: true, help: 'Database user with appropriate permissions' },
    { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password', required: true, help: 'Database password' },
  ],
  HTTP_API: [
    { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.example.com', required: true, help: 'The root URL of the API (e.g. https://api.openai.com/v1)' },
    { key: 'headerName', label: 'Auth Header Name', placeholder: 'X-API-Key', half: true, help: 'Name of the authentication header' },
    { key: 'apiKey', label: 'API Key / Token', placeholder: 'sk-...', type: 'password', half: true, help: 'The API key or bearer token value' },
  ],
  WEBHOOK: [
    { key: 'url', label: 'Webhook URL (optional)', placeholder: 'https://example.com/webhook', help: 'Leave empty to auto-generate a URL' },
    { key: 'secret', label: 'Secret (optional)', placeholder: 'HMAC signing secret', type: 'password', help: 'Used to verify webhook signatures (HMAC)' },
    { key: 'method', label: 'HTTP Method', placeholder: '', selectOptions: [{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }, { value: 'PUT', label: 'PUT' }], help: 'HTTP method the webhook expects' },
  ],
};

// ─── Helpers ─────────────────────────────────────────────

function getTypeMeta(type: IntegrationType) {
  return INTEGRATION_TYPES.find((t) => t.type === type)!;
}

function getDefaultName(type: IntegrationType): string {
  const names: Record<IntegrationType, string> = {
    SMTP: 'My SMTP Server',
    TELEGRAM: 'Telegram Bot',
    DATABASE: 'My Database',
    HTTP_API: 'HTTP API',
    WEBHOOK: 'My Webhook',
  };
  return names[type];
}

const STEPS: WizardStep[] = ['type', 'config', 'test', 'save'];
const STEP_LABELS: Record<WizardStep, string> = {
  type: 'Type',
  config: 'Configure',
  test: 'Test',
  save: 'Save',
};

// ─── Password Field Component ────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('pr-9', className)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ─── Main Wizard Component ───────────────────────────────

export function IntegrationWizard({
  open,
  onOpenChange,
  editIntegration,
}: IntegrationWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>(editIntegration ? 'config' : 'type');
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(
    (editIntegration?.type as IntegrationType) || null,
  );
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    if (editIntegration) {
      return { ...editIntegration.config } as Record<string, string>;
    }
    return {};
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [integrationName, setIntegrationName] = useState(editIntegration?.name || '');

  const resetWizard = useCallback(() => {
    setStep('type');
    setSelectedType(null);
    setFormData({});
    setFormErrors({});
    setIsVerifying(false);
    setVerifyResult(null);
    setIntegrationName('');
  }, []);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) resetWizard();
      onOpenChange(isOpen);
    },
    [onOpenChange, resetWizard],
  );

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ─── Validation ──────────────────────────────────────────

  const validateConfig = (): boolean => {
    if (!selectedType) return false;
    const fields = TYPE_FIELDS[selectedType];
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && !formData[field.key]?.trim()) {
        errors[field.key] = `${field.label} is required`;
      }
      if (field.type === 'number' && formData[field.key] && isNaN(Number(formData[field.key]))) {
        errors[field.key] = 'Must be a number';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Verify ──────────────────────────────────────────────

  const handleVerify = async () => {
    if (!selectedType) return;
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      let res: any;
      switch (selectedType) {
        case 'TELEGRAM':
          res = await api.post('/integrations/telegram/verify', {
            botToken: formData.botToken,
          });
          break;
        case 'SMTP':
          res = await api.post('/integrations/smtp/verify', {
            host: formData.host,
            port: parseInt(formData.port || '587'),
            user: formData.user,
            password: formData.password,
            secure: formData.secure === 'true' ? true : formData.secure === 'false' ? false : formData.port === '465',
          });
          break;
        case 'WEBHOOK':
          res = await api.post('/integrations/webhook/verify', {
            name: integrationName || formData.url || 'Webhook',
            url: formData.url,
          });
          break;
        case 'HTTP_API':
          res = await api.post('/integrations/http-api/verify', {
            baseUrl: formData.baseUrl,
            headers: formData.headerName && formData.apiKey
              ? { [formData.headerName]: formData.apiKey }
              : undefined,
          });
          break;
        case 'DATABASE': {
          const dbType = formData.dbType || 'postgres';
          const port = formData.port || (dbType === 'mysql' ? '3306' : '5432');
          const connStr = `${dbType === 'mysql' ? 'mysql' : 'postgresql'}://${formData.username}:${formData.password}@${formData.host}:${port}/${formData.database}`;
          res = await api.post('/integrations/database/verify', {
            connectionString: connStr,
          });
          break;
        }
      }
      const data = res?.data?.data || res?.data;
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ ok: false, message: getErrorMessage(err) });
    } finally {
      setIsVerifying(false);
    }
  };

  // ─── Save ────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/integrations', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration saved successfully');
      handleClose(false);
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const handleSave = () => {
    if (!selectedType) return;
    let name = integrationName || getDefaultName(selectedType);
    let config: Record<string, any> = {};
    let metadata: Record<string, any> = {};

    switch (selectedType) {
      case 'TELEGRAM':
        if (!integrationName && verifyResult?.botUsername) {
          name = `@${verifyResult.botUsername}`;
        }
        config = { botToken: formData.botToken };
        if (formData.chatId) config.chatId = formData.chatId;
        metadata = {
          botId: verifyResult?.botId,
          botName: verifyResult?.botName,
          botUsername: verifyResult?.botUsername,
          photoUrl: verifyResult?.photoUrl,
        };
        break;
      case 'SMTP':
        config = {
          host: formData.host,
          port: parseInt(formData.port || '587'),
          user: formData.user,
          password: formData.password,
          secure: formData.secure === 'true' ? true : formData.secure === 'false' ? false : undefined,
        };
        if (formData.from) config.from = formData.from;
        metadata = { message: verifyResult?.message };
        break;
      case 'WEBHOOK':
        config = {
          webhookUrl: verifyResult?.webhookUrl,
          secret: verifyResult?.secret || formData.secret,
          method: formData.method || 'POST',
        };
        if (formData.url) config.url = formData.url;
        metadata = { webhookUrl: verifyResult?.webhookUrl };
        break;
      case 'HTTP_API':
        config = {
          baseUrl: formData.baseUrl,
          headers: formData.headerName && formData.apiKey
            ? { [formData.headerName]: formData.apiKey }
            : {},
        };
        metadata = { statusCode: verifyResult?.statusCode, message: verifyResult?.message };
        break;
      case 'DATABASE': {
        const dbType = formData.dbType || 'postgres';
        const port = formData.port || (dbType === 'mysql' ? '3306' : '5432');
        config = {
          connectionString: `${dbType === 'mysql' ? 'mysql' : 'postgresql'}://${formData.username}:${formData.password}@${formData.host}:${port}/${formData.database}`,
          host: formData.host,
          port: parseInt(port),
          database: formData.database,
          username: formData.username,
          dbType,
        };
        metadata = { message: verifyResult?.message };
        break;
      }
    }

    createMutation.mutate({ type: selectedType, name, config, metadata });
  };

  // ─── Step Navigation ─────────────────────────────────────

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (step === 'config' && !validateConfig()) return;
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
      setVerifyResult(null);
    }
  };

  const selectType = (type: IntegrationType) => {
    setSelectedType(type);
    setFormData({});
    setFormErrors({});
    setVerifyResult(null);
    setIntegrationName('');
    setStep('config');
  };

  const stepIndex = STEPS.indexOf(step);

  // ─── Render ──────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {editIntegration ? 'Edit Integration' : 'Add Integration'}
          </DialogTitle>
          <DialogDescription>
            {step === 'type' && 'Choose the type of service you want to connect'}
            {step === 'config' && selectedType && `Configure your ${getTypeMeta(selectedType).label} connection`}
            {step === 'test' && 'Test the connection before saving'}
            {step === 'save' && 'Review and save your integration'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all',
                  i < stepIndex
                    ? 'bg-primary text-primary-foreground'
                    : i === stepIndex
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block',
                  i === stepIndex ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {STEP_LABELS[s]}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-1',
                    i < stepIndex ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* ─── Step 1: Type Selection ─── */}
        {step === 'type' && (
          <div className="grid gap-3 sm:grid-cols-2 mt-2">
            {INTEGRATION_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.type}
                  onClick={() => selectType(t.type)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md',
                    'hover:border-primary/50 hover:bg-accent/50',
                    selectedType === t.type
                      ? 'border-primary bg-primary/5'
                      : 'border-border',
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-11 h-11 rounded-lg flex-shrink-0',
                      t.bgColor,
                    )}
                  >
                    <Icon className={cn('h-5 w-5', t.color)} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Step 2: Configuration ─── */}
        {step === 'config' && selectedType && (
          <div className="space-y-4 mt-2">
            {/* Type badge */}
            <div className="flex items-center gap-2">
              {(() => {
                const meta = getTypeMeta(selectedType);
                const Icon = meta.icon;
                return (
                  <>
                    <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', meta.bgColor)}>
                      <Icon className={cn('h-4 w-4', meta.color)} />
                    </div>
                    <span className="text-sm font-semibold">{meta.label}</span>
                  </>
                );
              })()}
            </div>

            {/* Dynamic fields */}
            <div className="space-y-3">
              {(() => {
                const fields = TYPE_FIELDS[selectedType];
                const rendered: React.ReactNode[] = [];
                let i = 0;
                while (i < fields.length) {
                  const field = fields[i];
                  const next = fields[i + 1];
                  if (field.half && next?.half) {
                    rendered.push(
                      <div key={field.key} className="grid grid-cols-2 gap-3">
                        {renderField(field)}
                        {renderField(next)}
                      </div>,
                    );
                    i += 2;
                  } else {
                    rendered.push(
                      <div key={field.key}>{renderField(field)}</div>,
                    );
                    i++;
                  }
                }
                return rendered;
              })()}
            </div>
          </div>
        )}

        {/* ─── Step 3: Test Connection ─── */}
        {step === 'test' && selectedType && (
          <div className="flex flex-col items-center py-6 space-y-6">
            {!verifyResult && !isVerifying && (
              <>
                {(() => {
                  const meta = getTypeMeta(selectedType);
                  const Icon = meta.icon;
                  return (
                    <div className={cn('flex items-center justify-center w-20 h-20 rounded-2xl', meta.bgColor)}>
                      <Icon className={cn('h-10 w-10', meta.color)} />
                    </div>
                  );
                })()}
                <div className="text-center">
                  <p className="font-semibold text-lg">Ready to test</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click the button below to verify your {getTypeMeta(selectedType).label} connection
                  </p>
                </div>
                <Button
                  onClick={handleVerify}
                  size="lg"
                  className="px-8 gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Test Connection
                </Button>
              </>
            )}

            {isVerifying && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">
                  Testing connection...
                </p>
              </div>
            )}

            {verifyResult && (
              <div className="w-full space-y-4">
                <div
                  className={cn(
                    'flex items-start gap-4 rounded-xl border-2 p-5',
                    verifyResult.ok
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-red-500/30 bg-red-500/5',
                  )}
                >
                  {verifyResult.ok ? (
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 flex-shrink-0">
                      <CheckCircle className="h-7 w-7 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 flex-shrink-0">
                      <XCircle className="h-7 w-7 text-red-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-semibold', verifyResult.ok ? 'text-emerald-500' : 'text-red-500')}>
                      {verifyResult.ok ? 'Connection successful!' : 'Connection failed'}
                    </p>
                    {/* Telegram bot details */}
                    {selectedType === 'TELEGRAM' && verifyResult.ok && (
                      <div className="flex items-center gap-3 mt-2">
                        {verifyResult.photoUrl ? (
                          <img
                            src={verifyResult.photoUrl}
                            alt={verifyResult.botName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <Bot className="h-6 w-6 text-blue-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{verifyResult.botName}</p>
                          <p className="text-xs text-muted-foreground">@{verifyResult.botUsername}</p>
                        </div>
                      </div>
                    )}
                    {/* Webhook URL */}
                    {selectedType === 'WEBHOOK' && verifyResult.ok && verifyResult.webhookUrl && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">Webhook URL:</p>
                        <code className="text-xs font-mono break-all text-foreground">
                          {verifyResult.webhookUrl}
                        </code>
                      </div>
                    )}
                    {/* Generic message */}
                    {verifyResult.message && (
                      <p className="text-sm text-muted-foreground mt-1">{verifyResult.message}</p>
                    )}
                    {/* Error suggestion */}
                    {!verifyResult.ok && verifyResult.error && (
                      <p className="text-sm text-muted-foreground mt-1">{verifyResult.error}</p>
                    )}
                    {!verifyResult.ok && (
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Double-check your credentials and try again. Make sure the service is reachable from this server.
                      </p>
                    )}
                  </div>
                </div>
                {!verifyResult.ok && (
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={goBack}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Edit Configuration
                    </Button>
                    <Button onClick={handleVerify}>
                      Retry Test
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 4: Save ─── */}
        {step === 'save' && selectedType && (
          <div className="space-y-5 mt-2">
            {/* Name */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Integration Name
              </label>
              <Input
                value={integrationName}
                onChange={(e) => setIntegrationName(e.target.value)}
                placeholder={
                  selectedType === 'TELEGRAM' && verifyResult?.botUsername
                    ? `@${verifyResult.botUsername}`
                    : getDefaultName(selectedType)
                }
                className="h-10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A friendly name to identify this integration
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Configuration Summary
              </p>
              {(() => {
                const meta = getTypeMeta(selectedType);
                const Icon = meta.icon;
                return (
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', meta.bgColor)}>
                      <Icon className={cn('h-4.5 w-4.5', meta.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {verifyResult?.ok ? '✅ Connection verified' : '⚠️ Not tested'}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <div className="grid gap-1.5 text-sm pt-1">
                {selectedType === 'SMTP' && (
                  <>
                    <SummaryRow label="Server" value={`${formData.host}:${formData.port || '587'}`} />
                    <SummaryRow label="Username" value={formData.user} />
                  </>
                )}
                {selectedType === 'TELEGRAM' && verifyResult?.ok && (
                  <>
                    <SummaryRow label="Bot" value={`@${verifyResult.botUsername}`} />
                    <SummaryRow label="Name" value={verifyResult.botName} />
                  </>
                )}
                {selectedType === 'DATABASE' && (
                  <>
                    <SummaryRow label="Type" value={(formData.dbType || 'postgres').toUpperCase()} />
                    <SummaryRow label="Host" value={`${formData.host}:${formData.port}`} />
                    <SummaryRow label="Database" value={formData.database} />
                  </>
                )}
                {selectedType === 'HTTP_API' && (
                  <>
                    <SummaryRow label="URL" value={formData.baseUrl} />
                    {formData.headerName && (
                      <SummaryRow label="Auth Header" value={formData.headerName} />
                    )}
                  </>
                )}
                {selectedType === 'WEBHOOK' && (
                  <>
                    {verifyResult?.webhookUrl && (
                      <SummaryRow label="URL" value={verifyResult.webhookUrl} truncate />
                    )}
                    <SummaryRow label="Method" value={formData.method || 'POST'} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Footer ─── */}
        {step !== 'type' && (
          <div className="flex justify-between pt-2 border-t">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 'config' && !editIntegration}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              {step === 'config' && (
                <Button onClick={goNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === 'test' && verifyResult?.ok && (
                <Button onClick={goNext}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === 'save' && (
                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending}
                  className="gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Integration
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  // ─── Field Renderer ────────────────────────────────────

  function renderField(field: FieldDef) {
    const value = formData[field.key] || '';
    const error = formErrors[field.key];

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          {field.help && (
            <HelpTooltip
              content={field.help}
              linkUrl={field.helpUrl}
              linkText={field.helpLinkText}
            />
          )}
        </div>

        {field.selectOptions ? (
          <select
            value={value || field.selectOptions[0]?.value || ''}
            onChange={(e) => updateField(field.key, e.target.value)}
            className={cn(
              'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-ring focus-visible:ring-offset-2',
              error && 'border-destructive',
            )}
          >
            {field.selectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === 'password' ? (
          <PasswordInput
            value={value}
            onChange={(v) => updateField(field.key, v)}
            placeholder={field.placeholder}
            className={cn('h-9', error && 'border-destructive')}
          />
        ) : (
          <Input
            type={field.type || 'text'}
            value={value}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={cn('h-9', error && 'border-destructive')}
          />
        )}

        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }
}

// ─── Summary Row Helper ──────────────────────────────────

function SummaryRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value?: string;
  truncate?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-sm font-medium text-right', truncate && 'truncate max-w-[250px]')}>
        {value}
      </span>
    </div>
  );
}
