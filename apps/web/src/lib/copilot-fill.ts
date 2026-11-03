/** Window event that puts a question in the copilot composer (or sends it), from any panel. */
export const COPILOT_FILL_EVENT = 'mitsinjo:copilot:fill';

export interface CopilotFillDetail {
  prompt: string;
  /** Send the question right away instead of leaving it in the field. */
  autoSend?: boolean;
}

/** Fills the copilot composer with `prompt`; no-op on the server. */
export function fillCopilotPrompt(prompt: string, autoSend = false): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<CopilotFillDetail>(COPILOT_FILL_EVENT, { detail: { prompt, autoSend } })
  );
}
