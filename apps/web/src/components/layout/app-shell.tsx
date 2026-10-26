'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CopilotPanel, type CopilotMessage } from './copilot-panel';
import type { StatusBadgeVariant } from '@/components/ui/status-badge';
import type { ScenarioOption } from '@/components/ui/scenario-selector';
import { useTranslations } from '@/lib/i18n';

export interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  status?: StatusBadgeVariant;
  modified?: boolean;
  scenarios?: ScenarioOption[];
  activeScenarioId?: string;
  onScenarioChange?: (id: string) => void;
  onReset?: () => void;
  className?: string;
}

export function AppShell({
  children,
  title,
  subtitle,
  status = 'ready',
  modified = false,
  scenarios,
  activeScenarioId,
  onScenarioChange,
  onReset,
  className,
}: AppShellProps) {
  const pathname = usePathname();
  const tRoutes = useTranslations('routes');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);

  // On the /copilot route, the full page is the copilot workspace, so we hide the slide-out panel
  const isCopilotRoute = pathname === '/copilot';

  const routeKey = pathname?.replace(/^\//, '') || 'overview';

  let defaultTitle = 'Mitsinjo Grid';
  let defaultSubtitle = 'Rural Solar Microgrid Simulation';

  try {
    defaultTitle = tRoutes(`${routeKey}.title`);
    defaultSubtitle = tRoutes(`${routeKey}.subtitle`);
  } catch {
    // Fallback if key not in route catalog
  }

  const resolvedTitle = title || defaultTitle;
  const resolvedSubtitle = subtitle || defaultSubtitle;

  const handleSendMessage = (content: string) => {
    const userMsg: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    // Simulated copilot response for UI showcase
    setTimeout(() => {
      const assistantMsg: CopilotMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Analyzing "${content}": Under the current baseline scenario, the battery reserve maintains 20% minimum state of charge while keeping essential clinic services 100% covered.`,
        evidence: [
          { label: 'Battery Min SoC', value: 20.0, unit: '%' },
          { label: 'Essential Coverage', value: 100.0, unit: '%' },
        ],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 600);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-text-primary">
      {/* Sidebar (desktop fixed / mobile drawer) */}
      <Sidebar
        status={status}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header
          title={resolvedTitle}
          subtitle={resolvedSubtitle}
          status={status}
          modified={modified}
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onScenarioChange={onScenarioChange}
          onReset={onReset}
          copilotOpen={copilotOpen && !isCopilotRoute}
          onCopilotToggle={
            !isCopilotRoute ? () => setCopilotOpen((prev) => !prev) : undefined
          }
          onMenuToggle={() => setSidebarOpen(true)}
        />

        {/* Content Area + Optional Copilot Panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main workspace (scrolls independently, padding 24: p-6) */}
          <main
            className={cn(
              'flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 bg-canvas',
              className
            )}
          >
            {children}
          </main>

          {/* Right Copilot Panel (when not on /copilot page) */}
          {!isCopilotRoute && (
            <CopilotPanel
              open={copilotOpen}
              onClose={() => setCopilotOpen(false)}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
