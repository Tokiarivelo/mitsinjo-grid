import { describe, it, expect, vi } from 'vitest';
import { COPILOT_FILL_EVENT, fillCopilotPrompt, type CopilotFillDetail } from '../copilot-fill';

describe('fillCopilotPrompt', () => {
  it('dispatches the fill event with the prompt', () => {
    const listener = vi.fn();
    window.addEventListener(COPILOT_FILL_EVENT, listener);
    fillCopilotPrompt('Why?');
    window.removeEventListener(COPILOT_FILL_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0]![0] as CustomEvent<CopilotFillDetail>).detail;
    expect(detail).toEqual({ prompt: 'Why?', autoSend: false });
  });

  it('passes autoSend through', () => {
    const listener = vi.fn();
    window.addEventListener(COPILOT_FILL_EVENT, listener);
    fillCopilotPrompt('Go', true);
    window.removeEventListener(COPILOT_FILL_EVENT, listener);

    const detail = (listener.mock.calls[0]![0] as CustomEvent<CopilotFillDetail>).detail;
    expect(detail.autoSend).toBe(true);
  });
});
