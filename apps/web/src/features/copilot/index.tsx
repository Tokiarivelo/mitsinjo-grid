'use client';

import { CopilotWorkspace } from './ui/copilot-workspace';

export function CopilotPage() {
  return <CopilotWorkspace mode="full" />;
}

export { CopilotWorkspace } from './ui/copilot-workspace';
export { CopilotTerminal } from './ui/copilot-terminal';
export { CopilotProvider } from './hooks/copilot-context';
export { MarkdownRenderer } from './ui/markdown-renderer';
export { MediaLightboxModal } from './ui/media-lightbox-modal';
export { CanvasSketchDialog } from './ui/canvas-sketch-dialog';
export { ChatChart } from './ui/chat-chart';
export { useCopilot } from './hooks/use-copilot';
export * from './types';
