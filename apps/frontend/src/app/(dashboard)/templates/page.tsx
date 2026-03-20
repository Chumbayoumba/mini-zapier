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
    id: 'ai-telegram-bot',
    name: 'AI Telegram Bot',
    description: 'Telegram messages → AI generates response → auto-reply. Just connect your bot and AI credential.',
    icon: Bot,
    color: 'text-violet-500',
    tags: ['Telegram', 'AI', 'OpenRouter'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 250, y: 100 }, data: { label: 'Telegram Trigger', type: 'TELEGRAM', config: { eventType: 'message' } } },
        { id: 'ai-1', type: 'actionNode', position: { x: 250, y: 280 }, data: { label: 'AI Response', type: 'OPENROUTER', config: { systemPrompt: 'You are a helpful Telegram bot. Reply in the same language the user writes. Be concise.' } } },
        { id: 'action-1', type: 'actionNode', position: { x: 250, y: 460 }, data: { label: 'Send Reply', type: 'TELEGRAM', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'ai-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'ai-1', target: 'action-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'smart-telegram-menu',
    name: 'Smart Telegram Bot with Menu',
    description: 'Bot with /start menu, /help, AI chat — routes commands via IF branching with different responses.',
    icon: Bot,
    color: 'text-blue-500',
    tags: ['Telegram', 'AI', 'Logic', 'IF'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 300, y: 50 }, data: { label: 'Telegram', type: 'TELEGRAM', config: { eventType: 'any' } } },
        { id: 'if-1', type: 'logicNode', position: { x: 300, y: 220 }, data: { label: 'Is /start?', type: 'IF', config: { field: '{{trigger.text}}', operator: 'equals', value: '/start' } } },
        { id: 'menu-1', type: 'actionNode', position: { x: 80, y: 400 }, data: { label: 'Show Menu', type: 'TELEGRAM', config: { message: '👋 Welcome!\n\n📋 Commands:\n/start — This menu\n/help — Get help\n\n💬 Or just type any message to chat with AI!' } } },
        { id: 'if-2', type: 'logicNode', position: { x: 520, y: 400 }, data: { label: 'Is /help?', type: 'IF', config: { field: '{{trigger.text}}', operator: 'equals', value: '/help' } } },
        { id: 'help-1', type: 'actionNode', position: { x: 350, y: 570 }, data: { label: 'Help Text', type: 'TELEGRAM', config: { message: '❓ Help:\n\nI am an AI-powered bot. Just send me any message and I will respond using AI.\n\nPowered by FlowForge ⚡' } } },
        { id: 'ai-1', type: 'actionNode', position: { x: 650, y: 570 }, data: { label: 'AI Chat', type: 'OPENROUTER', config: { systemPrompt: 'You are a friendly Telegram bot. Reply in the user\'s language. Be helpful and concise.' } } },
        { id: 'reply-1', type: 'actionNode', position: { x: 650, y: 740 }, data: { label: 'AI Reply', type: 'TELEGRAM', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'if-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'if-1', sourceHandle: 'output-0', target: 'menu-1', type: 'smoothstep', animated: true },
        { id: 'e3', source: 'if-1', sourceHandle: 'output-1', target: 'if-2', type: 'smoothstep', animated: true },
        { id: 'e4', source: 'if-2', sourceHandle: 'output-0', target: 'help-1', type: 'smoothstep', animated: true },
        { id: 'e5', source: 'if-2', sourceHandle: 'output-1', target: 'ai-1', type: 'smoothstep', animated: true },
        { id: 'e6', source: 'ai-1', target: 'reply-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'email-ai-autoreply',
    name: 'AI Email Auto-Reply',
    description: 'Incoming email → AI writes professional reply → sends back automatically. Perfect for support.',
    icon: Mail,
    color: 'text-red-500',
    tags: ['Email', 'AI', 'Auto-Reply'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 250, y: 100 }, data: { label: 'Email Trigger', type: 'EMAIL', config: {} } },
        { id: 'ai-1', type: 'actionNode', position: { x: 250, y: 280 }, data: { label: 'Generate Reply', type: 'OPENROUTER', config: { systemPrompt: 'Write a professional email reply. Keep it brief, helpful, and friendly. Match the language of the original email.' } } },
        { id: 'action-1', type: 'actionNode', position: { x: 250, y: 460 }, data: { label: 'Send Reply', type: 'SEND_EMAIL', config: { toMode: 'auto_reply', subject: 'Re: {{trigger.subject}}' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'ai-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'ai-1', target: 'action-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'webhook-ai-api',
    name: 'AI API Endpoint',
    description: 'Webhook receives request → AI processes it → returns response. Build your own AI API.',
    icon: Brain,
    color: 'text-emerald-500',
    tags: ['Webhook', 'AI', 'API'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 250, y: 100 }, data: { label: 'Webhook', type: 'WEBHOOK', config: {} } },
        { id: 'ai-1', type: 'actionNode', position: { x: 250, y: 280 }, data: { label: 'AI Process', type: 'OPENROUTER', config: { systemPrompt: 'Process the incoming request and provide a structured response.' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'ai-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'content-pipeline',
    name: 'AI Content Pipeline',
    description: 'Daily schedule → AI generates content → sends via Email + Telegram simultaneously.',
    icon: Zap,
    color: 'text-yellow-500',
    tags: ['Cron', 'AI', 'Email', 'Telegram'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 300, y: 50 }, data: { label: 'Daily 9 AM', type: 'CRON', config: { cronExpression: '0 9 * * 1-5', timezone: 'UTC' } } },
        { id: 'ai-1', type: 'actionNode', position: { x: 300, y: 220 }, data: { label: 'Generate Tip', type: 'OPENROUTER', config: { systemPrompt: 'Generate a short, actionable daily productivity tip. Format with emoji. Max 3 sentences.' } } },
        { id: 'email-1', type: 'actionNode', position: { x: 120, y: 400 }, data: { label: 'Email', type: 'SEND_EMAIL', config: { toMode: 'manual', subject: '💡 Daily Tip', isHtml: 'false' } } },
        { id: 'tg-1', type: 'actionNode', position: { x: 480, y: 400 }, data: { label: 'Telegram', type: 'TELEGRAM', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'ai-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'ai-1', target: 'email-1', type: 'smoothstep', animated: true },
        { id: 'e3', source: 'ai-1', target: 'tg-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'webhook-filter-notify',
    name: 'Smart Webhook Router',
    description: 'Webhook → Filter by priority → High: Email + Telegram, Low: just log. Multi-branch logic.',
    icon: Shield,
    color: 'text-pink-500',
    tags: ['Webhook', 'IF', 'Email', 'Telegram'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 300, y: 50 }, data: { label: 'Webhook', type: 'WEBHOOK', config: {} } },
        { id: 'if-1', type: 'logicNode', position: { x: 300, y: 220 }, data: { label: 'High Priority?', type: 'IF', config: { field: '{{trigger.body.priority}}', operator: 'equals', value: 'high' } } },
        { id: 'email-1', type: 'actionNode', position: { x: 100, y: 400 }, data: { label: 'Urgent Email', type: 'SEND_EMAIL', config: { toMode: 'manual', subject: '🚨 URGENT: {{trigger.body.title}}' } } },
        { id: 'tg-1', type: 'actionNode', position: { x: 100, y: 570 }, data: { label: 'Telegram Alert', type: 'TELEGRAM', config: { message: '🚨 URGENT\n\n{{trigger.body.title}}\n{{trigger.body.message}}' } } },
        { id: 'transform-1', type: 'actionNode', position: { x: 500, y: 400 }, data: { label: 'Log Entry', type: 'TRANSFORM', config: { expression: '{ "logged": true, "priority": "low", "title": $.trigger.body.title }' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'if-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'if-1', sourceHandle: 'output-0', target: 'email-1', type: 'smoothstep', animated: true },
        { id: 'e3', source: 'email-1', target: 'tg-1', type: 'smoothstep', animated: true },
        { id: 'e4', source: 'if-1', sourceHandle: 'output-1', target: 'transform-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'api-monitor',
    name: 'API Health Monitor',
    description: 'Every 5 min check API → IF down → alert via Email + Telegram. Uptime monitoring.',
    icon: Globe,
    color: 'text-orange-500',
    tags: ['Cron', 'HTTP', 'IF', 'Email'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 300, y: 50 }, data: { label: 'Every 5 min', type: 'CRON', config: { cronExpression: '*/5 * * * *' } } },
        { id: 'http-1', type: 'actionNode', position: { x: 300, y: 220 }, data: { label: 'Check API', type: 'HTTP_REQUEST', config: { url: 'https://api.example.com/health', method: 'GET', timeout: '10000' } } },
        { id: 'if-1', type: 'logicNode', position: { x: 300, y: 400 }, data: { label: 'Is Down?', type: 'IF', config: { field: '{{steps.http-1.status}}', operator: 'notEquals', value: '200' } } },
        { id: 'email-1', type: 'actionNode', position: { x: 120, y: 570 }, data: { label: 'Alert Email', type: 'SEND_EMAIL', config: { toMode: 'manual', subject: '🔴 API DOWN — {{steps.http-1.url}}' } } },
        { id: 'tg-1', type: 'actionNode', position: { x: 480, y: 570 }, data: { label: 'Telegram Alert', type: 'TELEGRAM', config: { message: '🔴 API is DOWN!\nStatus: {{steps.http-1.status}}' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'http-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'http-1', target: 'if-1', type: 'smoothstep', animated: true },
        { id: 'e3', source: 'if-1', sourceHandle: 'output-0', target: 'email-1', type: 'smoothstep', animated: true },
        { id: 'e4', source: 'if-1', sourceHandle: 'output-0', target: 'tg-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'telegram-simple',
    name: 'Simple Telegram Echo Bot',
    description: 'Echoes back whatever user sends. Simplest possible bot — great for testing.',
    icon: Send,
    color: 'text-sky-500',
    tags: ['Telegram', 'Simple'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 250, y: 150 }, data: { label: 'Telegram', type: 'TELEGRAM', config: { eventType: 'any' } } },
        { id: 'action-1', type: 'actionNode', position: { x: 250, y: 330 }, data: { label: 'Echo Reply', type: 'TELEGRAM', config: { message: 'You said: {{trigger.text}}' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'action-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'data-pipeline',
    name: 'Data Processing Pipeline',
    description: 'Webhook → Transform data → Filter valid records → Store in DB. ETL workflow.',
    icon: Database,
    color: 'text-cyan-500',
    tags: ['Webhook', 'Transform', 'Filter', 'Database'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 250, y: 50 }, data: { label: 'Webhook', type: 'WEBHOOK', config: {} } },
        { id: 'transform-1', type: 'actionNode', position: { x: 250, y: 220 }, data: { label: 'Transform', type: 'TRANSFORM', config: { expression: '$.body.records' } } },
        { id: 'filter-1', type: 'logicNode', position: { x: 250, y: 390 }, data: { label: 'Valid Only', type: 'FILTER', config: { field: '{{trigger.body.status}}', operator: 'equals', value: 'active' } } },
        { id: 'db-1', type: 'actionNode', position: { x: 250, y: 560 }, data: { label: 'Save to DB', type: 'DATABASE', config: { operation: 'SELECT', table: 'workflows' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'transform-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'transform-1', target: 'filter-1', type: 'smoothstep', animated: true },
        { id: 'e3', source: 'filter-1', target: 'db-1', type: 'smoothstep', animated: true },
      ],
    },
  },
  {
    id: 'scheduled-report',
    name: 'Scheduled API Report',
    description: 'Daily: fetch API data → AI summarizes → Email report. Automated reporting.',
    icon: Globe,
    color: 'text-indigo-500',
    tags: ['Cron', 'HTTP', 'AI', 'Email'],
    definition: {
      nodes: [
        { id: 'trigger-1', type: 'triggerNode', position: { x: 250, y: 50 }, data: { label: 'Daily 8 AM', type: 'CRON', config: { cronExpression: '0 8 * * *' } } },
        { id: 'http-1', type: 'actionNode', position: { x: 250, y: 220 }, data: { label: 'Fetch Data', type: 'HTTP_REQUEST', config: { url: 'https://api.example.com/stats', method: 'GET' } } },
        { id: 'ai-1', type: 'actionNode', position: { x: 250, y: 390 }, data: { label: 'AI Summary', type: 'OPENROUTER', config: { systemPrompt: 'Summarize this API data into a brief daily report. Use bullet points. Include key metrics.' } } },
        { id: 'email-1', type: 'actionNode', position: { x: 250, y: 560 }, data: { label: 'Email Report', type: 'SEND_EMAIL', config: { toMode: 'manual', subject: '📊 Daily Report — {{trigger.scheduledAt}}', isHtml: 'false' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'http-1', type: 'smoothstep', animated: true },
        { id: 'e2', source: 'http-1', target: 'ai-1', type: 'smoothstep', animated: true },
        { id: 'e3', source: 'ai-1', target: 'email-1', type: 'smoothstep', animated: true },
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
