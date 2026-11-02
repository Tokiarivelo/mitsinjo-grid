/**
 * Background stage jobs (PG-T18): the stages left after a shape's first answer run on the server
 * while the browser follows them on the same SSE stream. Each job keeps its events in order, so
 * a dropped stream resumes from the last one it saw (`followJob(id, from)`). In memory, one
 * server process; jobs are forgotten `JOB_TTL_MS` after they end. No energy values here.
 */

export interface JobEvent {
  event: string;
  data: Record<string, unknown>;
}

interface Job {
  events: JobEvent[];
  done: boolean;
  /** When it ended (TTL), else when it started. */
  at: number;
  listeners: Set<() => void>;
  abort: AbortController;
}

/** A finished job is kept this long for late reconnects. */
export const JOB_TTL_MS = 10 * 60_000;
/** Most jobs kept at once (oldest finished dropped first). */
export const MAX_JOBS = 200;

const jobs = new Map<string, Job>();

function sweep(now: number) {
  for (const [id, j] of jobs) if (j.done && now - j.at > JOB_TTL_MS) jobs.delete(id);
  if (jobs.size <= MAX_JOBS) return;
  for (const [id, j] of jobs) {
    if (jobs.size <= MAX_JOBS) break;
    if (j.done) jobs.delete(id);
  }
}

/** New job; its `signal` aborts when the job is cancelled. */
export function createJob(id: string, now = Date.now()): AbortSignal {
  sweep(now);
  const job: Job = {
    events: [],
    done: false,
    at: now,
    listeners: new Set(),
    abort: new AbortController(),
  };
  jobs.set(id, job);
  return job.abort.signal;
}

export function hasJob(id: string): boolean {
  return jobs.has(id);
}

/** Appends an event and wakes the followers. Ignored after the job ended. */
export function pushJobEvent(id: string, event: string, data: Record<string, unknown>) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  job.events.push({ event, data });
  for (const l of job.listeners) l();
}

/** Last event, then the job is done (followers return). */
export function finishJob(
  id: string,
  event: string,
  data: Record<string, unknown>,
  now = Date.now()
) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  job.events.push({ event, data });
  job.done = true;
  job.at = now;
  for (const l of job.listeners) l();
}

/** Stops a running job (a manual edit, a new request): its stages see the abort. */
export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.done) return false;
  job.abort.abort();
  return true;
}

/**
 * Sends the job's events from index `from` on, then each new one, until the job is done or
 * `signal` aborts. Resolves to the index after the last event sent; -1 for an unknown job.
 */
export async function followJob(
  id: string,
  from: number,
  send: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal
): Promise<number> {
  const job = jobs.get(id);
  if (!job) return -1;
  let next = Math.max(0, Math.floor(from));
  const flush = () => {
    while (next < job.events.length) {
      const e = job.events[next]!;
      send(e.event, { ...e.data, seq: next });
      next++;
    }
  };
  flush();
  if (job.done || signal?.aborted) return next;
  await new Promise<void>((resolve) => {
    const wake = () => {
      flush();
      if (job.done || signal?.aborted) {
        job.listeners.delete(wake);
        signal?.removeEventListener('abort', wake);
        resolve();
      }
    };
    job.listeners.add(wake);
    signal?.addEventListener('abort', wake, { once: true });
  });
  return next;
}

/** Test helper: forget every job. */
export function resetJobs() {
  jobs.clear();
}
