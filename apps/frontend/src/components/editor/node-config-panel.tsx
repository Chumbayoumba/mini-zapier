'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useEditorStore } from '@/stores/editor-store';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';
import { validateNodeField } from '@/lib/node-validation';
import { testIntegration } from '@/lib/integration-test';
import { IntegrationWizard } from '@/components/integrations/integration-wizard';
import { X, Settings2, Copy, Check, Zap, MessageSquare, Reply, Plus, Loader2 } from 'lucide-react';

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
    { key: 'integrationId', label: 'Webhook Endpoint', placeholder: 'Select webhook...', inputType: 'select', options: [], hint: 'Select a webhook from Integrations or use auto-generated URL' },
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
    { key: 'toMode', label: 'Recipient Mode', placeholder: '', inputType: 'select', options: [
      { value: 'manual', label: '✉️ Enter email manually' },
      { value: 'auto_reply', label: '↩️ Auto-reply to trigger sender' },
    ], hint: 'Auto-reply sends to the person who triggered the workflow' },
    { key: 'to', label: 'To', placeholder: 'user@example.com', required: true, hint: 'Comma-separated for multiple recipients' },
    { key: 'cc', label: 'CC', placeholder: 'cc@example.com', hint: 'Comma-separated' },
    { key: 'bcc', label: 'BCC', placeholder: 'bcc@example.com', hint: 'Comma-separated' },
    { key: 'subject', label: 'Subject', placeholder: 'Re: {{trigger.subject}}', required: true, hint: 'Email subject line — use {{trigger.subject}} to include original subject' },
    { key: 'body', label: 'Body', placeholder: 'Hello {{trigger.name}},\n\nYour order has been processed.', inputType: 'textarea', rows: 5, hint: 'Supports {{template}} variables' },
    { key: 'isHtml', label: 'Format', inputType: 'select', placeholder: '', options: [
      { value: 'false', label: 'Plain Text' },
      { value: 'true', label: 'HTML' },
    ] },
  ],
  TELEGRAM: [
    { key: 'integrationId', label: 'Telegram Bot', placeholder: 'Select a bot...', inputType: 'select', options: [], hint: 'Select from your integrations' },
    { key: 'chatId', label: 'Chat ID', placeholder: 'Auto from trigger', hint: 'Leave empty to reply to the user who triggered this workflow' },
    { key: 'message', label: 'Message (leave empty to use previous node output)', placeholder: 'Leave empty to auto-use AI response', inputType: 'textarea', rows: 4, hint: 'Supports {{template}} variables — see list below' },
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
  OPENAI: [
    { key: 'integrationId', label: 'OpenAI Credential', placeholder: 'Select credential...', inputType: 'select', options: [], hint: 'Select from Credentials page or enter API key below' },
    { key: 'apiKey', label: 'API Key (if no credential)', placeholder: 'sk-...', type: 'password', hint: 'Used only if no credential selected above' },
    { key: 'operation', label: 'Operation', placeholder: '', inputType: 'select', options: [
      { value: 'chat', label: '💬 Chat Completion' },
      { value: 'image', label: '🎨 Image Generation (DALL-E)' },
    ] },
    { key: 'model', label: 'Model', placeholder: '', inputType: 'select', options: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ] },
    { key: 'systemPrompt', label: 'System Prompt', placeholder: 'You are a helpful assistant...', inputType: 'textarea', rows: 3, hint: 'Sets the behavior of the AI' },
    { key: 'userPrompt', label: 'User Prompt', placeholder: '{{trigger.text}}', inputType: 'textarea', rows: 3, hint: 'Supports {{template}} variables' },
    { key: 'temperature', label: 'Temperature', placeholder: '0.7', type: 'number', hint: '0 = deterministic, 2 = creative' },
    { key: 'maxTokens', label: 'Max Tokens', placeholder: '1024', type: 'number' },
    { key: 'responseFormat', label: 'Response Format', placeholder: '', inputType: 'select', options: [
      { value: 'text', label: 'Text' },
      { value: 'json', label: 'JSON Object' },
    ] },
  ],
  ANTHROPIC: [
    { key: 'integrationId', label: 'Anthropic Credential', placeholder: 'Select credential...', inputType: 'select', options: [], hint: 'Select from Credentials page or enter API key below' },
    { key: 'apiKey', label: 'API Key (if no credential)', placeholder: 'sk-ant-...', type: 'password', hint: 'Used only if no credential selected above' },
    { key: 'model', label: 'Model', placeholder: '', inputType: 'select', options: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ] },
    { key: 'systemPrompt', label: 'System Prompt', placeholder: 'You are a helpful assistant...', inputType: 'textarea', rows: 3 },
    { key: 'userPrompt', label: 'User Prompt', placeholder: '{{trigger.text}}', inputType: 'textarea', rows: 3, hint: 'Supports {{template}} variables' },
    { key: 'temperature', label: 'Temperature', placeholder: '0.7', type: 'number' },
    { key: 'maxTokens', label: 'Max Tokens', placeholder: '1024', type: 'number' },
  ],
  MISTRAL: [
    { key: 'integrationId', label: 'Mistral Credential', placeholder: 'Select credential...', inputType: 'select', options: [], hint: 'Select from Credentials page or enter API key below' },
    { key: 'apiKey', label: 'API Key (if no credential)', placeholder: 'your-mistral-key', type: 'password', hint: 'Used only if no credential selected above' },
    { key: 'model', label: 'Model', placeholder: '', inputType: 'select', options: [
      { value: 'mistral-large-latest', label: 'Mistral Large' },
      { value: 'mistral-medium-latest', label: 'Mistral Medium' },
      { value: 'mistral-small-latest', label: 'Mistral Small' },
      { value: 'open-mistral-nemo', label: 'Mistral Nemo (Open)' },
    ] },
    { key: 'systemPrompt', label: 'System Prompt', placeholder: 'You are a helpful assistant...', inputType: 'textarea', rows: 3 },
    { key: 'userPrompt', label: 'User Prompt', placeholder: '{{trigger.text}}', inputType: 'textarea', rows: 3, hint: 'Supports {{template}} variables' },
    { key: 'temperature', label: 'Temperature', placeholder: '0.7', type: 'number' },
    { key: 'maxTokens', label: 'Max Tokens', placeholder: '1024', type: 'number' },
    { key: 'responseFormat', label: 'Response Format', placeholder: '', inputType: 'select', options: [
      { value: 'text', label: 'Text' },
      { value: 'json', label: 'JSON Object' },
    ] },
  ],
  OPENROUTER: [
    { key: 'integrationId', label: 'OpenRouter Credential', placeholder: 'Select credential...', inputType: 'select', options: [], hint: 'Select from Credentials page or enter API key below' },
    { key: 'apiKey', label: 'API Key (if no credential)', placeholder: 'sk-or-...', type: 'password', hint: 'Used only if no credential selected above' },
    { key: 'model', label: 'Model', placeholder: 'openai/gpt-4o-mini', required: true, hint: 'Select credential first to load available models' },
    { key: 'systemPrompt', label: 'System Prompt', placeholder: 'You are a helpful assistant...', inputType: 'textarea', rows: 3 },
    { key: 'userPrompt', label: 'User Prompt', placeholder: '{{trigger.text}}', inputType: 'textarea', rows: 3, hint: 'Supports {{template}} variables' },
    { key: 'temperature', label: 'Temperature', placeholder: '0.7', type: 'number' },
    { key: 'maxTokens', label: 'Max Tokens', placeholder: '1024', type: 'number' },
    { key: 'responseFormat', label: 'Response Format', placeholder: '', inputType: 'select', options: [
      { value: 'text', label: 'Text' },
      { value: 'json', label: 'JSON Object' },
    ] },
  ],
};

