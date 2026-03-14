'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Settings2, Copy, Check } from 'lucide-react';

const TRIGGER_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string; type?: string; required?: boolean }>> = {
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

const ACTION_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string; type?: string; required?: boolean }>> = {
  HTTP_REQUEST: [
    { key: 'url', label: 'URL', placeholder: 'https://api.example.com/data', required: true },
    { key: 'method', label: 'Method', placeholder: 'GET' },
    { key: 'headers', label: 'Headers (JSON)', placeholder: '{"Authorization": "Bearer ..."}' },
    { key: 'body', label: 'Body (JSON)', placeholder: '{}' },
  ],
  SEND_EMAIL: [
    { key: 'to', label: 'To', placeholder: 'user@example.com', required: true },
    { key: 'subject', label: 'Subject', placeholder: 'Notification' },
    { key: 'body', label: 'Body', placeholder: 'Hello {{name}}' },
  ],
  TELEGRAM: [
    { key: 'chatId', label: 'Chat ID', placeholder: '123456789', required: true },
    { key: 'message', label: 'Message', placeholder: 'Alert: {{data}}' },
  ],
  DATABASE: [
    { key: 'operation', label: 'Operation', placeholder: 'SELECT' },
    { key: 'table', label: 'Table', placeholder: 'users' },
    { key: 'query', label: 'Query (for RAW)', placeholder: 'SELECT * FROM ...' },
  ],
  TRANSFORM: [
    { key: 'expression', label: 'JSONata Expression', placeholder: '$.data.items[price > 100]' },
    { key: 'outputVariable', label: 'Output Variable', placeholder: 'filteredItems' },
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
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  <Input
                    className={`mt-1 h-8 text-sm ${field.required && !config[field.key] ? 'border-destructive/50' : ''}`}
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={config[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                </div>
              ))}
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
