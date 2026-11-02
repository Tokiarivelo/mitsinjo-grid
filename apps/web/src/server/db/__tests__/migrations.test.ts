import { describe, expect, it } from 'vitest';
import { MIGRATIONS, assertMigrationsValid, runMigrations, type SqlExec } from '../migrations';

/** In-memory stand-in for Neon: records statements, keeps `schema_migrations` ids. */
function fakeDb(alreadyApplied: string[] = [], failOn?: string) {
  const ids = new Set(alreadyApplied);
  const log: string[] = [];
  const exec: SqlExec = async (text, params) => {
    log.push(text);
    if (failOn && text.includes(failOn)) throw new Error('boom');
    if (text.startsWith('SELECT id FROM schema_migrations')) return [...ids].map((id) => ({ id }));
    if (text.startsWith('INSERT INTO schema_migrations')) ids.add(String(params?.[0]));
    return [];
  };
  return { exec, ids, log };
}

describe('Neon migrations', () => {
  it('shipped list is valid: NNNN_name ids, strictly increasing, none empty', () => {
    expect(() => assertMigrationsValid(MIGRATIONS)).not.toThrow();
    expect(() =>
      assertMigrationsValid([
        { id: '0002_b', statements: ['x'] },
        { id: '0001_a', statements: ['x'] },
      ])
    ).toThrow(/order/);
    expect(() => assertMigrationsValid([{ id: 'add_table', statements: ['x'] }])).toThrow(/id/);
    expect(() => assertMigrationsValid([{ id: '0001_a', statements: [] }])).toThrow(/Empty/);
  });

  it('fresh database: applies every migration in order and records it', async () => {
    const db = fakeDb();
    expect(await runMigrations(db.exec)).toEqual(MIGRATIONS.map((m) => m.id));
    expect([...db.ids]).toEqual(MIGRATIONS.map((m) => m.id));
    expect(db.log[0]).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
  });

  it('up-to-date database: runs nothing; second run is a no-op', async () => {
    const db = fakeDb();
    await runMigrations(db.exec);
    const before = db.log.length;
    expect(await runMigrations(db.exec)).toEqual([]);
    expect(db.log.slice(before).some((t) => t.startsWith('ALTER') || t.includes('copilot_'))).toBe(
      false
    );
  });

  it('only the pending ones run (a new migration appended later)', async () => {
    const db = fakeDb(MIGRATIONS.map((m) => m.id));
    const next = [
      ...MIGRATIONS,
      { id: '9999_new_table', statements: ['CREATE TABLE IF NOT EXISTS t (id INT)'] },
    ];
    expect(await runMigrations(db.exec, next)).toEqual(['9999_new_table']);
  });

  it('a failing statement stops the run and leaves that migration pending', async () => {
    const db = fakeDb([], 'summarized_count');
    await expect(runMigrations(db.exec)).rejects.toThrow('boom');
    expect(db.ids.has('0002_message_decision')).toBe(true);
    expect(db.ids.has('0003_session_summary')).toBe(false);
  });

  it('every statement is idempotent (safe for databases created before the migration table)', () => {
    for (const m of MIGRATIONS) for (const s of m.statements) expect(s).toMatch(/IF NOT EXISTS/);
  });
});
