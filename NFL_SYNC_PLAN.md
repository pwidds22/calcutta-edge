# NFL Sync — Implementation Plan (Phase 1: per-unit settlement + weekly wins)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a season-long NFL Calcutta settle automatically — per-win payouts refreshing every week from ESPN, with a working manual fallback — before Week 1 results land on 2026-09-14.

**Architecture:** `tournament_results.result_count` already exists in production but **nothing reads or writes it**. This plan threads it through every read path, every write path, and the manual entry UI, then adds a pure ESPN parser (`lib/espn/nfl.ts`) and a sync route modelled on `/api/soccer/sync`. The per-win round is written as a running total every week; everything gated on regular-season completeness is deliberately out of scope until December.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase Postgres, ESPN public API.

## Global Constraints

- All work happens in `v2/`. Run `npm test`, `npm run build`, `npm run lint` from `v2/`.
- **Never break golf, World Cup, or March Madness.** Every change is additive with a default preserving current behavior. `result_count` is nullable and NULL means 1 unit.
- The NFL config `nfl_season_2026` has 7 rounds: `regularSeasonWins` (parallel, `flatRate`, `payoutUnits: 272`), `divisionWinner` (parallel, 8), then the ladder `playoffBerth` (14) → `reachDivisional` (8) → `reachConfChamp` (4) → `reachSuperBowl` (2) → `superBowl` (1). Props: `bestRecord`, `worstRecord`.
- **A win is 1 unit; a tie is 0.5.** Rank teams by `units = wins + 0.5 × ties`, never by raw wins.
- **Never write `'pending'`** from the sync.
- Commit after every task. Do not push — pushing requires explicit approval.
- Verified this session: migration `00006_result_count` **is applied in production**, and **zero NFL sessions have drafted**, so there is no live data to corrupt.

---

### Task 1: Thread `result_count` through the read paths

**Files:**
- Modify: `v2/actions/session.ts:263`
- Modify: `v2/actions/dashboard.ts:181,186`
- Modify: `v2/components/live/tournament-dashboard.tsx:172-215`

**Interfaces:**
- Consumes: `TournamentResult.result_count?: number | null` (already on the type)
- Produces: every read path carries the count. Tasks 3-6 depend on this; without it, every per-win write reads back as 1 unit.

**Why this is first:** `getTeamStatus` defaults a missing count to 1 (`actual-payouts.ts:170`). An 11-win team pays $4.12 instead of $45.28 on a $4,000 pot. Writing counts before reading them is pointless.

- [ ] **Step 1: Write the failing test**

