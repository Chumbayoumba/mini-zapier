'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, Settings2, Copy, Check } from 'lucide-react';

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password' | 'number';
  inputType?: 'input' | 'textarea' | 'select' | 'code';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hint?: string;
  readOnly?: boolean;
  rows?: number;
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
    { key: 'imapHost', label: 'IMAP Host', placeholder: 'imap.gmail.com', required: true },
    { key: 'imapPort', label: 'IMAP Port', placeholder: '993' },
    { key: 'imapUser', label: 'IMAP Username', placeholder: 'user@gmail.com', required: true },
    { key: 'imapPassword', label: 'IMAP Password', placeholder: '••••••••', type: 'password', required: true },
    { key: 'filter', label: 'Subject Filter (optional)', placeholder: 'Order*' },
  ],
};

const ACTION_FIELDS: Record<string, Array<ConfigField>> = {
  HTTP_REQUEST: [
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
    { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF1234...', type: 'password', required: true, hint: 'Get from @BotFather on Telegram' },
    { key: 'chatId', label: 'Chat ID', placeholder: '123456789', required: true, hint: 'Numeric chat or group ID' },
    { key: 'message', label: 'Message', placeholder: '🔔 Alert: {{trigger.data}}', inputType: 'textarea', rows: 4, required: true, hint: 'Max 4096 characters. Supports {{template}} variables' },
    { key: 'parseMode', label: 'Parse Mode', inputType: 'select', placeholder: '', options: [
      { value: 'HTML', label: 'HTML' },
      { value: 'Markdown', label: 'Markdown' },
      { value: 'MarkdownV2', label: 'MarkdownV2' },
    ] },
  ],
  DATABASE: [
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

export function NodeConfigPanel() {
  const { selectedNode, updateNodeData, setSelectedNode } = useEditorStore();
  const [copied, setCopied] = useState(false);

  if (!selectedNode) return null;

  const nodeType = selectedNode.data?.type as string;
  const isTrigger = ['WEBHOOK', 'CRON', 'EMAIL'].includes(nodeType);
  const fields = isTrigger ? TRIGGER_FIELDS[nodeType] : ACTION_FIELDS[nodeType];
  const config = (selectedNode.data?.config as Record<string, string>) || {};

  const handleChange = (key: string, value: string) => {
    updateNodeData(selectedNode.id, {
      config: { ...config, [key]: value },
    });
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

  return (
    <div className="w-72 border-l bg-card overflow-y-auto shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{selectedNode.data?.label as string}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{nodeType}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setSelectedNode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* General section */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">General</p>
          <label className="text-xs font-medium">Node Label</label>
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

        {/* Configuration section */}
        {fields && fields.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Configuration</p>
            <div className="space-y-3">
              {fields.map((field) => {
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

            {/* Template variables reference for action nodes */}
            {!isTrigger && (
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
          <Input
            className="h-8 text-sm"
            placeholder="Optional description"
            value={(selectedNode.data?.description as string) || ''}
            onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
