'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export function CreateWorkflowDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/workflows', { name: name.trim(), description: description.trim() });
      toast.success('Workflow created');
      setOpen(false);
      setName('');
      setDescription('');
      router.push(`/workflows/${res.data.id}/editor`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> New Workflow
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-lg space-y-3 w-80">
      <h3 className="font-semibold text-sm">Create Workflow</h3>
      <Input
        placeholder="Workflow name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