Create `v2/lib/auction/live/__tests__/result-count-readpath.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTeamStatus, calculateTeamEarnings } from '../actual-payouts';
import type { TournamentConfig } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';

const config = {
  rounds: [
    { key: 'wins', label: 'W', payoutLabel: 'Wins', teamsAdvancing: 32, payoutUnits: 272, parallel: true, flatRate: true },
  ],
} as unknown as TournamentConfig;

describe('result_count survives the read path', () => {
  it('an 11-win team earns 11 units, not 1', () => {
    const results: TournamentResult[] = [
      { team_id: 1, round_key: 'wins', result: 'won', result_count: 11 },
    ];
    const status = getTeamStatus(1, results, config);
    expect(status.roundCounts.wins).toBe(11);
    expect(calculateTeamEarnings(status.roundsWon, 4000, { wins: 0.1029 }, status.roundCounts)).toBeCloseTo(45.28, 2);
  });

  it('a tie counts half a unit', () => {
    const results: TournamentResult[] = [
      { team_id: 2, round_key: 'wins', result: 'won', result_count: 9.5 },
    ];
    expect(getTeamStatus(2, results, config).roundCounts.wins).toBe(9.5);
  });

  it('a missing count still means one unit (golf / World Cup behavior)', () => {
    const results: TournamentResult[] = [{ team_id: 3, round_key: 'wins', result: 'won' }];
    expect(getTeamStatus(3, results, config).roundCounts.wins).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it passes already**

Run: `cd v2 && npm test -- result-count-readpath`
Expected: PASS. This test pins the *engine*, which Task 2 of the previous plan already built. It exists so the next steps cannot silently regress it. If it fails, stop and report — something upstream is broken.

- [ ] **Step 3: Add the column to the session read**

`v2/actions/session.ts:263` — this is the sole feed for `initialResults` on both `/host/[sessionId]` and `/live/[sessionId]`:

```typescript
.select('team_id, round_key, result, result_count')
```

- [ ] **Step 4: Add the column to the dashboard read**

`v2/actions/dashboard.ts` — add `result_count` to the `.select(...)` at `:181` **and** carry it into the pushed row object at `:186`. The consumer at `:287` already passes `teamStatus.roundCounts`, so it is starved rather than miswired.

- [ ] **Step 5: Preserve the count across live broadcasts**

`v2/components/live/tournament-dashboard.tsx` — `handleResultUpdate` (`:172-192`) and `handleBulkUpdate` (`:194-215`) rebuild `TournamentResult` from scratch and **replace** the array entry (`next[idx] = updated`) rather than merging. An omitted field is data loss, not a no-op: a live broadcast would blank an already-rendered win total.

Widen both handlers' param types with `resultCount?: number | null` and set `result_count: data.resultCount ?? null` in both rebuilds.

- [ ] **Step 6: Verify**

Run: `cd v2 && npm test && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add v2/actions/session.ts v2/actions/dashboard.ts v2/components/live/tournament-dashboard.tsx v2/lib/auction/live/__tests__/result-count-readpath.test.ts
git commit -m "feat(nfl): carry result_count through every read path"
```

---

### Task 2: Gate tie adjustment on completed rounds

**Files:**
- Modify: `v2/lib/auction/live/actual-payouts.ts:319`
- Modify: `v2/actions/dashboard.ts:261-266` (and its import at `:8`)
- Test: `v2/lib/auction/live/__tests__/tie-adjustment.test.ts`

**Interfaces:**
- Consumes: `adjustPayoutRulesForTies(rules, winners, config, onlyRounds?)` — the 4th param already exists at `actual-payouts.ts:440`
- Produces: no new interface; a behavior fix

**Why:** `calculateLeaderboard` never passes `onlyRounds`, so a partially-decided round redistributes its whole budget among whoever has resolved. NFL's `divisionWinner` is the worst case: `2.0% × 8 ÷ 1 = 16% of the pot` to the first team to clinch. This is the live twin of the `f172400` soccer bug (Canada, $176 → $22). `soccer-standings.ts:78-83` and `projected-standings.ts:148-152` already do this correctly; these are the two call sites that were missed.

- [ ] **Step 1: Write the failing test**

Append to `v2/lib/auction/live/__tests__/tie-adjustment.test.ts`:

```typescript
describe('partially-resolved parallel round must not inflate', () => {
  it('one clinched division winner earns 1 slot, not the whole 8-slot budget', () => {
    const config = {
      rounds: [
        { key: 'divisionWinner', label: 'Div', payoutLabel: 'Win Division', teamsAdvancing: 8, parallel: true },
      ],
    } as unknown as TournamentConfig;

    // Only ONE division has clinched. The other 7 are undecided (no rows at all).
    const results = [{ team_id: 1, round_key: 'divisionWinner', result: 'won' as const }];
    const soldTeams = [{ teamId: 1, amount: 100 }] as never[];

    const winners = countWinnersPerRound(soldTeams, results, config);
    const completed = new Set(getCompletedRounds([1], results, config));

    const adjusted = adjustPayoutRulesForTies({ divisionWinner: 2.0 }, winners, config, completed);

    // The round is NOT complete, so its rate must be untouched: 2% of pot, not 16%.
    expect(adjusted.divisionWinner).toBeCloseTo(2.0, 5);
  });
});
```

Add `getCompletedRounds` to the file's imports if absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- tie-adjustment`
Expected: FAIL — the new test reports `16` where `2` was expected, because nothing passes `onlyRounds`. Note the existing fixture writes a result for every round for every team, which is exactly why this bug survived.

