'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useEditorStore } from '@/stores/editor-store';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, Settings2, Copy, Check, Zap, MessageSquare, Reply } from 'lucide-react';

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password' | 'number';
  inputType?: 'input' | 'textarea' | 'select' | 'code';
  options?: Array<{ value: string; label: string; description?: string }>;
  required?: boolean;
  hint?: string;
  readOnly?: boolean;
  rows?: number;
  hidden?: boolean;
}

const TRIGGER_FIELDS: Record<string, Array<ConfigField>> = {
  WEBHOOK: [
    { key: 'secret', label: 'Secret (optional)', placeholder: 'HMAC secret for signature validation' },
  ],
  CRON: [
    { key: 'cronExpression', label: 'Cron Expression', placeholder: '*/5 * * * *', required: true },
    { key: 'timezone', label: 'Timezone', placeholder: 'UTC' },
  ],
  EMAIL: [
    { key: 'integrationId', label: 'Email Server', placeholder: 'Use default server', inputType: 'select', options: [], hint: 'Select SMTP integration for IMAP settings' },
    { key: 'imapHost', label: 'IMAP Host', placeholder: 'imap.gmail.com', required: true },
    { key: 'imapPort', label: 'IMAP Port', placeholder: '993' },
    { key: 'imapUser', label: 'IMAP Username', placeholder: 'user@gmail.com', required: true },
    { key: 'imapPassword', label: 'IMAP Password', placeholder: '••••••••', type: 'password', required: true },
    { key: 'filter', label: 'Subject Filter (optional)', placeholder: 'Order*' },
  ],
  TELEGRAM: [
    { key: 'integrationId', label: 'Telegram Bot', placeholder: 'Select a bot...', inputType: 'select', required: true, options: [], hint: 'Go to Integrations to add a Telegram bot first' },
    { key: 'eventType', label: 'Event Type', placeholder: 'Select event...', inputType: 'select', required: true, options: [
      { value: 'command_start', label: '🚀 /start command' },
      { value: 'command_help', label: '❓ /help command' },
      { value: 'command', label: '⌨️ Any command (/, /help, /custom...)' },
      { value: 'message', label: '💬 Text message (not commands)' },
      { value: 'callback_query', label: '🔘 Button click (callback)' },
      { value: 'any', label: '📨 Any event' },
    ], hint: 'What type of message should trigger this workflow?' },
  ],
};

