import { describe, it, expect } from 'vitest';
import { positionToTierResults, calculateDeadHeatFractions } from '../leaderboard';
import { parsePosition } from '../client';

const MASTERS_TIERS = [
  { key: 'makeCut', teamsAdvancing: 50 },
  { key: 'top20', teamsAdvancing: 20 },
  { key: 'top10', teamsAdvancing: 10 },
  { key: 'top5', teamsAdvancing: 5 },
  { key: 'winner', teamsAdvancing: 1 },
];

// ─── positionToTierResults ────────────────────────────────────────

describe('positionToTierResults', () => {
  it('winner (position 1) wins all tiers', () => {
    const results = positionToTierResults(1, false, false, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'won' },
      { roundKey: 'top20', result: 'won' },
      { roundKey: 'top10', result: 'won' },
      { roundKey: 'top5', result: 'won' },
      { roundKey: 'winner', result: 'won' },
    ]);
  });

  it('position 8 wins makeCut, top20, top10, loses top5 and winner', () => {
    const results = positionToTierResults(8, false, false, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'won' },
      { roundKey: 'top20', result: 'won' },
      { roundKey: 'top10', result: 'won' },
      { roundKey: 'top5', result: 'lost' },
      { roundKey: 'winner', result: 'lost' },
    ]);
  });

  it('position 10 (T10) still wins top10', () => {
    const results = positionToTierResults(10, false, false, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'won' },
      { roundKey: 'top20', result: 'won' },
      { roundKey: 'top10', result: 'won' },
      { roundKey: 'top5', result: 'lost' },
      { roundKey: 'winner', result: 'lost' },
    ]);
  });

  it('position 11 loses top10', () => {
    const results = positionToTierResults(11, false, false, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'won' },
      { roundKey: 'top20', result: 'won' },
      { roundKey: 'top10', result: 'lost' },
      { roundKey: 'top5', result: 'lost' },
      { roundKey: 'winner', result: 'lost' },
    ]);
  });

  it('position 50 only wins makeCut', () => {
    const results = positionToTierResults(50, false, false, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'won' },
      { roundKey: 'top20', result: 'lost' },
      { roundKey: 'top10', result: 'lost' },
      { roundKey: 'top5', result: 'lost' },
      { roundKey: 'winner', result: 'lost' },
    ]);
  });

  it('position 51 loses everything', () => {
    const results = positionToTierResults(51, false, false, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'lost' },
      { roundKey: 'top20', result: 'lost' },
      { roundKey: 'top10', result: 'lost' },
      { roundKey: 'top5', result: 'lost' },
      { roundKey: 'winner', result: 'lost' },
    ]);
  });

  it('missed cut loses all tiers', () => {
    const results = positionToTierResults(null, true, false, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'lost' },
      { roundKey: 'top20', result: 'lost' },
      { roundKey: 'top10', result: 'lost' },
      { roundKey: 'top5', result: 'lost' },
      { roundKey: 'winner', result: 'lost' },
    ]);
  });

  it('withdrawn player loses all tiers', () => {
    const results = positionToTierResults(null, false, true, MASTERS_TIERS);
    expect(results).toEqual([
      { roundKey: 'makeCut', result: 'lost' },
      { roundKey: 'top20', result: 'lost' },
      { roundKey: 'top10', result: 'lost' },
      { roundKey: 'top5', result: 'lost' },
      { roundKey: 'winner', result: 'lost' },
    ]);
  });
});

// ─── parsePosition ────────────────────────────────────────────────

describe('parsePosition', () => {
  it('parses simple position', () => {
    expect(parsePosition('1')).toEqual({ position: 1, isTied: false });
    expect(parsePosition('42')).toEqual({ position: 42, isTied: false });
  });

  it('parses tied position', () => {
    expect(parsePosition('T8')).toEqual({ position: 8, isTied: true });
    expect(parsePosition('T22')).toEqual({ position: 22, isTied: true });
  });

  it('handles CUT/WD/DQ/MDF', () => {
    expect(parsePosition('CUT')).toEqual({ position: null, isTied: false });
    expect(parsePosition('WD')).toEqual({ position: null, isTied: false });
    expect(parsePosition('DQ')).toEqual({ position: null, isTied: false });
    expect(parsePosition('MDF')).toEqual({ position: null, isTied: false });
  });

  it('handles null input', () => {
    expect(parsePosition(null)).toEqual({ position: null, isTied: false });
  });
});

// ─── calculateDeadHeatFractions ──────────────────────────────────