- [ ] **Step 3: Pass the gate in calculateLeaderboard**

`v2/lib/auction/live/actual-payouts.ts:319` — `completedRounds` is already in scope at `:301`:

```typescript
  const adjustedPayoutRules = adjustPayoutRulesForTies(
    payoutRules,
    winnersPerRound,
    config,
    new Set(completedRounds)
  );
```

- [ ] **Step 4: Pass the gate in the dashboard**

`v2/actions/dashboard.ts:261-266` — same 4th argument. **`getCompletedRounds` is not currently imported** at `:8` (the import pulls `getTeamStatus, calculateTeamEarnings, buildPlayInLoserSet, countWinnersPerRound, adjustPayoutRulesForTies`). Add it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v2 && npm test -- tie-adjustment`
Expected: PASS, including the two pre-existing pot-conservation assertions ("total distributed should not exceed pot" at `:124-138` and "DISTRIBUTED should equal POT exactly when all tiers are settled" at `:183-207`).

**Those two must not move.** At settlement every round is in `completedRounds`, so the gate filters nothing — that is the proof this fix is a no-op for golf and March Madness. If either assertion changes, the fix is wrong.

- [ ] **Step 6: Verify and commit**

```bash
cd v2 && npm test && npm run build
git add v2/lib/auction/live/actual-payouts.ts v2/actions/dashboard.ts v2/lib/auction/live/__tests__/tie-adjustment.test.ts
git commit -m "fix(payouts): only redistribute a tier's budget once its round is complete"
```

---

### Task 3: Thread `result_count` through the write paths

**Files:**
- Modify: `v2/actions/tournament-results.ts:38-93` (`updateResult`), `:99-150` (`bulkUpdateResults`)
- Modify: `v2/app/api/test-action/route.ts:92,95` (arity)

**Interfaces:**
- Produces: `updateResult(sessionId, teamId, roundKey, result, resultCount?)` and `bulkUpdateResults(sessionId, updates)` where each update may carry `resultCount`. Tasks 4 and 6 call these.

- [ ] **Step 1: Write the failing test**

There are no unit tests for `tournament-results.ts` (it is DB-coupled). Instead, pin the contract with a type-level test — create `v2/actions/__tests__/result-count-contract.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { updateResult, bulkUpdateResults } from '../tournament-results';

