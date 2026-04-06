/**
 * ESPN Golf Leaderboard API client.
 * Free, no auth required. Returns live/final positions for PGA Tour events.
 *
 * Endpoint: site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard
 */

const ESPN_GOLF_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga';

export interface GolfPlayerResult {
  /** ESPN player name (e.g., "Scottie Scheffler") */
  name: string;
  /** Current position (1, 2, 3...) or null if WD/DQ */
  position: number | null;
  /** Position string from ESPN (e.g., "T3", "1", "CUT", "WD") */
  positionDisplay: string;
  /** Whether player made the cut (null if cut hasn't happened yet) */
  madeCut: boolean | null;
  /** Current round (1-4) or total if finished */
  currentRound: number;
  /** Total score relative to par (e.g., -12, +3) */
  totalScore: number;
  /** Current round score */
  roundScore: number | null;
  /** Whether the tournament is complete for this player */
  isFinished: boolean;
  /** Whether player was cut */
  isCut: boolean;
  /** Whether player withdrew */
  isWithdrawn: boolean;
}

export interface GolfLeaderboardResult {
  tournamentName: string;
  /** 'pre' | 'in' | 'post' */
  status: string;
  /** Current round number (1-4) */
  currentRound: number;
  players: GolfPlayerResult[];
}

/**
 * Fetch the current PGA Tour leaderboard from ESPN.
 * During Masters week, this will be the Masters leaderboard.
 */
export async function fetchGolfLeaderboard(): Promise<GolfLeaderboardResult> {
  const url = `${ESPN_GOLF_BASE}/leaderboard`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN Golf API error: ${res.status}`);

  const data = await res.json();

  const event = data.events?.[0];
  if (!event) throw new Error('No active golf event found');

  const competition = event.competitions?.[0];
  if (!competition) throw new Error('No competition data found');

  const status = competition.status?.type?.state ?? 'pre';

  // Find current round from status
  const currentRound = competition.status?.period ?? 1;

  const players: GolfPlayerResult[] = [];

  for (const competitor of competition.competitors ?? []) {
    const athlete = competitor.athlete;
    if (!athlete) continue;

    const name = athlete.displayName ?? `${athlete.firstName ?? ''} ${athlete.lastName ?? ''}`.trim();
    const statusInfo = competitor.status;
    const isCut = statusInfo?.type?.id === '3' || statusInfo?.displayValue === 'CUT';
    const isWithdrawn = statusInfo?.type?.id === '4' || statusInfo?.displayValue === 'WD';
    const isDQ = statusInfo?.type?.id === '5' || statusInfo?.displayValue === 'DQ';

    // Parse position
    let position: number | null = null;
    const posStr = competitor.status?.position?.id ?? competitor.sortOrder;
    if (posStr && !isCut && !isWithdrawn && !isDQ) {
      position = typeof posStr === 'number' ? posStr : parseInt(posStr, 10);
      if (isNaN(position)) position = null;
    }

    const positionDisplay = competitor.status?.position?.displayName
      ?? competitor.status?.displayValue
      ?? (position ? String(position) : '--');

    // Parse scores
    const totalScoreStr = competitor.score?.displayValue ?? '0';
    const totalScore = totalScoreStr === 'E' ? 0 : parseInt(totalScoreStr, 10) || 0;

    // Round score from linescores
    let roundScore: number | null = null;
    const linescores = competitor.linescores;
    if (Array.isArray(linescores) && linescores.length > 0) {
      const lastScore = linescores[linescores.length - 1];
      const val = lastScore?.displayValue ?? lastScore?.value;
      if (val !== undefined && val !== null) {
        roundScore = typeof val === 'number' ? val : parseInt(val, 10) || null;
      }
    }

    const isFinished = status === 'post' || competitor.status?.type?.completed === true;

    players.push({
      name,
      position,
      positionDisplay,
      madeCut: isCut ? false : (status === 'pre' ? null : !isCut && !isWithdrawn && !isDQ),
      currentRound,
      totalScore,
      roundScore,
      isFinished,
      isCut,
      isWithdrawn,
    });
  }

  // Sort by position (null = end)
  players.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

  return {
    tournamentName: event.name ?? 'PGA Tour Event',
    status,
    currentRound,
    players,
  };
}

/**
 * Map ESPN player name to our team ID.
 * Uses fuzzy name matching (case-insensitive, ignores accents/suffixes).
 */
export function matchPlayerToTeamId(
  espnName: string,
  teams: Array<{ id: number; name: string }>
): number | null {
  const normalize = (n: string) =>
    n.toLowerCase()
      .replace(/['']/g, '')
      .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, '')
      .replace(/[áàäâå]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöôø]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ß]/g, 'ss')
      .trim();

  const normalizedEspn = normalize(espnName);

  // Exact match first
  for (const team of teams) {
    if (normalize(team.name) === normalizedEspn) return team.id;
  }

  // Last name match (for cases like "Scottie Scheffler" vs "S. Scheffler")
  const espnLastName = normalizedEspn.split(' ').pop() ?? '';
  for (const team of teams) {
    const teamLastName = normalize(team.name).split(' ').pop() ?? '';
    if (teamLastName === espnLastName && espnLastName.length >= 4) {
      return team.id;
    }
  }

  return null;
}

/**
 * Convert leaderboard positions to tournament_results rows.
 * For golf, a player who finishes 8th gets:
 *   makeCut: won, top20: won, top10: won, top5: lost, winner: lost
 */
export function positionToResults(
  position: number | null,
  isCut: boolean,
  isWithdrawn: boolean,
  roundKeys: Array<{ key: string; teamsAdvancing: number }>
): Array<{ roundKey: string; result: 'won' | 'lost' }> {
  const results: Array<{ roundKey: string; result: 'won' | 'lost' }> = [];

  if (isCut || isWithdrawn || position === null) {
    // Missed the cut or withdrew — lost all rounds
    for (const round of roundKeys) {
      results.push({ roundKey: round.key, result: 'lost' });
    }
    return results;
  }

  for (const round of roundKeys) {
    // Player's position must be <= teamsAdvancing for this tier
    results.push({
      roundKey: round.key,
      result: position <= round.teamsAdvancing ? 'won' : 'lost',
    });
  }

  return results;
}
