import { describe, it, expect } from 'vitest';
import { devigOutrightMarket, devigBinaryMarket } from '../devig';

describe('devigOutrightMarket', () => {
  it('removes vig from a simple two-way market', () => {
    const result = devigOutrightMarket([
      { name: 'Team A', decimalOdds: 1.9 },
      { name: 'Team B', decimalOdds: 1.9 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].fairProbability).toBeCloseTo(0.5, 2);
    expect(result[1].fairProbability).toBeCloseTo(0.5, 2);
    const total = result.reduce((s, r) => s + r.fairProbability, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('removes vig from outright futures market', () => {
    const result = devigOutrightMarket([
      { name: 'Favorite', decimalOdds: 3.0 },
      { name: 'Contender', decimalOdds: 5.0 },
      { name: 'Longshot', decimalOdds: 10.0 },
    ]);
    expect(result[0].fairProbability).toBeCloseTo(0.527, 2);
    const total = result.reduce((s, r) => s + r.fairProbability, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('handles empty input', () => {
    expect(devigOutrightMarket([])).toEqual([]);
  });
});

describe('devigBinaryMarket', () => {
  it('devigs a YES/NO futures market', () => {
    // Arizona to reach S16: Yes 1.090, No 7.670 (from Pinnacle)
    const fair = devigBinaryMarket(1.090, 7.670);
    expect(fair).toBeCloseTo(0.8756, 2);
  });

  it('returns 0.5 for even odds', () => {
    const fair = devigBinaryMarket(1.95, 1.95);
    expect(fair).toBeCloseTo(0.5, 2);
  });
});
