import { afterEach, describe, expect, it } from 'vitest';
import {
  JOB_TTL_MS,
  cancelJob,
  createJob,
  finishJob,
  followJob,
  hasJob,
  pushJobEvent,
  resetJobs,
} from '../shape-jobs';

afterEach(() => resetJobs());

const collect = () => {
  const got: Array<[string, Record<string, unknown>]> = [];
  return { got, send: (e: string, d: Record<string, unknown>) => got.push([e, d]) };
};

describe('shape jobs (PG-T18)', () => {
  it('a follower gets past and new events in order, with their seq, until the job ends', async () => {
    createJob('j');
    pushJobEvent('j', 'shape_stage', { index: 1 });
    const { got, send } = collect();
    const done = followJob('j', 0, send);
    pushJobEvent('j', 'shape_stage', { index: 2 });
    finishJob('j', 'shape_stages_done', { status: 'done' });
    expect(await done).toBe(3);
    expect(got.map(([e, d]) => [e, d.seq])).toEqual([
      ['shape_stage', 0],
      ['shape_stage', 1],
      ['shape_stages_done', 2],
    ]);
  });

  it('a dropped stream resumes from the last event it saw', async () => {
    createJob('j');
    pushJobEvent('j', 'shape_stage', { index: 1 });
    pushJobEvent('j', 'shape_stage', { index: 2 });
    finishJob('j', 'shape_stages_done', { status: 'stopped', cause: 'timeout' });
    const { got, send } = collect();
    await followJob('j', 2, send);
    expect(got.map(([e]) => e)).toEqual(['shape_stages_done']);
  });

  it('an aborted follower returns; the job keeps running for a reconnect', async () => {
    createJob('j');
    const ctrl = new AbortController();
    const { send } = collect();
    const p = followJob('j', 0, send, ctrl.signal);
    ctrl.abort();
    expect(await p).toBe(0);
    pushJobEvent('j', 'shape_stage', { index: 1 });
    const again = collect();
    finishJob('j', 'shape_stages_done', { status: 'done' });
    await followJob('j', 0, again.send);
    expect(again.got).toHaveLength(2);
  });

  it('cancel aborts the job signal; unknown jobs answer -1; finished jobs expire', async () => {
    const signal = createJob('j', 0);
    expect(cancelJob('j')).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(await followJob('nope', 0, () => {})).toBe(-1);
    finishJob('j', 'shape_stages_done', { status: 'stopped', cause: 'aborted' }, 0);
    expect(cancelJob('j')).toBe(false);
    createJob('k', JOB_TTL_MS + 1);
    expect(hasJob('j')).toBe(false);
    expect(hasJob('k')).toBe(true);
  });

  it('events after the end are ignored', async () => {
    createJob('j');
    finishJob('j', 'shape_stages_done', { status: 'done' });
    pushJobEvent('j', 'shape_stage', { index: 9 });
    const { got, send } = collect();
    await followJob('j', 0, send);
    expect(got).toHaveLength(1);
  });
});
