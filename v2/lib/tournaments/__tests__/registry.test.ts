import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listSelectorTournaments,
  listPastTournaments,
  getFeaturedTournament,
  matchesTournamentEvent,
  getTournament,
  listSyncEligibleTournaments,
} from '../registry';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('phase-aware registry helpers', () => {
  it('listSelectorTournaments excludes completed and archived', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const ids = listSelectorTournaments().map((t) => t.config.id);

    expect(ids).not.toContain('march_madness_2026');
    expect(ids).not.toContain('masters_2026');
    expect(ids).not.toContain('kentucky_derby_2026');
  });

  it('listSelectorTournaments includes PGA Championship 2026 on May 10', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const ids = listSelectorTournaments().map((t) => t.config.id);
    expect(ids).toContain('pga_championship_2026');
  });

  it('listPastTournaments includes recently-ended tournaments', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const ids = listPastTournaments().map((t) => t.config.id);

    expect(ids).toContain('masters_2026');
    expect(ids).toContain('kentucky_derby_2026');
  });

  it('getFeaturedTournament prefers live > soonest hostable > soonest upcoming', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const featured = getFeaturedTournament();
    // On May 10 with PGA hostable May 14, PGA should be the next hostable.
    expect(featured?.config.id).toBe('pga_championship_2026');
  });
});

describe('matchesTournamentEvent', () => {
  // Regression: the /api/golf/projections route used to hardcode an `isMasters`
  // event-name check and silently fall through for any other tournament. PGA
  // hosts opening the Leaderboard tab during the 2026 PGA saw "Projected
  // standings unavailable" because the projections endpoint couldn't match
  // "PGA Championship" against the Masters substring. The shared helper plus
  // each config's `liveSyncMatchers` is now the single source of truth — every
  // event-name check should route through this function.

  it('matches PGA Championship against its liveSyncMatchers', () => {
    const pga = getTournament('pga_championship_2026');
    expect(pga).toBeDefined();
    expect(matchesTournamentEvent('PGA Championship', pga!.config)).toBe(true);
    expect(matchesTournamentEvent('Pga Championship - Round 1', pga!.config)).toBe(true);
  });

  it('matches Masters against its liveSyncMatchers (case-insensitive substring)', () => {
    const masters = getTournament('masters_2026');
    expect(masters).toBeDefined();
    expect(matchesTournamentEvent('Masters Tournament', masters!.config)).toBe(true);
    expect(matchesTournamentEvent('THE MASTERS', masters!.config)).toBe(true);
    expect(matchesTournamentEvent('augusta national invitational', masters!.config)).toBe(true);
  });

  it('rejects non-matching events without leaking across tournaments', () => {
    const pga = getTournament('pga_championship_2026');
    const masters = getTournament('masters_2026');
    expect(matchesTournamentEvent('Masters Tournament', pga!.config)).toBe(false);
    expect(matchesTournamentEvent('PGA Championship', masters!.config)).toBe(false);
    expect(matchesTournamentEvent('US Open', pga!.config)).toBe(false);
  });
});

describe('listSyncEligibleTournaments', () => {
  // Regression: the golf-sync cron used to filter on `live + hostable` only.
  // Once a tournament's phase flipped to `completed` at 00:00 UTC the day after
  // endDate, the cron skipped it forever — even if Sunday-evening final results
  // hadn't been written to tournament_results yet. PGA Championship 2026 wrapped
  // 2026-05-17 (Sunday evening ET); the 6am UTC Monday cron ran AFTER phase
  // flipped to `completed` and never graded the cut/T20/T10/T5/winner tiers.
  // Settlement stayed stuck at 10% distributed; Standings stayed on "Live Odds"
  // projections. Caught 2026-05-18.

  it('includes a tournament during its live phase', () => {
    // PGA Championship 2026: startDate 2026-05-14, endDate 2026-05-17
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    const ids = listSyncEligibleTournaments(1).map((t) => t.config.id);
    expect(ids).toContain('pga_championship_2026');
  });

  it('includes a tournament during its hostable phase', () => {
    // PGA hostingOpensAt 2026-04-30; on May 10 it should be hostable
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const ids = listSyncEligibleTournaments(1).map((t) => t.config.id);
    expect(ids).toContain('pga_championship_2026');
  });

  it('still includes a recently-completed tournament during the grace window', () => {
    // Day after endDate: phase = 'completed' but still inside 1-day grace.
    // This is the specific case where Monday-morning cron must still try PGA.
    vi.setSystemTime(new Date('2026-05-18T06:00:00Z'));
    const ids = listSyncEligibleTournaments(1).map((t) => t.config.id);
    expect(ids).toContain('pga_championship_2026');
  });

  it('drops a completed tournament once it is past the grace window', () => {
    // Two days after endDate with 1-day grace — should NOT be eligible.
    vi.setSystemTime(new Date('2026-05-19T06:00:00Z'));
    const ids = listSyncEligibleTournaments(1).map((t) => t.config.id);
    expect(ids).not.toContain('pga_championship_2026');
  });

  it('respects a larger grace window for late-arriving results', () => {
    // 3 days after endDate with 5-day grace — still eligible.
    vi.setSystemTime(new Date('2026-05-20T06:00:00Z'));
    const ids = listSyncEligibleTournaments(5).map((t) => t.config.id);
    expect(ids).toContain('pga_championship_2026');
  });

  it('excludes upcoming tournaments (not yet hostable)', () => {
    // On 2026-05-15 PGA is live, but World Cup (startDate 2026-06-11) is still
    // upcoming — its hosting window opens later. It must not be in the eligible
    // list yet or the cron would burn DataGolf calls fetching odds for events
    // that haven't started.
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    const ids = listSyncEligibleTournaments(1).map((t) => t.config.id);
    expect(ids).not.toContain('world_cup_2026');
    expect(ids).not.toContain('nfl_season_2026');
  });
});