describe('calculateDeadHeatFractions', () => {
  const tiers = [
    { key: 'top10', teamsAdvancing: 10 },
    { key: 'top5', teamsAdvancing: 5 },
  ];

  it('no ties — full fractions', () => {
    const players = [
      { id: 1, position: 5, isCut: false, isWithdrawn: false },
      { id: 2, position: 12, isCut: false, isWithdrawn: false },
    ];
    const fractions = calculateDeadHeatFractions(players, tiers);
    expect(fractions.get(1)).toEqual({ top10: 1, top5: 1 });
    expect(fractions.get(2)).toEqual({ top10: 0, top5: 0 });
  });

  it('3-way tie fully inside boundary — all get full payout', () => {
    // 3 players at T8 — positions 8, 8, 8 (conceptually 8-10, all within top10)
    const players = [
      { id: 1, position: 8, isCut: false, isWithdrawn: false },
      { id: 2, position: 8, isCut: false, isWithdrawn: false },
      { id: 3, position: 8, isCut: false, isWithdrawn: false },
    ];
    const fractions = calculateDeadHeatFractions(players, tiers);
    expect(fractions.get(1)!.top10).toBe(1); // 8+3-1=10, all within top10
    expect(fractions.get(2)!.top10).toBe(1);
    expect(fractions.get(3)!.top10).toBe(1);
  });

  it('3-way tie straddling top10 boundary — fractional payout', () => {
    // 3 players at T9 — positions 9, 9, 9 (conceptually 9-11)
    // 2 of 3 are in top10 → fraction = 2/3
    const players = [
      { id: 1, position: 9, isCut: false, isWithdrawn: false },
      { id: 2, position: 9, isCut: false, isWithdrawn: false },
      { id: 3, position: 9, isCut: false, isWithdrawn: false },
    ];
    const fractions = calculateDeadHeatFractions(players, tiers);
    expect(fractions.get(1)!.top10).toBeCloseTo(2 / 3);
    expect(fractions.get(2)!.top10).toBeCloseTo(2 / 3);
    expect(fractions.get(3)!.top10).toBeCloseTo(2 / 3);
  });

  it('2-way tie at exactly the boundary — fractional payout', () => {
    // 2 players at T10 — positions 10, 10 (conceptually 10-11)
    // 1 of 2 is in top10 → fraction = 1/2
    const players = [
      { id: 1, position: 10, isCut: false, isWithdrawn: false },
      { id: 2, position: 10, isCut: false, isWithdrawn: false },
    ];
    const fractions = calculateDeadHeatFractions(players, tiers);
    expect(fractions.get(1)!.top10).toBe(0.5);
    expect(fractions.get(2)!.top10).toBe(0.5);
  });

  it('tie fully outside boundary — zero fraction', () => {
    // 2 players at T11 — both outside top10
    const players = [
      { id: 1, position: 11, isCut: false, isWithdrawn: false },
      { id: 2, position: 11, isCut: false, isWithdrawn: false },
    ];
    const fractions = calculateDeadHeatFractions(players, tiers);
    expect(fractions.get(1)!.top10).toBe(0);
    expect(fractions.get(2)!.top10).toBe(0);
  });

  it('handles cut and withdrawn players', () => {
    const players = [
      { id: 1, position: null, isCut: true, isWithdrawn: false },
      { id: 2, position: null, isCut: false, isWithdrawn: true },
      { id: 3, position: 5, isCut: false, isWithdrawn: false },
    ];
    const fractions = calculateDeadHeatFractions(players, tiers);
    // Cut/withdrawn players are not in any position group
    expect(fractions.has(1)).toBe(false);
    expect(fractions.has(2)).toBe(false);
    expect(fractions.get(3)).toEqual({ top10: 1, top5: 1 });
  });

  it('5-way tie at T4 straddling top5 boundary', () => {
    // 5 players at T4 — positions 4,4,4,4,4 (conceptually 4-8)
    // 2 of 5 are in top5 → fraction = 2/5
    const players = [
      { id: 1, position: 4, isCut: false, isWithdrawn: false },
      { id: 2, position: 4, isCut: false, isWithdrawn: false },
      { id: 3, position: 4, isCut: false, isWithdrawn: false },
      { id: 4, position: 4, isCut: false, isWithdrawn: false },
      { id: 5, position: 4, isCut: false, isWithdrawn: false },
    ];
    const fractions = calculateDeadHeatFractions(players, tiers);
    expect(fractions.get(1)!.top5).toBeCloseTo(2 / 5);
    // All 5 at T4 conceptually = 4-8, all within top10
    expect(fractions.get(1)!.top10).toBe(1);
  });
});
