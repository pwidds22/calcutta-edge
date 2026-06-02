import { describe, it, expect } from 'vitest';
import type { BaseTeam, TournamentConfig } from '@/lib/tournaments/types';
import { initializeTeams } from '../initialize';
import {
  WORLD_CUP_2026_CONFIG,
  WORLD_CUP_2026_TEAMS,
} from '@/lib/tournaments/configs/world-cup-2026';

/**
 * Tests for the scope-aware `'group'` devig strategy used by the World Cup:
 *  - group-scoped rounds (e.g. "Win Group") normalize WITHIN each group to sum→1
 *    and sit OUTSIDE the knockout cap chain.
 *  - global-scoped rounds form a nested ladder, each normalized to `teamsAdvancing`
 *    and capped at the previous global round.
 *
 * Kalshi prices are fed via `probabilities` (0–1); `americanOdds` is empty.
 */

const NO_AMERICAN: Record<string, number> = {};

// ── Main fixture: 2 groups of 3, deliberately "over-round" so devig scales down ──
const CONFIG: TournamentConfig = {
  id: 'wc_test',
  name: 'WC Test',
  sport: 'soccer',
  rounds: [
    { key: 'winGroup', label: 'Win Group', teamsAdvancing: 2, payoutLabel: 'Win Group', devigScope: 'group' },
    { key: 'r16', label: 'R16', teamsAdvancing: 4, payoutLabel: 'Reach R16', devigScope: 'global' },
    { key: 'champion', label: 'Champ', teamsAdvancing: 1, payoutLabel: 'Champion', devigScope: 'global' },
  ],
  groups: [
    { key: 'A', label: 'Group A' },
    { key: 'B', label: 'Group B' },
  ],
  devigStrategy: 'group',
  defaultPayoutRules: { winGroup: 1, r16: 1, champion: 10 },
  defaultPotSize: 10000,
  propBets: [],
  badge: 'WC Test',
  teamLabel: 'Nation',
  groupLabel: 'Group',
  startDate: '2026-06-11',
  endDate: '2026-07-19',
  isActive: true,
};

// winGroup raw sums: A=1.20, B=1.05 (both >1 → scale to 1).
// r16 raw sum = 4.05 (>4 → scale to 4). champion raw sum = 1.10 (>1 → scale to 1).
// Data is internally consistent (champion ≤ r16 per team) so no cap fires here,
// EXCEPT A1 where winGroup(0.70) > r16(0.30): proves winGroup is outside the cap chain.
const TEAMS: BaseTeam[] = [
  { id: 1, name: 'A1', seed: 1, group: 'A', americanOdds: NO_AMERICAN, probabilities: { winGroup: 0.70, r16: 0.30, champion: 0.20 } },
  { id: 2, name: 'A2', seed: 2, group: 'A', americanOdds: NO_AMERICAN, probabilities: { winGroup: 0.30, r16: 0.55, champion: 0.15 } },
  { id: 3, name: 'A3', seed: 3, group: 'A', americanOdds: NO_AMERICAN, probabilities: { winGroup: 0.20, r16: 0.40, champion: 0.05 } },
  { id: 4, name: 'B1', seed: 1, group: 'B', americanOdds: NO_AMERICAN, probabilities: { winGroup: 0.75, r16: 0.95, champion: 0.40 } },
  { id: 5, name: 'B2', seed: 2, group: 'B', americanOdds: NO_AMERICAN, probabilities: { winGroup: 0.20, r16: 0.90, champion: 0.20 } },
  { id: 6, name: 'B3', seed: 3, group: 'B', americanOdds: NO_AMERICAN, probabilities: { winGroup: 0.10, r16: 0.95, champion: 0.10 } },
];

function build() {
  return initializeTeams(TEAMS, [], CONFIG.defaultPayoutRules, 10000, CONFIG);
}

