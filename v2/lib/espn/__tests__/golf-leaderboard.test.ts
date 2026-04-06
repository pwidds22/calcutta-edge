import { describe, it, expect } from 'vitest';
import { matchPlayerToTeamId, positionToResults } from '../golf-leaderboard';
import { MASTERS_2026_TEAMS } from '@/lib/tournaments/configs/masters-2026';

// ─── matchPlayerToTeamId ──────────────────────────────────────────

describe('matchPlayerToTeamId', () => {
  it('matches exact names', () => {
    expect(matchPlayerToTeamId('Scottie Scheffler', MASTERS_2026_TEAMS)).toBe(1);
    expect(matchPlayerToTeamId('Jon Rahm', MASTERS_2026_TEAMS)).toBe(2);
    expect(matchPlayerToTeamId('Rory McIlroy', MASTERS_2026_TEAMS)).toBe(4);
  });

  it('matches case-insensitively', () => {
    expect(matchPlayerToTeamId('scottie scheffler', MASTERS_2026_TEAMS)).toBe(1);
    expect(matchPlayerToTeamId('RORY MCILROY', MASTERS_2026_TEAMS)).toBe(4);
  });

  it('matches with accent normalization', () => {
    // Nicolai Højgaard might appear with ø or o
    expect(matchPlayerToTeamId('Nicolai Hojgaard', MASTERS_2026_TEAMS)).toBe(34);
  });

  it('matches by last name when first name differs', () => {
    // ESPN might use abbreviated first names
    expect(matchPlayerToTeamId('S. Scheffler', MASTERS_2026_TEAMS)).toBe(1);
    expect(matchPlayerToTeamId('R. McIlroy', MASTERS_2026_TEAMS)).toBe(4);
  });

  it('returns null for unknown players', () => {
    expect(matchPlayerToTeamId('Tiger Woods', MASTERS_2026_TEAMS)).toBe(null);
    expect(matchPlayerToTeamId('Phil Mickelson', MASTERS_2026_TEAMS)).toBe(null);
  });

  it('matches field players correctly', () => {
    expect(matchPlayerToTeamId('Fred Couples', MASTERS_2026_TEAMS)).toBe(91);
    expect(matchPlayerToTeamId('Vijay Singh', MASTERS_2026_TEAMS)).toBe(86);
    expect(matchPlayerToTeamId('Bubba Watson', MASTERS_2026_TEAMS)).toBe(74);
  });

  it('matches all Masters field players by exact name', () => {
    let matchedCount = 0;
    for (const team of MASTERS_2026_TEAMS) {
      const id = matchPlayerToTeamId(team.name, MASTERS_2026_TEAMS);
      if (id === team.id) matchedCount++;
    }
    expect(matchedCount).toBe(MASTERS_2026_TEAMS.length);
  });
});

// ─── positionToResults (ESPN version) ─────────────────────────────

describe('positionToResults', () => {
  const tiers = [
    { key: 'makeCut', teamsAdvancing: 50 },
    { key: 'top20', teamsAdvancing: 20 },
    { key: 'top10', teamsAdvancing: 10 },
    { key: 'top5', teamsAdvancing: 5 },
    { key: 'winner', teamsAdvancing: 1 },
  ];

  it('position 1 wins all', () => {
    const r = positionToResults(1, false, false, tiers);
    expect(r.every(x => x.result === 'won')).toBe(true);
  });

  it('position 25 wins makeCut and top20 loses rest', () => {
    const r = positionToResults(25, false, false, tiers);
    expect(r.find(x => x.roundKey === 'makeCut')!.result).toBe('won');
    // 25 > 20, so loses top20
    expect(r.find(x => x.roundKey === 'top20')!.result).toBe('lost');
  });

  it('cut player loses all', () => {
    const r = positionToResults(null, true, false, tiers);
    expect(r.every(x => x.result === 'lost')).toBe(true);
    expect(r.length).toBe(5);
  });
});
