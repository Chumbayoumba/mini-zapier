'use client';

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  linkUrl?: string;
  linkText?: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function HelpTooltip({
  content,
  linkUrl,
  linkText,
  className,
  side = 'top',
}: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors',
              className,
            )}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs text-xs leading-relaxed"
        >
          <div className="space-y-1">
            <div>{content}</div>
            {linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                {linkText || 'Learn more'} ↗
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
