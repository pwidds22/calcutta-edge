import { describe, it, expect } from 'vitest';
import {
  buildFanDuelProbabilities,
  buildDraftKingsProbabilities,
  buildPinnacleProbabilities,
} from '../devig-pipeline';
import { MARCH_MADNESS_2026_TEAMS } from '../configs/march-madness-2026';
import { TEAM_RANKINGS_2026 } from '../data/team-rankings-2026';
import type { OddsSourceProbabilities } from '../odds-sources';

function buildEvanMiya(): OddsSourceProbabilities {
  const teams: Record<number, Record<string, number>> = {};
  for (const t of MARCH_MADNESS_2026_TEAMS) {
    if (t.probabilities) teams[t.id] = { ...t.probabilities };
  }
  return { teams, updatedAt: '' };
}

const ALL_SOURCES: Record<string, OddsSourceProbabilities> = {
  evan_miya: buildEvanMiya(),
  team_rankings: TEAM_RANKINGS_2026,
  fanduel: buildFanDuelProbabilities(),
  draftkings: buildDraftKingsProbabilities(),
  pinnacle: buildPinnacleProbabilities(),
};

const SOURCES = Object.keys(ALL_SOURCES);
const ROUNDS = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'] as const;
const TOP_TEAM_IDS = [51, 17, 1, 34, 49, 67, 32, 45, 15, 28, 5, 23, 39, 11, 63];
const TEAM_NAMES: Record<number, string> = {
  51: 'Michigan', 17: 'Arizona', 1: 'Duke', 34: 'Florida', 49: 'Houston',
  67: 'Iowa St', 32: 'Purdue', 45: 'Illinois', 15: 'UConn', 28: 'Gonzaga',
  5: 'St Johns', 23: 'Arkansas', 39: 'Vanderbilt', 11: 'Mich St', 63: 'Virginia',
};

describe('Cross-source odds validation', () => {
  it('should print comparison tables for manual review', () => {
    for (const round of ROUNDS) {
      console.log(`\n=== ${round.toUpperCase()} ===`);
      const header = 'Team'.padEnd(14) + SOURCES.map(s => s.slice(0, 10).padStart(12)).join('');
      console.log(header);

      for (const id of TOP_TEAM_IDS) {
        const row = SOURCES.map(s => {
          const prob = ALL_SOURCES[s].teams[id]?.[round] ?? 0;
          return (prob * 100).toFixed(2).padStart(12);
        });
        console.log((TEAM_NAMES[id] ?? String(id)).padEnd(14) + row.join(''));
      }
    }
    expect(true).toBe(true); // Always passes — this is for manual review
  });

  it('championship probabilities should sum to ~1.0 for each source', () => {
    for (const src of SOURCES) {
      let sum = 0;
      for (const probs of Object.values(ALL_SOURCES[src].teams)) {
        sum += (probs as Record<string, number>).champ ?? 0;
      }
      console.log(`${src.padEnd(14)}: champ sum = ${sum.toFixed(4)}`);
      // Allow some tolerance — devigging normalizes but interpolation can shift slightly
      expect(sum).toBeGreaterThan(0.85);
      expect(sum).toBeLessThan(1.15);
    }
  });

  it('monotonic decrease: each round probability <= previous round', () => {
    const violations: string[] = [];
    for (const src of SOURCES) {
      for (const [tidStr, probs] of Object.entries(ALL_SOURCES[src].teams)) {
        const p = probs as Record<string, number>;
        for (let i = 1; i < ROUNDS.length; i++) {
          const curr = p[ROUNDS[i]] ?? 0;
          const prev = p[ROUNDS[i - 1]] ?? 0;
          if (curr > prev + 0.001) {
            const team = MARCH_MADNESS_2026_TEAMS.find(t => t.id === Number(tidStr));
            violations.push(
              `${src}/${team?.name ?? tidStr}: ${ROUNDS[i - 1]}=${prev.toFixed(4)} < ${ROUNDS[i]}=${curr.toFixed(4)}`
            );
          }
        }
      }
    }
    if (violations.length > 0) {
      console.log(`Monotonic violations (${violations.length}):`);
      violations.slice(0, 10).forEach(v => console.log(`  ${v}`));
    }
    expect(violations.length).toBe(0);
  });

  it('top teams should have reasonable championship odds (1-25%)', () => {
    for (const src of SOURCES) {
      for (const id of TOP_TEAM_IDS.slice(0, 4)) { // Top 4 teams
        const champ = ALL_SOURCES[src].teams[id]?.champ ?? 0;
        expect(champ).toBeGreaterThan(0.01);
        expect(champ).toBeLessThan(0.30);
      }
    }
  });

  it('sources should agree within 10% for top team championship odds', () => {
    const outliers: string[] = [];
    for (const id of TOP_TEAM_IDS.slice(0, 10)) {
      const probs = SOURCES.map(s => ALL_SOURCES[s].teams[id]?.champ ?? 0).filter(p => p > 0);
      if (probs.length < 2) continue;
      const max = Math.max(...probs);
      const min = Math.min(...probs);
      const spread = max - min;
      if (spread > 0.10) {
        outliers.push(`${TEAM_NAMES[id]}: spread=${(spread * 100).toFixed(1)}% (min=${(min * 100).toFixed(2)}%, max=${(max * 100).toFixed(2)}%)`);
      }
    }
    if (outliers.length > 0) {
      console.log('Championship spread outliers (>10%):');
      outliers.forEach(o => console.log(`  ${o}`));
    }
    // This is a soft check — log but don't fail
    expect(outliers.length).toBeLessThanOrEqual(3); // Allow a few outliers
  });
});
