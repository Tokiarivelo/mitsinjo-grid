import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessageItem } from '../chat-message-item';
import type { ChatMessageData } from '../../types';

class FakeUtterance {
  text: string;
  lang = '';
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const FR = { lang: 'fr-FR', name: 'Google français' };
const EN = { lang: 'en-US', name: 'Google US English' };
const MG = { lang: 'mg-MG', name: 'Malagasy' };

function stubSpeech(voices: { lang: string; name: string }[]) {
  const speak = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  Object.defineProperty(window, 'speechSynthesis', {
    value: { speak, cancel, getVoices: () => voices },
    configurable: true,
  });
  return { speak, cancel };
}

const answer: ChatMessageData = {
  id: 'a1',
  role: 'assistant',
  content: 'Full answer.',
  sections: {
    whatHappened: 'The school runs short at 19:00.',
    computedEvidence: 'Demand: 10 kWh',
    whyItMatters: 'Evening classes need light.',
    exploreNext: 'Try essential-first.',
  },
};

describe('ChatMessageItem readout voice (M3-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the summary sections in a voice of the locale, never the evidence', () => {
    const { speak } = stubSpeech([FR, EN]);
    render(<ChatMessageItem message={answer} locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read response aloud' }));
    expect(speak).toHaveBeenCalledTimes(1);
    const said = speak.mock.calls[0]![0] as FakeUtterance;
    expect(said.lang).toBe('en');
    expect(said.voice).toBe(EN);
    expect(said.text).toContain('runs short at 19:00');
    expect(said.text).toContain('need light');
    expect(said.text).not.toContain('Demand: 10 kWh');
  });

  it('picks the French voice for the French locale', () => {
    const { speak } = stubSpeech([EN, FR]);
    render(<ChatMessageItem message={answer} locale="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read response aloud' }));
    const said = speak.mock.calls[0]![0] as FakeUtterance;
    expect(said.lang).toBe('fr');
    expect(said.voice).toBe(FR);
  });

  it('Malagasy without a voice stays text-only; with one it reads', () => {
    const noVoice = stubSpeech([EN, FR]);
    const { unmount } = render(<ChatMessageItem message={answer} locale="mg" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read response aloud' }));
    expect(noVoice.speak).not.toHaveBeenCalled();
    unmount();

    const withVoice = stubSpeech([EN, MG]);
    render(<ChatMessageItem message={answer} locale="mg" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read response aloud' }));
    expect(withVoice.speak).toHaveBeenCalledTimes(1);
    expect((withVoice.speak.mock.calls[0]![0] as FakeUtterance).voice).toBe(MG);
  });

  it('second click stops the audio (mute)', () => {
    const { speak, cancel } = stubSpeech([EN]);
    render(<ChatMessageItem message={answer} locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Read response aloud' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop audio' }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
  });
});

describe('ChatMessageItem visual card (M5-T2)', () => {
  const visualAnswer: ChatMessageData = {
    ...answer,
    id: 'v1',
    visual: {
      kind: 'village_tonight',
      imageUrl: 'https://img.example/village.webp',
      caption: 'Le village ce soir',
      overlay: null,
      resultId: 'SIM-1',
    },
  };

  it('shows the generated visual with an AI badge and its caption', () => {
    render(<ChatMessageItem message={visualAnswer} locale="en" />);
    const img = screen.getByRole('img', { name: 'Le village ce soir' });
    expect(img).toHaveAttribute('src', 'https://img.example/village.webp');
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
  });

  it('click opens the existing lightbox with the visual', () => {
    const onMediaClick = vi.fn();
    render(<ChatMessageItem message={visualAnswer} locale="fr" onMediaClick={onMediaClick} />);
    fireEvent.click(screen.getByRole('img', { name: 'Le village ce soir' }));
    expect(onMediaClick).toHaveBeenCalledWith({
      url: 'https://img.example/village.webp',
      type: 'image',
      title: 'Le village ce soir',
      caption: 'Le village ce soir',
    });
  });

  it('keyboard opens the lightbox too', () => {
    const onMediaClick = vi.fn();
    render(<ChatMessageItem message={visualAnswer} locale="fr" onMediaClick={onMediaClick} />);
    fireEvent.keyDown(screen.getByRole('img', { name: 'Le village ce soir' }), { key: 'Enter' });
    expect(onMediaClick).toHaveBeenCalledTimes(1);
  });
});
