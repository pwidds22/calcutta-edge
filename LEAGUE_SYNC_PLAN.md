# League-Member Score Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any member of a league press "Sync Scores" and pull the latest standings, instead of only the commissioner.

**Architecture:** One shared authorization helper replaces four hand-rolled (and three missing) auth checks across the sync routes. A second helper adds a 60-second per-session cooldown derived from data already in the database. The UI button already exists and already renders for every member — only its response handling changes.

**Tech Stack:** Next.js 16 App Router route handlers, Supabase (`@supabase/ssr` for the caller's identity, service-role admin client for lookups and writes), Vitest.

**Spec:** `LEAGUE_SYNC_SPEC.md` at the repo root.

**This file:** `LEAGUE_SYNC_PLAN.md` at the repo root, matching `NFL_CALCUTTA_PLAN.md` / `NFL_SYNC_PLAN.md`. `docs/` is gitignored in this repo.

## Global Constraints

- Working directory is the worktree `C:\Users\pwidd\CascadeProjects\calcutta-auction-tool\.claude\worktrees\nfl-calcutta-merge-blockers-6e5ea4`. Run every command from `v2/` unless stated otherwise. Do NOT `cd` to the main checkout.
- Branch is `claude/league-member-sync`. Verify with `git branch --show-current` before the first commit.
- Never push. Commits only.
- `npm run build`, `npx vitest run`, and `npm run lint` must all pass before the final commit. Lint baseline is **15 errors / 32 warnings**, all pre-existing — do not introduce new ones.
- The cron path must keep working unchanged in all four routes. Cron is checked FIRST and never reaches the member guard or the cooldown.
- Writes continue to use the admin client, because system rows need `entered_by: null`, which RLS rejects from a user session.
- Every new test must be confirmed to FAIL when its guard clause is reverted. A test that passes against the unfixed code proves nothing.

---

### Task 1: Shared sync authorization guard

**Files:**
- Create: `v2/lib/auth/sync-access.ts`
- Test: `v2/lib/auth/__tests__/sync-access.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `createAdminClient` from `@/lib/supabase/admin` (type only).
- Produces:
  - `type SyncAccess = { ok: true; userId: string } | { ok: false; status: 401 | 403 | 404; error: string }`
  - `function isCronRequest(req: NextRequest): boolean`
  - `async function authorizeSessionSync(admin: ReturnType<typeof createAdminClient>, sessionId: string): Promise<SyncAccess>`

  Tasks 3 and 4 import all three.

- [ ] **Step 1: Write the failing test**

Create `v2/lib/auth/__tests__/sync-access.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd v2 && npx vitest run sync-access`
Expected: FAIL — `Failed to resolve import "../sync-access"`.

- [ ] **Step 3: Write the implementation**

Create `v2/lib/auth/sync-access.ts`:

```ts
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * Who may trigger a score sync for one session.
 *
 * Before this helper each sync route decided for itself, and only one of the
 * four decided correctly: `/api/nfl/sync` allowed the commissioner alone (so a
 * league member pressing the "Sync Scores" button that the dashboard already
 * shows them got a 403), while `/api/golf/sync`, `/api/soccer/sync` and
 * `/api/espn/sync` performed NO check at all — `middleware.ts` allowlists all
 * four under a comment claiming they handle their own auth.
 */
export type SyncAccess =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * True only when CRON_SECRET is configured AND the request presents it.
 *
 * The `!!secret` is the point: `header === \`Bearer ${process.env.CRON_SECRET}\``
 * — the shape the golf, soccer and espn routes still use inline — matches the
 * literal string 'Bearer undefined' whenever the variable is unset, granting
 * cron privileges to any caller who guesses that.
 */
export function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Authorize a member-initiated sync of a single session. Never called on the
 * cron path — cron carries no sessionId, it syncs every eligible session.
 *
 * Identity comes from the caller's own cookies; the session and membership
 * lookups go through the admin client so the check does not depend on the
 * caller being able to read those rows under RLS.
 */
export async function authorizeSessionSync(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<SyncAccess> {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Not authenticated' };

  const { data: session } = await admin
    .from('auction_sessions')
    .select('id, commissioner_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return { ok: false, status: 404, error: 'Session not found' };

  // Commissioner accepted directly, NOT only via a participant row:
  // `createSession` inserts that row without checking the result, so a failed
  // insert would otherwise lock a host out of their own league.
  if (session.commissioner_id === user.id) return { ok: true, userId: user.id };

  const { data: membership } = await admin
    .from('auction_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership) return { ok: true, userId: user.id };

  return { ok: false, status: 403, error: 'You are not a member of this league' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd v2 && npx vitest run sync-access`
Expected: PASS, 8 tests.

- [ ] **Step 5: Prove the member test actually guards something**

Temporarily change the membership branch in `sync-access.ts` to
`if (membership && false) return { ok: true, userId: user.id };`
Run: `cd v2 && npx vitest run sync-access`
Expected: FAIL on "allows a plain league member".
Then revert the change and re-run — expected PASS.

- [ ] **Step 6: Commit**

```bash
git add v2/lib/auth/sync-access.ts v2/lib/auth/__tests__/sync-access.test.ts
git commit -m "feat(sync): shared league-member authorization guard

One rule for all four sync routes: cron secret, else signed-in member of
that league. Replaces NFL's commissioner-only check and the total absence
of one in the golf, soccer and espn routes.

isCronRequest requires the secret to EXIST, closing the 'Bearer undefined'
match those three routes still carry inline."
```

---

### Task 2: Per-session sync cooldown

**Files:**
- Create: `v2/lib/auction/sync-cooldown.ts`
- Test: `v2/lib/auction/__tests__/sync-cooldown.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/admin` (type only).
- Produces:
  - `const SYNC_COOLDOWN_MS = 60_000`
  - `async function lastSystemSyncAt(admin, sessionId: string): Promise<Date | null>`
  - `function cooldownRemainingMs(lastSyncAt: Date | null, now?: Date): number`

  Tasks 3 and 4 import `lastSystemSyncAt` and `cooldownRemainingMs`.

- [ ] **Step 1: Write the failing test**

Create `v2/lib/auction/__tests__/sync-cooldown.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd v2 && npx vitest run sync-cooldown`
Expected: FAIL — `Failed to resolve import "../sync-cooldown"`.

- [ ] **Step 3: Write the implementation**

Create `v2/lib/auction/sync-cooldown.ts`:

```ts
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * How long after a successful sync we decline to run another for the same
 * session. Any league member can press "Sync Scores", so on a Sunday afternoon
 * a dozen people refreshing is otherwise a dozen upstream fetches and a dozen
 * 32-row writes per league, for data that moves a few times an hour.
 */
export const SYNC_COOLDOWN_MS = 60_000;

/**
 * When a sync last wrote rows for this session, or null if it never has.
 *
 * No new column: every sync route already stamps `entered_by: null` and
 * `entered_at: <now>` on the rows it writes, so the timestamp is already there.
 *
 * KNOWN GAP (accepted, see LEAGUE_SYNC_SPEC.md): this only throttles syncs that
 * WROTE something. A sync returning no rows — preseason, or ESPN reporting the
 * wrong season type — leaves `entered_at` untouched, so repeated presses still
 * reach upstream. That costs one GET and no writes, and stops once a season is
 * underway.
 */
export async function lastSystemSyncAt(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<Date | null> {
  const { data, error } = await admin
    .from('tournament_results')
    .select('entered_at')
    .eq('session_id', sessionId)
    .is('entered_by', null) // system-written rows only
    // `entered_at` is nullable and Postgres puts NULLs FIRST on a DESC sort, so
    // without this the newest row found could be one carrying no timestamp —
    // and the cooldown would never engage.
    .not('entered_at', 'is', null)
    .order('entered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.entered_at) return null;
  return new Date(data.entered_at as string);
}

/**
 * Milliseconds left on the cooldown; 0 means a sync may proceed.
 *
 * A future timestamp returns 0 rather than a huge wait: the database clock and
 * the function clock are different machines, and skew must not lock a league
 * out of syncing.
 */
export function cooldownRemainingMs(
  lastSyncAt: Date | null,
  now: Date = new Date()
): number {
  if (!lastSyncAt) return 0;
  const elapsed = now.getTime() - lastSyncAt.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.max(0, SYNC_COOLDOWN_MS - elapsed);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd v2 && npx vitest run sync-cooldown`
Expected: PASS, 8 tests.

- [ ] **Step 5: Prove the null-timestamp test guards something**

Temporarily delete the line `.not('entered_at', 'is', null)` from `sync-cooldown.ts`.
Run: `cd v2 && npx vitest run sync-cooldown`
Expected: FAIL on "ignores rows with no timestamp".
Restore the line and re-run — expected PASS.

- [ ] **Step 6: Commit**

```bash
git add v2/lib/auction/sync-cooldown.ts v2/lib/auction/__tests__/sync-cooldown.test.ts
git commit -m "feat(sync): 60s per-session cooldown, no migration

Derived from entered_at on system-written rows, which every sync route
already stamps. Filters out NULL timestamps explicitly: the column is
nullable and Postgres sorts NULLs first on DESC, so the newest row found
would otherwise be one with no timestamp and the cooldown would never fire."
```

---

### Task 3: Wire the guard and cooldown into `/api/nfl/sync`

**Files:**
- Modify: `v2/app/api/nfl/sync/route.ts`

**Interfaces:**
- Consumes: `isCronRequest`, `authorizeSessionSync` (Task 1); `lastSystemSyncAt`, `cooldownRemainingMs` (Task 2).
- Produces: a `{ skipped: true, message, lastSyncedAt, retryInMs }` response shape that Task 5 renders.

This is the route the request was actually about — do it first and alone, so a reviewer can accept or reject it independently of the three archived-tournament routes.

- [ ] **Step 1: Replace the route's local cron check with the shared one**

In `v2/app/api/nfl/sync/route.ts`, DELETE this entire function:

```ts
/**
 * `header === \`Bearer ${process.env.CRON_SECRET}\`` — the shape the other sync
 * routes use — matches the literal string 'Bearer undefined' when the secret is
 * unset, handing cron privileges to anyone who sends it. Require the secret to
 * exist first.
 */
function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}
```

and add to the imports at the top of the file:

```ts
import { isCronRequest, authorizeSessionSync } from '@/lib/auth/sync-access';
import { lastSystemSyncAt, cooldownRemainingMs } from '@/lib/auction/sync-cooldown';
```

- [ ] **Step 2: Replace the commissioner-only gate**

In `POST`, find this block:

```ts
  // ── Auth gate (pattern from actions/tournament-results.ts) ──────────────
  // The user client reads the caller's cookies; writes below still go through
  // the admin client because system rows need `entered_by: null`, which RLS
  // will not accept from a user session.
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: session, error } = await supabase
    .from('auction_sessions')
    .select('id, tournament_id, commissioner_id')
    .eq('id', body.sessionId)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
```

and replace it with:

```ts
  // ── Auth gate ───────────────────────────────────────────────────────────
  // ANY member of the league, not just the commissioner — the dashboard has
  // always shown them the "Sync Scores" button, and a commissioner-only route
  // meant pressing it returned 403. Writes below still go through the admin
  // client because system rows need `entered_by: null`, which RLS will not
  // accept from a user session.
  const access = await authorizeSessionSync(supabase, body.sessionId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: session, error } = await supabase
    .from('auction_sessions')
    .select('id, tournament_id')
    .eq('id', body.sessionId)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
```

Then DELETE the now-unused import of `createClient` from `@/lib/supabase/server` at the top of the file (`authorizeSessionSync` builds its own).

- [ ] **Step 3: Add the cooldown before the expensive work**

Immediately AFTER the existing NFL sport check:

```ts
  const tournament = getTournament(session.tournament_id);
  if (!tournament || tournament.config.sport !== 'nfl') {
    return NextResponse.json({ error: 'Not an NFL tournament session' }, { status: 400 });
  }
```

insert:

```ts
  // Member-initiated only — the cron path returned above and must never be
  // skipped because somebody pressed the button a minute earlier.
  const lastSync = await lastSystemSyncAt(supabase, session.id);
  const retryInMs = cooldownRemainingMs(lastSync);
  if (retryInMs > 0) {
    return NextResponse.json({
      skipped: true,
      message: 'Just synced — already up to date',
      lastSyncedAt: lastSync?.toISOString() ?? null,
      retryInMs,
    });
  }
```

- [ ] **Step 4: Verify types and the whole suite still pass**

Run: `cd v2 && npx tsc --noEmit && npx vitest run`
Expected: no type errors, and **396 tests pass** — 380 before this plan, plus 8 from Task 1 and 8 from Task 2. If the printed total differs, stop and find out why before continuing.

- [ ] **Step 5: Commit**

```bash
git add v2/app/api/nfl/sync/route.ts
git commit -m "fix(nfl-sync): any league member may sync, not just the commissioner

The dashboard has always rendered the Sync Scores button for every
participant (it sits outside every isCommissioner gate), but the route
allowed only the commissioner — so pressing it showed 'Error: Not
authorized'. Broken affordance, live in production.

Adds the 60s per-session cooldown on the member path; cron is unaffected."
```

---

### Task 4: Apply the same guard to golf, soccer and espn

**Files:**
- Modify: `v2/app/api/golf/sync/route.ts`
- Modify: `v2/app/api/soccer/sync/route.ts`
- Modify: `v2/app/api/espn/sync/route.ts`
- Modify: `v2/middleware.ts:22-26`

**Interfaces:**
- Consumes: `isCronRequest`, `authorizeSessionSync` (Task 1); `lastSystemSyncAt`, `cooldownRemainingMs` (Task 2).
- Produces: nothing new.

These three currently have NO authorization — any caller who knows a session UUID can trigger writes. All three tournaments are archived, so tightening them cannot affect a live league.

- [ ] **Step 1: golf — imports and cron check**

In `v2/app/api/golf/sync/route.ts`, add to the imports:

```ts
import { isCronRequest, authorizeSessionSync } from '@/lib/auth/sync-access';
import { lastSystemSyncAt, cooldownRemainingMs } from '@/lib/auction/sync-cooldown';
```

Replace:

```ts
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  const supabase = createAdminClient();

  if (isCron) {
    return await syncAllGolfSessions(supabase);
  }
```

with:

```ts
  const supabase = createAdminClient();

  if (isCronRequest(req)) {
    return await syncAllGolfSessions(supabase);
  }
```

- [ ] **Step 2: golf — authorize, then cooldown**

Replace:

```ts
  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data: session } = await supabase
```

with:

```ts
  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // This route previously performed NO authorization at all — any caller who
  // knew a session UUID could trigger writes.
  //
  // Placed before the sport check (unlike the NFL route, where it sits after)
  // simply because golf's sport check comes much later in the handler. The
  // dashboard picks the endpoint by sport, so a cross-sport call cannot happen
  // through the UI and the ordering has no practical effect.
  const access = await authorizeSessionSync(supabase, sessionId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const lastSync = await lastSystemSyncAt(supabase, sessionId);
  const retryInMs = cooldownRemainingMs(lastSync);
  if (retryInMs > 0) {
    return NextResponse.json({
      skipped: true,
      message: 'Just synced — already up to date',
      lastSyncedAt: lastSync?.toISOString() ?? null,
      retryInMs,
    });
  }

  const { data: session } = await supabase
```

- [ ] **Step 3: soccer — same treatment**

In `v2/app/api/soccer/sync/route.ts`, add the same two imports, then replace:

```ts
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  const supabase = createAdminClient();

  if (isCron) return await syncAllSoccerSessions(supabase);
```

with:

```ts
  const supabase = createAdminClient();

  if (isCronRequest(req)) return await syncAllSoccerSessions(supabase);
```

and replace:

```ts
  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data: session, error } = await supabase
```

with:

```ts
  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // This route previously performed NO authorization at all.
  const access = await authorizeSessionSync(supabase, body.sessionId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const lastSync = await lastSystemSyncAt(supabase, body.sessionId);
  const retryInMs = cooldownRemainingMs(lastSync);
  if (retryInMs > 0) {
    return NextResponse.json({
      skipped: true,
      message: 'Just synced — already up to date',
      lastSyncedAt: lastSync?.toISOString() ?? null,
      retryInMs,
    });
  }

  const { data: session, error } = await supabase
```

- [ ] **Step 4: espn — same treatment**

In `v2/app/api/espn/sync/route.ts`, add the same two imports, then replace:

```ts
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;

  const supabase = createAdminClient();

  if (isCron) {
```

with:

```ts
  const supabase = createAdminClient();

  if (isCronRequest(req)) {
```

and replace:

```ts
  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // Verify the session exists and is a March Madness tournament
```

with:

```ts
  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // This route previously performed NO authorization at all.
  const access = await authorizeSessionSync(supabase, sessionId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const lastSync = await lastSystemSyncAt(supabase, sessionId);
  const retryInMs = cooldownRemainingMs(lastSync);
  if (retryInMs > 0) {
    return NextResponse.json({
      skipped: true,
      message: 'Just synced — already up to date',
      lastSyncedAt: lastSync?.toISOString() ?? null,
      retryInMs,
    });
  }

  // Verify the session exists and is a March Madness tournament
```

- [ ] **Step 5: Correct the middleware comment**

In `v2/middleware.ts`, replace:

```ts
  // Allow specific API routes — they handle their own auth.
  // SECURITY: Allowlist only known prefixes, not blanket /api/
```

with:

```ts
  // Allow specific API routes past the login redirect so they can answer with
  // a JSON 401 instead of an HTML redirect. The sync routes authorize through
  // `authorizeSessionSync` (lib/auth/sync-access.ts); until 2026-09 that was
  // true of /api/nfl only and this comment was simply wrong about the rest.
  // SECURITY: Allowlist only known prefixes, not blanket /api/
```

- [ ] **Step 6: Verify**

Run: `cd v2 && npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors, all tests pass, build succeeds.

Then confirm no route still carries the vulnerable comparison:

Run: `cd v2 && grep -rn 'Bearer \${process.env.CRON_SECRET}' app/`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add v2/app/api/golf/sync/route.ts v2/app/api/soccer/sync/route.ts v2/app/api/espn/sync/route.ts v2/middleware.ts
git commit -m "fix(sync): authorize golf, soccer and espn sync routes

All three accepted any caller who knew a session UUID and could be handed
cron privileges by sending 'Bearer undefined' when CRON_SECRET is unset.
Now behind the same league-member guard as NFL, plus the cooldown.

The middleware comment claiming these routes handle their own auth is now
true rather than aspirational."
```

---

### Task 5: Render the cooldown response

**Files:**
- Modify: `v2/components/live/tournament-dashboard.tsx:103-138` (`handleEspnSync`) and `:307-317` (the button)

**Interfaces:**
- Consumes: the `{ skipped, message, lastSyncedAt }` response shape from Tasks 3 and 4.
- Produces: nothing.

The button already renders for every member and needs no gating change.

- [ ] **Step 1: Track the last-synced time**

Next to the existing sync state near line 89, add:

```ts
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
```

- [ ] **Step 2: Handle a skipped response**

In `handleEspnSync`, replace:

```ts
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
      } else if (data.inserted === 0 && data.updated === 0) {
```

with:

```ts
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
      } else if (data.skipped) {
        // Server-side cooldown: somebody else in the league just synced. This
        // is a neutral outcome, not a failure and not new data.
        setSyncMessage(data.message ?? 'Just synced — already up to date');
        if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
      } else if (data.inserted === 0 && data.updated === 0) {
```

and in the success branch, after `setSyncMessage(\`Synced ${count} ${unit}${lowRoundMsg}\`);` add:

```ts
        setLastSyncedAt(new Date().toISOString());
```

- [ ] **Step 3: Style a skipped message as neutral, not green**

The message classifier keys off substrings, and "Just synced — already up to date" would fall through to the green success style. Replace:

```tsx
        <div className={`rounded-md px-3 py-2 text-xs ${
          syncMessage.startsWith('Error') || syncMessage.includes('failed')
            ? 'bg-red-500/10 text-red-400'
            : syncMessage.includes('No new')
              ? 'bg-white/[0.04] text-white/50'
              : 'bg-emerald-500/10 text-emerald-400'
        }`}>
```

with:

```tsx
        <div className={`rounded-md px-3 py-2 text-xs ${
          syncMessage.startsWith('Error') || syncMessage.includes('failed')
            ? 'bg-red-500/10 text-red-400'
            : syncMessage.includes('No new') || syncMessage.includes('already up to date')
              ? 'bg-white/[0.04] text-white/50'
              : 'bg-emerald-500/10 text-emerald-400'
        }`}>
```

- [ ] **Step 4: Show the last sync time in the button tooltip**

Add immediately after the `tabs` array definition and before the component's
`return (` — the same block that already derives `actualPot` and the tab list:

```ts
  /** "3m ago" / "just now" — plain relative age for the sync button tooltip. */
  const lastSyncedLabel = (() => {
    if (!lastSyncedAt) return null;
    const ms = Date.now() - new Date(lastSyncedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();
```

Then replace the button's `title` attribute:

```tsx
            title={`Sync ${config.sport === 'golf' ? 'leaderboard' : 'game results'} from ${config.sport === 'golf' ? 'DataGolf' : 'ESPN'}`}
```

with:

```tsx
            title={[
              `Sync ${config.sport === 'golf' ? 'leaderboard' : 'game results'} from ${config.sport === 'golf' ? 'DataGolf' : 'ESPN'}`,
              lastSyncedLabel ? `Last synced ${lastSyncedLabel}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
```

- [ ] **Step 5: Full verification**

Run: `cd v2 && npx tsc --noEmit && npx vitest run && npm run build && npm run lint`
Expected: no type errors; all tests pass; build succeeds; lint reports **15 errors / 32 warnings** — identical to the baseline. Any new error or warning must be fixed before committing.

- [ ] **Step 6: Commit**

```bash
git add v2/components/live/tournament-dashboard.tsx
git commit -m "feat(sync): show cooldown result and last-synced time

A skipped sync renders in the neutral grey style rather than green — it is
neither an error nor new data. The button tooltip gains a relative
'Last synced 3m ago' so a member can tell whether pressing it is worth it."
```

---

## Manual verification (deferred — requires a real league)

Cannot be done before the NFL regular season starts: `/api/nfl/sync` refuses to
write unless ESPN reports `seasonType: 2`, and ESPN reports preseason until
2026-09-10. Fold this into the same pass that exercises the batched sync write
(see the NFL section of `MEMORY.md`).

Window: **2026-09-10 to 2026-09-14** (kickoff to the first real cron run).

1. Create an NFL league; have a second account join it as a plain participant.
2. As the **participant**, open the league dashboard and press "Sync Scores".
   Expect a green "Synced 32 teams" — this is the behaviour being added, and it
   returned `Error: Not authorized` before this change.
3. Press it again within 60 seconds. Expect a grey "Just synced — already up to
   date" and no new writes.
4. Wait 60 seconds, press again. Expect a real sync.
5. Confirm win totals match ESPN's published standings for week 1.
6. Sign out and `POST /api/golf/sync` with a real session UUID. Expect 401,
   where before it would have run.
7. Delete the test league.
