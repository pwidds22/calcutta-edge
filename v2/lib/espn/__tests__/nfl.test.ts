import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  parseStandings,
  readStatValue,
  computeSeasonResults,
  computeRecordProps,
} from '../nfl';
import type { EspnStandings, NflStandings, NflSyncResultRow } from '../nfl';
import { NFL_SEASON_2026_TEAMS } from '@/lib/tournaments/configs/nfl-season-2026';
import type { BaseTeam } from '@/lib/tournaments/types';

/**
 * Fixtures are UNMODIFIED captures of
 *   https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings
 *     ?season={year}&level=3&seasontype=2
 * taken 2026-08-27. Read via fs rather than a JSON import so tsc never has to
 * infer a literal type for a 166 KB object (it makes `next build` crawl).
 */
function loadFixture(year: 2025 | 2022): EspnStandings {
  const path = fileURLToPath(new URL(`./fixtures/nfl-standings-${year}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf-8')) as EspnStandings;
}

const teams = NFL_SEASON_2026_TEAMS;
const standings2025 = parseStandings(loadFixture(2025));
const standings2022 = parseStandings(loadFixture(2022));

const byAbbr = (s: NflStandings, abbr: string) => s.teams.find((t) => t.abbreviation === abbr)!;
const configIdOf = (name: string) => teams.find((t) => t.name === name)!.id;
const rowsFor = (rows: NflSyncResultRow[], roundKey: string) =>
  rows.filter((r) => r.roundKey === roundKey);

describe('parseStandings', () => {
  it('reads all 32 teams with numerics off stats[].value, keyed by name', () => {
    expect(standings2025.teams).toHaveLength(32);
    expect(standings2025.seasonYear).toBe(2025);
    // seasonType lives on each DIVISION node's `standings`, not at the top level.
    expect(standings2025.seasonType).toBe(2);

    const ne = byAbbr(standings2025, 'NE');
    expect(ne.name).toBe('New England Patriots');
    expect(ne.division).toBe('AFC East');
    expect(ne.wins).toBe(14);
    expect(ne.losses).toBe(3);
    expect(ne.ties).toBe(0);
    expect(ne.pointsFor).toBe(490);
    expect(ne.playoffSeed).toBe(2);
    expect(ne.units).toBe(14);
    expect(ne.gamesPlayed).toBe(17);

    // ESPN's own abbreviations, not ours: JAX (never JAC), WSH (never WAS).
    const abbrs = standings2025.teams.map((t) => t.abbreviation);
    expect(abbrs).toContain('JAX');
    expect(abbrs).toContain('WSH');
    expect(abbrs).not.toContain('JAC');
    expect(abbrs).not.toContain('WAS');
  });

  it('does not mistake record-shaped string stats for numerics', () => {
    // Real 2025 NE stats. `divisionRecord` is the dangerous one: value is a
    // genuine 0.0, so a naive `.value` read silently returns 0 for a '5-1'.
    const stats = [
      { name: 'divisionRecord', type: 'divisionrecord', value: 0.0, displayValue: '5-1' },
      { name: 'overall', type: 'total', value: null, displayValue: '14-3' },
      { name: 'Home', type: 'home', value: null, displayValue: '6-3' },
      { name: 'Road', type: 'road', value: null, displayValue: '8-0' },
      { name: 'vs. Div.', type: 'vsdiv', value: null, displayValue: '5-1' },
      { name: 'vs. Conf.', type: 'vsconf', value: null, displayValue: '9-3' },
      { name: 'wins', type: 'wins', value: 14.0, displayValue: '14' },
      { name: 'ties', type: 'ties', value: 0.0, displayValue: '0' },
      { name: 'pointDifferential', type: 'pointdifferential', value: -170.0, displayValue: '-170' },
    ];
    for (const impostor of ['divisionRecord', 'overall', 'Home', 'Road', 'vs. Div.', 'vs. Conf.']) {
      expect(readStatValue(stats, impostor)).toBeNull();
    }
    // ...while real numerics still read, including a negative differential
    // whose displayValue starts with a '-'.
    expect(readStatValue(stats, 'wins')).toBe(14);
    expect(readStatValue(stats, 'ties')).toBe(0);
    expect(readStatValue(stats, 'pointDifferential')).toBe(-170);
    expect(readStatValue(stats, 'nonexistent')).toBeNull();

    // And the whole-fixture consequence: no team's win total was contaminated.
    expect(standings2025.teams.every((t) => t.gamesPlayed === 17)).toBe(true);
  });

  it('throws on a missing numeric rather than settling it as zero', () => {
    // The &type=2 trap: it selects ESPN's "expanded" stat set, which has no
    // pointsFor at all. Silently reading 0 would look like a real season.
    const fixture = loadFixture(2025);
    const entry = fixture.children![0].children![0].standings!.entries![0];
    entry.stats = entry.stats!.filter((s) => s.name !== 'pointsFor');
    expect(() => parseStandings(fixture)).toThrow(/no numeric 'pointsFor'/);
  });

  it('throws if the response is not grouped by division (level=3)', () => {
    // At level=1 ESPN returns one league-wide bucket. Grading it would produce
    // a single "division winner" for all 32 teams against an 8-slot budget.
    const flat: NflStandings = {
      ...standings2025,
      teams: standings2025.teams.map((t) => ({ ...t, division: 'National Football League' })),
    };
    expect(() =>
      computeSeasonResults(flat, teams as BaseTeam[], { seasonComplete: true })
    ).toThrow(/expected 8 divisions/);
  });

  it('refuses to grade preseason standings even if seasontype=2 was dropped', () => {
    // Live on 2026-08-27, ?season=2026&level=3 with no seasontype returned
    // seasonType 1 and the Bills 2-0 — preseason wins, in the settlement shape.
    const preseasonFeed: NflStandings = { ...standings2025, seasonType: 1 };
    expect(() => computeSeasonResults(preseasonFeed, teams as BaseTeam[])).toThrow(
      /seasonType 1/
    );
    expect(() => computeRecordProps(preseasonFeed, teams as BaseTeam[])).toThrow(/seasonType 1/);
  });

  it('never reads the clincher stat (its letters are unstable across seasons)', () => {
    // 2025 uses '*' / 'z' / 'y' / 'e'; 2021 used 'x' where 2022-25 use 'y'.
    // A prose warning is welcome; a quoted string literal means someone is
    // looking the stat up.
    const src = readFileSync(fileURLToPath(new URL('../nfl.ts', import.meta.url)), 'utf-8');
    expect(src).not.toMatch(/['"]clincher['"]/);
  });
});

describe('computeSeasonResults — regularSeasonWins', () => {
  it('counts a tie as half a win and conserves the 272-game league total', () => {
    const rows = computeSeasonResults(standings2025, teams as BaseTeam[]);
    const wins = rowsFor(rows, 'regularSeasonWins');

    // Green Bay went 9-7-1 in 2025.
    const gb = byAbbr(standings2025, 'GB');
    expect([gb.wins, gb.losses, gb.ties]).toEqual([9, 7, 1]);
    const gbRow = wins.find((r) => r.teamId === configIdOf('Green Bay Packers'))!;
    expect(gbRow.result).toBe('won');
    expect(gbRow.resultCount).toBe(9.5);

    // A complete, uninterrupted season distributes exactly 272 units.
    const total = wins.reduce((sum, r) => sum + (r.resultCount ?? 0), 0);
    expect(total).toBe(272);
  });

  it('emits only won rows for regularSeasonWins on the weekly path', () => {
    const rows = computeSeasonResults(standings2025, teams as BaseTeam[]);
    expect(rows.every((r) => r.roundKey === 'regularSeasonWins')).toBe(true);
    expect(rows.every((r) => r.result === 'won')).toBe(true);
    expect(rows).toHaveLength(32);
  });

  it('emits nothing before kickoff (0-0-0, playoffSeed 0 sentinel)', () => {
    const preseason: NflStandings = {
      seasonYear: 2026,
      seasonType: 2,
      teams: standings2025.teams.map((t) => ({
        ...t,
        wins: 0,
        losses: 0,
        ties: 0,
        units: 0,
        gamesPlayed: 0,
        playoffSeed: 0,
      })),
    };
    expect(computeSeasonResults(preseason, teams as BaseTeam[])).toEqual([]);
    expect(
      computeSeasonResults(preseason, teams as BaseTeam[], { seasonComplete: true })
    ).toEqual([]);
  });

  it('throws rather than silently dropping a team it cannot name-join', () => {
    const renamed = teams.map((t) =>
      t.name === 'Las Vegas Raiders' ? { ...t, name: 'Oakland Raiders' } : t
    ) as BaseTeam[];
    expect(() => computeSeasonResults(standings2025, renamed)).toThrow(/Las Vegas Raiders/);
  });
});

describe('computeSeasonResults — divisionWinner', () => {
  it('picks exactly one winner from the 2025 NFC South three-way tie', () => {
    // CAR, TB and ATL all finished 8-9. A max-wins grader returns three.
    const south = standings2025.teams.filter((t) => t.division === 'NFC South');
    expect(south.filter((t) => t.wins === 8)).toHaveLength(3);

    const rows = computeSeasonResults(standings2025, teams as BaseTeam[], { seasonComplete: true });
    const div = rowsFor(rows, 'divisionWinner');

    const southIds = new Set(south.map((t) => configIdOf(t.name)));
    const southWon = div.filter((r) => southIds.has(r.teamId) && r.result === 'won');
    expect(southWon).toHaveLength(1);
    expect(southWon[0].teamId).toBe(configIdOf('Carolina Panthers')); // playoffSeed 4
    expect(div.filter((r) => southIds.has(r.teamId) && r.result === 'lost')).toHaveLength(3);

    // League-wide: 8 divisions, 8 winners, 24 losers, exactly one row per team.
    expect(div.filter((r) => r.result === 'won')).toHaveLength(8);
    expect(div).toHaveLength(32);
    expect(div.every((r) => r.resultCount === undefined)).toBe(true);
  });

  it('does not emit divisionWinner rows on the weekly path', () => {
    const rows = computeSeasonResults(standings2025, teams as BaseTeam[]);
    expect(rowsFor(rows, 'divisionWinner')).toHaveLength(0);
  });
});

describe('computeRecordProps', () => {
  it('ranks by units, not raw wins (2022 CHI 3-14-0 vs HOU 3-13-1)', () => {
    const chi = byAbbr(standings2022, 'CHI');
    const hou = byAbbr(standings2022, 'HOU');
    expect([chi.wins, chi.losses, chi.ties]).toEqual([3, 14, 0]);
    expect([hou.wins, hou.losses, hou.ties]).toEqual([3, 13, 1]);
    expect(chi.units).toBe(3);
    expect(hou.units).toBe(3.5);

    const props = computeRecordProps(standings2022, teams as BaseTeam[]);
    // Raw wins ties them at 3; units puts Chicago alone at the bottom.
    expect(props.worstRecord).toEqual([configIdOf('Chicago Bears')]);
    expect(props.worstRecord).not.toContain(configIdOf('Houston Texans'));
    expect(props.bestRecord.sort((a, b) => a - b)).toEqual(
      [configIdOf('Kansas City Chiefs'), configIdOf('Philadelphia Eagles')].sort((a, b) => a - b)
    );
  });

  it('emits every team in a four-way worst-record tie and a three-way best', () => {
    const props = computeRecordProps(standings2025, teams as BaseTeam[]);
    expect(props.worstRecord).toHaveLength(4);
    expect(new Set(props.worstRecord)).toEqual(
      new Set(
        ['New York Jets', 'Tennessee Titans', 'Las Vegas Raiders', 'Arizona Cardinals'].map(
          configIdOf
        )
      )
    );
    expect(props.bestRecord).toHaveLength(3);
    expect(new Set(props.bestRecord)).toEqual(
      new Set(
        ['New England Patriots', 'Denver Broncos', 'Seattle Seahawks'].map(configIdOf)
      )
    );
  });

  it('returns no winners before any game is played', () => {
    const preseason: NflStandings = {
      seasonYear: 2026,
      seasonType: 2,
      teams: standings2025.teams.map((t) => ({
        ...t,
        wins: 0,
        losses: 0,
        ties: 0,
        units: 0,
        gamesPlayed: 0,
        playoffSeed: 0,
      })),
    };
    expect(computeRecordProps(preseason, teams as BaseTeam[])).toEqual({
      bestRecord: [],
      worstRecord: [],
    });
  });
});

describe('fixture integrity — the config join ESPN feeds depend on', () => {
  it('joins all 32 config names to ESPN displayName with no aliases, in both seasons', () => {
    for (const s of [standings2025, standings2022]) {
      const espnNames = new Set(s.teams.map((t) => t.name));
      const missing = teams.filter((t) => !espnNames.has(t.name)).map((t) => t.name);
      expect(missing).toEqual([]);
    }
  });

  it("matches ESPN's division nodes to our config groups", () => {
    for (const t of standings2025.teams) {
      const cfg = teams.find((c) => c.name === t.name)!;
      expect(t.division.replace(/ /g, '_')).toBe(cfg.group);
    }
  });

  it('confirms 2022 played 271 games — the reason a "272 final" gate must never be used', () => {
    const total = standings2022.teams.reduce((sum, t) => sum + t.units, 0);
    expect(total).toBe(271);
    expect(standings2022.teams.some((t) => t.gamesPlayed === 16)).toBe(true);
  });
});
