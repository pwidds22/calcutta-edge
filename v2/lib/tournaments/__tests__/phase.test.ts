import { describe, it, expect } from 'vitest';
import { getTournamentPhase } from '../phase';
import type { TournamentConfig } from '../types';

function makeConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: 'test',
    name: 'Test',
    sport: 'golf',
    rounds: [],
    groups: [],
    devigStrategy: 'global',
    defaultPayoutRules: {},
    defaultPotSize: 1000,
    propBets: [],
    badge: 'Test',
    teamLabel: 'Player',
    groupLabel: 'Tier',
    startDate: '2026-06-01',
    endDate: '2026-06-04',
    hostingOpensAt: '2026-05-15',
    isActive: false,
    ...overrides,
  };
}

describe('getTournamentPhase', () => {
  it('returns "upcoming" before hostingOpensAt', () => {
    const config = makeConfig();
    const now = new Date('2026-05-01T12:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('upcoming');
  });

  it('returns "hostable" between hostingOpensAt and startDate', () => {
    const config = makeConfig();
    const now = new Date('2026-05-20T12:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('hostable');
  });

  it('returns "live" between startDate and endDate (inclusive)', () => {
    const config = makeConfig();
    const start = new Date('2026-06-01T12:00:00Z');
    const middle = new Date('2026-06-02T18:00:00Z');
    const lastDay = new Date('2026-06-04T20:00:00Z');
    expect(getTournamentPhase(config, start)).toBe('live');
    expect(getTournamentPhase(config, middle)).toBe('live');
    expect(getTournamentPhase(config, lastDay)).toBe('live');
  });

  it('returns "completed" after endDate but before default archive (endDate + 30 days)', () => {
    const config = makeConfig();
    const now = new Date('2026-06-15T00:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('completed');
  });

  it('returns "archived" after default archive window (endDate + 30 days)', () => {
    const config = makeConfig();
    const now = new Date('2026-07-10T00:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('archived');
  });

  it('respects custom archiveAt date', () => {
    const config = makeConfig({ archiveAt: '2026-06-10' });
    const dayAfterEnd = new Date('2026-06-05T00:00:00Z');
    const dayAfterArchive = new Date('2026-06-11T00:00:00Z');
    expect(getTournamentPhase(config, dayAfterEnd)).toBe('completed');
    expect(getTournamentPhase(config, dayAfterArchive)).toBe('archived');
  });

  it('treats missing hostingOpensAt as "always hostable"', () => {
    const config = makeConfig({ hostingOpensAt: undefined });
    const farPast = new Date('2020-01-01T00:00:00Z');
    expect(getTournamentPhase(config, farPast)).toBe('hostable');
  });

  it('returns phaseOverride when set, ignoring dates', () => {
    const config = makeConfig({ phaseOverride: 'live' });
    const farPast = new Date('2020-01-01T00:00:00Z');
    expect(getTournamentPhase(config, farPast)).toBe('live');
  });

  it('handles boundary: end of endDate is still live', () => {
    const config = makeConfig({ endDate: '2026-06-04' });
    const endOfDay = new Date('2026-06-04T23:59:59Z');
    expect(getTournamentPhase(config, endOfDay)).toBe('live');
  });

  it('handles boundary: start of day after endDate is completed', () => {
    const config = makeConfig({ endDate: '2026-06-04' });
    const nextDay = new Date('2026-06-05T00:00:00Z');
    expect(getTournamentPhase(config, nextDay)).toBe('completed');
  });
});
