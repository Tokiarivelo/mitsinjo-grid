import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoiceSpectrum } from '../voice-spectrum';

const SAMPLE_RATE = 48_000;
const BIN_COUNT = 2048;

/** Analyser that always hears one tone at `hz`. */
function fakeAnalyser(hz: number | null): AnalyserNode {
  return {
    frequencyBinCount: BIN_COUNT,
    context: { sampleRate: SAMPLE_RATE },
    getByteFrequencyData(out: Uint8Array) {
      out.fill(0);
      if (hz === null) return;
      const i = Math.round(hz / (SAMPLE_RATE / (2 * BIN_COUNT)));
      out[i - 1] = 160;
      out[i] = 220;
      out[i + 1] = 160;
    },
  } as unknown as AnalyserNode;
}

/** Runs exactly one animation frame. */
function oneFrame() {
  let ran = false;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    if (!ran) {
      ran = true;
      cb(1000);
    }
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  return cancel;
}

describe('VoiceSpectrum', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the loudest frequency and raises the bar of its band', () => {
    oneFrame();
    const { container } = render(<VoiceSpectrum analyser={fakeAnalyser(440)} />);

    expect(
      screen.getByRole('img', { name: /frequency spectrum of the microphone/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Peak 4[34]\d Hz$/)).toBeInTheDocument();
    expect(screen.getByText('Voice pitch')).toBeInTheDocument();
    expect(screen.getByText('1 kHz')).toBeInTheDocument();

    const scales = [...container.querySelectorAll<HTMLDivElement>('.origin-bottom')].map((bar) =>
      Number(/scaleY\(([\d.]+)\)/.exec(bar.style.transform)?.[1])
    );
    expect(scales).toHaveLength(48);
    expect(scales.filter((s) => s > 0.8)).toHaveLength(1);
  });

  it('silence → no peak, and the animation stops on unmount', () => {
    const cancel = oneFrame();
    const { unmount } = render(<VoiceSpectrum analyser={fakeAnalyser(null)} />);
    expect(screen.getByText('Peak —')).toBeInTheDocument();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
