'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Bot, Mail, Globe, Send, Database, Zap, Brain, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-handler';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tags: string[];
  definition: { nodes: any[]; edges: any[] };
}

const TEMPLATES: Template[] = [
  {
    id: 'telegram-bot',
    name: 'Telegram Bot',
    description: 'Auto-reply Telegram bot that responds to /start and messages',
    icon: Send,
    color: 'text-blue-500',
    tags: ['Telegram', 'Bot'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 100, y: 200 }, data: { label: 'Telegram Trigger', type: 'TELEGRAM', config: { eventType: 'any' } } },
        { id: 'action-1', type: 'actionNode', position: { x: 400, y: 200 }, data: { label: 'Send Reply', type: 'TELEGRAM', config: { chatIdMode: 'auto_reply', message: 'Hello {{trigger.from.first_name}}! You said: {{trigger.text}}' } } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1', type: 'smoothstep', animated: true }],
    },
  },
  {
    id: 'ai-chatbot',
    name: 'AI Chatbot',
    description: 'Webhook → OpenAI GPT → respond with AI-generated text',
    icon: Brain,
    color: 'text-emerald-500',
    tags: ['AI', 'OpenAI', 'Webhook'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 100, y: 200 }, data: { label: 'Webhook', type: 'WEBHOOK', config: {} } },
        { id: 'ai-1', type: 'actionNode', position: { x: 400, y: 200 }, data: { label: 'OpenAI Chat', type: 'OPENAI', config: { model: 'gpt-4o-mini', systemPrompt: 'You are a helpful assistant.', userPrompt: '{{trigger.body.message}}' } } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'ai-1', type: 'smoothstep', animated: true }],
    },
  },
  {
    id: 'email-notification',
    name: 'Email Notification',
    description: 'Webhook trigger → send email notification',
    icon: Mail,
    color: 'text-red-500',
    tags: ['Email', 'Webhook'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 100, y: 200 }, data: { label: 'Webhook', type: 'WEBHOOK', config: {} } },
        { id: 'action-1', type: 'actionNode', position: { x: 400, y: 200 }, data: { label: 'Send Email', type: 'SEND_EMAIL', config: { toMode: 'manual', subject: 'New notification', body: '{{trigger.body.message}}' } } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1', type: 'smoothstep', animated: true }],
    },
  },
  {
    id: 'scheduled-api',
    name: 'Scheduled API Call',
    description: 'Cron schedule → HTTP request → transform data',
    icon: Globe,
    color: 'text-orange-500',
    tags: ['Cron', 'HTTP', 'Transform'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 100, y: 200 }, data: { label: 'Schedule', type: 'CRON', config: { cronExpression: '0 9 * * 1-5' } } },
        { id: 'action-1', type: 'actionNode', position: { x: 400, y: 200 }, data: { label: 'HTTP Request', type: 'HTTP_REQUEST', config: { url: 'https://api.example.com/data', method: 'GET' } } },
        { id: 'action-2', type: 'actionNode', position: { x: 700, y: 200 }, data: { label: 'Transform', type: 'TRANSFORM', config: { expression: '$.data' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'action-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'action-1', target: 'action-2', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'data-sync',
    name: 'Data Sync Pipeline',
    description: 'Webhook → filter → database write',
    icon: Database,
    color: 'text-amber-500',
    tags: ['Database', 'Filter'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 100, y: 200 }, data: { label: 'Webhook', type: 'WEBHOOK', config: {} } },
        { id: 'logic-1', type: 'logicNode', position: { x: 400, y: 200 }, data: { label: 'Filter', type: 'FILTER', config: { field: '{{trigger.body.status}}', operator: 'equals', value: 'active' } } },
        { id: 'action-1', type: 'actionNode', position: { x: 700, y: 200 }, data: { label: 'Database', type: 'DATABASE', config: { operation: 'insert', table: 'records' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'logic-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'logic-1', target: 'action-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'ai-telegram',
    name: 'AI Telegram Bot',
    description: 'Telegram message → OpenAI → reply with AI response',
    icon: Bot,
    color: 'text-violet-500',
    tags: ['AI', 'Telegram', 'OpenAI'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 100, y: 200 }, data: { label: 'Telegram', type: 'TELEGRAM', config: { eventType: 'message' } } },
        { id: 'ai-1', type: 'actionNode', position: { x: 400, y: 200 }, data: { label: 'OpenAI', type: 'OPENAI', config: { model: 'gpt-4o-mini', systemPrompt: 'You are a helpful Telegram bot.', userPrompt: '{{trigger.text}}' } } },
        { id: 'action-1', type: 'actionNode', position: { x: 700, y: 200 }, data: { label: 'Reply', type: 'TELEGRAM', config: { chatIdMode: 'auto_reply', message: '{{steps.ai-1.content}}' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'ai-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'ai-1', target: 'action-1', type: 'smoothstep', animated: true },
      ],
    },
  },
];

export default function TemplatesPage() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const createFromTemplate = useMutation({
    mutationFn: async (template: Template) => {
      const res = await api.post('/workflows', {
        name: template.name,
        description: template.description,
        definition: template.definition,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Workflow created from template');
      router.push(`/workflows/${data.id}/editor`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const filtered = TEMPLATES.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workflow Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start with a pre-built workflow and customize it
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const Icon = template.icon;
          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Icon className={`h-5 w-5 ${template.color}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm">{template.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => createFromTemplate.mutate(template)}
                    disabled={createFromTemplate.isPending}
                  >
                    {createFromTemplate.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