const ACTION_FIELDS: Record<string, Array<ConfigField>> = {
  HTTP_REQUEST: [
    { key: 'integrationId', label: 'API Integration', placeholder: 'Configure manually', inputType: 'select', options: [], hint: 'Select HTTP API integration or configure manually below' },
    { key: 'url', label: 'URL', placeholder: 'https://api.example.com/data', required: true, hint: 'Supports {{template}} variables' },
    { key: 'method', label: 'Method', placeholder: 'GET', inputType: 'select', options: [
      { value: 'GET', label: 'GET' },
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
      { value: 'DELETE', label: 'DELETE' },
      { value: 'PATCH', label: 'PATCH' },
    ] },
    { key: 'headers', label: 'Headers', placeholder: '{"Authorization": "Bearer ..."}', inputType: 'textarea', rows: 3, hint: 'JSON object with header key-value pairs' },
    { key: 'body', label: 'Body', placeholder: '{"key": "value"}', inputType: 'textarea', rows: 4, hint: 'JSON request body' },
    { key: 'timeout', label: 'Timeout (ms)', placeholder: '30000', type: 'number', hint: 'Request timeout in milliseconds' },
  ],
  SEND_EMAIL: [
    { key: 'integrationId', label: 'SMTP Server', placeholder: 'Use default server', inputType: 'select', options: [], hint: 'Select SMTP integration or leave empty for default' },
    { key: 'to', label: 'To', placeholder: 'user@example.com', required: true, hint: 'Comma-separated for multiple recipients' },
    { key: 'cc', label: 'CC', placeholder: 'cc@example.com', hint: 'Comma-separated' },
    { key: 'bcc', label: 'BCC', placeholder: 'bcc@example.com', hint: 'Comma-separated' },
    { key: 'subject', label: 'Subject', placeholder: 'Notification: {{trigger.event}}', required: true, hint: 'Supports {{template}} variables' },
    { key: 'body', label: 'Body', placeholder: 'Hello {{trigger.name}},\n\nYour order has been processed.', inputType: 'textarea', rows: 5, hint: 'Supports {{template}} variables' },
    { key: 'isHtml', label: 'Format', inputType: 'select', placeholder: '', options: [
      { value: 'false', label: 'Plain Text' },
      { value: 'true', label: 'HTML' },
    ] },
  ],
  TELEGRAM: [
    { key: 'integrationId', label: 'Telegram Bot', placeholder: 'Select a bot...', inputType: 'select', required: true, options: [], hint: 'Select from your integrations' },
    { key: 'chatId', label: 'Chat ID', placeholder: 'Auto from trigger', hint: 'Leave empty to reply to the user who triggered this workflow' },
    { key: 'message', label: 'Message', placeholder: 'Привет, {{trigger.from.first_name}}! 👋\n\nДобро пожаловать!', inputType: 'textarea', rows: 4, required: true, hint: 'Supports {{template}} variables — see list below' },
    { key: 'parseMode', label: 'Parse Mode', inputType: 'select', placeholder: '', options: [
      { value: 'HTML', label: 'HTML' },
      { value: 'Markdown', label: 'Markdown' },
      { value: 'MarkdownV2', label: 'MarkdownV2' },
    ] },
  ],
  DATABASE: [
    { key: 'integrationId', label: 'Database Connection', placeholder: 'Select database', inputType: 'select', options: [], hint: 'Select database integration from Integrations page' },
    { key: 'operation', label: 'Operation', placeholder: 'SELECT', inputType: 'select', readOnly: true, options: [
      { value: 'SELECT', label: 'SELECT' },
    ] },
    { key: 'table', label: 'Table', placeholder: 'Select table', inputType: 'select', options: [
      { value: 'workflows', label: 'workflows' },
      { value: 'workflow_versions', label: 'workflow_versions' },
      { value: 'triggers', label: 'triggers' },
      { value: 'workflow_executions', label: 'workflow_executions' },
      { value: 'execution_step_logs', label: 'execution_step_logs' },
    ] },
    { key: 'where', label: 'Where', placeholder: '{"status": "active"}', inputType: 'textarea', rows: 2, hint: 'JSON filter conditions' },
    { key: 'orderBy', label: 'Order By', placeholder: 'created_at DESC' },
    { key: 'limit', label: 'Limit', placeholder: '100', type: 'number' },
  ],
  TRANSFORM: [
    { key: 'expression', label: 'JSONata Expression', placeholder: '$.data.items[price > 100]', inputType: 'code', rows: 5, required: true, hint: 'JSONata expression — see docs.jsonata.org' },
  ],
};

const CRON_EXAMPLES = [
  { expr: '* * * * *', desc: 'Every minute' },
  { expr: '*/5 * * * *', desc: 'Every 5 minutes' },
  { expr: '0 * * * *', desc: 'Every hour' },
  { expr: '0 9 * * 1-5', desc: 'Weekdays at 9:00' },
];

// Template variables available from Telegram trigger
const TELEGRAM_TEMPLATE_VARS = [
  { var: '{{trigger.from.first_name}}', desc: 'Имя пользователя', example: 'Иван' },
  { var: '{{trigger.from.username}}', desc: 'Username (@...)', example: 'ivan123' },
  { var: '{{trigger.text}}', desc: 'Текст сообщения', example: '/start' },
  { var: '{{trigger.chat.id}}', desc: 'ID чата', example: '123456789' },
  { var: '{{trigger.command}}', desc: 'Команда (без /)', example: 'start' },
  { var: '{{trigger.commandArgs}}', desc: 'Аргументы команды', example: 'arg1 arg2' },
];

// Message templates for quick start
const TELEGRAM_MESSAGE_TEMPLATES = [
  { label: '👋 Приветствие /start', text: 'Привет, {{trigger.from.first_name}}! 👋\n\nЯ бот, созданный через Mini-Zapier.\nОтправь /help чтобы узнать что я умею.' },
  { label: '❓ Ответ на /help', text: '📋 Доступные команды:\n\n/start — Начать\n/help — Помощь\n\nИли просто отправь мне сообщение!' },
  { label: '💬 Эхо-ответ', text: 'Ты написал: {{trigger.text}}\n\nОтправитель: {{trigger.from.first_name}} (@{{trigger.from.username}})' },
  { label: '🔔 Уведомление', text: '🔔 Новое сообщение от {{trigger.from.first_name}}:\n\n{{trigger.text}}' },
];

