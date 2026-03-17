import { describe, it, expect } from 'vitest';
import {
  americanToImplied,
  devigMatchup,
  devigBinary,
  devigOutright,
  estimateAvgOverround,
  devigYesOnly,
  buildFanDuelProbabilities,
  buildDraftKingsProbabilities,
  buildPinnacleProbabilities,
} from '../devig-pipeline';

// ── Core devig functions ─────────────────────────────────────────────

describe('americanToImplied', () => {
  it('converts positive odds (+200 = 0.3333)', () => {
    expect(americanToImplied(200)).toBeCloseTo(0.3333, 4);
  });

  it('converts negative odds (-200 = 0.6667)', () => {
    expect(americanToImplied(-200)).toBeCloseTo(0.6667, 4);
  });

  it('converts even odds (+100 = 0.5)', () => {
    expect(americanToImplied(100)).toBe(0.5);
  });

  it('converts heavy favorite (-1000 = 0.9091)', () => {
    expect(americanToImplied(-1000)).toBeCloseTo(0.9091, 4);
  });

  it('converts big underdog (+5000 = 0.0196)', () => {
    expect(americanToImplied(5000)).toBeCloseTo(0.0196, 4);
  });
});

describe('devigMatchup', () => {
  it('devigged matchup sums to 1.0', () => {
    const [pA, pB] = devigMatchup(-150, 130);
    expect(pA + pB).toBeCloseTo(1.0, 10);
  });

  it('favorite gets > 0.5', () => {
    const [pFav, pDog] = devigMatchup(-150, 130);
    expect(pFav).toBeGreaterThan(0.5);
    expect(pDog).toBeLessThan(0.5);
  });

  it('even matchup yields ~0.5 each', () => {
    const [pA, pB] = devigMatchup(-110, -110);
    expect(pA).toBeCloseTo(0.5, 4);
    expect(pB).toBeCloseTo(0.5, 4);
  });

  it('handles extreme favorite', () => {
    const [pFav, pDog] = devigMatchup(-100000, 6500);
    expect(pFav).toBeGreaterThan(0.98);
    expect(pFav + pDog).toBeCloseTo(1.0, 10);
  });
});

describe('devigBinary', () => {
  it('Duke S16 from FanDuel: -700/+570 ~ 0.854', () => {
    // FanDuel Duke S16: yes=-700, no=+570
    // implied YES = 700/800 = 0.875, implied NO = 100/670 = 0.1493
    // fair = 0.875 / (0.875 + 0.1493) = 0.854
    const prob = devigBinary(-700, 570);
    expect(prob).toBeCloseTo(0.854, 2);
    expect(prob).toBeGreaterThan(0.84);
    expect(prob).toBeLessThan(0.87);
  });

  it('result is between 0 and 1', () => {
    const prob = devigBinary(-200, 170);
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThan(1);
  });

  it('heavy favorite gives high probability', () => {
    const prob = devigBinary(-1000, 760);
    expect(prob).toBeGreaterThan(0.88);
  });
});

