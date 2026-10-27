'use client';

import { CopilotWorkspace } from './ui/copilot-workspace';

export function CopilotPage() {
  return <CopilotWorkspace mode="full" />;
}

export { CopilotWorkspace } from './ui/copilot-workspace';
export { useCopilot } from './hooks/use-copilot';
export * from './types';
