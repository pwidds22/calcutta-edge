import { describe, it, expect } from 'vitest';
import { listHostableTournaments } from '../registry';

describe('listHostableTournaments', () => {
  it('excludes a tournament that has already finished', () => {
    // 2026-08-16: PGA ended 2026-05-17, so it is archived.
    const ids = listHostableTournaments(new Date('2026-08-16T12:00:00Z')).map((c) => c.id);
    expect(ids).not.toContain('pga_championship_2026');
    expect(ids).not.toContain('march_madness_2026');
  });

  it('includes NFL once its hosting window opens', () => {
    const ids = listHostableTournaments(new Date('2026-08-21T12:00:00Z')).map((c) => c.id);
    expect(ids).toContain('nfl_season_2026');
  });

  it('excludes NFL before hosting opens', () => {
    const ids = listHostableTournaments(new Date('2026-08-01T12:00:00Z')).map((c) => c.id);
    expect(ids).not.toContain('nfl_season_2026');
  });
});
