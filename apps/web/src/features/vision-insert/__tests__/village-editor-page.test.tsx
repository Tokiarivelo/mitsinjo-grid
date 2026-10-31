import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';

vi.mock('../utils/prepare-image', async (orig) => ({
  ...(await orig<typeof import('../utils/prepare-image')>()),
  prepareVisionImage: vi.fn(async () => new Blob([new Uint8Array(4)], { type: 'image/jpeg' })),
}));

import { SAMPLE_ROOM_URL, VillageEditorPage } from '../index';

const detections = [
  { id: 'det-1', label: 'Fridge', category: 'fridge', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 } },
  { id: 'det-2', label: 'Samsung TV', category: 'tv', box: { x: 0.5, y: 0.3, w: 0.2, h: 0.2 } },
];
const sseBody = `event: vision_detections\ndata: ${JSON.stringify({ phase: 'boxes', detections, source: 'mock', model: 'm' })}\n\nevent: done\ndata: {}\n\n`;

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string) =>
    url === SAMPLE_ROOM_URL
      ? // jsdom's FileReader only reads its own Blob, not Node's Response.blob().
        ({ blob: async () => new Blob([new Uint8Array(8)], { type: 'image/jpeg' }) } as Response)
      : new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

const renderPage = () =>
  render(
    <I18nProvider>
      <VillageEditorPage />
    </I18nProvider>
  );

describe('VillageEditorPage (/village)', () => {
  it('starts with the photo picker and the simulated-data label', () => {
    renderPage();
    expect(screen.getByText('Drop a photo here')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeTruthy();
    expect(screen.getAllByText('SIMULATED DATA').length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a JPEG, PNG or WebP photo', async () => {
    renderPage();
    const input = screen.getByLabelText('Choose a photo', { selector: 'input' });
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toBe('Use a JPEG, PNG or WebP photo.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sample room → detections → select one', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use the sample room' }));
    const tv = await screen.findByRole('button', { name: /Samsung TV/ });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([SAMPLE_ROOM_URL, '/api/vision']);
    expect(screen.getByText('No appliance selected yet.')).toBeTruthy();
    fireEvent.click(tv);
    expect(screen.getByText('Selected: Samsung TV (Television)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeTruthy();
  });
});
