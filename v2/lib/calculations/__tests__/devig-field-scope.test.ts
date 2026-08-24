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

// Regression: a multi-slot PROBABILITY round (targetSum > 1, e.g. golf's makeCut/top20
// or World Cup's r32/r16) must still clamp an individual team's devigged value to 1.
// `devigGroup` used to infer "count-based" from `targetSum > 1`, which silently removed
// the clamp from every multi-slot probability round in every live tournament. The real
// signal is `devigScope === 'field'`, not the target sum — this test pins the clamp for
// every OTHER scope (here: default/global) even when targetSum is well above 1.
const globalConfig = {
  devigStrategy: 'global',
  groups: [{ key: 'A', label: 'A' }],
  rounds: [
    { key: 'top20', label: 'T20', payoutLabel: 'Top 20', teamsAdvancing: 20 },
  ],
} as unknown as TournamentConfig;

const mkGlobalTeam = (id: number, top20: number): Team =>
  ({ id, name: `T${id}`, group: 'A', seed: id, rawImpliedProbabilities: { top20 }, odds: {} }) as unknown as Team;

describe('probability rounds keep the 1.0 clamp regardless of targetSum', () => {
  it('clamps a dominant team to 1 even on a multi-slot round (targetSum=20)', () => {
    // Raw probabilities sum to ~25 (> targetSum=20), so devigGroup scales down by
    // ~0.8x — team 1's scaled value (~20) still far exceeds 1 and must clamp to 1.
    const teams = [mkGlobalTeam(1, 25), mkGlobalTeam(2, 0.001), mkGlobalTeam(3, 0.001)];
    devigRoundOdds(teams, globalConfig);
    expect(teams[0].odds.top20).toBe(1);
  });
});