describe("World Cup 'group' devig — scope-aware hybrid", () => {
  it('normalizes Win Group within EACH group to sum→1 (one winner per group)', () => {
    const teams = build();
    for (const g of ['A', 'B']) {
      const sum = teams.filter((t) => t.group === g).reduce((s, t) => s + t.odds['winGroup'], 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('normalizes reach-R16 GLOBALLY to teamsAdvancing (16-style target)', () => {
    const teams = build();
    const sum = teams.reduce((s, t) => s + t.odds['r16'], 0);
    expect(sum).toBeCloseTo(4.0, 5);
  });

  it('normalizes champion globally to sum→1', () => {
    const teams = build();
    const sum = teams.reduce((s, t) => s + t.odds['champion'], 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('keeps the knockout ladder monotone (champion ≤ r16 per team)', () => {
    const teams = build();
    for (const t of teams) {
      expect(t.odds['champion']).toBeLessThanOrEqual(t.odds['r16'] + 1e-9);
    }
  });

  it('does NOT cap Win Group by the ladder (winGroup can exceed r16)', () => {
    const teams = build();
    const a1 = teams.find((t) => t.name === 'A1')!;
    // A1 is the group-A favorite (winGroup 0.70) but a weak knockout bet (r16 0.30).
    // Its devigged winGroup must stay well above its devigged r16 — i.e. it was not
    // clamped to the ladder.
    expect(a1.odds['winGroup']).toBeGreaterThan(a1.odds['r16'] + 0.1);
  });

  it('produces a higher fair value for the strong all-round team (B1) than a weak one (A3)', () => {
    const teams = build();
    const b1 = teams.find((t) => t.name === 'B1')!;
    const a3 = teams.find((t) => t.name === 'A3')!;
    expect(b1.fairValue).toBeGreaterThan(a3.fairValue);
  });
});

// ── Focused cap fixture: champion raw > r16 raw must be clamped to r16 ──
const CAP_CONFIG: TournamentConfig = {
  ...CONFIG,
  id: 'wc_cap_test',
  rounds: [
    { key: 'r16', label: 'R16', teamsAdvancing: 1, payoutLabel: 'Reach R16', devigScope: 'global' },
    { key: 'champion', label: 'Champ', teamsAdvancing: 1, payoutLabel: 'Champion', devigScope: 'global' },
  ],
  groups: [{ key: 'G', label: 'Group G' }],
  defaultPayoutRules: { r16: 1, champion: 10 },
};

const CAP_TEAMS: BaseTeam[] = [
  // T1 has an inconsistent champion (0.60) > r16 (0.30): the ladder cap must fix it.
  { id: 1, name: 'T1', seed: 1, group: 'G', americanOdds: NO_AMERICAN, probabilities: { r16: 0.30, champion: 0.60 } },
  { id: 2, name: 'T2', seed: 2, group: 'G', americanOdds: NO_AMERICAN, probabilities: { r16: 0.90, champion: 0.30 } },
];

describe("World Cup 'group' devig — ladder cap", () => {
  it('caps champion at the (devigged) r16 probability when market data is inconsistent', () => {
    const teams = initializeTeams(CAP_TEAMS, [], CAP_CONFIG.defaultPayoutRules, 10000, CAP_CONFIG);
    const t1 = teams.find((t) => t.name === 'T1')!;
    // r16 raw sum 1.20 → scaled by 1/1.2 → T1 r16 = 0.25. Champion (0.60) would exceed
    // that, so it must be clamped down to 0.25.
    expect(t1.odds['r16']).toBeCloseTo(0.25, 5);
    expect(t1.odds['champion']).toBeCloseTo(0.25, 5);
  });
});

// ── Smoke test against the REAL shipped config (structural, refresh-robust) ──
describe('World Cup 2026 — real config sanity', () => {
  const cfg = WORLD_CUP_2026_CONFIG;
  const teams = initializeTeams(
    WORLD_CUP_2026_TEAMS,
    [],
    cfg.defaultPayoutRules,
    cfg.defaultPotSize,
    cfg
  );
  const sumOdds = (round: string) => teams.reduce((s, t) => s + t.odds[round], 0);

  it('has 48 nations across 12 groups of 4', () => {
    expect(teams).toHaveLength(48);
    for (const g of cfg.groups) {
      expect(teams.filter((t) => t.group === g.key)).toHaveLength(4);
    }
  });

  it('normalizes Win Group within each group to ~1', () => {
    for (const g of cfg.groups) {
      const sum = teams.filter((t) => t.group === g.key).reduce((s, t) => s + t.odds['winGroup'], 0);
      expect(sum).toBeGreaterThan(0.9);
      expect(sum).toBeLessThanOrEqual(1.0001);
    }
  });

  it('keeps each reach-round ladder sum at/under its teamsAdvancing target', () => {
    // Devig never scales above target; market overround may leave it slightly under.
    for (const r of cfg.rounds) {
      if (r.devigScope === 'group') continue;
      const sum = sumOdds(r.key);
      expect(sum).toBeGreaterThan(0);
      expect(sum).toBeLessThanOrEqual(r.teamsAdvancing + 0.001);
    }
    // champion is a single-winner market → should be a near-full distribution.
    expect(sumOdds('champion')).toBeGreaterThan(0.9);
  });

  it('ladder is monotone non-increasing per team (r16 ≥ qf ≥ sf ≥ final ≥ champion)', () => {
    const ladder = ['r16', 'qf', 'sf', 'final', 'champion'];
    for (const t of teams) {
      for (let i = 1; i < ladder.length; i++) {
        expect(t.odds[ladder[i - 1]]).toBeGreaterThanOrEqual(t.odds[ladder[i]] - 1e-9);
      }
    }
  });

  it('makes a top title contender the most valuable team, with finite ≥ 0 values throughout', () => {
    for (const t of teams) {
      expect(Number.isFinite(t.fairValue)).toBe(true);
      expect(t.fairValue).toBeGreaterThanOrEqual(0);
    }
    const byChamp = [...teams].sort((a, b) => b.odds['champion'] - a.odds['champion']);
    const byValue = [...teams].sort((a, b) => b.fairValue - a.fairValue);
    // The most VALUABLE team need not be the title favorite — fair value sums all six
    // weighted milestones, so a favorite in a weak group (high win-group + deep-run odds)
    // can outrank the nominal title favorite. It should still be a top-3 title contender.
    const top3Champ = new Set(byChamp.slice(0, 3).map((t) => t.id));
    expect(top3Champ.has(byValue[0].id)).toBe(true);
    expect(byValue[0].fairValue).toBeGreaterThan(0);
    // Sanity: the weakest title odds should not produce the highest value.
    expect(byValue[0].fairValue).toBeGreaterThan(byValue[byValue.length - 1].fairValue);
  });
});
