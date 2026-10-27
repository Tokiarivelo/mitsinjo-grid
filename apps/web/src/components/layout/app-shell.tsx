'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CopilotPanel } from './copilot-panel';
import type { StatusBadgeVariant } from '@/components/ui/status-badge';
import type { ScenarioOption } from '@/components/ui/scenario-selector';
import { useTranslations } from '@/lib/i18n';
import { useSimulationStore } from '@/stores';
import type { ScenarioId } from '@mitsinjo/engine';

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
  status,
  modified,
  scenarios,
  activeScenarioId,
  onScenarioChange,
  onReset,
  className,
}: AppShellProps) {
  const storeStatus = useSimulationStore((s) => s.status);
  const storeScenarioId = useSimulationStore((s) => s.scenarioId);
  const loadScenario = useSimulationStore((s) => s.loadScenario);
  const resetScenario = useSimulationStore((s) => s.reset);

  const resolvedStatus: StatusBadgeVariant =
    status ??
    (storeStatus === 'modified'
      ? 'modified'
      : storeStatus === 'complete'
      ? 'complete'
      : storeStatus === 'running'
      ? 'running'
      : storeStatus === 'error'
      ? 'error'
      : 'ready');
  const resolvedModified = modified ?? (storeStatus === 'modified');
  const resolvedActiveScenarioId = activeScenarioId ?? storeScenarioId;
  const resolvedOnScenarioChange =
    onScenarioChange ?? ((id: string) => loadScenario(id as ScenarioId));
  const resolvedOnReset = onReset ?? resetScenario;
  const pathname = usePathname();
  const tRoutes = useTranslations('routes');
  const tCommon = useTranslations('common');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // On the /copilot route, the full page is the copilot workspace, so we hide the slide-out panel
  const isCopilotRoute = pathname === '/copilot';

  const routeKey = pathname?.replace(/^\//, '') || 'overview';

  let defaultTitle = tCommon('appName');
  let defaultSubtitle = '';

  try {
    defaultTitle = tRoutes(`${routeKey}.title`);
    defaultSubtitle = tRoutes(`${routeKey}.subtitle`);
  } catch {
    // Fallback if key not in route catalog
  }

  const resolvedTitle = title || defaultTitle;
  const resolvedSubtitle = subtitle || defaultSubtitle;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-text-primary">
      {/* Sidebar (desktop fixed / mobile drawer) */}
      <Sidebar
        status={resolvedStatus}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header
          title={resolvedTitle}
          subtitle={resolvedSubtitle}
          status={resolvedStatus}
          modified={resolvedModified}
          scenarios={scenarios}
          activeScenarioId={resolvedActiveScenarioId}
          onScenarioChange={resolvedOnScenarioChange}
          onReset={resolvedOnReset}
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
