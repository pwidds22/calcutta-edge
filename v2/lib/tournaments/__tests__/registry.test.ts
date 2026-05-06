import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listSelectorTournaments,
  listPastTournaments,
  getFeaturedTournament,
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
