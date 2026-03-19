'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <h1 className="text-6xl font-bold text-destructive">500</h1>
            <h2 className="text-2xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground max-w-md">
              {error.message || 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <Button onClick={reset}>Try again</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