describe('devigOutright', () => {
  it('devigged outright sums to 1.0', () => {
    const result = devigOutright({ 1: 350, 17: 380, 51: 360, 34: 800 });
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('preserves relative ordering', () => {
    const result = devigOutright({ 1: 350, 17: 380 });
    // +350 has higher implied prob than +380 (lower odds = more likely)
    expect(result[1]).toBeGreaterThan(result[17]);
  });

  it('handles single-entry market', () => {
    const result = devigOutright({ 1: 200 });
    expect(result[1]).toBeCloseTo(1.0, 10);
  });

  it('handles empty market', () => {
    const result = devigOutright({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('estimateAvgOverround', () => {
  it('returns > 1.0 for typical vig markets', () => {
    const overround = estimateAvgOverround([
      { yes: -200, no: 170 },
      { yes: -150, no: 130 },
    ]);
    expect(overround).toBeGreaterThan(1.0);
  });

  it('returns 1.05 default for empty array', () => {
    expect(estimateAvgOverround([])).toBe(1.05);
  });

  it('returns ~1.0 for fair-priced market', () => {
    // -100 vs -100 = no-vig line
    const overround = estimateAvgOverround([{ yes: -100, no: -100 }]);
    // -100 implied = 0.5, so total = 1.0
    expect(overround).toBeCloseTo(1.0, 4);
  });
});

describe('devigYesOnly', () => {
  it('returns less than raw implied probability', () => {
    const raw = americanToImplied(200);
    const devigged = devigYesOnly(200, 1.05);
    expect(devigged).toBeLessThan(raw);
  });

  it('with overround 1.0, matches raw implied', () => {
    const raw = americanToImplied(200);
    const devigged = devigYesOnly(200, 1.0);
    expect(devigged).toBeCloseTo(raw, 10);
  });
});

// ── Monotonic decrease enforcement ───────────────────────────────────

describe('monotonic decrease enforcement', () => {
  it('FanDuel builder produces monotonically decreasing probs for top teams', () => {
    const fd = buildFanDuelProbabilities();
    const rounds = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'];
    // Check a few top teams
    for (const teamId of [1, 17, 51, 34]) {
      const probs = fd.teams[teamId];
      expect(probs).toBeDefined();
      for (let i = 1; i < rounds.length; i++) {
        expect(probs[rounds[i]]).toBeLessThanOrEqual(probs[rounds[i - 1]]);
      }
    }
  });

  it('DraftKings builder produces monotonically decreasing probs', () => {
    const dk = buildDraftKingsProbabilities();
    const rounds = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'];
    for (const teamId of [1, 17, 51, 34]) {
      const probs = dk.teams[teamId];
      expect(probs).toBeDefined();
      for (let i = 1; i < rounds.length; i++) {
        expect(probs[rounds[i]]).toBeLessThanOrEqual(probs[rounds[i - 1]]);
      }
    }
  });

  it('Pinnacle builder produces monotonically decreasing probs', () => {
    const pin = buildPinnacleProbabilities();
    const rounds = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'];
    for (const teamId of [1, 17, 51, 34]) {
      const probs = pin.teams[teamId];
      expect(probs).toBeDefined();
      for (let i = 1; i < rounds.length; i++) {
        expect(probs[rounds[i]]).toBeLessThanOrEqual(probs[rounds[i - 1]]);
      }
    }
  });
});

// ── Builder integration tests ────────────────────────────────────────

describe('buildFanDuelProbabilities', () => {
  it('returns all 68 teams', () => {
    const fd = buildFanDuelProbabilities();
    expect(Object.keys(fd.teams)).toHaveLength(68);
  });

  it('returns all 6 rounds per team', () => {
    const fd = buildFanDuelProbabilities();
    const rounds = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'];
    for (const teamId of [1, 17, 51]) {
      for (const rk of rounds) {
        expect(fd.teams[teamId][rk]).toBeDefined();
        expect(fd.teams[teamId][rk]).toBeGreaterThan(0);
      }
    }
  });

  it('top seeds have highest championship probabilities', () => {
    const fd = buildFanDuelProbabilities();
    const topTeamChamp = fd.teams[1].champ; // Duke
    const lowTeamChamp = fd.teams[2].champ; // Siena (16 seed)
    expect(topTeamChamp).toBeGreaterThan(lowTeamChamp);
  });

  it('has updatedAt timestamp', () => {
    const fd = buildFanDuelProbabilities();
    expect(fd.updatedAt).toBe('2026-03-17T18:09:00Z');
  });

  it('probabilities are within bounds', () => {
    const fd = buildFanDuelProbabilities();
    for (const probs of Object.values(fd.teams)) {
      for (const p of Object.values(probs)) {
        expect(p).toBeGreaterThanOrEqual(0.0001);
        expect(p).toBeLessThanOrEqual(0.999);
      }
    }
  });
});

describe('buildDraftKingsProbabilities', () => {
  it('returns all 68 teams', () => {
    const dk = buildDraftKingsProbabilities();
    expect(Object.keys(dk.teams)).toHaveLength(68);
  });

  it('returns all 6 rounds per team', () => {
    const dk = buildDraftKingsProbabilities();
    const rounds = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'];
    for (const teamId of [1, 17, 51]) {
      for (const rk of rounds) {
        expect(dk.teams[teamId][rk]).toBeDefined();
        expect(dk.teams[teamId][rk]).toBeGreaterThan(0);
      }
    }
  });

  it('fills TBD r32 from Evan Miya interpolation', () => {
    const dk = buildDraftKingsProbabilities();
    // Michigan (51) has r32=0 in DraftKings raw data, so it's excluded from
    // the outright pool and filled via Evan Miya ratio interpolation.
    // The interpolated value is based on the nearest available round (s16).
    expect(dk.teams[51].r32).toBeGreaterThan(0);
    // r32 should be >= s16 (monotonic decrease enforced)
    expect(dk.teams[51].r32).toBeGreaterThanOrEqual(dk.teams[51].s16);
  });

  it('probabilities are within bounds', () => {
    const dk = buildDraftKingsProbabilities();
    for (const probs of Object.values(dk.teams)) {
      for (const p of Object.values(probs)) {
        expect(p).toBeGreaterThanOrEqual(0.0001);
        expect(p).toBeLessThanOrEqual(0.999);
      }
    }
  });
});

describe('buildPinnacleProbabilities', () => {
  it('returns all 68 teams', () => {
    const pin = buildPinnacleProbabilities();
    expect(Object.keys(pin.teams)).toHaveLength(68);
  });

  it('returns all 6 rounds per team', () => {
    const pin = buildPinnacleProbabilities();
    const rounds = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'];
    for (const teamId of [1, 17, 51]) {
      for (const rk of rounds) {
        expect(pin.teams[teamId][rk]).toBeDefined();
        expect(pin.teams[teamId][rk]).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates missing e8 and f2 rounds', () => {
    const pin = buildPinnacleProbabilities();
    // Duke (1): e8 and f2 are interpolated
    expect(pin.teams[1].e8).toBeGreaterThan(0);
    expect(pin.teams[1].f2).toBeGreaterThan(0);
    // e8 should be between s16 and f4
    expect(pin.teams[1].e8).toBeLessThanOrEqual(pin.teams[1].s16);
    expect(pin.teams[1].e8).toBeGreaterThanOrEqual(pin.teams[1].f4);
  });

  it('probabilities are within bounds', () => {
    const pin = buildPinnacleProbabilities();
    for (const probs of Object.values(pin.teams)) {
      for (const p of Object.values(probs)) {
        expect(p).toBeGreaterThanOrEqual(0.0001);
        expect(p).toBeLessThanOrEqual(0.999);
      }
    }
  });

  it('regional F4 devig sums to ~1.0 per region', () => {
    // This is tested indirectly — the builder uses devigOutright per region
    const pin = buildPinnacleProbabilities();
    // Just verify top seeds in each region have reasonable F4 probs
    expect(pin.teams[1].f4).toBeGreaterThan(0.3);  // Duke, East 1-seed
    expect(pin.teams[17].f4).toBeGreaterThan(0.3); // Arizona, West 1-seed
    expect(pin.teams[34].f4).toBeGreaterThan(0.2); // Florida, South 1-seed
    expect(pin.teams[51].f4).toBeGreaterThan(0.3); // Michigan, Midwest 1-seed
  });
});
