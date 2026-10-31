import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChatComposer } from '../use-chat-composer';

const media = { id: 'm1', url: 'data:image/png;base64,AA', type: 'image' as const, name: 'a.png' };

describe('useChatComposer', () => {
  it('sends text and attachments, then clears them', () => {
    const onSend = vi.fn();
    const { result } = renderHook(() => useChatComposer({ onSend, pending: false }));
    act(() => {
      result.current.setInput('Hello');
      result.current.addMedia(media);
    });
    act(() => result.current.send());
    expect(onSend).toHaveBeenCalledWith('Hello', [media]);
    expect(result.current.input).toBe('');
    expect(result.current.attachedMedia).toEqual([]);
  });

  it('does not send while pending or when empty', () => {
    const onSend = vi.fn();
    const { result, rerender } = renderHook(({ pending }) => useChatComposer({ onSend, pending }), {
      initialProps: { pending: false },
    });
    act(() => result.current.send());
    act(() => result.current.setInput('Hi'));
    rerender({ pending: true });
    expect(result.current.canSend).toBe(false);
    act(() => result.current.send());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('appends speech after typed text and removes one attachment', () => {
    const { result } = renderHook(() => useChatComposer({ onSend: vi.fn(), pending: false }));
    act(() => result.current.setInput('Cut  '));
    act(() => result.current.appendText('the market'));
    expect(result.current.input).toBe('Cut the market');
    act(() => result.current.addMedia(media));
    act(() => result.current.removeMedia('m1'));
    expect(result.current.attachedMedia).toEqual([]);
  });
});
