import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCopilot } from '../use-copilot';

afterEach(() => vi.unstubAllGlobals());

describe('useCopilot model picker', () => {
  it('defaults to Auto (adaptive) even when the server names another model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/copilot/models') {
          return new Response(
            JSON.stringify({ activeModel: 'muse-spark-1.3', models: ['muse-spark-1.3', 'wonder'] })
          );
        }
        return new Response(JSON.stringify({ sessions: [] }));
      })
    );
    const { result } = renderHook(() => useCopilot());
    await waitFor(() => expect(result.current.availableModels).toContain('muse-spark-1.3'));
    expect(result.current.selectedModel).toBe('auto');
    expect(result.current.availableModels[0]).toBe('auto');
  });
});
