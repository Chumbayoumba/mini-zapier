import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-2xl font-bold">Terms of Service</h2>
        <p className="text-sm text-muted-foreground mt-1">Last updated: March 2026</p>
      </div>
      <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
        <p>By using FlowForge, you agree to these terms. FlowForge provides a workflow automation platform on an &quot;as is&quot; basis.</p>
        <p>You are responsible for the workflows you create and the data processed through them. Do not use the platform for illegal activities.</p>
        <p>We reserve the right to suspend accounts that violate these terms or abuse the platform resources.</p>
        <p>For questions, contact the platform administrator.</p>
      </div>
      <a href="/register">
        <Button variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Register
        </Button>
      </a>
    </div>
  );
}
