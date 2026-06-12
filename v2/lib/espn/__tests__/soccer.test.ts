import { describe, it, expect } from 'vitest';
import { parseScoreboard, computeGroupTables } from '../soccer';
import type { SoccerMatch } from '../soccer';
import type { BaseTeam } from '@/lib/tournaments/types';

const baseTeams = [
  { id: 9, name: 'Brazil', seed: 1, group: 'C' },
  { id: 10, name: 'Morocco', seed: 2, group: 'C' },
  { id: 13, name: 'United States', seed: 1, group: 'D' },
  { id: 1, name: 'Mexico', seed: 1, group: 'A' },
  { id: 3, name: 'South Africa', seed: 4, group: 'A' },
] as unknown as BaseTeam[];

// Minimal slice of ESPN's real shape (score is a STRING; no group label).
const espn = {
  events: [
    {
      date: '2026-06-11T19:00Z',
      competitions: [
        {
          status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Mexico' }, score: '2', winner: true },
            { homeAway: 'away', team: { displayName: 'South Africa' }, score: '0', winner: false },
          ],
        },
      ],
    },
    {
      date: '2026-06-12T19:00Z',
      competitions: [
        {
          status: { type: { name: 'STATUS_SCHEDULED', completed: false } },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Brazil' }, score: '0', winner: false },
            { homeAway: 'away', team: { displayName: 'Morocco' }, score: '0', winner: false },
          ],
        },
      ],
    },
  ],
};

describe('parseScoreboard', () => {
  it('parses a completed match with resolved team ids + winner', () => {
    const matches = parseScoreboard(espn, baseTeams);
    const final = matches.find((m) => m.status === 'final')!;
    expect(final.homeTeamId).toBe(1); // Mexico
    expect(final.awayTeamId).toBe(3); // South Africa
    expect(final.homeScore).toBe(2);
    expect(final.awayScore).toBe(0);
    expect(final.winnerTeamId).toBe(1);
    expect(final.date).toBe('2026-06-11T19:00Z');
  });

  it('parses a scheduled match as not-yet-played (null scores, no winner)', () => {
    const matches = parseScoreboard(espn, baseTeams);
    const sched = matches.find((m) => m.status === 'scheduled')!;
    expect(sched.homeName).toBe('Brazil');
    expect(sched.homeScore).toBeNull();
    expect(sched.winnerTeamId).toBeNull();
  });

  it('skips matches whose team names do not resolve, without throwing', () => {
    const weird = {
      events: [
        {
          date: 'x',
          competitions: [
            {
              status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
              competitors: [
                { homeAway: 'home', team: { displayName: 'Atlantis' }, score: '1', winner: true },
                { homeAway: 'away', team: { displayName: 'Brazil' }, score: '0', winner: false },
              ],
            },
          ],
        },
      ],
    };
    const matches = parseScoreboard(weird, baseTeams);
    expect(matches[0].homeTeamId).toBeNull(); // unresolved
    expect(matches[0].awayTeamId).toBe(9); // Brazil resolved
  });
});

const m = (h: number, a: number, hs: number, as: number): SoccerMatch => ({
  homeTeamId: h,
  awayTeamId: a,
  homeName: '',
  awayName: '',
  homeScore: hs,
  awayScore: as,
  status: 'final',
  winnerTeamId: hs > as ? h : as > hs ? a : null,
  date: '',
});

describe('computeGroupTables', () => {
  it('tallies P/W/D/L/GF/GA/GD/Pts per group and sorts by points then GD', () => {
    const tables = computeGroupTables([m(9, 10, 2, 0)], baseTeams);
    const groupC = tables['C'];
    const brazil = groupC.find((r) => r.teamId === 9)!;
    const morocco = groupC.find((r) => r.teamId === 10)!;
    expect(brazil.points).toBe(3);
    expect(brazil.gf).toBe(2);
    expect(brazil.ga).toBe(0);
    expect(brazil.gd).toBe(2);
    expect(morocco.points).toBe(0);
    expect(groupC[0].teamId).toBe(9); // Brazil sorted top by points
  });

  it('a draw gives both teams 1 point', () => {
    const tables = computeGroupTables([m(9, 10, 1, 1)], baseTeams);
    expect(tables['C'].find((r) => r.teamId === 9)!.points).toBe(1);
    expect(tables['C'].find((r) => r.teamId === 10)!.points).toBe(1);
  });

  it('ignores scheduled (not-final) matches', () => {
    const sched: SoccerMatch = { ...m(9, 10, 0, 0), status: 'scheduled', winnerTeamId: null };
    const tables = computeGroupTables([sched], baseTeams);
    expect(tables['C'].every((r) => r.played === 0)).toBe(true);
  });
});