describe('write-path contract', () => {
  it('updateResult accepts an optional result count', () => {
    expect(updateResult.length).toBeGreaterThanOrEqual(4);
  });
  it('bulkUpdateResults is exported', () => {
    expect(typeof bulkUpdateResults).toBe('function');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd v2 && npm test -- result-count-contract`
Expected: PASS (it is a smoke test). The real verification is Step 6's manual round-trip.

- [ ] **Step 3: Widen `updateResult`**

Add a 5th parameter `resultCount?: number | null`. **Always** include the column in the upsert — never conditionally:

```typescript
result_count: result === 'pending' ? null : (resultCount ?? null),
```

Forcing `null` on `pending` matters: `buildCountMap` (`actual-payouts.ts:493-501`) keys off any non-null value, so a stale `11` left on a row toggled won → pending → won would resurrect a wrong total invisibly.

Add `resultCount` to the `RESULT_UPDATED` broadcast payload at `:86-90`.

- [ ] **Step 4: Widen `bulkUpdateResults`**

Widen the `updates` item type and set `result_count: u.resultCount ?? null` on **every** row in the `:121-128` mapper.

**Uniform keys are mandatory, not stylistic** — PostgREST rejects a bulk payload whose objects have differing key sets (`PGRST102`). The broadcast at `:144-146` re-emits `updates` verbatim, so it inherits the field for free.

- [ ] **Step 5: Update the test-action arity**

`v2/app/api/test-action/route.ts:92,95` — pass the new argument through so the e2e harness can exercise it.

- [ ] **Step 6: Verify**

Run: `cd v2 && npm test && npm run build && npm run lint`
Expected: all pass, no new lint errors.

- [ ] **Step 7: Commit**

```bash
git add v2/actions/tournament-results.ts "v2/app/api/test-action/route.ts" v2/actions/__tests__/result-count-contract.test.ts
git commit -m "feat(nfl): carry result_count through updateResult and bulkUpdateResults"
```

---

### Task 4: Numeric win entry in the commissioner UI

**Files:**
- Modify: `v2/components/live/results-entry.tsx`

**Interfaces:**
- Consumes: `updateResult(..., resultCount?)` and `bulkUpdateResults` (Task 3), `RoundConfig.flatRate` / `unitLabel`

**Why:** The manual path is the only fallback if the sync is late or wrong. A tri-state Won/Lost/Pending toggle cannot express "11 wins."

- [ ] **Step 1: Locate the current shape**

Read the file. Note `resultMap` (`:36-40`), the `getAliveTeamsForRound` call (~`:43`), the Won/Lost control pair (`:177-204`), and the payout hint (`:128-132`).

- [ ] **Step 2: Add a flat-rate branch**

Compute `const activeRoundConfig = config.rounds.find(r => r.key === activeRound)` alongside the alive-teams call, and build a `countMap` next to `resultMap` so an existing count prefills the input.

When `activeRoundConfig?.flatRate`, replace the Won/Lost pair with:

```tsx
<input
  type="number"
  step={0.5}
  min={0}
  max={17}
  defaultValue={countMap.get(team.id) ?? ''}
  onBlur={(e) => saveUnits(team.id, Number(e.target.value))}
/>
```

`step={0.5}` is required — a tie is half a unit.

- [ ] **Step 3: Map the value to a result correctly**

```typescript
const units = Number(value) || 0;
await updateResult(sessionId, teamId, activeRound, units > 0 ? 'won' : 'lost', units);
```

**Storing 0 wins as `'lost'` with count 0 is deliberate.** Storing `'won'` with count 0 would pollute `countWinnersPerRound` and put a bogus "won" chip on the leaderboard.

- [ ] **Step 4: Add "Save all"**

Batch through `bulkUpdateResults`. Thirty-two individual `updateResult` calls is 32 round-trips every week.

- [ ] **Step 5: Fix the payout hint for flat-rate rounds**

`:128-132` prints `0.1029% of pot`, which is meaningless as a round total. Reuse the `payoutUnits × unitLabel` phrasing already used in `payout-rules-editor.tsx:73-74`.

- [ ] **Step 6: Verify**

Run: `cd v2 && npm test && npm run build`
Then open `/host/[sessionId]` in the preview browser for a session on a flat-rate tournament and confirm the numeric input renders, accepts `9.5`, and persists.

- [ ] **Step 7: Commit**

```bash
git add v2/components/live/results-entry.tsx
git commit -m "feat(nfl): numeric win entry for flat-rate rounds"
```

---

### Task 5: ESPN NFL client and parser

**Files:**
- Create: `v2/lib/espn/nfl-client.ts`
- Create: `v2/lib/espn/nfl.ts`
- Test: `v2/lib/espn/__tests__/nfl.test.ts`

**Interfaces:**
- Produces: `fetchStandings(seasonYear)`, `fetchRegularSeasonWeek(year, week)`, `parseStandings(json)`, `computeSeasonResults(standings)`, `computeRecordProps(standings)`, and:

```typescript
export interface NflSyncResultRow {
  teamId: number;
  roundKey: string;
  result: 'won' | 'lost';   // no 'pending' member — the type enforces we never write it
  resultCount?: number;
}
```

Task 6 consumes all of these.

- [ ] **Step 1: The endpoint, exactly**

```
https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season={seasonYear}&level=3&seasontype=2
```

Four non-negotiables, each verified live:

1. **`site.api.espn.com/.../nfl/standings` is a dead 86-byte stub** returning only `{fullViewLink:{…}}` — the identical failure CLAUDE.md records for `fifa.world`. Use `site.web.api`.
2. **`&seasontype=2` is mandatory.** Without it ESPN returns the *currently active* season type. Fetched live: `?season=2026&level=3` → `seasonType: 1`, Bills **2-0**, pointsFor 60 — preseason. Adding `&seasontype=2` → `seasonType: 2`, Bills 0-0. Invisible when testing against a past season; bites only in Aug/Sep and Jan/Feb.
3. **`type=2` is NOT a synonym** — it switches to the "expanded" stat set and drops `pointsFor`.
4. **`seasonYear` = `config.startDate.slice(0, 4)` = `2026`, never `new Date().getFullYear()`.** In January 2027 the wall-clock year is 2027 but the ESPN season year is still 2026 — otherwise a guaranteed January outage.

Also export `fetchRegularSeasonWeek(year, week)`. **Do not copy soccer's `Promise.allSettled → []` swallow** (`soccer-client.ts:38-42`): a dropped week there is self-healing, but here it would make an incomplete season look complete. Fail loudly on any failed week.

- [ ] **Step 2: Write the failing tests**

Create `v2/lib/espn/__tests__/nfl.test.ts`, fixture-driven, mirroring `soccer.test.ts`. Capture a real `level=3&seasontype=2` response for season 2025 as the fixture. Tests:

1. **32 entries**, with `wins/losses/ties/pointsFor/playoffSeed` read off `stats[].value` by `name`.
2. **String impostors are not mistaken for numerics** — assert `overall`, `divisionRecord`, `Home`, `Road` are excluded. `divisionRecord` has `value: 0.0` with `displayValue: '5-1'`; `overall`/`Home`/`Road` have `value: null`.
3. **A tie counts 0.5** — a 9-7-1 team yields `resultCount: 9.5`; league-wide `sum === 272` for a complete uninterrupted season.
4. **NFC South three-way tie** (2025: CAR/TB/ATL all 8-9) → exactly **one** `divisionWinner: won` in that division, chosen by `playoffSeed`. A max-wins grader returns three and pays the 8-slot budget out ten times.
5. **`bestRecord` ranks by units, not raw wins** — 2022 CHI 3-14-0 (3.0) vs HOU 3-13-1 (3.5): CHI alone.
6. **A four-way worst-record tie emits four winners**, one entry per team.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd v2 && npm test -- nfl.test`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the parser**

Pure, no I/O. Parsing traps, all verified live:

- `entry.stats` is an **array** of `{name, type, value, displayValue}` (22 entries), not an object. Numerics live on `.value`.
- **`clincher.value` is always `0.0`** — the code is a letter in `displayValue`, and the vocabulary is **unstable across seasons** ('x' for wild card in 2021, 'y' in 2022-25) and absent before the season generates one. **Never gate on the clincher letter.**
- `playoffSeed === 0.0` is the "season not started" sentinel — not null, not absent.
- The name join is **clean**: all 32 config `name` values match ESPN `displayName` exactly, and all 32 divisions match `group`. No `ESPN_NAME_ALIASES` needed. Prefer joining on `team.abbreviation` or `team.id` anyway — note ESPN uses **JAX** (not JAC) and **WSH** (not WAS).

`computeSeasonResults` emits, for the weekly path, only the `won` rows for `regularSeasonWins` with `resultCount: wins + 0.5 * ties`.

`computeRecordProps` returns **all** teams tied at max/min units — one entry per team. **Do not copy `computeGroupProps`** (`soccer.ts:251-273`); it collapses to a single teamId with a tiebreaker.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v2 && npm test -- nfl.test`
Expected: PASS, all six.

- [ ] **Step 6: Verify and commit**

```bash
cd v2 && npm test && npm run build
git add v2/lib/espn/nfl-client.ts v2/lib/espn/nfl.ts v2/lib/espn/__tests__/nfl.test.ts
git commit -m "feat(nfl): ESPN standings client and season parser"
```

---

### Task 6: The sync route and its wiring

**Files:**
- Create: `v2/app/api/nfl/sync/route.ts`
- Modify: `v2/middleware.ts:24`
- Modify: `v2/vercel.json`
- Modify: `v2/components/live/tournament-dashboard.tsx:44-52,91-96,121`

**Interfaces:**
- Consumes: everything from Tasks 1-5

- [ ] **Step 1: Clone the soccer route skeleton**

Read `v2/app/api/soccer/sync/route.ts` in full. Copy its dual-mode shape, fetch-once-then-fan-out, and upsert.

- [ ] **Step 2: Harden the cron check**

The template's `header === \`Bearer ${process.env.CRON_SECRET}\`` matches the literal string `'Bearer undefined'` if the secret is ever unset:

```typescript
const secret = process.env.CRON_SECRET;
const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
```

- [ ] **Step 3: Add the commissioner auth gate the template omits**

`soccer/sync:36-63` and `golf/sync:48-86` have **no auth of any kind** on the POST path — any unauthenticated caller who knows a session UUID can force a sync. `middleware.ts:24` allowlists these prefixes under the comment "they handle their own auth," which is false for both. Do not copy the hole:

```typescript
const userClient = await createClient();               // lib/supabase/server.ts
const { data: { user } } = await userClient.auth.getUser();
if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
const { data: s } = await admin.from('auction_sessions')
  .select('commissioner_id').eq('id', sessionId).single();
if (!s || s.commissioner_id !== user.id)
  return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
```

Pattern copied from `actions/tournament-results.ts:44-58`. Writes still go through `createAdminClient()` — RLS bypass is needed for `entered_by: null` system rows.

- [ ] **Step 4: Discovery — sport filter, not `matchesTournamentEvent`**

```typescript
listSyncEligibleTournaments(2).filter(t => t.config.sport === 'nfl')
```

`liveSyncMatchers` on the config is **inert for this sport** — ESPN's NFL feed is league-wide, so there is no upstream `event_name` to match (unlike DataGolf). This is the soccer case, not the golf case, so CLAUDE.md's `matchesTournamentEvent` rule does not apply.

**`graceDays: 2`, not 1** — `endDate: '2027-02-14'` flips the phase to `completed` at `2027-02-15T00:00Z`, roughly 3.5 hours *before* Super Bowl LXI ends.

- [ ] **Step 5: Upsert with the count**

Same `onConflict: 'session_id,team_id,round_key'`, `entered_by: null`, **plus `result_count: row.resultCount ?? null`**. No writer in the codebase sets this column today — copying soccer's payload verbatim produces a wins round that pays every team exactly 1.

Broadcast `RESULTS_BULK_UPDATED` on `auction:{sessionId}` with `resultCount` on each update. The extra key is additive and ignored by existing consumers.

**Do not use the insert/update counters as a change signal.** The wins round is a running total re-upserted weekly, so `inserted === 0 && updated === 0` — which the UI reads as "No new results found" (`tournament-dashboard.tsx:110`) — will essentially never fire.

- [ ] **Step 6: Scope — weekly wins only**

Write **only** the `regularSeasonWins` running total this phase. `divisionWinner`, `playoffBerth`, and the playoff ladder are gated on regular-season completeness and land in December; leave them unimplemented rather than half-gated.

Assert `standings.seasonType === 2` and reject the run otherwise — that is the guard against silently ingesting preseason records.

- [ ] **Step 7: Wire it up**

- `v2/middleware.ts:24` — add `|| path.startsWith('/api/nfl')`. Without it the commissioner POST 307-redirects to `/login` and the sync silently never runs.
- `v2/vercel.json` (**not** repo root — Vercel's root dir is `v2`) — add `{ "path": "/api/nfl/sync", "schedule": "0 7,13 * * *" }`. Sunday-night games end ~04:30 UTC Monday and MNF ends ~03:30 UTC Tuesday; 07:00 UTC clears both, 13:00 UTC is the same-morning retry. Soccer's `0 2,6` would miss MNF.
- `tournament-dashboard.tsx:44-52` — add `if (config.sport === 'nfl') return true;` to `supportsManualSync`. Today it returns `config.id === 'march_madness_2026'` for anything not golf/soccer, so NFL gets **no manual escape hatch** — the exact 2026-05-18 PGA regression.
- `:91-96` — add `config.sport === 'nfl' ? '/api/nfl/sync'` to the endpoint ternary. Today NFL falls through to `/api/espn/sync`, which returns `"Only March Madness 2026 sessions supported"`.
- `:121` — fix the `players`/`games` wording while there.

- [ ] **Step 8: Verify**

```bash
cd v2 && npm test && npm run build && npm run lint
```

Then exercise the route locally: start the dev server via the preview tool and POST to `/api/nfl/sync` as a commissioner. Confirm a 401 when unauthenticated and a 403 for a non-commissioner.

- [ ] **Step 9: Commit**

```bash
git add "v2/app/api/nfl/sync/route.ts" v2/middleware.ts v2/vercel.json v2/components/live/tournament-dashboard.tsx
git commit -m "feat(nfl): weekly settlement sync with a real commissioner auth gate"
```

---

## Final verification

- [ ] `cd v2 && npm test` — all green
- [ ] `cd v2 && npm run build` — succeeds
- [ ] `cd v2 && npm run lint` — no new errors
- [ ] Manual round-trip: write 11 wins via `/api/test-action`, reload `/host/[sessionId]`, confirm the leaderboard shows the 11-unit payout, not 1. This exercises the write path *and* the `session.ts:263` read path together, which is where a failure would otherwise be silent.
- [ ] Toggle `won(11) → pending → won` and confirm the count is `null` in between and not resurrected.

## Deliberately out of scope

**Phase 2 (December):** regular-season completeness sweep, `divisionWinner` / `playoffBerth` row emission, the final wins pass writing winless `lost` rows, and `bestRecord` / `worstRecord` prop grading.

The completeness gate must be: **every event in weeks 1-18 has `status.type.completed === true` OR `status.type.name ∈ {STATUS_CANCELED, STATUS_FORFEIT}`.** Never "272 games final" — 2022 played 271 (a canceled Bills-Bengals game ESPN still reports `completed: false`), so that gate would never fire and the season would never settle. Treat `STATUS_POSTPONED` as blocking.

**Phase 3 (before Wild Card weekend, 2027-01-13):** postseason grading via `seasontype=3` weeks `{1,2,3,5}`, hard-skipping **week 4, which is the Pro Bowl** (verified: shortName `'NFC VS AFC'`, headline `'Pro Bowl Games'`, `STATUS_FINAL`).

`reachDivisional` **must include the two bye rows** (`berthWinners − wildCardParticipants`, cross-checked as `size === 2` and `playoffSeed === 1`). Omitting them is the most expensive bug in the feature: the round never completes so the ladder stalls forever, and at settlement each wild-card winner is inflated 8/6 = +33% while the two #1 seeds — the priciest teams in the auction — are paid $0 for a round they demonstrably reached.

`playoffBerth` is `playoffSeed ≤ 7`, **not `≤ 14`** — seed is 1-16 *per conference*, so `≤ 14` selects 28 teams.

**Phase 4:** `roundCounts` on the `TeamResult` interface plus an "11 Wins" chip in `leaderboard.tsx:304-315`; round-tab disambiguation (`regularSeasonWins`, `divisionWinner`, and `playoffBerth` all carry `gameLabel: 'Season'`, so `results-entry.tsx:111` renders three tabs all reading "Season").

## Open questions

1. **`playoffSeed` mid-season semantics are unverified.** Every observation is from a completed or not-yet-started season. This does not block Phase 1 (nothing reads it until December) but is a landmine for any future NFL projected-standings view. Probe manually in late September 2026, before Phase 2 ships.
2. **The full `status.type` vocabulary is unverified** — only `STATUS_FINAL`, `STATUS_SCHEDULED`, and `STATUS_CANCELED` were observed live. Gate on `completed === true` plus a short terminal-name allowlist, never on an enumerated list of non-terminal names.
3. **Whether the 2026-27 regular season is actually 272 games** — week 1 was confirmed at 16 events and the calendar shows 18 regular-season weeks, but no one summed all 18. Phase 1 does not depend on it.