const LOGIC_FIELDS: Record<string, Array<ConfigField>> = {
  IF: [
    { key: 'field', label: 'Field to Evaluate', placeholder: '{{trigger.value}}', required: true, hint: 'Field or expression to check' },
    { key: 'operator', label: 'Operator', placeholder: 'equals', inputType: 'select', options: [
      { value: 'equals', label: 'Equals' },
      { value: 'notEquals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'greaterThan', label: 'Greater Than' },
      { value: 'lessThan', label: 'Less Than' },
      { value: 'exists', label: 'Exists' },
      { value: 'isEmpty', label: 'Is Empty' },
    ] },
    { key: 'value', label: 'Value', placeholder: 'Expected value' },
    { key: 'combinator', label: 'Combine Multiple', placeholder: '', inputType: 'select', options: [
      { value: 'AND', label: 'AND — all must match' },
      { value: 'OR', label: 'OR — any must match' },
    ], hint: 'How to combine when multiple conditions exist' },
  ],
  SWITCH: [
    { key: 'field', label: 'Value to Check', placeholder: '{{trigger.status}}', required: true, hint: 'Field or expression to evaluate' },
    { key: 'outputCount', label: 'Number of Outputs', placeholder: '3', type: 'number', hint: 'Total branches including Default (min 2)' },
    { key: 'rules', label: 'Rules (JSON)', placeholder: '[{"value": "active", "output": 0}, {"value": "inactive", "output": 1}]', inputType: 'textarea', rows: 4, hint: 'Array of {value, output} pairs' },
    { key: 'fallbackOutput', label: 'Default Output Index', placeholder: '2', type: 'number', hint: 'Output index for unmatched values (last branch)' },
  ],
  FILTER: [
    { key: 'field', label: 'Field to Filter', placeholder: '{{trigger.items}}', required: true },
    { key: 'operator', label: 'Operator', placeholder: 'equals', inputType: 'select', options: [
      { value: 'equals', label: 'Equals' },
      { value: 'notEquals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'greaterThan', label: 'Greater Than' },
      { value: 'lessThan', label: 'Less Than' },
      { value: 'exists', label: 'Exists' },
    ] },
    { key: 'value', label: 'Value', placeholder: 'Filter value' },
    { key: 'combinator', label: 'Combine', placeholder: '', inputType: 'select', options: [
      { value: 'AND', label: 'AND' },
      { value: 'OR', label: 'OR' },
    ] },
  ],
  SET: [
    { key: 'mode', label: 'Mode', placeholder: '', inputType: 'select', options: [
      { value: 'set', label: 'Set — overwrite fields' },
      { value: 'append', label: 'Append — add to existing' },
      { value: 'remove', label: 'Remove — delete fields' },
    ] },
    { key: 'fields', label: 'Fields (JSON)', placeholder: '[{"name": "key", "value": "value"}]', inputType: 'textarea', rows: 4, hint: 'Array of {name, value} pairs' },
  ],
  CODE: [
    { key: 'language', label: 'Language', placeholder: '', inputType: 'select', options: [
      { value: 'javascript', label: 'JavaScript' },
    ] },
    { key: 'code', label: 'Code', placeholder: '// Access input data with $input\n// Return result\nreturn { processed: true };', inputType: 'code', rows: 8, hint: 'Write JavaScript that receives $input and returns output' },
  ],
  MERGE: [
    { key: 'mode', label: 'Mode', placeholder: '', inputType: 'select', options: [
      { value: 'append', label: 'Append — combine all items' },
      { value: 'mergeByKey', label: 'Merge by Key — join on field' },
      { value: 'keepMatching', label: 'Keep Matching — inner join' },
      { value: 'removeMatching', label: 'Remove Matching — anti join' },
    ] },
    { key: 'joinField', label: 'Join Field', placeholder: 'id', hint: 'Field name to join on (for merge modes)' },
  ],
  WAIT: [
    { key: 'amount', label: 'Duration', placeholder: '5', type: 'number', required: true },
    { key: 'unit', label: 'Unit', placeholder: '', inputType: 'select', options: [
      { value: 'seconds', label: 'Seconds' },
      { value: 'minutes', label: 'Minutes' },
      { value: 'hours', label: 'Hours' },
    ] },
  ],
  LOOP: [
    { key: 'batchSize', label: 'Batch Size', placeholder: '10', type: 'number', hint: 'Number of items to process per iteration' },
  ],
  NOOP: [],
  MANUAL_TRIGGER: [
    { key: 'testData', label: 'Test Data (JSON)', placeholder: '{"key": "value"}', inputType: 'textarea', rows: 4, hint: 'JSON data to inject when manually triggered' },
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
  { var: '{{trigger.from.first_name}}', desc: 'User first name', example: 'John' },
  { var: '{{trigger.from.username}}', desc: 'Username (@...)', example: 'ivan123' },
  { var: '{{trigger.text}}', desc: 'Message text', example: '/start' },
  { var: '{{trigger.chat.id}}', desc: 'Chat ID', example: '123456789' },
  { var: '{{trigger.command}}', desc: 'Command (without /)', example: 'start' },
  { var: '{{trigger.commandArgs}}', desc: 'Command arguments', example: 'arg1 arg2' },
];

// Message templates for quick start
const TELEGRAM_MESSAGE_TEMPLATES = [
  { label: '👋 Welcome /start', text: 'Hello, {{trigger.from.first_name}}! 👋\n\nI am a bot created with FlowForge.\nSend /help to see what I can do.' },
  { label: '❓ Reply to /help', text: '📋 Available commands:\n\n/start — Start\n/help — Help\n\nOr just send me a message!' },
  { label: '💬 Echo reply', text: 'You wrote: {{trigger.text}}\n\nSender: {{trigger.from.first_name}} (@{{trigger.from.username}})' },
  { label: '🔔 Notification', text: '🔔 New message from {{trigger.from.first_name}}:\n\n{{trigger.text}}' },
];

export function NodeConfigPanel({ embedded = false }: { embedded?: boolean }) {
  const { selectedNode, updateNodeData, setSelectedNode, nodes } = useEditorStore();
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [testingIntegration, setTestingIntegration] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch integrations for node dropdowns (Telegram, SMTP, HTTP API, Database)
  const { data: integrations = [] } = useQuery<Array<{ id: string; name: string; type: string }>>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await api.get('/integrations');
      return res.data.data || res.data;
    },
    staleTime: 30000,
  });

  // Fetch AI models when an AI credential is selected
  const aiNodeType = selectedNode?.data?.type as string;
  const aiIntegrationId = (selectedNode?.data?.config as any)?.integrationId;
  const isAiNode = ['OPENAI', 'ANTHROPIC', 'MISTRAL', 'OPENROUTER'].includes(aiNodeType);
  const { data: aiModels } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['ai-models', aiIntegrationId],
    queryFn: async () => {
      const res = await api.get(`/integrations/${aiIntegrationId}/models`);
      return res.data.models || [];
    },
    enabled: isAiNode && !!aiIntegrationId,
    staleTime: 60000,
  });

  if (!selectedNode) return null;

  const nodeType = selectedNode.data?.type as string;
  // Use ReactFlow node type to distinguish trigger vs action vs logic
  const isTrigger = selectedNode.type === 'triggerNode';
  const isLogic = selectedNode.type === 'logicNode';
  let fields = isTrigger
    ? TRIGGER_FIELDS[nodeType]
    : isLogic
      ? LOGIC_FIELDS[nodeType]
      : ACTION_FIELDS[nodeType];

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
              ? '⚠️ No bots found. Go to Integrations → Add Telegram bot'
              : 'Select a bot for this trigger',
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

  // Inject WEBHOOK integration options into WEBHOOK trigger integrationId field
  if (nodeType === 'WEBHOOK' && isTrigger && fields) {
    const webhookIntegrations = integrations.filter((i) => i.type === 'WEBHOOK');
    fields = fields.map((f) =>
      f.key === 'integrationId'
        ? {
            ...f,
            options: [
              { value: '', label: '🔗 Auto-generate URL' },
              ...webhookIntegrations.map((w) => ({ value: w.id, label: `🌐 ${w.name}` })),
            ],
            hint: webhookIntegrations.length === 0
              ? 'URL will be generated when workflow is activated'
              : 'Select a webhook integration or auto-generate',
          }
        : f,
    );
  }

  // Inject bot options into TELEGRAM action integrationId field
  // Auto-inherit bot from trigger if not set
  if (nodeType === 'TELEGRAM' && !isTrigger && fields) {
    const telegramBots = integrations.filter((i) => i.type === 'TELEGRAM');
    const triggerNode = nodes.find((n) => n.type === 'triggerNode' && n.data?.type === 'TELEGRAM');
    const triggerBotId = (triggerNode?.data?.config as any)?.integrationId;

    fields = fields.map((f) => {
      if (f.key === 'integrationId') {
        return {
          ...f,
          options: telegramBots.map((b) => ({ value: b.id, label: b.name })),
          hint: triggerBotId
            ? 'Auto-inherited from Telegram trigger'
            : telegramBots.length === 0
              ? '⚠️ No bots found. Add one on the Integrations page'
              : 'Select a bot for sending messages',
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

  // Inject AI credential options into AI action nodes
  if (['OPENAI', 'ANTHROPIC', 'MISTRAL', 'OPENROUTER'].includes(nodeType) && fields) {
    const aiIntegrations = integrations.filter((i) => i.type === nodeType);
    fields = fields.map((f) =>
      f.key === 'integrationId'
        ? {
            ...f,
            options: [
              { value: '', label: '🔑 Enter API key manually' },
              ...aiIntegrations.map((a) => ({ value: a.id, label: `🤖 ${a.name}` })),
            ],
            hint: aiIntegrations.length === 0
              ? 'Add credential on the Credentials page, or enter API key below'
              : 'Select saved credential or enter key manually',
          }
        : f,
    );
  }

  const config = (selectedNode.data?.config as Record<string, string>) || {};

  // Auto-inherit Telegram bot from trigger for action nodes
  if (nodeType === 'TELEGRAM' && !isTrigger && !config.integrationId) {
    const triggerNode = nodes.find((n) => n.type === 'triggerNode' && n.data?.type === 'TELEGRAM');
    const triggerBotId = (triggerNode?.data?.config as any)?.integrationId;
    if (triggerBotId) {
      const latestNode = useEditorStore.getState().nodes.find(n => n.id === selectedNode.id);
      const latestConfig = (latestNode?.data?.config as Record<string, string>) || {};
      if (!latestConfig.integrationId) {
        updateNodeData(selectedNode.id, { config: { ...latestConfig, integrationId: triggerBotId } });
      }
    }
  }

  // Hide apiKey field when AI credential is selected
  if (['OPENAI', 'ANTHROPIC', 'MISTRAL', 'OPENROUTER'].includes(nodeType) && config.integrationId && fields) {
    fields = fields.map((f) => f.key === 'apiKey' ? { ...f, hidden: true } : f);
  }

  // Inject dynamic AI models when credential is selected
  if (isAiNode && aiModels && aiModels.length > 0 && fields) {
    fields = fields.map((f) =>
      f.key === 'model'
        ? { ...f, inputType: 'select' as const, options: aiModels.map((m) => ({ value: m.id, label: m.name })) }
        : f,
    );
  }

  // Auto-hide IMAP fields when email integration is selected (not Manual)
  if (nodeType === 'EMAIL' && isTrigger && fields && config.integrationId) {
    fields = fields.map((f) =>
      ['imapHost', 'imapPort', 'imapUser', 'imapPassword'].includes(f.key)
        ? { ...f, hidden: true }
        : f
    );
  }

  // Hide 'to' field when auto-reply mode is selected in Send Email
  if (nodeType === 'SEND_EMAIL' && !isTrigger && fields && config.toMode === 'auto_reply') {
    fields = fields.map((f) =>
      f.key === 'to' ? { ...f, hidden: true } : f
    );
  }

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
    const updates: Record<string, string> = { [key]: value };
    // Auto-set 'to' and 'subject' fields when switching to auto-reply mode
    if (key === 'toMode' && value === 'auto_reply') {
      updates.to = '{{trigger.from}}';
      const currentConfig = (useEditorStore.getState().nodes.find(n => n.id === selectedNode.id)?.data?.config as Record<string, string>) || {};
      if (!currentConfig.subject) {
        updates.subject = 'Re: {{trigger.subject}}';
      }
    }
    // Read latest config from store to avoid stale closure
    const latestNode = useEditorStore.getState().nodes.find(n => n.id === selectedNode.id);
    const latestConfig = (latestNode?.data?.config as Record<string, string>) || {};
    updateNodeData(selectedNode.id, {
      config: { ...latestConfig, ...updates },
    });

    // Validate all changed fields
    const newErrors = { ...fieldErrors };
    for (const [k, val] of Object.entries(updates)) {
      const error = validateNodeField(nodeType, k, val);
      if (error) {
        newErrors[k] = error;
      } else {
        delete newErrors[k];
      }
    }
    setFieldErrors(newErrors);
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
    <div className={embedded ? '' : 'w-80 border-l bg-card overflow-y-auto shrink-0 animate-in slide-in-from-right duration-200'}>
      {/* Header — hidden when embedded in NDV */}
      {!embedded && (
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{selectedNode.data?.label as string}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {isTrigger ? '⚡ Trigger' : isLogic ? '🔀 Logic' : '▶️ Action'} · {nodeType}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setSelectedNode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      )}

      <div className="p-4 space-y-4">
        {/* General section */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">General</p>
          <label className="text-xs font-medium">Node Name</label>
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
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">How it works</p>
            </div>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 leading-relaxed">
              Select a bot and event type. When a user sends a matching message to the bot, the workflow will start automatically.
            </p>
          </div>
        )}

        {/* Telegram Action: Auto-reply info */}
        {isTelegramAction && hasTelegramTrigger && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Reply className="h-3.5 w-3.5 text-green-500" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-300">Auto-reply</p>
            </div>
            <p className="text-[11px] text-green-600 dark:text-green-400 leading-relaxed">
              Chat ID is determined automatically from the trigger — the bot will reply to the user who sent the message. You can leave Chat ID empty.
            </p>
          </div>
        )}

        {/* Webhook Trigger: Integration info */}
        {nodeType === 'WEBHOOK' && isTrigger && config.integrationId && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Linked webhook integration</p>
            </div>
            <p className="text-[11px] text-violet-600 dark:text-violet-400 leading-relaxed">
              The webhook URL from the selected integration will be used as the trigger endpoint.
              Activate the workflow to see the URL.
            </p>
          </div>
        )}

        {/* Email Trigger: Integration credentials info */}
        {nodeType === 'EMAIL' && isTrigger && config.integrationId && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Credentials from integration</p>
            </div>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
              IMAP connection settings are loaded automatically from the selected integration.
              Only the email filter below can be customized.
            </p>
          </div>
        )}

        {/* Send Email: Auto-reply mode info */}
        {nodeType === 'SEND_EMAIL' && !isTrigger && config.toMode === 'auto_reply' && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Reply className="h-3.5 w-3.5 text-green-500" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-300">Auto-reply mode</p>
            </div>
            <p className="text-[11px] text-green-600 dark:text-green-400 leading-relaxed">
              The email will be sent to the address from the trigger event automatically.
              The &quot;To&quot; field is set to {'{{trigger.from}}'}.
            </p>
          </div>
        )}

        {/* Configuration section */}
        {fields && fields.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Settings</p>
            <div className="space-y-3">
              {fields.filter((f) => !f.hidden).map((field) => {
                const value = config[field.key] || '';
                const hasError = field.required && !value;
                const isNumberErr = field.type === 'number' && value !== '' && isNaN(Number(value));
                const validationError = fieldErrors[field.key];

                return (
                  <div key={field.key}>
                    <div className="flex items-center gap-1">
                      <label className="text-xs font-medium">
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </label>
                      {/* Help tooltips for specific fields */}
                      {field.key === 'cronExpression' && (
                        <HelpTooltip
                          content="Use crontab.guru to create and validate cron expressions"
                          linkUrl="https://crontab.guru"
                          linkText="Open crontab.guru"
                        />
                      )}
                      {field.key === 'body' && field.inputType === 'textarea' && nodeType === 'HTTP_REQUEST' && (
                        <HelpTooltip content={'Enter valid JSON. Example: {"key": "value"}'} />
                      )}
                      {field.key === 'headers' && (
                        <HelpTooltip content={'Enter valid JSON. Example: {"Authorization": "Bearer token"}'} />
                      )}
                      {field.key === 'expression' && (
                        <HelpTooltip
                          content="JSONata expression for data transformation"
                          linkUrl="https://docs.jsonata.org"
                          linkText="JSONata docs"
                        />
                      )}
                    </div>

                    {field.key === 'integrationId' && field.inputType === 'select' && field.options ? (
                      <div className="mt-1 space-y-1.5">
                        <Select
                          className={cn('h-8 text-sm', hasError && 'border-destructive/50')}
                          value={value || field.options[0]?.value || ''}
                          options={[
                            ...field.options,
                            { value: '__add_new__', label: '➕ Add New Integration...' },
                          ]}
                          disabled={field.readOnly}
                          onChange={(e) => {
                            if (e.target.value === '__add_new__') {
                              setWizardOpen(true);
                              return;
                            }
                            handleChange(field.key, e.target.value);
                          }}
                        />
                        {value && value !== '__add_new__' && (
                          <button
                            type="button"
                            onClick={async () => {
                              setTestingIntegration(true);
                              setTestResult(null);
                              const result = await testIntegration(value);
                              setTestResult(result);
                              setTestingIntegration(false);
                            }}
                            disabled={testingIntegration}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          >
                            {testingIntegration ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            Test Connection
                          </button>
                        )}
                        {testResult && (
                          <p className={cn('text-[10px]', testResult.success ? 'text-emerald-500' : 'text-red-500')}>
                            {testResult.success ? '✓ ' : '✗ '}{testResult.message}
                          </p>
                        )}
                      </div>
                    ) : field.inputType === 'select' && field.options ? (
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
                          (hasError || validationError) && 'border-destructive/50',
                        )}
                        rows={field.rows || 3}
                        placeholder={field.placeholder}
                        value={value}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      />
                    ) : (
                      <Input
                        className={cn('mt-1 h-8 text-sm', (hasError || isNumberErr || validationError) && 'border-destructive/50')}
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
                    {validationError && (
                      <p className="text-xs text-destructive mt-0.5">{validationError}</p>
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
                  📤 Trigger data for Action nodes:
                </p>
                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                  <p><code className="font-mono text-primary">{'{{trigger.text}}'}</code> — message text</p>
                  <p><code className="font-mono text-primary">{'{{trigger.chat.id}}'}</code> — chat ID</p>
                  <p><code className="font-mono text-primary">{'{{trigger.from.first_name}}'}</code> — first name</p>
                  <p><code className="font-mono text-primary">{'{{trigger.command}}'}</code> — command</p>
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
                    {showTemplates ? 'Hide templates' : '📝 Message templates'}
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
                    🔗 Variables (click to insert):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {TELEGRAM_TEMPLATE_VARS.map((v) => (
                      <button
                        key={v.var}
                        type="button"
                        className="inline-flex items-center rounded border bg-background px-1.5 py-0.5 font-mono text-[9px] text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                        title={`${v.desc} (example: ${v.example})`}
                        onClick={() => insertTemplate(v.var)}
                      >
                        {v.var.replace(/[{}]/g, '').replace('trigger.', '')}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5">
                    Click a variable to insert it into the Message field
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
          <Input
            className="h-8 text-sm"
            placeholder="Optional description"
            value={(selectedNode.data?.description as string) || ''}
            onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
          />
        </div>
      </div>

      {/* Integration Wizard Dialog (opened from + Add New) */}
      <IntegrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
    </div>
  );
}
