import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listSelectorTournaments,
  listPastTournaments,
  getFeaturedTournament,
  matchesTournamentEvent,
  getTournament,
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
