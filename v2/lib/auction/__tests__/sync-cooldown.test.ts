import { describe, it, expect } from 'vitest';
import {
  SYNC_COOLDOWN_MS,
  cooldownRemainingMs,
  lastSystemSyncAt,
} from '../sync-cooldown';

type Row = Record<string, unknown>;

/**
 * Stand-in for the admin client covering exactly the chain the helper uses:
 * select / eq / is / not / order / limit / maybeSingle.
 * `is` and `not(..., 'is', null)` are modelled faithfully because the whole
 * point of the query is which rows it excludes.
 */
function makeAdmin(rows: Row[]) {
  const filters: Array<(r: Row) => boolean> = [];
  let orderDesc = false;
  const q = {
    select: () => q,
    eq(col: string, val: unknown) {
      filters.push((r) => r[col] === val);
      return q;
    },
    is(col: string, val: null) {
      filters.push((r) => r[col] === val);
      return q;
    },
    not(col: string, _op: 'is', val: null) {
      filters.push((r) => r[col] !== val);
      return q;
    },
    order(_col: string, opts?: { ascending?: boolean }) {
      orderDesc = opts?.ascending === false;
      return q;
    },
    limit: () => q,
    async maybeSingle() {
      let out = rows.filter((r) => filters.every((f) => f(r)));
      out = [...out].sort((a, b) => {
        const av = String(a.entered_at ?? '');
        const bv = String(b.entered_at ?? '');
        return (av < bv ? -1 : av > bv ? 1 : 0) * (orderDesc ? -1 : 1);
      });
      return { data: out[0] ?? null, error: null };
    },
  };
  return { from: () => q } as unknown as Parameters<typeof lastSystemSyncAt>[0];
}

describe('cooldownRemainingMs', () => {
  const now = new Date('2026-09-14T12:00:00.000Z');

  it('allows a sync when the session has never been synced', () => {
    expect(cooldownRemainingMs(null, now)).toBe(0);
  });

  it('blocks a sync 10 seconds after the last one', () => {
    const last = new Date(now.getTime() - 10_000);
    expect(cooldownRemainingMs(last, now)).toBe(SYNC_COOLDOWN_MS - 10_000);
  });

  it('allows a sync once the window has elapsed', () => {
    expect(cooldownRemainingMs(new Date(now.getTime() - 61_000), now)).toBe(0);
    expect(cooldownRemainingMs(new Date(now.getTime() - SYNC_COOLDOWN_MS), now)).toBe(0);
  });

  it('never blocks on a future timestamp', () => {
    // Clock skew between the DB and the function must not lock a league out.
    expect(cooldownRemainingMs(new Date(now.getTime() + 600_000), now)).toBe(0);
  });
});

describe('lastSystemSyncAt', () => {
  const SESSION = 'sess-1';

  it('returns null when nothing has been synced', async () => {
    expect(await lastSystemSyncAt(makeAdmin([]), SESSION)).toBeNull();
  });

  it('returns the newest system-written timestamp', async () => {
    const admin = makeAdmin([
      { session_id: SESSION, entered_by: null, entered_at: '2026-09-14T11:00:00.000Z' },
      { session_id: SESSION, entered_by: null, entered_at: '2026-09-14T11:59:00.000Z' },
    ]);
    const out = await lastSystemSyncAt(admin, SESSION);
    expect(out?.toISOString()).toBe('2026-09-14T11:59:00.000Z');
  });

  it('ignores rows a human entered', async () => {
    // A commissioner typing results by hand must not suppress an automatic sync.
    const admin = makeAdmin([
      { session_id: SESSION, entered_by: 'user-1', entered_at: '2026-09-14T11:59:00.000Z' },
    ]);
    expect(await lastSystemSyncAt(admin, SESSION)).toBeNull();
  });

  it('ignores rows with no timestamp', async () => {
    // entered_at is NULLABLE, and Postgres sorts NULLs FIRST on a DESC order —
    // so without the not-null filter the "newest" row found could be one with
    // no timestamp at all, and the cooldown would silently never engage.
    const admin = makeAdmin([
      { session_id: SESSION, entered_by: null, entered_at: null },
      { session_id: SESSION, entered_by: null, entered_at: '2026-09-14T11:00:00.000Z' },
    ]);
    const out = await lastSystemSyncAt(admin, SESSION);
    expect(out?.toISOString()).toBe('2026-09-14T11:00:00.000Z');
  });
});
