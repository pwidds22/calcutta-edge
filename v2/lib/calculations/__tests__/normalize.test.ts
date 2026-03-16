import { describe, it, expect } from 'vitest';
import { normalizePayoutRules } from '../normalize';
import type { TournamentConfig } from '@/lib/tournaments/types';

const mockConfig: TournamentConfig = {
  id: 'test',
  name: 'Test',
  sport: 'test',
  rounds: [
    { key: 'r32', label: 'R32', teamsAdvancing: 32, payoutLabel: 'Round of 32' },
    { key: 's16', label: 'S16', teamsAdvancing: 16, payoutLabel: 'Sweet 16' },
    { key: 'e8', label: 'E8', teamsAdvancing: 8, payoutLabel: 'Elite 8' },
    { key: 'f4', label: 'F4', teamsAdvancing: 4, payoutLabel: 'Final Four' },
    { key: 'f2', label: 'F2', teamsAdvancing: 2, payoutLabel: 'Championship' },
    { key: 'champ', label: 'Champ', teamsAdvancing: 1, payoutLabel: 'Winner' },
  ],
  groups: [],
  devigStrategy: 'global',
  defaultPayoutRules: {
    r32: 0.5,
    s16: 1.0,
    e8: 2.5,
    f4: 4.0,
    f2: 8.0,
    champ: 16.0,
    biggestUpset: 0,
    highestSeed: 0,
    largestMargin: 0,
    customProp: 0,
  },
  defaultPotSize: 10000,
  propBets: [
    { key: 'biggestUpset', label: 'Biggest Upset' },
    { key: 'highestSeed', label: 'Highest Seed' },
    { key: 'largestMargin', label: 'Largest Margin' },
    { key: 'customProp', label: 'Custom Prop' },
  ],
  badge: 'Test',
  teamLabel: 'Team',
  groupLabel: 'Region',
  startDate: '2026-03-17',
  isActive: true,
};

describe('normalizePayoutRules', () => {
  it('returns config defaults when dbRules is null', () => {
    const result = normalizePayoutRules(null, mockConfig);
    expect(result.r32).toBe(0.5);
    expect(result.s16).toBe(1.0);
    expect(result.champ).toBe(16.0);
  });

  it('returns config defaults when dbRules is empty object', () => {
    const result = normalizePayoutRules({}, mockConfig);
    expect(result.r32).toBe(0.5);
    expect(result.e8).toBe(2.5);
    expect(result.champ).toBe(16.0);
  });

  it('maps legacy key names to current keys', () => {
    const legacyRules = {
      roundOf64: 1.0,
      roundOf32: 2.0,
      sweet16: 3.0,
      elite8: 5.0,
      finalFour: 10.0,
      champion: 20.0,
    };
    const result = normalizePayoutRules(legacyRules, mockConfig);
    expect(result.r32).toBe(1.0);
    expect(result.s16).toBe(2.0);
    expect(result.e8).toBe(3.0);
    expect(result.f4).toBe(5.0);
    expect(result.f2).toBe(10.0);
    expect(result.champ).toBe(20.0);
  });

  it('passes through rules that already use current keys', () => {
    const currentRules = {
      r32: 1.5,
      s16: 2.5,
      e8: 3.5,
      f4: 5.5,
      f2: 9.0,
      champ: 18.0,
      biggestUpset: 2.0,
      highestSeed: 0,
      largestMargin: 0,
      customProp: 0,
    };
    const result = normalizePayoutRules(currentRules, mockConfig);
    expect(result.r32).toBe(1.5);
    expect(result.s16).toBe(2.5);
    expect(result.champ).toBe(18.0);
    expect(result.biggestUpset).toBe(2.0);
  });

  it('fills missing current keys from config defaults', () => {
    const partialRules = { r32: 1.0, champ: 20.0 };
    const result = normalizePayoutRules(partialRules, mockConfig);
    expect(result.r32).toBe(1.0);
    expect(result.s16).toBe(1.0); // from default
    expect(result.e8).toBe(2.5); // from default
    expect(result.champ).toBe(20.0);
  });

  it('preserves prop bet keys from legacy rules', () => {
    const legacyWithProps = {
      roundOf64: 0.5,
      roundOf32: 1.0,
      sweet16: 2.0,
      elite8: 4.0,
      finalFour: 8.0,
      champion: 16.0,
      biggestUpset: 5.0,
      largestMargin: 3.0,
    };
    const result = normalizePayoutRules(legacyWithProps, mockConfig);
    expect(result.biggestUpset).toBe(5.0);
    expect(result.largestMargin).toBe(3.0);
    expect(result.highestSeed).toBe(0); // from default
  });

  it('returns config defaults when dbRules is undefined', () => {
    const result = normalizePayoutRules(undefined, mockConfig);
    expect(result.r32).toBe(0.5);
    expect(result.champ).toBe(16.0);
  });
});
