import { describe, it, expect, vi, beforeEach } from 'vitest';

const holder = vi.hoisted(() => ({
  access: { ok: true, userId: 'u1' } as
    | { ok: true; userId: string }
    | { ok: false; status: 401 | 403 | 404; error: string },
  lastSync: null as Date | null,
  remaining: 0,
}));

vi.mock('../sync-access', () => ({
  authorizeSessionSync: async () => holder.access,
}));

vi.mock('@/lib/auction/sync-cooldown', () => ({
  lastSystemSyncAt: async () => holder.lastSync,
  cooldownRemainingMs: () => holder.remaining,
}));

import { guardMemberSync, SYNC_SKIPPED_MESSAGE } from '../sync-gate';

const admin = {} as Parameters<typeof guardMemberSync>[0];

describe('guardMemberSync', () => {
  beforeEach(() => {
    holder.access = { ok: true, userId: 'u1' };
    holder.lastSync = null;
    holder.remaining = 0;
  });

  it('returns null when the caller is a member and no sync is pending', async () => {
    // null means "proceed" - the route does its real work.
    expect(await guardMemberSync(admin, 'sess-1')).toBeNull();
  });

  it('passes an authorization failure straight through with its status', async () => {
    holder.access = { ok: false, status: 403, error: 'You are not a member of this league' };
    const res = await guardMemberSync(admin, 'sess-1');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    await expect(res!.json()).resolves.toEqual({
      error: 'You are not a member of this league',
    });
  });

  it('401s an anonymous caller', async () => {
    holder.access = { ok: false, status: 401, error: 'Not authenticated' };
    const res = await guardMemberSync(admin, 'sess-1');
    expect(res!.status).toBe(401);
  });

  it('returns a 200 skipped response while the cooldown is active', async () => {
    // Deliberately 200, not 429: nothing went wrong, the data is simply fresh.
    holder.lastSync = new Date('2026-09-14T11:59:30.000Z');
    holder.remaining = 30_000;
    const res = await guardMemberSync(admin, 'sess-1');
    expect(res!.status).toBe(200);
    await expect(res!.json()).resolves.toEqual({
      skipped: true,
      message: SYNC_SKIPPED_MESSAGE,
      lastSyncedAt: '2026-09-14T11:59:30.000Z',
      retryInMs: 30_000,
    });
  });

  it('does not run the cooldown check for an unauthorized caller', async () => {
    // A stranger must not learn when a league last synced.
    holder.access = { ok: false, status: 403, error: 'nope' };
    holder.remaining = 30_000;
    const res = await guardMemberSync(admin, 'sess-1');
    expect(res!.status).toBe(403);
    await expect(res!.json()).resolves.not.toHaveProperty('lastSyncedAt');
  });
});
