# NFL Season Calcutta — Implementation Plan (Phase 1: draft path)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `nfl_season_2026` a fully working season-long Calcutta — 32 teams auctioned pre-season, payouts for every regular-season win plus a playoff ladder — so a real draft can run before hosting opens on 2026-08-27.

**Architecture:** Four additive fields on `RoundConfig` (`payoutUnits`, `flatRate`, `unitLabel`, and a `'field'` devig scope) let a single round pay a flat rate per unit rather than once per team. `tournament_results` gains a nullable `result_count`, and `calculateTeamEarnings` gains an optional counts argument that defaults to 1 — so golf and World Cup behave identically. Everything else is per-tournament config: rounds, presets, props, bundling, odds.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase Postgres, Kalshi public API, ESPN public API.

## Global Constraints

- All work happens in `v2/`. Run `npm test`, `npm run build`, `npm run lint` from `v2/`.
- **Never break golf or World Cup.** Every shared-code change is additive with a default that preserves current behavior. Task 2 includes an explicit regression test for this.
- Payout rules are **per-position**: a round's budget is `pct × (payoutUnits ?? teamsAdvancing)`. All three places that compute a budget must use that expression: the preset test, the create-form total, and `adjustPayoutRulesForTies`.
- Presets must sum to 100% ±0.5%. Verify with `npm test -- payout-presets`.
- `endDate` for `nfl_season_2026` is **2027-02-14** (Super Bowl LXI, SoFi Stadium — verified 2026-08-16). The value currently in the config, `2027-02-07`, is wrong.
- Prop keys in a preset must exactly match keys returned by `getStandardProps()`, or the pot silently under-distributes.
- Commit after every task. Do not push — pushing requires explicit approval.
- Scripts that need real credentials must run from the main checkout (`C:\Users\pwidd\CascadeProjects\calcutta-auction-tool\v2`); worktrees have no `.env.local`.

---

### Task 1: RoundConfig gains payout units, flat rate, and a `field` devig scope

**Files:**
- Modify: `v2/lib/tournaments/types.ts:22-47` (RoundConfig)
- Modify: `v2/lib/calculations/odds.ts:159-182` (devigByGroup)
- Test: `v2/lib/calculations/__tests__/devig-field-scope.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `RoundConfig.payoutUnits?: number`, `RoundConfig.flatRate?: boolean`, `RoundConfig.unitLabel?: string`, and `devigScope` accepting `'field'`. Tasks 2, 3, 5, 6 all depend on these names.

- [ ] **Step 1: Write the failing test**

Create `v2/lib/calculations/__tests__/devig-field-scope.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { devigRoundOdds } from '../odds';
import type { TournamentConfig } from '@/lib/tournaments/types';
import type { Team } from '@/lib/calculations/types';

// Two rounds: a field-scoped per-win round (target 272) and a global ladder round.
const config = {
  devigStrategy: 'group',
  groups: [{ key: 'A', label: 'A' }],
  rounds: [
    { key: 'wins', label: 'W', payoutLabel: 'Wins', teamsAdvancing: 32, payoutUnits: 272, parallel: true, flatRate: true, devigScope: 'field' },
    { key: 'champ', label: 'C', payoutLabel: 'Champion', teamsAdvancing: 1, devigScope: 'global' },
  ],
} as unknown as TournamentConfig;

const mkTeam = (id: number, wins: number, champ: number): Team =>
  ({ id, name: `T${id}`, group: 'A', seed: id, rawImpliedProbabilities: { wins, champ }, odds: {} }) as unknown as Team;

