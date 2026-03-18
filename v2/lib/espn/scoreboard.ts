/**
 * ESPN Scoreboard API client for NCAA Men's Basketball.
 * Fetches game results and maps them to our tournament format.
 */

import { resolveEspnTeam, resolveEspnRound } from './team-map';

const ESPN_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';

const NCAA_TOURNAMENT_ID = 22;

export interface GameResult {
  espnGameId: string;
  roundKey: string;
  winnerId: number;   // Our internal team ID
  loserId: number;    // Our internal team ID
  winnerName: string; // ESPN display name (for logging)
  loserName: string;
  winnerScore: number;
  loserScore: number;
  region: string;
}

interface EspnCompetitor {
  team: {
    id: string;
    displayName: string;
    shortDisplayName: string;
    abbreviation: string;
  };
  score: string;
  homeAway: string;
  winner?: boolean;
}

interface EspnCompetition {
  id: string;
  tournamentId?: number;
  type: { abbreviation: string };
  status: {
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
    };
  };
  competitors: EspnCompetitor[];
  notes?: Array<{ headline: string }>;
}

interface EspnEvent {
  id: string;
  competitions: EspnCompetition[];
}

interface EspnScoreboardResponse {
  events: EspnEvent[];
}

/**
 * Fetch completed NCAA tournament games from ESPN for a given date.
 * @param date - YYYYMMDD format, or omit for today
 */
export async function fetchCompletedGames(date?: string): Promise<GameResult[]> {
  const url = date ? `${ESPN_SCOREBOARD_URL}?dates=${date}` : ESPN_SCOREBOARD_URL;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`ESPN API error: ${res.status} ${res.statusText}`);
  }

  const data: EspnScoreboardResponse = await res.json();
  const results: GameResult[] = [];
  const unmapped: string[] = [];

  for (const event of data.events) {
    const comp = event.competitions[0];
    if (!comp) continue;

    // Only NCAA tournament games
    if (comp.tournamentId !== NCAA_TOURNAMENT_ID && comp.type.abbreviation !== 'TRNMNT') {
      continue;
    }

    // Only completed games
    if (!comp.status.type.completed) continue;

    // Determine round from headline
    const headline = comp.notes?.[0]?.headline ?? '';
    const roundKey = resolveEspnRound(headline);
    if (!roundKey) continue; // Skip First Four or unrecognized rounds

    // Parse region from headline (e.g., "... - West Region - ...")
    const regionMatch = headline.match(/(East|West|South|Midwest)\s+Region/i);
    const region = regionMatch ? regionMatch[1] : 'Unknown';

    // Get competitors
    const [c1, c2] = comp.competitors;
    if (!c1 || !c2) continue;

    const score1 = parseInt(c1.score, 10);
    const score2 = parseInt(c2.score, 10);

    // Determine winner
    const winner = c1.winner === true ? c1 : c2.winner === true ? c2 : (score1 > score2 ? c1 : c2);
    const loser = winner === c1 ? c2 : c1;

    // Map to our team IDs — try shortDisplayName first, then displayName
    const winnerId = resolveEspnTeam(winner.team.shortDisplayName)
      ?? resolveEspnTeam(winner.team.displayName)
      ?? resolveEspnTeam(winner.team.abbreviation);
    const loserId = resolveEspnTeam(loser.team.shortDisplayName)
      ?? resolveEspnTeam(loser.team.displayName)
      ?? resolveEspnTeam(loser.team.abbreviation);

    if (winnerId === null) {
      unmapped.push(`Winner: "${winner.team.shortDisplayName}" (${winner.team.displayName})`);
      continue;
    }
    if (loserId === null) {
      unmapped.push(`Loser: "${loser.team.shortDisplayName}" (${loser.team.displayName})`);
      continue;
    }

    results.push({
      espnGameId: event.id,
      roundKey,
      winnerId,
      loserId,
      winnerName: winner.team.shortDisplayName,
      loserName: loser.team.shortDisplayName,
      winnerScore: winner === c1 ? score1 : score2,
      loserScore: winner === c1 ? score2 : score1,
      region,
    });
  }

  if (unmapped.length > 0) {
    console.warn('[ESPN] Unmapped teams:', unmapped);
  }

  return results;
}

/**
 * Fetch games across multiple dates (for catching up on missed results).
 * March Madness 2026 runs roughly 3/19 - 4/6.
 */
export async function fetchTournamentResults(startDate: string, endDate: string): Promise<GameResult[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const allResults: GameResult[] = [];
  const seenGameIds = new Set<string>();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const games = await fetchCompletedGames(dateStr);
      for (const game of games) {
        if (!seenGameIds.has(game.espnGameId)) {
          seenGameIds.add(game.espnGameId);
          allResults.push(game);
        }
      }
    } catch (err) {
      console.error(`[ESPN] Failed to fetch ${dateStr}:`, err);
    }
  }

  return allResults;
}
