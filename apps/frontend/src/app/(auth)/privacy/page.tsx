import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-2xl font-bold">Privacy Policy</h2>
        <p className="text-sm text-muted-foreground mt-1">Last updated: March 2026</p>
      </div>
      <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
        <p>FlowForge collects only the data necessary to provide the service: email, name, and workflow configurations.</p>
        <p>Your credentials for third-party services (API keys, tokens) are stored encrypted and used only to execute your workflows.</p>
        <p>We do not sell or share your personal data with third parties. Workflow execution logs are retained for monitoring purposes.</p>
        <p>You can delete your account and all associated data at any time from the Settings page.</p>
      </div>
      <a href="/register">
        <Button variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Register
        </Button>
      </a>
    </div>
  );
}
