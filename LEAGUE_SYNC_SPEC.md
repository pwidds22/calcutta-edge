# League-member score sync

**Date:** 2026-09-02
**Status:** Approved, not yet implemented

## Problem

Any member of an NFL league can already see a "Sync Scores" button. Pressing it
fails.

`supportsManualSync()` returns `true` for NFL
(`components/live/tournament-dashboard.tsx:52`), and the button it gates
(line 307) sits outside every `isCommissioner` check — so it renders for every
participant. But `POST /api/nfl/sync` allows only the commissioner, so a
participant who presses it gets a red `Error: Not authorized`. This is live in
production today. It is a broken affordance, not a missing feature.

The requested behaviour: any member of the league can press the button and pull
the latest ESPN standings.

## Existing state of the four sync routes

| Route | Who may call it today | Cron check |
| --- | --- | --- |
| `/api/nfl/sync` | commissioner only | correct |
| `/api/golf/sync` | **anyone with a session UUID** | vulnerable |
| `/api/soccer/sync` | **anyone with a session UUID** | vulnerable |
| `/api/espn/sync` | **anyone with a session UUID** | vulnerable |

`middleware.ts` allowlists all four under a comment claiming "they handle their
own auth". For three of them that is false.

"Vulnerable" cron check means `header === \`Bearer ${process.env.CRON_SECRET}\``,
which matches the literal string `'Bearer undefined'` when the secret is unset —
handing cron privileges to any caller who sends that. The NFL route already
requires the secret to exist; the other three do not.

All four routes share an identical prologue: cron check, parse JSON body,
require `sessionId`. One guard drops into the same position in each.

## Design

### 1. Shared authorization — `lib/auth/sync-access.ts`

The combined decision, across both exported functions:

```
cron secret present AND matching   -> allow  (unchanged behaviour)
not signed in                      -> 401
session not found                  -> 404
commissioner_id === user.id        -> allow
row in auction_participants        -> allow   <- new for NFL
otherwise                          -> 403
```

These are two functions, not one, because the cron path carries no `sessionId`
to authorize against — it syncs every eligible session. Each route calls
`isCronRequest(req)` first and returns early on the cron path exactly as
`/api/nfl/sync` does today, then calls `authorizeSessionSync` for the
member path only.

Membership is a row in `auction_participants` matching `(session_id, user_id)`.
That table is `(id, session_id, user_id, display_name, is_commissioner,
joined_at)`.

`commissioner_id` is accepted **in addition to** the participant row, not
instead of it. `createSession` inserts the commissioner's participant row
without checking the result (`actions/session.ts:118`), so if that insert ever
failed, a membership-only check would lock a host out of their own league.

The helper owns the cron check too, which fixes the `'Bearer undefined'` hole in
golf, soccer and espn as a side effect of routing them all through one function.

Shape:

```ts
type SyncAccess =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

/** True only when CRON_SECRET is set AND the header matches it. */
function isCronRequest(req: NextRequest): boolean;

/**
 * Authorize a member-initiated sync of one session. Never called on the cron
 * path. Reads the caller's identity from their own cookies; takes the admin
 * client for the session/participant lookups so the check does not depend on
 * RLS being readable by the caller.
 */
async function authorizeSessionSync(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<SyncAccess>;
```

`authorizeSessionSync` builds its own cookie-scoped client internally via
`createClient()` from `lib/supabase/server` — callers pass only the admin
client, so no route can accidentally authorize against the wrong identity.
Writes continue to go through the admin client, because system rows need
`entered_by: null`, which RLS will not accept from a user session. This split
already exists in the NFL route and is preserved.

### 2. Cooldown — `lib/auction/sync-cooldown.ts`

60 seconds, per session, no migration.

All four routes already stamp `entered_by: null, entered_at: <now>` on the rows
they write, so the time of the last system sync is already recorded:

```sql
select entered_at from tournament_results
where session_id = $1 and entered_by is null
order by entered_at desc
limit 1
```

Within the window, the route returns HTTP 200 with
`{ skipped: true, message: 'Just synced — already up to date', lastSyncedAt }`
and performs no upstream fetch and no writes.

**Cron bypasses the cooldown entirely.** A scheduled run must never be skipped
because a participant happened to press the button a minute earlier.

**Known gap, accepted:** this throttles syncs that *wrote* something. A sync
returning no rows — preseason, or ESPN reporting the wrong season type — writes
nothing, so `entered_at` does not advance and repeated presses still reach ESPN.
That costs one cached upstream GET and no writes, and it stops once the season
starts. Closing it properly needs a `last_sync_at` column on `auction_sessions`;
that does not earn a migration at this scale.

### 3. UI — `components/live/tournament-dashboard.tsx`

The button already renders for every member, so nothing is added. Two changes:

- A `skipped` response renders in the existing neutral grey style
  (`bg-white/[0.04] text-white/50`), not the green success style. The existing
  message classifier keys off substrings; `skipped` becomes an explicit branch
  rather than another substring match.
- The button's `title` gains a relative "Last synced 3m ago" when a timestamp is
  known, so a member can tell whether pressing it is worth anything.

### 4. Middleware

`middleware.ts` keeps the four routes allowlisted — they must bypass the login
redirect to return a JSON 401 rather than an HTML redirect. The comment claiming
they handle their own auth stops being a lie once this lands, and is updated to
name the guard.

## Testing

The guard and the cooldown are pure enough to test directly; the routes stay
DB-coupled and untested, as they are today.

`lib/auth/__tests__/sync-access.test.ts`
- cron secret unset + `Authorization: Bearer undefined` -> NOT cron (regression
  test for the hole this closes)
- cron secret set and matching -> `isCronRequest` true
- no user -> 401
- unknown session -> 404
- user is neither commissioner nor participant -> 403
- user has a participant row -> allowed
- user is `commissioner_id` with NO participant row -> allowed (the failed-insert
  case)

`lib/auction/__tests__/sync-cooldown.test.ts`
- no prior system row -> not throttled
- last sync 10s ago -> throttled
- last sync 61s ago -> not throttled
- rows written by a human (`entered_by` non-null) are ignored when finding the
  last sync

Each test must be confirmed to fail if its corresponding guard clause is
removed. A test that passes against the unfixed code proves nothing.

## Scope

Four routes, two new library files, one component, no schema change.

Golf, soccer and March Madness tournaments are all archived, so tightening their
routes cannot affect a live league.

## Explicitly not doing

- **Auto-sync on visit for NFL.** March Madness and Masters auto-sync on first
  visit when a league has no results (`tournament-dashboard.tsx:141`). Extending
  that to NFL would make the button close to redundant, but it is a separate
  decision about background behaviour and is not part of this change.
- **A `last_sync_at` migration.** See the accepted gap above.
- **Rate limiting by user rather than by session.** The session is the unit that
  matters; the work is per-session regardless of who triggers it.
