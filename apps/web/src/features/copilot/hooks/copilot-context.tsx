'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useCopilot } from './use-copilot';

export type CopilotApi = ReturnType<typeof useCopilot>;

const CopilotContext = createContext<CopilotApi | null>(null);

/** One conversation shared by every chat view below (copilot tab, full-screen terminal). */
export function CopilotProvider({ children }: { children: ReactNode }) {
  const api = useCopilot();
  return <CopilotContext.Provider value={api}>{children}</CopilotContext.Provider>;
}

/** Uses the conversation of an enclosing provider, or starts one when there is none. */
export function EnsureCopilot({ children }: { children: ReactNode }) {
  const shared = useContext(CopilotContext);
  return shared ? <>{children}</> : <CopilotProvider>{children}</CopilotProvider>;
}

/** The shared conversation; needs a `CopilotProvider` (or `EnsureCopilot`) above. */
export function useSharedCopilot(): CopilotApi {
  const api = useContext(CopilotContext);
  if (!api) throw new Error('useSharedCopilot needs a <CopilotProvider> above it.');
  return api;
}
