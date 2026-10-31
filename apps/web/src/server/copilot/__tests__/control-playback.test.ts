import { describe, it, expect } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { executeTool } from '../tools';
import { mockPlaybackCommand, playbackDoneAnswer } from '../providers/mock';
import { runCopilotLoop, type SseEventName } from '../loop';

const ctx = { input: scenarios.baseline.input, activeStrategy: 'proportional' as const };

describe('control_playback tool', () => {
  it('returns the command for the app and changes no input', () => {
    const res = executeTool('control_playback', { action: 'seek', hour: 18 }, ctx);
    expect(res.error).toBeUndefined();
    expect(res.control).toEqual({ action: 'seek', hour: 18 });
    expect(res.data?.status).toBe('applied_in_app');
    expect(executeTool('control_playback', { action: 'pause' }, ctx).control).toEqual({
      action: 'pause',
    });
  });

  it('invalid args → structured error, no command', () => {
    for (const args of [{ action: 'seek' }, { action: 'seek', hour: 24 }, { action: 'rewind' }]) {
      const res = executeTool('control_playback', args, ctx);
      expect(res.error).toBeTruthy();
      expect(res.control).toBeUndefined();
    }
  });
});

describe('mock playback triggers', () => {
  it.each([
    ['play', { action: 'play' }],
    ['Lance la lecture', { action: 'play' }],
    ['mets la lecture en pause', { action: 'pause' }],
    ['arrête l’animation', { action: 'stop' }],
    ['recommence la journée', { action: 'restart' }],
    ['va à 18 h', { action: 'seek', hour: 18 }],
    ['Go to 7:00', { action: 'seek', hour: 7 }],
  ])('%s', (q, expected) => expect(mockPlaybackCommand(q.toLowerCase())).toEqual(expected));

  it.each([
    'lance une simulation avec 40 % de baisse solaire',
    'start a run with a 40% solar drop',
    'coupe le courant du foyer du village',
    'va à 30 h',
  ])('not a playback order: %s', (q) => expect(mockPlaybackCommand(q.toLowerCase())).toBeNull());

  it('answers in one line, in the app language', () => {
    expect(playbackDoneAnswer('seek', 18, 'fr')).toBe(
      "Curseur déplacé à 18:00. Seule la vue a changé ; aucun réglage n'a été modifié."
    );
    expect(playbackDoneAnswer('pause', undefined, 'en')).toMatch(/^Playback paused\./);
  });
});

describe('control_playback through the loop (offline)', () => {
  it('"va à 18 h" emits a control event and a short answer, no proposal', async () => {
    const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
    await runCopilotLoop({
      messages: [{ role: 'user', content: 'va à 18 h' }],
      input: scenarios.baseline.input,
      emit: (name, data) => events.push({ name, data }),
      locale: 'fr',
    });
    expect(events.find((e) => e.name === 'control')?.data).toEqual({ action: 'seek', hour: 18 });
    expect(events.some((e) => e.name === 'proposal')).toBe(false);
    const text = events
      .filter((e) => e.name === 'delta')
      .map((e) => e.data.text)
      .join('');
    expect(text).toContain('Curseur déplacé à 18:00');
  });
});
