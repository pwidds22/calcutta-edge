import { describe, it, expect } from 'vitest';
import {
  parseScoreboard,
  computeGroupTables,
  computeGroupResults,
  computeKnockoutResults,
  computeGroupProps,
} from '../soccer';
import type { SoccerMatch, EspnScoreboard, SyncResultRow } from '../soccer';
import type { BaseTeam } from '@/lib/tournaments/types';

const baseTeams = [
  { id: 9, name: 'Brazil', seed: 1, group: 'C' },
  { id: 10, name: 'Morocco', seed: 2, group: 'C' },
  { id: 13, name: 'United States', seed: 1, group: 'D' },
  { id: 1, name: 'Mexico', seed: 1, group: 'A' },
  { id: 3, name: 'South Africa', seed: 4, group: 'A' },
] as unknown as BaseTeam[];

// Minimal slice of ESPN's real shape (score is a STRING; no group label).
const espn: EspnScoreboard = {
  events: [
    {
      date: '2026-06-11T19:00Z',
      season: { year: 2026, slug: 'group-stage' },
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
      season: { year: 2026, slug: 'group-stage' },
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

  it('parses an in-play match: status=in, live scores, no winner yet', () => {
    // Mirrors the real feed (Belgium v Senegal, STATUS_SECOND_HALF, state 'in').
    const live: EspnScoreboard = {
      events: [
        {
          date: '2026-07-01T20:00Z',
          season: { year: 2026, slug: 'round-of-32' },
          competitions: [
            {
              status: { type: { name: 'STATUS_SECOND_HALF', completed: false, state: 'in' } },
              competitors: [
                { homeAway: 'home', team: { displayName: 'Brazil' }, score: '0', winner: false },
                { homeAway: 'away', team: { displayName: 'Morocco' }, score: '2', winner: false },
              ],
            },
          ],
        },
      ],
    };
    const [m] = parseScoreboard(live, baseTeams);
    expect(m.status).toBe('in');
    expect(m.homeScore).toBe(0);
    expect(m.awayScore).toBe(2);
    expect(m.winnerTeamId).toBeNull(); // winner stays completed-only
  });

  it('an in-play match does NOT count toward group tables', () => {
    const live: SoccerMatch = {
      homeTeamId: 9,
      awayTeamId: 10,
      homeName: 'Brazil',
      awayName: 'Morocco',
      homeScore: 3,
      awayScore: 0,
      status: 'in',
      winnerTeamId: null,
      date: '2026-06-12T19:00Z',
      stage: 'group-stage',
    };
    const groups = computeGroupTables([live], baseTeams);
    const brazil = groups['C'].find((r) => r.teamId === 9)!;
    expect(brazil.played).toBe(0); // only 'final' matches count
  });

  it('skips matches whose team names do not resolve, without throwing', () => {
    const weird: EspnScoreboard = {
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

// Teams whose ESPN displayName differs from our config name. Uses CONFIG names.
const aliasTeams = [
  { id: 100, name: 'Bosnia and Herzegovina', seed: 3, group: 'B' },
  { id: 101, name: 'Turkey', seed: 2, group: 'D' },
  { id: 102, name: 'Curacao', seed: 4, group: 'E' },
  { id: 103, name: 'DR Congo', seed: 3, group: 'K' },
  { id: 104, name: 'Qatar', seed: 4, group: 'B' },
] as unknown as BaseTeam[];

const oneMatch = (homeName: string, awayName: string): EspnScoreboard => ({
  events: [
    {
      date: 'x',
      season: { year: 2026, slug: 'group-stage' },
      competitions: [
        {
          status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
          competitors: [
            { homeAway: 'home', team: { displayName: homeName }, score: '1', winner: true },
            { homeAway: 'away', team: { displayName: awayName }, score: '0', winner: false },
          ],
        },
      ],
    },
  ],
});

describe('parseScoreboard ESPN name aliases', () => {
  it.each([
    ['Bosnia-Herzegovina', 100],
    ['Türkiye', 101],
    ['Curaçao', 102],
    ['Congo DR', 103],
  ])('resolves ESPN "%s" to the config team id %i', (espnName, expectedId) => {
    const [match] = parseScoreboard(oneMatch(espnName as string, 'Qatar'), aliasTeams);
    expect(match.homeTeamId).toBe(expectedId);
    expect(match.awayTeamId).toBe(104); // Qatar resolves with no alias needed
  });

  it('counts an aliased team\'s match in its group table (the reported bug)', () => {
    // ESPN spells it "Bosnia-Herzegovina"; before the alias fix this match was
    // silently dropped, leaving Bosnia at P0.
    const matches = parseScoreboard(oneMatch('Bosnia-Herzegovina', 'Qatar'), aliasTeams);
    const tables = computeGroupTables(matches, aliasTeams);
    expect(tables['B'].find((r) => r.teamId === 100)!.played).toBe(1);
    expect(tables['B'].find((r) => r.teamId === 104)!.played).toBe(1);
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
  stage: 'group-stage',
});

describe('stage parsing', () => {
  it('extracts the stage from event.season.slug', () => {
    const ko: EspnScoreboard = {
      events: [
        {
          date: '2026-06-29T19:00Z',
          season: { year: 2026, slug: 'round-of-32' },
          competitions: [
            {
              status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
              competitors: [
                { homeAway: 'home', team: { displayName: 'Brazil' }, score: '2', winner: true },
                { homeAway: 'away', team: { displayName: 'Mexico' }, score: '1', winner: false },
              ],
            },
          ],
        },
      ],
    };
    const matches = parseScoreboard(ko, baseTeams);
    expect(matches[0].stage).toBe('round-of-32');
  });

  it('defaults stage to group-stage when season is absent', () => {
    const noSeason: EspnScoreboard = {
      events: [
        {
          date: 'x',
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
    const matches = parseScoreboard(noSeason, baseTeams);
    expect(matches[0].stage).toBe('group-stage');
  });
});

describe('computeGroupTables stage filter', () => {
  it('ignores knockout rematches between same-group teams', () => {
    // Brazil beat Morocco 2-0 in the groups, then meet again in a knockout.
    const group = { ...m(9, 10, 2, 0), stage: 'group-stage' };
    const knockout = { ...m(9, 10, 3, 0), stage: 'quarterfinals' };
    const tables = computeGroupTables([group, knockout], baseTeams);
    const brazil = tables['C'].find((r) => r.teamId === 9)!;
    expect(brazil.played).toBe(1); // knockout rematch NOT counted
    expect(brazil.gf).toBe(2);
  });
});

// Build a full 6-match group from 4 team ids: t[0] beats everyone,
// t[1] beats t[2],t[3]; t[2] beats t[3]. Clean 1st/2nd/3rd/4th by points.
// gfBoost inflates the 3rd-place team's goals (for best-thirds ranking tests).
const fullGroup = (t: [number, number, number, number], gfBoost = 0): SoccerMatch[] => [
  m(t[0], t[1], 2, 0),
  m(t[0], t[2], 2, 0),
  m(t[0], t[3], 2, 0),
  m(t[1], t[2], 1, 0),
  m(t[1], t[3], 1, 0),
  m(t[2], t[3], 1 + gfBoost, 0),
];

// 48-team field: groups A-L, ids 1-48 in blocks of 4.
const GROUPS = 'ABCDEFGHIJKL'.split('');
const fullField = GROUPS.flatMap((g, gi) =>
  [0, 1, 2, 3].map((i) => ({ id: gi * 4 + i + 1, name: `${g}${i + 1}`, seed: i + 1, group: g }))
) as unknown as BaseTeam[];
const groupIds = (gi: number): [number, number, number, number] =>
  [gi * 4 + 1, gi * 4 + 2, gi * 4 + 3, gi * 4 + 4];

const row = (rows: SyncResultRow[], teamId: number, roundKey: string) =>
  rows.find((r) => r.teamId === teamId && r.roundKey === roundKey);

describe('computeGroupProps', () => {
  it('returns nulls until ALL groups are complete', () => {
    const matches = GROUPS.flatMap((_, gi) => fullGroup(groupIds(gi))).slice(0, -1); // last match missing
    expect(computeGroupProps(matches, fullField)).toEqual({ worstGroupDiff: null, bestGroupDiff: null });
  });

  it('picks the global min-GD team as worstGroupDiff and max-GD as bestGroupDiff', () => {
    // In fullGroup, t[3] loses every game (worst in its group) and t[0] wins every game
    // (best). Boost group A's 4th-place loss margin so A's t[3] is the GLOBAL worst.
    const matches = GROUPS.flatMap((_, gi) => fullGroup(groupIds(gi), gi === 0 ? 5 : 0));
    const props = computeGroupProps(matches, fullField);
    expect(props.worstGroupDiff).toBe(groupIds(0)[3]); // group A's 4th team (GD -9)
    // best is one of the unbeaten group winners (GD +6); just assert it's a valid winner id.
    const winnerIds = GROUPS.map((_, gi) => groupIds(gi)[0]);
    expect(winnerIds).toContain(props.bestGroupDiff);
  });
});

describe('computeGroupResults', () => {
  it('writes nothing for an incomplete group', () => {
    const matches = fullGroup(groupIds(0)).slice(0, 5); // 5 of 6 played
    expect(computeGroupResults(matches, fullField)).toEqual([]);
  });

  it('a complete group yields 4 winGroup rows and 3 decidable r32 rows', () => {
    const [a1, a2, a3, a4] = groupIds(0);
    const rows = computeGroupResults(fullGroup(groupIds(0)), fullField);
    expect(row(rows, a1, 'winGroup')?.result).toBe('won');
    expect(row(rows, a2, 'winGroup')?.result).toBe('lost');
    expect(row(rows, a4, 'winGroup')?.result).toBe('lost');
    expect(row(rows, a1, 'r32')?.result).toBe('won');
    expect(row(rows, a2, 'r32')?.result).toBe('won');
    expect(row(rows, a4, 'r32')?.result).toBe('lost');
    expect(row(rows, a3, 'r32')).toBeUndefined(); // 3rd place waits for best-thirds
    expect(rows).toHaveLength(7);
  });

  it('resolves best-8-thirds r32 rows once all 12 groups are complete', () => {
    // Boost the 3rd-place GF in groups A-H so those 8 thirds outrank I-L's.
    const matches = GROUPS.flatMap((_, gi) => fullGroup(groupIds(gi), gi < 8 ? 3 : 0));
    const rows = computeGroupResults(matches, fullField);
    const thirdOf = (gi: number) => gi * 4 + 3; // t[2] finishes 3rd by construction
    expect(row(rows, thirdOf(0), 'r32')?.result).toBe('won'); // group A third (boosted)
    expect(row(rows, thirdOf(7), 'r32')?.result).toBe('won'); // group H third (boosted)
    expect(row(rows, thirdOf(8), 'r32')?.result).toBe('lost'); // group I third
    expect(row(rows, thirdOf(11), 'r32')?.result).toBe('lost'); // group L third
    // Every team now has exactly one winGroup row and one r32 row.
    expect(rows.filter((r) => r.roundKey === 'winGroup')).toHaveLength(48);
    expect(rows.filter((r) => r.roundKey === 'r32')).toHaveLength(48);
  });
});

const ko = (h: number, a: number, stage: string, winner: number | null): SoccerMatch => ({
  ...m(h, a, 1, 1),
  stage,
  winnerTeamId: winner, // shootouts: score level, winner flag decides
});

describe('computeKnockoutResults', () => {
  it('maps each knockout stage to the round it decides', () => {
    const rows = computeKnockoutResults([
      ko(9, 1, 'round-of-32', 9),
      ko(9, 13, 'round-of-16', 9),
      ko(9, 2, 'quarterfinals', 9),
      ko(9, 3, 'semifinals', 9),
      ko(9, 10, 'final', 9),
    ]);
    expect(row(rows, 9, 'r16')?.result).toBe('won');
    expect(row(rows, 1, 'r16')?.result).toBe('lost');
    expect(row(rows, 9, 'qf')?.result).toBe('won');
    expect(row(rows, 9, 'sf')?.result).toBe('won');
    expect(row(rows, 9, 'final')?.result).toBe('won');
    expect(row(rows, 9, 'champion')?.result).toBe('won');
    expect(row(rows, 10, 'champion')?.result).toBe('lost');
    expect(rows).toHaveLength(10);
  });

  it('ignores the 3rd-place match, group-stage, scheduled, and unresolved matches', () => {
    const rows = computeKnockoutResults([
      ko(2, 3, '3rd-place-match', 2), // decides nothing
      { ...m(9, 10, 2, 0), stage: 'group-stage' }, // group play, not knockout
      { ...ko(9, 1, 'round-of-32', 9), status: 'scheduled' }, // not played yet
      ko(9, 1, 'round-of-32', null), // anomalous: no winner flag
      { ...ko(9, 1, 'round-of-32', 9), awayTeamId: null }, // placeholder opponent
    ]);
    expect(rows).toEqual([]);
  });
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
