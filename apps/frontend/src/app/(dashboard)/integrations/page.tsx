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

interface BotVerification {
  ok: boolean;
  botId: number;
  botName: string;
  botUsername: string;
  photoUrl?: string;
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [verifiedBot, setVerifiedBot] = useState<BotVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

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
      toast.success('Integration added');
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
    setShowAddForm(false);
    setBotToken('');
    setVerifiedBot(null);
  };

  const handleVerify = async () => {
    if (!botToken.trim()) return;
    setIsVerifying(true);
    try {
      const res = await api.post('/integrations/telegram/verify', { botToken });
      const data = res.data.data || res.data;
      if (data.ok) {
        setVerifiedBot(data);
        toast.success(`Bot @${data.botUsername} verified`);
      } else {
        toast.error('Invalid bot token');
        setVerifiedBot(null);
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAddBot = () => {
    if (!verifiedBot) return;
    createMutation.mutate({
      type: 'TELEGRAM',
      name: `@${verifiedBot.botUsername}`,
      config: { botToken },
      metadata: {
        botId: verifiedBot.botId,
        botName: verifiedBot.botName,
        botUsername: verifiedBot.botUsername,
        photoUrl: verifiedBot.photoUrl,
      },
    });
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
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Integration
        </button>
      </div>

      {/* Add Telegram Bot Form */}
      {showAddForm && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-500/10">
              <Send className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h3 className="font-semibold">Add Telegram Bot</h3>
              <p className="text-sm text-muted-foreground">
                Enter your bot token from @BotFather
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleVerify}
              disabled={isVerifying || !botToken.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Verify
            </button>
          </div>

          {/* Verified Bot Card */}
          {verifiedBot && (
            <div className="flex items-center gap-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-sky-500/10 overflow-hidden">
                {verifiedBot.photoUrl ? (
                  <img
                    src={verifiedBot.photoUrl}
                    alt={verifiedBot.botName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <Bot className="h-6 w-6 text-sky-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{verifiedBot.botName}</p>
                <p className="text-sm text-muted-foreground">
                  @{verifiedBot.botUsername}
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={resetForm}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddBot}
              disabled={!verifiedBot || createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Add Bot
            </button>
          </div>
        </div>
      )}

      {/* Integrations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
            <Link2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No integrations yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Add a Telegram bot to start building automated workflows
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-500/10 overflow-hidden">
                    {(integration.metadata as any)?.photoUrl ? (
                      <img
                        src={(integration.metadata as any).photoUrl}
                        alt={integration.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <Send className="h-5 w-5 text-sky-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {integration.type}
                    </p>
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
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Connected
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      Inactive
                    </span>
                  </>
                )}
                <span className="text-muted-foreground ml-auto">
                  {new Date(integration.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