describe('field-scoped devig', () => {
  it('normalizes a field round to payoutUnits, not teamsAdvancing', () => {
    // Four teams whose raw "expected wins" sum to 544 — exactly 2x the 272 target.
    const teams = [mkTeam(1, 136, 0.5), mkTeam(2, 136, 0.2), mkTeam(3, 136, 0.2), mkTeam(4, 136, 0.2)];
    devigRoundOdds(teams, config);
    const total = teams.reduce((s, t) => s + t.odds.wins, 0);
    expect(total).toBeCloseTo(272, 5);
  });

  it('does not cap the field round against the ladder', () => {
    // champ is tiny; a capped implementation would clamp wins down to it.
    const teams = [mkTeam(1, 200, 0.01), mkTeam(2, 200, 0.01), mkTeam(3, 200, 0.01), mkTeam(4, 200, 0.01)];
    devigRoundOdds(teams, config);
    expect(teams[0].odds.wins).toBeGreaterThan(0.01);
  });

  it('leaves the global ladder round normalizing to teamsAdvancing', () => {
    const teams = [mkTeam(1, 68, 0.5), mkTeam(2, 68, 0.3), mkTeam(3, 68, 0.3), mkTeam(4, 68, 0.3)];
    devigRoundOdds(teams, config);
    const total = teams.reduce((s, t) => s + t.odds.champ, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- devig-field-scope`
Expected: FAIL — the field round is never devigged, so `odds.wins` is `undefined` and the sum is `NaN`.

- [ ] **Step 3: Extend RoundConfig**

In `v2/lib/tournaments/types.ts`, replace the `devigScope` doc-comment block and add three fields. The `devigScope` union becomes:

```typescript
  /** How this round is devigged under the `'group'` strategy.
   *  - 'global' (default): normalize across the whole field to `teamsAdvancing`,
   *    capped at the previous global round (a nested knockout ladder).
   *  - 'group':  normalize WITHIN each group to sum→1 (e.g. "win your group").
   *  - 'field':  normalize across the whole field to `payoutUnits`, with NO ladder
   *    cap. For flat per-unit rounds (e.g. NFL per-win), where the stored value is
   *    an expected COUNT (expected wins), not a probability.
   *  Ignored by the 'bracket' / 'global' / 'none' strategies. */
  devigScope?: 'group' | 'global' | 'field';
  /** A "parallel" round is a standalone bonus, NOT a rung in the advancement
   *  ladder. It is credited when won but never gates advancement, eliminates a
   *  team, or blocks completion tracking. Defaults to false. */
  parallel?: boolean;
  /** Number of payout units in this round, when that isn't one-per-advancing-team.
   *  The round's budget is `pct × (payoutUnits ?? teamsAdvancing)`. NFL's per-win
   *  round has 272 units (272 regular-season games = 272 wins) across 32 teams. */
  payoutUnits?: number;
  /** This round pays a flat rate per unit and must NEVER be redistributed by
   *  `adjustPayoutRulesForTies` — a per-win rate is fixed, not a tier split among
   *  however many teams happened to qualify. Defaults to false. */
  flatRate?: boolean;
  /** Noun for the payout editor's helper text ("272 wins = 28.0%"). Falls back to
   *  the tournament's `teamLabel`. */
  unitLabel?: string;
```

- [ ] **Step 4: Handle the field scope in devigByGroup**

In `v2/lib/calculations/odds.ts`, inside `devigByGroup`, insert this loop immediately after the group-scoped loop and before the `const ladder = ...` line:

```typescript
  // Field-scoped rounds: normalize across the whole field to `payoutUnits`, with no
  // ladder cap. The stored value is an expected COUNT (e.g. expected wins), so the
  // target is the total number of units in the round, not a team count.
  for (const round of config.rounds) {
    if (round.devigScope !== 'field') continue;
    devigGroup(teams, round.key, undefined, round.payoutUnits ?? round.teamsAdvancing);
  }
```

No change is needed to the `ladder` filter: it already keeps only rounds whose scope resolves to `'global'`, and `'field'` is excluded automatically.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd v2 && npm test -- devig-field-scope`
Expected: PASS, 3 tests.

- [ ] **Step 6: Verify nothing else regressed**

Run: `cd v2 && npm test`
Expected: all existing tests pass (261 + 3 new).

- [ ] **Step 7: Commit**

```bash
git add v2/lib/tournaments/types.ts v2/lib/calculations/odds.ts v2/lib/calculations/__tests__/devig-field-scope.test.ts
git commit -m "feat(rounds): add payoutUnits, flatRate, unitLabel and 'field' devig scope"
```

---

### Task 2: Per-unit payouts in the settlement engine

**Files:**
- Create: `v2/supabase/migrations/00006_result_count.sql`
- Modify: `v2/actions/tournament-results.ts:7-11` (TournamentResult)
- Modify: `v2/lib/auction/live/actual-payouts.ts` (buildResultMap, getTeamStatus, calculateTeamEarnings, adjustPayoutRulesForTies)
- Test: `v2/lib/auction/live/__tests__/per-unit-payouts.test.ts`

**Interfaces:**
- Consumes: `RoundConfig.payoutUnits`, `RoundConfig.flatRate` (Task 1)
- Produces: `TournamentResult.result_count?: number | null`; `getTeamStatus()` returns an added `roundCounts: Record<string, number>`; `calculateTeamEarnings(roundsWon, actualPot, payoutRules, roundCounts?)`. Tasks 3 and 6 depend on these.

- [ ] **Step 1: Write the failing test**

Create `v2/lib/auction/live/__tests__/per-unit-payouts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTeamStatus, calculateTeamEarnings, adjustPayoutRulesForTies } from '../actual-payouts';
import type { TournamentConfig } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';

const config = {
  rounds: [
    { key: 'wins', label: 'W', payoutLabel: 'Wins', teamsAdvancing: 32, payoutUnits: 272, parallel: true, flatRate: true },
    { key: 'berth', label: 'B', payoutLabel: 'Playoffs', teamsAdvancing: 14 },
  ],
} as unknown as TournamentConfig;

const r = (team_id: number, round_key: string, result: 'won' | 'lost', result_count?: number): TournamentResult =>
  ({ team_id, round_key, result, result_count });

describe('per-unit payouts', () => {
  it('getTeamStatus surfaces the result count', () => {
    const status = getTeamStatus(1, [r(1, 'wins', 'won', 11)], config);
    expect(status.roundsWon).toEqual(['wins']);
    expect(status.roundCounts.wins).toBe(11);
  });

  it('a count of 11 pays 11x the per-unit rate', () => {
    // 0.1029% of a 4000 pot = $4.116 per win; 11 wins = $45.28
    const earnings = calculateTeamEarnings(['wins'], 4000, { wins: 0.1029 }, { wins: 11 });
    expect(earnings).toBeCloseTo(45.28, 2);
  });

  it('a tie counts half a win', () => {
    const earnings = calculateTeamEarnings(['wins'], 4000, { wins: 0.1029 }, { wins: 0.5 });
    expect(earnings).toBeCloseTo(2.06, 2);
  });

  it('REGRESSION: omitting counts is identical to the old behavior', () => {
    // This is exactly how golf and World Cup call it today.
    const earnings = calculateTeamEarnings(['berth'], 4000, { berth: 0.5 });
    expect(earnings).toBeCloseTo(20, 5);
  });

  it('adjustPayoutRulesForTies never rescales a flatRate round', () => {
    const winners = new Map([['wins', 30], ['berth', 7]]);
    const adjusted = adjustPayoutRulesForTies({ wins: 0.1029, berth: 0.5 }, winners, config);
    expect(adjusted.wins).toBe(0.1029);          // untouched
    expect(adjusted.berth).toBeCloseTo(1.0, 5);  // 0.5 * 14 / 7 — normal tier behavior
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- per-unit-payouts`
Expected: FAIL — `status.roundCounts` is undefined and `calculateTeamEarnings` ignores the 4th argument.

- [ ] **Step 3: Add the migration**

Create `v2/supabase/migrations/00006_result_count.sql`:

```sql
-- Per-unit results: a round may pay a flat rate per unit (NFL: one payout per
-- regular-season win) rather than once per team. NULL means 1, so every existing
-- golf / World Cup row is unaffected. Numeric so a tie can count 0.5.
alter table public.tournament_results
  add column if not exists result_count numeric;

comment on column public.tournament_results.result_count is
  'Units won in this round. NULL = 1. NFL per-win rounds store the win total; a tie counts 0.5.';
```

- [ ] **Step 4: Widen the TournamentResult type**

In `v2/actions/tournament-results.ts`, replace the interface:

```typescript
export interface TournamentResult {
  team_id: number;
  round_key: string;
  result: 'won' | 'lost' | 'pending';
  /** Units won, for flat-rate rounds. NULL/undefined means 1. */
  result_count?: number | null;
}
```

Then add `result_count` to the `.select(...)` column list in `getTournamentResults` so the value actually reaches the client.

- [ ] **Step 5: Surface counts from getTeamStatus**

In `v2/lib/auction/live/actual-payouts.ts`, add a count map builder next to `buildResultMap`:

```typescript
function buildCountMap(results: TournamentResult[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of results) {
    if (r.result_count !== undefined && r.result_count !== null) {
      map.set(`${r.team_id}:${r.round_key}`, Number(r.result_count));
    }
  }
  return map;
}
```

Change the `getTeamStatus` return type to include `roundCounts: Record<string, number>`, build the map alongside `resultMap`, and record a count whenever a round is credited. Both places that push to `roundsWon` get a matching line:

```typescript
  const resultMap = buildResultMap(results);
  const countMap = buildCountMap(results);
  const roundsWon: string[] = [];
  const roundCounts: Record<string, number> = {};
  let eliminatedInRound: string | null = null;

  const credit = (key: string) => {
    roundsWon.push(key);
    roundCounts[key] = countMap.get(`${teamId}:${key}`) ?? 1;
  };
```

Replace `if (result === 'won') roundsWon.push(round.key);` with `if (result === 'won') credit(round.key);` in the parallel branch, and `roundsWon.push(round.key);` with `credit(round.key);` in the ladder branch. Add `roundCounts` to the returned object, and to the early-return object at the top of the function (as `{}`).

Update the two cached-status type annotations in the same file (`actual-payouts.ts:285` and the destructure at `:314`) to include `roundCounts: Record<string, number>`, and pass `roundCounts` into the `calculateTeamEarnings` call at `:315`.

- [ ] **Step 6: Multiply by the count in calculateTeamEarnings**

```typescript
export function calculateTeamEarnings(
  roundsWon: string[],
  actualPot: number,
  payoutRules: PayoutRules,
  roundCounts?: Record<string, number>
): number {
  return roundsWon.reduce((total, roundKey) => {
    const pct = payoutRules[roundKey] ?? 0;
    const units = roundCounts?.[roundKey] ?? 1;
    return total + actualPot * (pct / 100) * units;
  }, 0);
}
```

- [ ] **Step 7: Exempt flat-rate rounds from tie redistribution**

In `adjustPayoutRulesForTies`, add the guard as the first statement of the loop and switch the expected count to units:

```typescript
  for (const round of config.rounds) {
    // A flat per-unit rate is fixed — it is not a tier budget split among
    // whoever qualified, so redistributing it would inflate every payout.
    if (round.flatRate) continue;
    if (onlyRounds && !onlyRounds.has(round.key)) continue;
    const actualWinners = winnersPerRound.get(round.key) ?? 0;
    const expected = round.payoutUnits ?? round.teamsAdvancing;
    if (actualWinners > 0 && expected > 0) {
      const pct = payoutRules[round.key] ?? 0;
      adjusted[round.key] = (pct * expected) / actualWinners;
    }
  }
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd v2 && npm test -- per-unit-payouts`
Expected: PASS, 5 tests.

- [ ] **Step 9: Verify golf and World Cup are untouched**

Run: `cd v2 && npm test`
Expected: all pass. `tie-adjustment.test.ts` and `parallel-rounds.test.ts` in particular must be green — they are the golf/WC guard rails.

- [ ] **Step 10: Apply the migration to Supabase**

Apply `00006_result_count.sql` via the Supabase MCP `apply_migration` tool (project `xtkdwyrxllqmgoedfotf`), or paste it into the SQL editor. Verify:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'tournament_results' and column_name = 'result_count';
```
Expected: one row, `numeric`, `YES`.

- [ ] **Step 11: Commit**

```bash
git add v2/supabase/migrations/00006_result_count.sql v2/actions/tournament-results.ts v2/lib/auction/live/actual-payouts.ts v2/lib/auction/live/__tests__/per-unit-payouts.test.ts
git commit -m "feat(payouts): flat per-unit round payouts via result_count"
```

---

### Task 3: Rewrite the NFL season config

**Files:**
- Modify: `v2/lib/tournaments/configs/nfl-season-2026.ts:3-44`
- Test: `v2/lib/tournaments/__tests__/nfl-season-config.test.ts`

**Interfaces:**
- Consumes: `payoutUnits`, `flatRate`, `unitLabel`, `devigScope: 'field'` (Task 1)
- Produces: round keys `regularSeasonWins`, `divisionWinner`, `playoffBerth`, `reachDivisional`, `reachConfChamp`, `reachSuperBowl`, `superBowl`; prop keys `bestRecord`, `worstRecord`. Tasks 4, 5, 8, 9 all reference these exact strings.

- [ ] **Step 1: Write the failing test**

Create `v2/lib/tournaments/__tests__/nfl-season-config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { NFL_SEASON_2026_CONFIG, NFL_SEASON_2026_TEAMS } from '../configs/nfl-season-2026';
import { getTeamStatus } from '@/lib/auction/live/actual-payouts';
import type { TournamentResult } from '@/actions/tournament-results';

const r = (team_id: number, round_key: string, result: 'won' | 'lost', result_count?: number): TournamentResult =>
  ({ team_id, round_key, result, result_count });

describe('nfl_season_2026 config', () => {
  it('ends on Super Bowl LXI, 2027-02-14', () => {
    expect(NFL_SEASON_2026_CONFIG.endDate).toBe('2027-02-14');
  });

  it('has 32 teams across 8 divisions', () => {
    expect(NFL_SEASON_2026_TEAMS).toHaveLength(32);
    expect(NFL_SEASON_2026_CONFIG.groups).toHaveLength(8);
  });

  it('puts all parallel rounds before the ladder', () => {
    const keys = NFL_SEASON_2026_CONFIG.rounds.map((x) => x.key);
    const lastParallel = Math.max(...NFL_SEASON_2026_CONFIG.rounds.map((x, i) => (x.parallel ? i : -1)));
    const firstLadder = NFL_SEASON_2026_CONFIG.rounds.findIndex((x) => !x.parallel);
    expect(lastParallel).toBeLessThan(firstLadder);
    expect(keys[0]).toBe('regularSeasonWins');
  });

  it('THE BUG: a wild card that lost its division still reaches the Super Bowl', () => {
    const results = [
      r(1, 'regularSeasonWins', 'won', 10),
      r(1, 'divisionWinner', 'lost'),
      r(1, 'playoffBerth', 'won'),
      r(1, 'reachDivisional', 'won'),
      r(1, 'reachConfChamp', 'won'),
      r(1, 'reachSuperBowl', 'won'),
      r(1, 'superBowl', 'won'),
    ];
    const status = getTeamStatus(1, results, NFL_SEASON_2026_CONFIG);
    expect(status.status).toBe('champion');
    expect(status.eliminatedInRound).toBeNull();
    expect(status.roundCounts.regularSeasonWins).toBe(10);
  });

  it('the per-win round carries 272 units and a flat rate', () => {
    const wins = NFL_SEASON_2026_CONFIG.rounds.find((x) => x.key === 'regularSeasonWins')!;
    expect(wins.payoutUnits).toBe(272);
    expect(wins.flatRate).toBe(true);
    expect(wins.devigScope).toBe('field');
    expect(wins.unitLabel).toBe('win');
  });

  it('declares props that exist and a Stripe link of its own', () => {
    expect(NFL_SEASON_2026_CONFIG.propBets.map((p) => p.key)).toEqual(['bestRecord', 'worstRecord']);
    expect(NFL_SEASON_2026_CONFIG.stripePaymentLinkEnvKey).toBe('NEXT_PUBLIC_STRIPE_PAYMENT_LINK_NFL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- nfl-season-config`
Expected: FAIL on `endDate`, on the wild-card test (eliminated at `divisionWinner`), and on the props/Stripe assertions.

- [ ] **Step 3: Rewrite the config head**

Replace lines 3-44 of `v2/lib/tournaments/configs/nfl-season-2026.ts`:

```typescript
export const NFL_SEASON_2026_CONFIG: TournamentConfig = {
  id: 'nfl_season_2026',
  name: 'NFL Season 2026-27',
  sport: 'nfl',
  rounds: [
    // ── Parallel bonuses. MUST come first: getCompletedRounds() stops at the
    //    first unresolved LADDER round, so anything after it is never evaluated.
    { key: 'regularSeasonWins', label: 'Wins', payoutLabel: 'Each Regular-Season Win', gameLabel: 'Season',
      teamsAdvancing: 32, payoutUnits: 272, parallel: true, flatRate: true, devigScope: 'field', unitLabel: 'win' },
    { key: 'divisionWinner', label: 'Div', payoutLabel: 'Win Division', gameLabel: 'Season',
      teamsAdvancing: 8, parallel: true, devigScope: 'group' },
    // ── Strictly nested "reach" ladder. Each rung is a true subset of the one
    //    above it, so a first-round bye still counts as reaching the divisional.
    { key: 'playoffBerth', label: 'Playoff', payoutLabel: 'Make Playoffs', gameLabel: 'Season',
      teamsAdvancing: 14, devigScope: 'global' },
    { key: 'reachDivisional', label: 'Div Rd', payoutLabel: 'Reach Divisional Round', gameLabel: 'Wild Card',
      teamsAdvancing: 8, devigScope: 'global' },
    { key: 'reachConfChamp', label: 'Conf Ch', payoutLabel: 'Reach Conference Championship', gameLabel: 'Divisional',
      teamsAdvancing: 4, devigScope: 'global' },
    { key: 'reachSuperBowl', label: 'SB', payoutLabel: 'Reach Super Bowl', gameLabel: 'Conf Champ',
      teamsAdvancing: 2, devigScope: 'global' },
    { key: 'superBowl', label: 'Champ', payoutLabel: 'Win Super Bowl', gameLabel: 'Super Bowl',
      teamsAdvancing: 1, devigScope: 'global' },
  ],
  groups: [
    { key: 'AFC_East', label: 'AFC East' },
    { key: 'AFC_North', label: 'AFC North' },
    { key: 'AFC_South', label: 'AFC South' },
    { key: 'AFC_West', label: 'AFC West' },
    { key: 'NFC_East', label: 'NFC East' },
    { key: 'NFC_North', label: 'NFC North' },
    { key: 'NFC_South', label: 'NFC South' },
    { key: 'NFC_West', label: 'NFC West' },
  ],
  // 'group' (not 'global'): divisionWinner normalizes within its division and sits
  // outside the cap chain; the reach-ladder is the capped monotone chain; the
  // per-win round is field-scoped. A 'global' strategy would clamp
  // P(make playoffs) <= P(12+ wins), which is nonsense.
  devigStrategy: 'group',
  defaultPayoutRules: {
    regularSeasonWins: 0.1029,
    divisionWinner: 2.0,
    playoffBerth: 0.75,
    reachDivisional: 1.5,
    reachConfChamp: 2.5,
    reachSuperBowl: 3.75,
    superBowl: 10.0,
    bestRecord: 3.0,
    worstRecord: 3.0,
  },
  defaultPotSize: 4000,
  propBets: [
    { key: 'bestRecord', label: 'Best Record in the NFL' },
    { key: 'worstRecord', label: 'Worst Record in the NFL' },
  ],
  badge: 'NFL 2026-27',
  teamLabel: 'Team',
  groupLabel: 'Division',
  startDate: '2026-09-10',
  // Super Bowl LXI — Sunday 2027-02-14, SoFi Stadium. Verified 2026-08-16.
  endDate: '2027-02-14',
  hostingOpensAt: '2026-08-20',
  isActive: true,
  strategyPrice: 1499,
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_NFL',
  liveSyncMatchers: ['nfl', 'nfl season'],
  previewTeamCount: 4,
};
```

Leave `NFL_SEASON_2026_TEAMS` exactly as it is — Task 9 refreshes the numbers, and team `id` values must stay stable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v2 && npm test -- nfl-season-config`
Expected: PASS, 6 tests.

- [ ] **Step 5: Confirm the preset test now fails loudly**

Run: `cd v2 && npm test -- payout-presets`
Expected: FAIL for `nfl_season_2026` — the presets still use the old round keys. Task 5 fixes this. Confirming the failure proves the guard rail works.

- [ ] **Step 6: Commit**

```bash
git add v2/lib/tournaments/configs/nfl-season-2026.ts v2/lib/tournaments/__tests__/nfl-season-config.test.ts
git commit -m "feat(nfl): reach-ladder rounds, per-win round, correct Super Bowl LXI date"
```

---

### Task 4: NFL props

**Files:**
- Modify: `v2/lib/tournaments/props.ts` (add `NFL_PROPS`, add branch to `getStandardProps`)
- Test: `v2/lib/tournaments/__tests__/nfl-props.test.ts`

**Interfaces:**
- Consumes: prop keys `bestRecord` / `worstRecord` from Task 3
- Produces: `NFL_PROPS: PropDefinition[]`, and `getStandardProps('nfl_season_2026')` returning it. Task 5's presets must use exactly these keys.

- [ ] **Step 1: Write the failing test**

Create `v2/lib/tournaments/__tests__/nfl-props.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getStandardProps } from '../props';
import { NFL_SEASON_2026_CONFIG } from '../configs/nfl-season-2026';

describe('NFL props', () => {
  it('returns props for the NFL season tournament', () => {
    const props = getStandardProps('nfl_season_2026');
    expect(props.map((p) => p.key)).toEqual(['bestRecord', 'worstRecord']);
  });

  it('prop keys match the config exactly, or the pot silently under-distributes', () => {
    const configKeys = NFL_SEASON_2026_CONFIG.propBets.map((p) => p.key).sort();
    const propKeys = getStandardProps('nfl_season_2026').map((p) => p.key).sort();
    expect(propKeys).toEqual(configKeys);
  });

  it('does not leak NFL props into other sports', () => {
    expect(getStandardProps('world_cup_2026').some((p) => p.key === 'bestRecord')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- nfl-props`
Expected: FAIL — `getStandardProps('nfl_season_2026')` returns `[]`.

- [ ] **Step 3: Add NFL_PROPS**

In `v2/lib/tournaments/props.ts`, after `WORLD_CUP_PROPS`:

```typescript
/**
 * Standard props for NFL season Calcuttas.
 * Best/worst record are the two attested NFL Calcutta side bets, and both are
 * auto-gradeable from the same ESPN standings call the per-win round needs.
 * Record ties are COMMON in the NFL (several teams routinely share the worst
 * record), so any auto-grader must emit every tied team — PropResult.winners[]
 * splits the payout evenly.
 */
export const NFL_PROPS: PropDefinition[] = [
  {
    key: 'bestRecord',
    label: 'Best Record in the NFL',
    description: 'Team with the most regular-season wins (ties split the payout)',
    defaultPercentage: 3,
    autoCalculated: true,
  },
  {
    key: 'worstRecord',
    label: 'Worst Record in the NFL',
    description: 'Team with the fewest regular-season wins — makes a bad team worth owning (ties split the payout)',
    defaultPercentage: 3,
    autoCalculated: true,
  },
];
```

- [ ] **Step 4: Branch in getStandardProps**

Add before the final `return []`:

```typescript
  if (tournamentId.startsWith('nfl')) {
    return NFL_PROPS;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd v2 && npm test -- nfl-props`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add v2/lib/tournaments/props.ts v2/lib/tournaments/__tests__/nfl-props.test.ts
git commit -m "feat(nfl): best/worst record props"
```

---

### Task 5: NFL payout presets, and a units-aware preset test

**Files:**
- Modify: `v2/lib/tournaments/payout-presets.ts:230-267` (NFL_SEASON_PAYOUT_PRESETS)
- Modify: `v2/lib/tournaments/__tests__/payout-presets.test.ts:36-40`

**Interfaces:**
- Consumes: round keys (Task 3), prop keys (Task 4), `payoutUnits` (Task 1)
- Produces: presets `balanced`, `everyWeek`, `topHeavy` for `nfl_season_2026`

- [ ] **Step 1: Make the preset test units-aware**

In `v2/lib/tournaments/__tests__/payout-presets.test.ts`, change the round-total reducer so a flat-rate round is scored against its real unit count:

```typescript
          // Round portion: each round's per-unit rate × its unit count. Most rounds
          // pay once per advancing team; a flatRate round (NFL per-win) pays once
          // per unit, so `payoutUnits` is the multiplier.
          const roundTotal = config.rounds.reduce((sum, round) => {
            const rate = preset.rules[round.key] ?? 0;
            return sum + rate * (round.payoutUnits ?? round.teamsAdvancing);
          }, 0);
```

Also update the doc-comment's "Sum formula" line to read `(rate × (payoutUnits ?? teamsAdvancing))`.

- [ ] **Step 2: Run the test to see the real failure**

Run: `cd v2 && npm test -- payout-presets`
Expected: FAIL for `nfl_season_2026` only — its presets still reference `conferenceChamp`, `mvp` and `mostWins`, which no longer exist, so the totals fall far below 99.5.

- [ ] **Step 3: Replace the NFL presets**

Replace `NFL_SEASON_PAYOUT_PRESETS` in `v2/lib/tournaments/payout-presets.ts`:

```typescript
/**
 * NFL season Calcutta. Budget = rate × (payoutUnits ?? teamsAdvancing).
 * The per-win round has 272 units (272 regular-season games), so its budget is
 * rate × 272. Props are absolute percentages.
 *
 * Balanced splits the pot 50/50 between the regular season and the playoffs;
 * every playoff rung pays less per team than the 10% champion award.
 */
export const NFL_SEASON_PAYOUT_PRESETS: Record<string, PayoutPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'Half the pot on the regular season, half on the playoffs',
    rules: {
      regularSeasonWins: 0.1029, // ×272 = 27.99%
      divisionWinner: 2.0,       // ×8   = 16%
      playoffBerth: 0.75,        // ×14  = 10.5%
      reachDivisional: 1.5,      // ×8   = 12%
      reachConfChamp: 2.5,       // ×4   = 10%
      reachSuperBowl: 3.75,      // ×2   = 7.5%
      superBowl: 10.0,           // ×1   = 10%
      bestRecord: 3.0,
      worstRecord: 3.0,
    },                           // total = 99.99%
  },
  everyWeek: {
    label: 'Every Week Counts',
    description: 'Most of the pot paid out win by win across the season',
    rules: {
      regularSeasonWins: 0.1471, // ×272 = 40.01%
      divisionWinner: 2.0,       // ×8   = 16%
      playoffBerth: 0.75,        // ×14  = 10.5%
      reachDivisional: 1.25,     // ×8   = 10%
      reachConfChamp: 1.75,      // ×4   = 7%
      reachSuperBowl: 2.25,      // ×2   = 4.5%
      superBowl: 6.0,            // ×1   = 6%
      bestRecord: 3.0,
      worstRecord: 3.0,
    },                           // total = 100.01%
  },
  topHeavy: {
    label: 'Super Bowl Heavy',
    description: 'Most of the pot goes to the champion',
    rules: {
      regularSeasonWins: 0.0625, // ×272 = 17%
      divisionWinner: 2.0,       // ×8   = 16%
      playoffBerth: 0.75,        // ×14  = 10.5%
      reachDivisional: 1.5,      // ×8   = 12%
      reachConfChamp: 2.5,       // ×4   = 10%
      reachSuperBowl: 4.75,      // ×2   = 9.5%
      superBowl: 19.0,           // ×1   = 19%
      bestRecord: 3.0,
      worstRecord: 3.0,
    },                           // total = 100%
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd v2 && npm test -- payout-presets`
Expected: PASS for every tournament, including three NFL presets.

- [ ] **Step 5: Verify the default rules also sum to 100**

Run: `cd v2 && npm test`
Expected: all pass. `defaultPayoutRules` in Task 3 is the balanced preset, so it sums identically.

- [ ] **Step 6: Commit**

```bash
git add v2/lib/tournaments/payout-presets.ts v2/lib/tournaments/__tests__/payout-presets.test.ts
git commit -m "feat(nfl): three payout presets; preset test honors payoutUnits"
```

---

### Task 6: Host-editable payouts — units-aware totals and a dollars-per-win input

**Files:**
- Modify: `v2/components/live/create-session-form.tsx:158-161` (totalPercent), `:623-650` (custom editor)
- Test: `v2/lib/tournaments/__tests__/payout-total.test.ts`

**Interfaces:**
- Consumes: `payoutUnits`, `flatRate`, `unitLabel` (Task 1); NFL config (Task 3)
- Produces: exported helper `roundBudget(round, rate): number` in `v2/lib/tournaments/payout-presets.ts`, reused by the form and the test

- [ ] **Step 1: Write the failing test**

Create `v2/lib/tournaments/__tests__/payout-total.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { roundBudget } from '../payout-presets';
import { NFL_SEASON_2026_CONFIG } from '../configs/nfl-season-2026';
import { getPayoutPresets } from '../payout-presets';

describe('roundBudget', () => {
  it('uses payoutUnits for a flat-rate round', () => {
    const wins = NFL_SEASON_2026_CONFIG.rounds.find((r) => r.key === 'regularSeasonWins')!;
    expect(roundBudget(wins, 0.1029)).toBeCloseTo(27.99, 2);
  });

  it('falls back to teamsAdvancing for a normal round', () => {
    const div = NFL_SEASON_2026_CONFIG.rounds.find((r) => r.key === 'divisionWinner')!;
    expect(roundBudget(div, 2.0)).toBeCloseTo(16, 5);
  });

  it('the create-form total for the balanced preset reads ~100%, not ~75%', () => {
    const rules = getPayoutPresets('nfl_season_2026').balanced.rules;
    const roundTotal = NFL_SEASON_2026_CONFIG.rounds.reduce(
      (sum, r) => sum + roundBudget(r, rules[r.key] ?? 0), 0
    );
    const propTotal = NFL_SEASON_2026_CONFIG.propBets.reduce((s, p) => s + (rules[p.key] ?? 0), 0);
    expect(roundTotal + propTotal).toBeGreaterThanOrEqual(99.5);
    expect(roundTotal + propTotal).toBeLessThanOrEqual(100.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- payout-total`
Expected: FAIL — `roundBudget` is not exported.

- [ ] **Step 3: Add the shared helper**

Add `import type { RoundConfig } from './types';` to the **top** of `v2/lib/tournaments/payout-presets.ts` alongside the existing imports (a mid-file import trips `import/first`), then append at the end of the file:

```typescript
/**
 * A round's share of the pot: the per-unit rate times the number of units.
 * Most rounds pay once per advancing team; a flat-rate round (NFL per-win) pays
 * once per unit. Every place that totals payouts must use this — the preset test,
 * the create-session form, and tie adjustment — or they drift apart silently.
 */
export function roundBudget(round: RoundConfig, rate: number): number {
  return rate * (round.payoutUnits ?? round.teamsAdvancing);
}
```

- [ ] **Step 4: Use it in the create form's running total**

In `v2/components/live/create-session-form.tsx`, import `roundBudget` from `@/lib/tournaments/payout-presets` and replace the `totalPercent` reducer:

```typescript
  const totalPercent = rounds.reduce(
    (sum, r) => sum + roundBudget(r, activeRules[r.key] ?? 0),
    0
  ) + enabledPropTotal;
```

- [ ] **Step 5: Make the per-round editor units-aware**

Replace the `rounds.map(...)` body inside the custom editor (`:626-649`) with:

```tsx
                {rounds.map((round) => {
                  const rate = customRules[round.key] ?? 0;
                  const units = round.payoutUnits ?? round.teamsAdvancing;
                  const unitNoun = round.unitLabel ?? selectedTournament?.teamLabel?.toLowerCase() ?? 'team';
                  const pot = Number(potSize) || 0;
                  // A flat-rate round's percentage is tiny (0.1029% per win) and
                  // meaningless to type. Let the host enter dollars instead and
                  // derive the rate; percent stays the stored source of truth so
                  // payouts still scale with the ACTUAL pot, not this estimate.
                  const isFlat = round.flatRate === true;
                  const dollars = isFlat ? (pot * rate) / 100 : 0;
                  return (
                    <div key={round.key}>
                      <label className="block text-[10px] text-white/40 mb-0.5">
                        {round.payoutLabel}
                      </label>
                      <div className="relative">
                        {isFlat && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">$</span>
                        )}
                        <input
                          type="number"
                          min={0}
                          max={isFlat ? undefined : 100}
                          step={isFlat ? 0.01 : 0.01}
                          value={isFlat ? Number(dollars.toFixed(2)) : rate}
                          onChange={(e) => {
                            if (isFlat) {
                              const d = Number(e.target.value) || 0;
                              const pct = pot > 0 ? (d / pot) * 100 : 0;
                              handleCustomRuleChange(round.key, String(pct));
                            } else {
                              handleCustomRuleChange(round.key, e.target.value);
                            }
                          }}
                          className={`h-8 w-full rounded border border-white/10 bg-white/[0.04] ${isFlat ? 'pl-5 pr-2' : 'px-2 pr-6'} text-right text-xs text-white focus:border-emerald-500/50 focus:outline-none`}
                        />
                        {!isFlat && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">%</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-white/20">
                        {isFlat
                          ? `per ${unitNoun} × ${units} = ${roundBudget(round, rate).toFixed(1)}%`
                          : `${units} ${unitNoun}s = ${roundBudget(round, rate).toFixed(1)}%`}
                      </p>
                    </div>
                  );
                })}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd v2 && npm test -- payout-total`
Expected: PASS, 3 tests.

- [ ] **Step 7: Verify visually**

Start the dev server via the preview tool (never `npm run dev` in Bash), open `/host/create`, select **NFL Season 2026-27**, and expand the custom payout editor.
Expected: total reads ~100.0% in green; the "Each Regular-Season Win" field shows `$4.12` with helper text `per win × 272 = 28.0%`; changing the pot to 2000 halves the dollar figure while the percentage total stays ~100%.

- [ ] **Step 8: Commit**

```bash
git add v2/lib/tournaments/payout-presets.ts v2/components/live/create-session-form.tsx v2/lib/tournaments/__tests__/payout-total.test.ts
git commit -m "feat(create): units-aware payout totals and dollars-per-win entry"
```

---

### Task 7: Stop offering archived tournaments

**Files:**
- Modify: `v2/app/(protected)/host/create/page.tsx:9`
- Modify: `v2/components/live/create-session-form.tsx:45-49`
- Test: `v2/lib/tournaments/__tests__/hostable-filter.test.ts`

**Interfaces:**
- Consumes: `getTournamentPhase` from `@/lib/tournaments/phase`
- Produces: `listHostableTournaments(now?: Date): TournamentConfig[]` in `v2/lib/tournaments/registry.ts`

- [ ] **Step 1: Write the failing test**

Create `v2/lib/tournaments/__tests__/hostable-filter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { listHostableTournaments } from '../registry';

describe('listHostableTournaments', () => {
  it('excludes a tournament that has already finished', () => {
    // 2026-08-16: PGA ended 2026-05-17, so it is archived.
    const ids = listHostableTournaments(new Date('2026-08-16T12:00:00Z')).map((c) => c.id);
    expect(ids).not.toContain('pga_championship_2026');
    expect(ids).not.toContain('march_madness_2026');
  });

  it('includes NFL once its hosting window opens', () => {
    const ids = listHostableTournaments(new Date('2026-08-21T12:00:00Z')).map((c) => c.id);
    expect(ids).toContain('nfl_season_2026');
  });

  it('excludes NFL before hosting opens', () => {
    const ids = listHostableTournaments(new Date('2026-08-01T12:00:00Z')).map((c) => c.id);
    expect(ids).not.toContain('nfl_season_2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- hostable-filter`
Expected: FAIL — `listHostableTournaments` does not exist.

- [ ] **Step 3: Add the registry helper**

In `v2/lib/tournaments/registry.ts`, after `listTournaments()`:

```typescript
/**
 * Tournaments a host can actually create a league for right now.
 *
 * `isHostable()` only asks "has hosting opened?" and has no upper bound, so every
 * finished event stays selectable forever — on 2026-08-09 a new user created a
 * league for a major that had ended in May. Phase is the correct gate.
 */
export function listHostableTournaments(now: Date = new Date()): TournamentConfig[] {
  return listTournaments().filter((c) => {
    const phase = getTournamentPhase(c, now);
    return phase === 'hostable' || phase === 'live';
  });
}
```

Add `import { getTournamentPhase } from './phase';` at the top if it isn't already imported.

- [ ] **Step 4: Use it on the create page**

In `v2/app/(protected)/host/create/page.tsx`, change the import and the call:

```typescript
import { listHostableTournaments } from '@/lib/tournaments/registry';
...
  const tournaments = listHostableTournaments();
```

- [ ] **Step 5: Fix the default selection and add an empty state**

In `v2/components/live/create-session-form.tsx`, replace the default-selection chain (`:45-49`). `isActive` must not participate — it is the legacy flag and is what selected a finished PGA Championship:

```typescript
  const defaultTournament =
    (initialTournamentId && tournaments.find((t) => t.id === initialTournamentId)) ||
    tournaments[0];
```

Then, immediately inside the component's returned JSX (before the form), add the empty state:

```tsx
  if (tournaments.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center">
        <h2 className="text-lg font-medium text-white">No events open for hosting right now</h2>
        <p className="mt-2 text-sm text-white/50">
          We open hosting a couple of weeks before each event. Check back soon — or email
          us and we&apos;ll build a custom Calcutta for any sport or event, from $74.99.
        </p>
      </div>
    );
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd v2 && npm test -- hostable-filter`
Expected: PASS, 3 tests.

- [ ] **Step 7: Verify visually**

Open `/host/create` in the preview browser.
Expected: the dropdown lists only NFL Season 2026-27 (on or after Aug 20). No PGA, Masters, March Madness, Kentucky Derby, or World Cup.

- [ ] **Step 8: Commit**

```bash
git add v2/lib/tournaments/registry.ts "v2/app/(protected)/host/create/page.tsx" v2/components/live/create-session-form.tsx v2/lib/tournaments/__tests__/hostable-filter.test.ts
git commit -m "fix(create): only offer tournaments whose hosting window is open"
```

---

### Task 8: NFL bundling

**Files:**
- Modify: `v2/lib/tournaments/bundles.ts` (`getBundlePresets`, `generateBundles`, `deriveBundleLabel`)
- Test: `v2/lib/tournaments/__tests__/nfl-bundles.test.ts`

**Interfaces:**
- Consumes: NFL config and teams (Task 3)
- Produces: `NFL_BUNDLE_PRESETS`, and `generateBundles(preset, teams, nflConfig)` returning value-ranked bundles

- [ ] **Step 1: Write the failing test**

Create `v2/lib/tournaments/__tests__/nfl-bundles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateBundles, getBundlePresets } from '../bundles';
import { NFL_SEASON_2026_CONFIG, NFL_SEASON_2026_TEAMS } from '../configs/nfl-season-2026';

describe('NFL bundling', () => {
  it('has its own presets, not the bracket ones', () => {
    const presets = getBundlePresets('nfl');
    expect(presets.light.description).toContain('8');
  });

  it('none returns no bundles', () => {
    expect(generateBundles('none', NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG)).toEqual([]);
  });

  it('bundles the WEAKEST teams, never a division', () => {
    const bundles = generateBundles('light', NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG);
    const bundled = bundles.flatMap((b) => b.teamIds);
    // The strongest team by seed must never be bundled.
    const best = [...NFL_SEASON_2026_TEAMS].sort((a, b) => a.seed - b.seed)[0];
    expect(bundled).not.toContain(best.id);
    expect(bundled).toHaveLength(8);
  });

  it('every bundle holds at least two teams', () => {
    for (const preset of ['light', 'standard', 'heavy'] as const) {
      const bundles = generateBundles(preset, NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG);
      for (const b of bundles) expect(b.teamIds.length).toBeGreaterThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v2 && npm test -- nfl-bundles`
Expected: FAIL — NFL falls through to bracket bundling, which groups seeds 13-16 (the AFC West, including one of the league's best teams).

- [ ] **Step 3: Add NFL presets**

In `v2/lib/tournaments/bundles.ts`, beside the other preset objects:

```typescript
const NFL_BUNDLE_PRESETS: Record<BundlePreset, { label: string; description: string }> = {
  none: { label: 'No Bundling', description: 'All 32 teams sold individually' },
  light: { label: 'Light Bundling', description: 'Weakest 8 teams sold in pairs (28 items)' },
  standard: { label: 'Standard Bundling', description: 'Weakest 12 teams sold in trios (24 items)' },
  heavy: { label: 'Heavy Bundling', description: 'Weakest 16 teams sold in fours (20 items)' },
  custom: { label: 'Custom', description: 'Define your own team groupings' },
};
```

And in `getBundlePresets`, before the bracket fallback:

```typescript
  if (sport === 'nfl') return NFL_BUNDLE_PRESETS;
```

- [ ] **Step 4: Add the generator**

Add the helper near `bundleGolf`:

```typescript
/**
 * NFL bundling: group the weakest N teams by rank into fixed-size lots.
 * Rank by `seed`, which for the NFL IS a true global 1-32 power rank (unlike
 * soccer, where seed is only within-group position).
 */
function bundleNfl(teams: BaseTeam[], weakestCount: number, groupSize: number): TeamBundle[] {
  const ranked = [...teams].sort((a, b) => a.seed - b.seed);
  const weakest = ranked.slice(-weakestCount);
  const bundles: TeamBundle[] = [];
  for (let i = 0; i < weakest.length; i += groupSize) {
    const chunk = weakest.slice(i, i + groupSize);
    if (chunk.length < 2) {
      // Never emit a one-team "bundle" — fold the straggler into the last lot.
      if (bundles.length > 0) bundles[bundles.length - 1].teamIds.push(...chunk.map((t) => t.id));
      continue;
    }
    bundles.push({
      id: `nfl-bundle-${chunk[0].id}`,
      // NOTE: the field is `name`, not `label` — see TeamBundle in types.ts:135.
      name: chunk.map((t) => t.name).join(' / '),
      teamIds: chunk.map((t) => t.id),
    });
  }
  return bundles;
}
```

Then in `generateBundles`, after the soccer block:

```typescript
  if (config.sport === 'nfl') {
    switch (preset) {
      case 'none': return [];
      case 'light': return bundleNfl(teams, 8, 2);
      case 'standard': return bundleNfl(teams, 12, 3);
      case 'heavy': return bundleNfl(teams, 16, 4);
      case 'custom': return [];
    }
  }
```

Finally, in `deriveBundleLabel`, add an `nfl-bundle-` branch beside the existing prefixes, so titles regenerate from the current team map instead of freezing at creation time:

```typescript
  if (bundle.id.startsWith('nfl-bundle-')) {
    return members.map((t) => t.name).join(' / ');
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd v2 && npm test -- nfl-bundles`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add v2/lib/tournaments/bundles.ts v2/lib/tournaments/__tests__/nfl-bundles.test.ts
git commit -m "feat(nfl): value-ranked bundling instead of bracket seed groups"
```

---

### Task 9: Fetch real NFL odds from Kalshi

**Files:**
- Create: `v2/scripts/fetch-nfl-odds.mjs`
- Modify: `v2/lib/tournaments/configs/nfl-season-2026.ts` (the teams array's `probabilities`, written by the script)

**Interfaces:**
- Consumes: round keys (Task 3)
- Produces: each team in `NFL_SEASON_2026_TEAMS` carries `probabilities` for all seven round keys, pre-normalized to each round's target

- [ ] **Step 1: Probe the API before writing anything**

```bash
curl -s "https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXNFLWINS&status=open&limit=5" | head -c 2000
```
Expected: JSON with an `events` array whose tickers look like `KXNFLWINS-27KC`. **Record the actual season suffix** — do not assume `-27`. If the response is empty, stop and report; every later step depends on this.

- [ ] **Step 2: Write the script**

Create `v2/scripts/fetch-nfl-odds.mjs`. Key requirements, each of which exists because of a documented bug:

```javascript
// Usage: node scripts/fetch-nfl-odds.mjs [--dry]
// Run from the MAIN checkout — worktrees have no node_modules/.env.local.
//
// Writes `probabilities` (NOT americanOdds) into NFL_SEASON_2026_TEAMS,
// pre-normalized per round to that round's target. Pre-normalizing is how we
// avoid the "devig never scales up" pot leak without touching shared devig code.

const BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Kalshi vs our config. Kalshi's yes_sub_title is city-only and ambiguous
// ("Los Angeles C", "New York G"), so we join on the TICKER SUFFIX. Note the
// dialect differences vs ESPN: Kalshi JAC/WAS/LAR where ESPN uses JAX/WSH/LAR.
// Values MUST match NFL_SEASON_2026_TEAMS[].name character for character.
const KALSHI_ABBR = {
  BUF: 'Buffalo Bills',        MIA: 'Miami Dolphins',
  NYJ: 'New York Jets',        NE:  'New England Patriots',
  BAL: 'Baltimore Ravens',     CIN: 'Cincinnati Bengals',
  PIT: 'Pittsburgh Steelers',  CLE: 'Cleveland Browns',
  HOU: 'Houston Texans',       IND: 'Indianapolis Colts',
  JAC: 'Jacksonville Jaguars', TEN: 'Tennessee Titans',
  KC:  'Kansas City Chiefs',   LAC: 'Los Angeles Chargers',
  DEN: 'Denver Broncos',       LV:  'Las Vegas Raiders',
  PHI: 'Philadelphia Eagles',  DAL: 'Dallas Cowboys',
  NYG: 'New York Giants',      WAS: 'Washington Commanders',
  DET: 'Detroit Lions',        GB:  'Green Bay Packers',
  MIN: 'Minnesota Vikings',    CHI: 'Chicago Bears',
  TB:  'Tampa Bay Buccaneers', NO:  'New Orleans Saints',
  ATL: 'Atlanta Falcons',      CAR: 'Carolina Panthers',
  SF:  'San Francisco 49ers',  SEA: 'Seattle Seahawks',
  LAR: 'Los Angeles Rams',     ARI: 'Arizona Cardinals',
};

// Prices live only in *_dollars STRING fields. Untraded-but-ACTIVE strikes report
// last_price_dollars "0.0000" while quoting a real bid/ask, so use the MID.
function priceOf(m) {
  const bid = Number(m.yes_bid_dollars ?? 0);
  const ask = Number(m.yes_ask_dollars ?? 0);
  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  return Number(m.last_price_dollars ?? 0);
}

// Normalize a round across the field to its target, scaling UP as well as down.
function normalize(byTeam, target) {
  const sum = Object.values(byTeam).reduce((a, b) => a + b, 0);
  if (sum === 0) return byTeam;
  const scale = target / sum;
  return Object.fromEntries(Object.entries(byTeam).map(([k, v]) => [k, v * scale]));
}
```

The script must:
1. Resolve the season suffix dynamically from `/events?series_ticker=KXNFLWINS`.
2. Skip any market where `m.status !== 'active'`.
3. For `regularSeasonWins`: sum the 17 "at least N" strike prices per team to get expected wins; assert the strike ladder is monotonically non-increasing and abort with the team name if not.
4. For `divisionWinner`: normalize within each division to 1.
5. For the five ladder rounds: read `KXNFLSTAGEOFELIM-{suffix}{ABBR}` legs and derive `playoffBerth = 1 − P(REG)`, `reachDivisional = 1 − P(REG) − P(WC)`, `reachConfChamp = P(CONF)+P(FL)+P(FW)`, `reachSuperBowl = P(FL)+P(FW)`, `superBowl = P(FW)`.
6. Normalize each round to its target: 272, 8 (per division), 14, 8, 4, 2, 1.
7. **Match teams by name, never reassign `id`** — `session.settings.bundles` reference creation-time ids.
8. Assert the abbreviation map resolves exactly 32 teams on both sides and abort otherwise.
9. Under `--dry`, print a table and write nothing.

- [ ] **Step 3: Dry run**

```bash
cd /c/Users/pwidd/CascadeProjects/calcutta-auction-tool/v2 && node scripts/fetch-nfl-odds.mjs --dry
```
Expected: 32 rows; expected wins between roughly 3 and 14 summing to ~272; `superBowl` probabilities summing to 1.00; no abort.

- [ ] **Step 4: Write for real, then confirm ids did not move**

```bash
cd /c/Users/pwidd/CascadeProjects/calcutta-auction-tool/v2 && node scripts/fetch-nfl-odds.mjs && git diff --stat lib/tournaments/configs/nfl-season-2026.ts && npx tsx scripts/diagnose-bundle-drift.ts
```
Expected: only `probabilities` values changed — no `id:` lines in the diff. Bundle drift reports nothing.

- [ ] **Step 5: Run all tests**

Run: `cd v2 && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add v2/scripts/fetch-nfl-odds.mjs v2/lib/tournaments/configs/nfl-season-2026.ts
git commit -m "feat(nfl): Kalshi odds fetcher and real preseason probabilities"
```

---

### Task 10: NFL checkout copy and Payment Link

**Files:**
- Modify: `v2/app/(protected)/payment/page.tsx:12-33` (FEATURES_BY_SPORT)

**Interfaces:**
- Consumes: `stripePaymentLinkEnvKey` from Task 3

- [ ] **Step 1: Confirm the bug**

Open `/payment?tournament=nfl_season_2026` in the preview browser.
Expected (the bug): basketball copy reading "All 64 teams with full analytics" on a 32-team event, and the checkout button pointing at the March Madness Payment Link.

- [ ] **Step 2: Add NFL copy**

In `v2/app/(protected)/payment/page.tsx`, add an `nfl` entry to `FEATURES_BY_SPORT` matching the shape of the existing entries:

```typescript
  nfl: [
    'All 32 teams with fair-value pricing',
    'Live Kalshi-derived win totals and playoff odds',
    'Per-win payout modeling for season-long pools',
    'Bid tracker and budget planner for auction night',
  ],
```

- [ ] **Step 3: Create the Stripe Payment Link**

Create a $14.99 live-mode Payment Link for "NFL Season 2026-27 Strategy Tool". **It must set `after_completion.type = 'redirect'`** with URL `https://www.calcuttaedge.com/strategy?tournament=nfl_season_2026&purchased=1` — a link created without it defaults to a generic thank-you page with no redirect.

Add the URL to Vercel as `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_NFL` (Production), with no trailing whitespace.

- [ ] **Step 4: Verify**

Redeploy, then open `/payment?tournament=nfl_season_2026`.
Expected: NFL copy, and the button opens the NFL Payment Link — not March Madness.

- [ ] **Step 5: Commit**

```bash
git add "v2/app/(protected)/payment/page.tsx"
git commit -m "fix(nfl): correct checkout copy and Payment Link for the NFL season tool"
```

---

## Final verification

- [ ] `cd v2 && npm test` — all green
- [ ] `cd v2 && npm run build` — succeeds
- [ ] `cd v2 && npm run lint` — clean
- [ ] `/pre-deploy-review` before any push
- [ ] `/e2e-test` a full live sale — `bidding.ts` is DB-coupled with no unit tests, and `markSingleTeamWinner` remains unverified in production

## Out of scope (later plans)

- The $19 host paywall — its own plan, after this lands.
- `/api/nfl/sync`, ESPN standings parsing, and settlement — needed by Week 1, not by draft night.
- Live/projected NFL standings and `/api/nfl/ev` — target Week 4.
- January playoff Calcutta (`nfl-playoffs-2026.ts`) — December.
