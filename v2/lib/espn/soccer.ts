import type { BaseTeam } from '@/lib/tournaments/types';

export interface SoccerMatch {
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'final';
  winnerTeamId: number | null;
  date: string;
  /** ESPN event.season.slug: group-stage | round-of-32 | round-of-16 |
   *  quarterfinals | semifinals | 3rd-place-match | final */
  stage: string;
}

export interface GroupTableRow {
  teamId: number;
  name: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

// Minimal shape of the ESPN fields we read.
interface EspnCompetitor {
  homeAway: 'home' | 'away';
  team?: { displayName?: string };
  score?: string;
  winner?: boolean;
}
interface EspnEvent {
  date?: string;
  season?: { year?: number; slug?: string };
  competitions?: Array<{
    status?: { type?: { name?: string; completed?: boolean } };
    competitors?: EspnCompetitor[];
  }>;
}
export interface EspnScoreboard {
  events?: EspnEvent[];
}

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Parse an ESPN soccer scoreboard into matches, resolving team names to our
 * BaseTeam ids (by name). ESPN does NOT label the group, so group membership is
 * applied later from our config (see computeGroupTables). Unresolved names are
 * kept with a null id rather than throwing.
 */
export function parseScoreboard(espn: EspnScoreboard, baseTeams: BaseTeam[]): SoccerMatch[] {
  const idByName = new Map<string, number>();
  for (const t of baseTeams) idByName.set(normalize(t.name), t.id);
  const resolve = (name: string | undefined): number | null =>
    name ? idByName.get(normalize(name)) ?? null : null;

  const matches: SoccerMatch[] = [];
  for (const event of espn.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp?.competitors) continue;
    const home = comp.competitors.find((c) => c.homeAway === 'home');
    const away = comp.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    const completed = comp.status?.type?.completed === true;
    const homeId = resolve(home.team?.displayName);
    const awayId = resolve(away.team?.displayName);
    const homeScore = completed ? Number(home.score) : null;
    const awayScore = completed ? Number(away.score) : null;
    const winnerTeamId = !completed
      ? null
      : home.winner
        ? homeId
        : away.winner
          ? awayId
          : null; // draw

    matches.push({
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeName: home.team?.displayName ?? '',
      awayName: away.team?.displayName ?? '',
      homeScore,
      awayScore,
      status: completed ? 'final' : 'scheduled',
      winnerTeamId,
      date: event.date ?? '',
      stage: event.season?.slug ?? 'group-stage',
    });
  }
  return matches;
}

/**
 * Compute group-stage tables from FINAL match results. Group membership comes
 * from our config (every BaseTeam has its group). Sorted by FIFA's first
 * tiebreakers: points → goal difference → goals for (head-to-head deferred).
 */
export function computeGroupTables(
  matches: SoccerMatch[],
  baseTeams: BaseTeam[]
): Record<string, GroupTableRow[]> {
  const rowById = new Map<number, GroupTableRow>();
  for (const t of baseTeams) {
    rowById.set(t.id, {
      teamId: t.id,
      name: t.name,
      group: t.group,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.stage !== 'group-stage') continue; // knockout rematches must not pollute tables
    if (match.status !== 'final') continue;
    if (match.homeTeamId == null || match.awayTeamId == null) continue;
    if (match.homeScore == null || match.awayScore == null) continue;
    const home = rowById.get(match.homeTeamId);
    const away = rowById.get(match.awayTeamId);
    if (!home || !away || home.group !== away.group) continue; // only intra-group

    home.played++;
    away.played++;
    home.gf += match.homeScore;
    home.ga += match.awayScore;
    away.gf += match.awayScore;
    away.ga += match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (match.awayScore > match.homeScore) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  const tables: Record<string, GroupTableRow[]> = {};
  for (const row of rowById.values()) {
    row.gd = row.gf - row.ga;
    (tables[row.group] ??= []).push(row);
  }
  for (const group of Object.keys(tables)) {
    tables[group].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  }
  return tables;
}

export interface SyncResultRow {
  teamId: number;
  roundKey: string;
  result: 'won' | 'lost';
}

/** Matches needed for a group of n teams to be complete: n*(n-1)/2. */
const matchesForGroupSize = (n: number) => (n * (n - 1)) / 2;

/**
 * Result rows decidable from group-stage play so far.
 * Per COMPLETE group (all 6 matches final): 1st → winGroup won (others lost);
 * 1st+2nd → r32 won; 4th → r32 lost. The twelve 3rd-place teams' r32 rows are
 * only written once ALL groups are complete (best 8 thirds advance, ranked
 * points → GD → GF; FIFA's later tiebreakers are a documented simplification).
 */
export function computeGroupResults(
  matches: SoccerMatch[],
  baseTeams: BaseTeam[]
): SyncResultRow[] {
  const tables = computeGroupTables(matches, baseTeams);
  const groupKeys = Object.keys(tables);
  const rows: SyncResultRow[] = [];
  const thirds: GroupTableRow[] = [];
  let completeGroups = 0;

  for (const g of groupKeys) {
    const table = tables[g];
    const played = table.reduce((sum, r) => sum + r.played, 0) / 2; // each match counts twice
    if (played < matchesForGroupSize(table.length)) continue; // group not finished
    completeGroups++;

    table.forEach((r, i) => {
      rows.push({ teamId: r.teamId, roundKey: 'winGroup', result: i === 0 ? 'won' : 'lost' });
      if (i <= 1) rows.push({ teamId: r.teamId, roundKey: 'r32', result: 'won' });
      if (i === 3) rows.push({ teamId: r.teamId, roundKey: 'r32', result: 'lost' });
      if (i === 2) thirds.push(r);
    });
  }

  // Best-8-thirds is only decidable with the full field in.
  if (completeGroups === groupKeys.length && thirds.length > 0) {
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    thirds.forEach((r, i) => {
      rows.push({ teamId: r.teamId, roundKey: 'r32', result: i < 8 ? 'won' : 'lost' });
    });
  }
  return rows;
}
