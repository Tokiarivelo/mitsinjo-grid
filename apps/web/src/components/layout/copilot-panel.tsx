'use client';

import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTranslations } from '@/lib/i18n';
import { CopilotWorkspace } from '@/features/copilot';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp?: string;
  evidence?: { label: string; value: string | number; unit?: string }[];
}

export interface CopilotPanelProps {
  open: boolean;
  onClose: () => void;
  messages?: CopilotMessage[];
  suggestedPrompts?: string[];
  pending?: boolean;
  error?: string;
  onSendMessage?: (content: string) => void;
  className?: string;
}

export function CopilotPanel({ open, onClose, className }: CopilotPanelProps) {
  const tCopilot = useTranslations('copilot');

  if (!open) return null;

  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-xs xl:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label={tCopilot('title')}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] flex-col bg-surface border-l border-border shadow-2xl transition-transform duration-panel ease-in-out',
          'xl:static xl:shadow-none',
          className
        )}
      >
        {/* Header */}
        <div className="flex h-17 items-center justify-between px-4 border-b border-border bg-surface-elevated/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-control-sm bg-ai-violet/15 text-ai-violet">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-text-primary">
                {tCopilot('title')}
              </span>
              <StatusBadge variant="ai" label={tCopilot('badge')} size="sm" />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tCopilot('close')}
            className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Workspace embedded in panel mode */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <CopilotWorkspace mode="panel" />
        </div>
      </aside>
    </>
  );
}
