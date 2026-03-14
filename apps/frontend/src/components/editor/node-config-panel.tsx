'use client';

import { useEditorStore } from '@/stores/editor-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Settings2 } from 'lucide-react';

const TRIGGER_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  WEBHOOK: [
    { key: 'path', label: 'Webhook Path', placeholder: '/my-webhook' },
    { key: 'secret', label: 'Secret (optional)', placeholder: 'hmac-secret' },
  ],
  CRON: [
    { key: 'expression', label: 'Cron Expression', placeholder: '*/5 * * * *' },
    { key: 'timezone', label: 'Timezone', placeholder: 'UTC' },
  ],
  EMAIL: [
    { key: 'imapHost', label: 'IMAP Host', placeholder: 'imap.gmail.com' },
    { key: 'imapPort', label: 'IMAP Port', placeholder: '993' },
    { key: 'filter', label: 'Subject Filter', placeholder: 'Order*' },
  ],
};

const ACTION_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  HTTP_REQUEST: [
    { key: 'url', label: 'URL', placeholder: 'https://api.example.com/data' },
    { key: 'method', label: 'Method', placeholder: 'GET' },
    { key: 'headers', label: 'Headers (JSON)', placeholder: '{"Authorization": "Bearer ..."}' },
    { key: 'body', label: 'Body (JSON)', placeholder: '{}' },
  ],
  SEND_EMAIL: [
    { key: 'to', label: 'To', placeholder: 'user@example.com' },
    { key: 'subject', label: 'Subject', placeholder: 'Notification' },
    { key: 'body', label: 'Body', placeholder: 'Hello {{name}}' },
  ],
  TELEGRAM: [
    { key: 'chatId', label: 'Chat ID', placeholder: '123456789' },
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

export function NodeConfigPanel() {
  const { selectedNode, updateNodeData, setSelectedNode } = useEditorStore();

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

        {/* Configuration section */}
        {fields && fields.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Configuration</p>
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium">{field.label}</label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    placeholder={field.placeholder}
                    value={config[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
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
