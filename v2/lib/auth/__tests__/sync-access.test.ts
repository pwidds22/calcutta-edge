import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

const holder = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: holder.user } }) },
  }),
}));

import { isCronRequest, authorizeSessionSync } from '../sync-access';

type Row = Record<string, unknown>;

/** Minimal stand-in for the admin client: select/eq/maybeSingle only. */
function makeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const filters: Array<(r: Row) => boolean> = [];
      const q = {
        select: () => q,
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return q;
        },
        async maybeSingle() {
          const out = rows.filter((r) => filters.every((f) => f(r)));
          return { data: out[0] ?? null, error: null };
        },
      };
      return q;
    },
  } as unknown as Parameters<typeof authorizeSessionSync>[0];
}

const req = (auth?: string) =>
  ({
    headers: {
      get: (k: string) => (k.toLowerCase() === 'authorization' ? (auth ?? null) : null),
    },
  }) as unknown as NextRequest;

const SESSION = 'sess-1';
const COMMISH = 'user-commish';
const MEMBER = 'user-member';
const STRANGER = 'user-stranger';

function tables() {
  return {
    auction_sessions: [{ id: SESSION, commissioner_id: COMMISH }],
    auction_participants: [
      { id: 'p-1', session_id: SESSION, user_id: COMMISH },
      { id: 'p-2', session_id: SESSION, user_id: MEMBER },
    ],
  };
}

describe('isCronRequest', () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it('rejects "Bearer undefined" when the secret is unset', () => {
    // The other three sync routes compare against `Bearer ${process.env.CRON_SECRET}`,
    // which IS the literal string 'Bearer undefined' when unset — handing cron
    // privileges to anyone who sends it. This is the hole this helper closes.
    expect(isCronRequest(req('Bearer undefined'))).toBe(false);
    expect(isCronRequest(req())).toBe(false);
  });

  it('accepts only the exact configured secret', () => {
    process.env.CRON_SECRET = 's3cret';
    expect(isCronRequest(req('Bearer s3cret'))).toBe(true);
    expect(isCronRequest(req('Bearer wrong'))).toBe(false);
    expect(isCronRequest(req())).toBe(false);
  });
});

describe('authorizeSessionSync', () => {
  beforeEach(() => {
    holder.user = null;
  });

  it('401s an anonymous caller', async () => {
    const out = await authorizeSessionSync(makeAdmin(tables()), SESSION);
    expect(out).toEqual({ ok: false, status: 401, error: 'Not authenticated' });
  });

  it('404s an unknown session', async () => {
    holder.user = { id: MEMBER };
    const out = await authorizeSessionSync(makeAdmin(tables()), 'nope');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(404);
  });

  it('403s someone who is not in the league', async () => {
    holder.user = { id: STRANGER };
    const out = await authorizeSessionSync(makeAdmin(tables()), SESSION);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(403);
  });

  it('allows a plain league member — the whole point of this change', async () => {
    holder.user = { id: MEMBER };
    const out = await authorizeSessionSync(makeAdmin(tables()), SESSION);
    expect(out).toEqual({ ok: true, userId: MEMBER });
  });

  it('allows the commissioner even with NO participant row', async () => {
    // createSession inserts the commissioner's participant row without checking
    // the result, so a membership-only check would lock a host out of their own
    // league if that insert ever failed.
    holder.user = { id: COMMISH };
    const admin = makeAdmin({
      auction_sessions: [{ id: SESSION, commissioner_id: COMMISH }],
      auction_participants: [],
    });
    const out = await authorizeSessionSync(admin, SESSION);
    expect(out).toEqual({ ok: true, userId: COMMISH });
  });

  it('does not accept a membership row from a DIFFERENT session', async () => {
    holder.user = { id: STRANGER };
    const admin = makeAdmin({
      auction_sessions: [{ id: SESSION, commissioner_id: COMMISH }],
      auction_participants: [{ id: 'p-9', session_id: 'other-session', user_id: STRANGER }],
    });
    const out = await authorizeSessionSync(admin, SESSION);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(403);
  });
});