export function NodeConfigPanel() {
  const { selectedNode, updateNodeData, setSelectedNode, nodes } = useEditorStore();
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Fetch integrations for node dropdowns (Telegram, SMTP, HTTP API, Database)
  const { data: integrations = [] } = useQuery<Array<{ id: string; name: string; type: string }>>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await api.get('/integrations');
      return res.data.data || res.data;
    },
    staleTime: 30000,
  });

  if (!selectedNode) return null;

  const nodeType = selectedNode.data?.type as string;
  // Use ReactFlow node type to distinguish trigger vs action (not data.type which can be ambiguous e.g. TELEGRAM)
  const isTrigger = selectedNode.type === 'triggerNode';
  let fields = isTrigger ? TRIGGER_FIELDS[nodeType] : ACTION_FIELDS[nodeType];

  // Check if workflow has a Telegram trigger (for smart defaults in action)
  const hasTelegramTrigger = nodes.some(
    (n) => n.type === 'triggerNode' && (n.data?.type === 'TELEGRAM'),
  );

  // Inject bot options into TELEGRAM trigger integrationId field
  if (nodeType === 'TELEGRAM' && isTrigger && fields) {
    const telegramBots = integrations.filter((i) => i.type === 'TELEGRAM');
    fields = fields.map((f) =>
      f.key === 'integrationId'
        ? {
            ...f,
            options: telegramBots.map((b) => ({ value: b.id, label: b.name })),
            hint: telegramBots.length === 0
              ? '⚠️ Нет ботов. Перейдите в Интеграции → Добавить Telegram бота'
              : 'Выберите бота для этого триггера',
          }
        : f,
    );
  }

  // Inject SMTP options into EMAIL trigger integrationId field
  if (nodeType === 'EMAIL' && isTrigger && fields) {
    const smtpIntegrations = integrations.filter((i) => i.type === 'SMTP');
    fields = fields.map((f) =>
      f.key === 'integrationId'
        ? {
            ...f,
            options: [
              { value: '', label: '🔧 Manual configuration' },
              ...smtpIntegrations.map((s) => ({ value: s.id, label: `📧 ${s.name}` })),
            ],
            hint: smtpIntegrations.length === 0
              ? 'Configure IMAP settings manually below'
              : 'Select preset or configure manually',
          }
        : f,
    );
  }

  // Inject bot options into TELEGRAM action integrationId field
  if (nodeType === 'TELEGRAM' && !isTrigger && fields) {
    const telegramBots = integrations.filter((i) => i.type === 'TELEGRAM');
    fields = fields.map((f) => {
      if (f.key === 'integrationId') {
        return {
          ...f,
          options: telegramBots.map((b) => ({ value: b.id, label: b.name })),
          hint: telegramBots.length === 0
            ? '⚠️ Нет ботов. Добавьте на странице Интеграции'
            : hasTelegramTrigger
              ? 'Выберите того же бота что и в триггере'
              : 'Выберите бота для отправки сообщений',
        };
      }
      return f;
    });
  }

  // Inject SMTP integration options into SEND_EMAIL action
  if (nodeType === 'SEND_EMAIL' && !isTrigger && fields) {
    const smtpIntegrations = integrations.filter((i) => i.type === 'SMTP');
    fields = fields.map((f) =>
      f.key === 'integrationId'
        ? {
            ...f,
            options: [
              { value: '', label: '🔧 Default (server settings)' },
              ...smtpIntegrations.map((s) => ({ value: s.id, label: `📧 ${s.name}` })),
            ],
            hint: smtpIntegrations.length === 0
              ? 'Uses default server SMTP. Add SMTP in Integrations for custom servers'
              : 'Select SMTP server or use default',
          }
        : f,
    );
  }

  // Inject HTTP API integration options into HTTP_REQUEST action
  if (nodeType === 'HTTP_REQUEST' && !isTrigger && fields) {
    const httpIntegrations = integrations.filter((i) => i.type === 'HTTP_API');
    fields = fields.map((f) =>
      f.key === 'integrationId'
        ? {
            ...f,
            options: [
              { value: '', label: '🔧 Configure manually' },
              ...httpIntegrations.map((h) => ({ value: h.id, label: `🌐 ${h.name}` })),
            ],
            hint: httpIntegrations.length === 0
              ? 'Configure URL and headers manually below'
              : 'Select API preset or configure manually',
          }
        : f,
    );
  }

  // Inject Database integration options into DATABASE action
  if (nodeType === 'DATABASE' && !isTrigger && fields) {
    const dbIntegrations = integrations.filter((i) => i.type === 'DATABASE');
    fields = fields.map((f) =>
      f.key === 'integrationId'
        ? {
            ...f,
            options: [
              ...dbIntegrations.map((d) => ({ value: d.id, label: `🗄️ ${d.name}` })),
            ],
            hint: dbIntegrations.length === 0
              ? '⚠️ No databases. Go to Integrations → Add Database'
              : 'Select database connection',
          }
        : f,
    );
  }

  const config = (selectedNode.data?.config as Record<string, string>) || {};

  // Auto-initialize select fields with first option when config is empty
  const initRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fields || initRef.current === selectedNode.id) return;
    initRef.current = selectedNode.id;
    const updates: Record<string, string> = {};
    for (const field of fields) {
      if (field.inputType === 'select' && field.options && field.options.length > 0 && !config[field.key]) {
        updates[field.key] = field.options[0].value;
      }
    }
    if (Object.keys(updates).length > 0) {
      updateNodeData(selectedNode.id, { config: { ...config, ...updates } });
    }
  }, [selectedNode.id, fields, config, updateNodeData]);

  const handleChange = (key: string, value: string) => {
    updateNodeData(selectedNode.id, {
      config: { ...config, [key]: value },
    });
  };

  const insertTemplate = (template: string) => {
    const current = config['message'] || '';
    const newText = current ? `${current}\n${template}` : template;
    handleChange('message', newText);
  };

  const webhookUrl = nodeType === 'WEBHOOK' && selectedNode.data?.triggerId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/${selectedNode.data.triggerId}`
    : null;

  const handleCopyWebhook = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if this is a Telegram action connected to a Telegram trigger
  const isTelegramAction = nodeType === 'TELEGRAM' && !isTrigger;

  return (
    <div className="w-80 border-l bg-card overflow-y-auto shrink-0 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{selectedNode.data?.label as string}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {isTrigger ? '⚡ Триггер' : '▶️ Действие'} · {nodeType}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setSelectedNode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* General section */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Общее</p>
          <label className="text-xs font-medium">Название ноды</label>
          <Input
            className="mt-1 h-8 text-sm"
            value={(selectedNode.data?.label as string) || ''}
            onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
          />
        </div>

        {/* Webhook URL display */}
        {nodeType === 'WEBHOOK' && webhookUrl && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Webhook URL</p>
            <div className="flex gap-1">
              <Input
                className="h-8 text-xs font-mono bg-muted"
                value={webhookUrl}
                readOnly
              />
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleCopyWebhook}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )}

        {/* Telegram Trigger: How it works info */}
        {nodeType === 'TELEGRAM' && isTrigger && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-sky-500" />
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">Как работает</p>
            </div>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 leading-relaxed">
              Выберите бота и тип события. Когда пользователь отправит боту сообщение 
              соответствующего типа — workflow запустится автоматически.
            </p>
          </div>
        )}

        {/* Telegram Action: Auto-reply info */}
        {isTelegramAction && hasTelegramTrigger && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Reply className="h-3.5 w-3.5 text-green-500" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-300">Авто-ответ</p>
            </div>
            <p className="text-[11px] text-green-600 dark:text-green-400 leading-relaxed">
              Chat ID определяется автоматически из триггера — бот ответит тому пользователю, 
              который написал сообщение. Поле Chat ID можно оставить пустым.
            </p>
          </div>
        )}

        {/* Configuration section */}
        {fields && fields.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Настройки</p>
            <div className="space-y-3">
              {fields.filter((f) => !f.hidden).map((field) => {
                const value = config[field.key] || '';
                const hasError = field.required && !value;
                const isNumberErr = field.type === 'number' && value !== '' && isNaN(Number(value));

                return (
                  <div key={field.key}>
                    <label className="text-xs font-medium">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>

                    {field.inputType === 'select' && field.options ? (
                      <Select
                        className={cn('mt-1 h-8 text-sm', hasError && 'border-destructive/50')}
                        value={value || field.options[0]?.value || ''}
                        options={field.options}
                        disabled={field.readOnly}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      />
                    ) : field.inputType === 'textarea' || field.inputType === 'code' ? (
                      <Textarea
                        className={cn(
                          'mt-1 text-sm',
                          field.inputType === 'code' && 'font-mono text-xs',
                          hasError && 'border-destructive/50',
                        )}
                        rows={field.rows || 3}
                        placeholder={field.placeholder}
                        value={value}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      />
                    ) : (
                      <Input
                        className={cn('mt-1 h-8 text-sm', (hasError || isNumberErr) && 'border-destructive/50')}
                        type={field.type || 'text'}
                        placeholder={field.placeholder}
                        value={value}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      />
                    )}

                    {field.hint && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{field.hint}</p>
                    )}
                    {hasError && (
                      <p className="text-[10px] text-destructive mt-0.5">{field.label} is required</p>
                    )}
                    {isNumberErr && (
                      <p className="text-[10px] text-destructive mt-0.5">Must be a number</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cron helper */}
            {nodeType === 'CRON' && (
              <div className="mt-3 rounded-md bg-muted p-2">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Examples:</p>
                <div className="space-y-0.5">
                  {CRON_EXAMPLES.map((ex) => (
                    <button
                      key={ex.expr}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-[11px] hover:bg-background transition-colors"
                      onClick={() => handleChange('cronExpression', ex.expr)}
                    >
                      <code className="font-mono text-[10px] text-primary">{ex.expr}</code>
                      <span className="text-muted-foreground">{ex.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Telegram trigger: Available data info */}
            {nodeType === 'TELEGRAM' && isTrigger && (
              <div className="mt-3 rounded-md bg-muted/50 p-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                  📤 Данные триггера для Action-нод:
                </p>
                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                  <p><code className="font-mono text-primary">{'{{trigger.text}}'}</code> — текст сообщения</p>
                  <p><code className="font-mono text-primary">{'{{trigger.chat.id}}'}</code> — ID чата</p>
                  <p><code className="font-mono text-primary">{'{{trigger.from.first_name}}'}</code> — имя</p>
                  <p><code className="font-mono text-primary">{'{{trigger.command}}'}</code> — команда</p>
                </div>
              </div>
            )}

            {/* Telegram action: Message templates */}
            {isTelegramAction && (
              <>
                <div className="mt-3">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    onClick={() => setShowTemplates(!showTemplates)}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {showTemplates ? 'Скрыть шаблоны' : '📝 Шаблоны сообщений'}
                  </button>
                  {showTemplates && (
                    <div className="mt-2 space-y-1.5">
                      {TELEGRAM_MESSAGE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.label}
                          type="button"
                          className="flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[11px] hover:bg-muted hover:border-border transition-colors"
                          onClick={() => handleChange('message', tpl.text)}
                        >
                          <span className="font-medium shrink-0">{tpl.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Telegram template variables clickable */}
                <div className="mt-3 rounded-md bg-muted/50 p-2.5">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                    🔗 Переменные (нажмите чтобы вставить):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {TELEGRAM_TEMPLATE_VARS.map((v) => (
                      <button
                        key={v.var}
                        type="button"
                        className="inline-flex items-center rounded border bg-background px-1.5 py-0.5 font-mono text-[9px] text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                        title={`${v.desc} (пример: ${v.example})`}
                        onClick={() => insertTemplate(v.var)}
                      >
                        {v.var.replace(/[{}]/g, '').replace('trigger.', '')}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5">
                    Нажмите на переменную — она добавится в поле Message
                  </p>
                </div>
              </>
            )}

            {/* Generic template variables reference for non-Telegram action nodes */}
            {!isTrigger && !isTelegramAction && (
              <div className="mt-2 rounded-md bg-muted/50 p-2">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">
                  Template Variables
                </p>
                <div className="space-y-0.5 text-[10px] text-muted-foreground font-mono">
                  <p>{'{{trigger.field}}'}</p>
                  <p>{'{{steps.nodeId.output.field}}'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes section */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Заметки</p>
          <Input
            className="h-8 text-sm"
            placeholder="Необязательное описание"
            value={(selectedNode.data?.description as string) || ''}
            onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
