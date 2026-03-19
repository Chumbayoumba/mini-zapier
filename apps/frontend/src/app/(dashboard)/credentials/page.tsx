'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  Key,
  Trash2,
  Bot,
  Mail,
  Globe,
  Database,
  Webhook,
  Loader2,
  Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-handler';
import { IntegrationWizard } from '@/components/integrations/integration-wizard';

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  TELEGRAM: { icon: Bot, color: 'text-blue-500', label: 'Telegram' },
  SMTP: { icon: Mail, color: 'text-emerald-500', label: 'SMTP' },
  WEBHOOK: { icon: Webhook, color: 'text-violet-500', label: 'Webhook' },
  HTTP_API: { icon: Globe, color: 'text-orange-500', label: 'HTTP API' },
  DATABASE: { icon: Database, color: 'text-amber-500', label: 'Database' },
  OPENAI: { icon: Brain, color: 'text-green-500', label: 'OpenAI' },
  ANTHROPIC: { icon: Brain, color: 'text-orange-500', label: 'Anthropic' },
  MISTRAL: { icon: Brain, color: 'text-blue-400', label: 'Mistral' },
  OPENROUTER: { icon: Brain, color: 'text-purple-500', label: 'OpenRouter' },
};

export default function CredentialsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await api.get('/integrations');
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Credential deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const filtered = integrations.filter((i: any) => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || i.type === filterType;
    return matchSearch && matchType;
  });

  const types = [...new Set(integrations.map((i: any) => i.type as string))] as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credentials</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage API keys, tokens, and service connections
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Credential
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search credentials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={filterType === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('')}
          >
            All
          </Button>
          {types.map((t: string) => {
            const meta = TYPE_META[t] || { label: t, icon: Key, color: 'text-gray-500' };
            return (
              <Button
                key={t}
                variant={filterType === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(t)}
                className="gap-1.5"
              >
                <meta.icon className={`h-3 w-3 ${filterType !== t ? meta.color : ''}`} />
                {meta.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Key className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || filterType ? 'No credentials match your filters' : 'No credentials yet'}
            </p>
            {!search && !filterType && (
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setWizardOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add your first credential
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cred: any) => {
            const meta = TYPE_META[cred.type] || { label: cred.type, icon: Key, color: 'text-gray-500' };
            const Icon = meta.icon;
            return (
              <Card key={cred.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{cred.name}</p>
                        <Badge variant="secondary" className="text-[10px] mt-0.5">
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm('Delete this credential?')) deleteMutation.mutate(cred.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Created {new Date(cred.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <IntegrationWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
