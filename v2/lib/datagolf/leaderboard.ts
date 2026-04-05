/**
 * DataGolf Leaderboard — converts in-play API data into the same format
 * as the ESPN golf leaderboard, plus DataGolf-specific extras (live probabilities).
 *
 * Used as primary data source for golf sync; ESPN is fallback.
 */

import { fetchInPlay, formatPlayerName, parsePosition } from './client';
import type { DataGolfInPlayPlayer, DataGolfInPlayResponse } from './client';

// ─── Types ────────────────────────────────────────────────────────

export interface GolfPlayerLeaderboard {
  /** Player name in "First Last" format */
  name: string;
  /** DataGolf player ID (for cross-referencing odds) */
  dgId: number;
  /** Numeric position (1, 2, 3...) or null if CUT/WD/DQ */
  position: number | null;
  /** Display position ("T8", "1", "CUT", "WD") */
  positionDisplay: string;
  /** Whether player made the cut */
  madeCut: boolean | null;
  /** Current round (1-4) */
  currentRound: number;
  /** Total score relative to par */
  totalScore: number | null;
  /** Today's score relative to par */
  todayScore: number | null;
  /** Holes completed in current round */
  thru: number | null;
  /** Player missed the cut */
  isCut: boolean;
  /** Player withdrew */
  isWithdrawn: boolean;
  /** DataGolf live probabilities (only available during tournament) */
  liveProbs?: {
    win: number;
    top5: number;
    top10: number;
    top20: number;
    makeCut: number;
  };
}

export interface GolfLeaderboard {
  tournamentName: string;
  /** 'pre' | 'in' | 'post' */
  status: string;
  currentRound: number;
  players: GolfPlayerLeaderboard[];
  source: 'datagolf' | 'espn';
  lastUpdated: string;
}

// ─── DataGolf Leaderboard Fetcher ────────────────────────────────

/**
 * Fetch and normalize the DataGolf in-play leaderboard.
 */
export async function fetchDataGolfLeaderboard(): Promise<GolfLeaderboard> {
  const data = await fetchInPlay('pga');

  const players: GolfPlayerLeaderboard[] = [];

  for (const p of data.data) {
    const name = formatPlayerName(p.player_name);
    const posStr = p.current_pos;
    const { position, isTied } = parsePosition(posStr);

    const isCut = posStr?.toUpperCase() === 'CUT' || posStr?.toUpperCase() === 'MDF';
    const isWithdrawn = posStr?.toUpperCase() === 'WD';
    const isDQ = posStr?.toUpperCase() === 'DQ';

    players.push({
      name,
      dgId: p.dg_id,
      position,
      positionDisplay: posStr ?? '--',
      madeCut: isCut ? false : (position !== null ? true : null),
      currentRound: p.current_round,
      totalScore: p.total,
      todayScore: p.today,
      thru: p.thru,
      isCut: isCut || isDQ,
      isWithdrawn,
      liveProbs: (p.win_prob !== undefined) ? {
        win: p.win_prob ?? 0,
        top5: p.top_5_prob ?? 0,
        top10: p.top_10_prob ?? 0,
        top20: p.top_20_prob ?? 0,
        makeCut: p.make_cut_prob ?? 0,
      } : undefined,
    });
  }

  // Sort by position (null = bottom)
  players.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

  // Infer tournament status from the data
  const allFinished = players.length > 0 && players.every(
    p => p.isCut || p.isWithdrawn || (p.currentRound >= 4 && (p.thru === null || p.thru === 18))
  );
  const anyStarted = players.some(p => p.position !== null || p.isCut || p.isWithdrawn);
  const status = allFinished ? 'post' : anyStarted ? 'in' : 'pre';

  return {
    tournamentName: data.event_name,
    status,
    currentRound: data.current_round,
    players,
    source: 'datagolf',
    lastUpdated: data.last_updated,
  };
}

// ─── Position-Based Results ──────────────────────────────────────

/**
 * Convert a player's final position into tier results for tournament_results.
 * For golf: position 8 → makeCut: won, top20: won, top10: won, top5: lost, winner: lost
 *
 * Standard Calcutta rule: all players tied within a boundary get full payout.
 * e.g., 3 players at T10 → all 3 get top10: won (position 10 ≤ 10).
 */
export function positionToTierResults(
  position: number | null,
  isCut: boolean,
  isWithdrawn: boolean,
  tiers: Array<{ key: string; teamsAdvancing: number }>
): Array<{ roundKey: string; result: 'won' | 'lost' }> {
  const results: Array<{ roundKey: string; result: 'won' | 'lost' }> = [];

  if (isCut || isWithdrawn || position === null) {
    // Missed cut, withdrew, or DQ — lost all tiers
    for (const tier of tiers) {
      results.push({ roundKey: tier.key, result: 'lost' });
    }
    return results;
  }

  for (const tier of tiers) {
    results.push({
      roundKey: tier.key,
      result: position <= tier.teamsAdvancing ? 'won' : 'lost',
    });
  }

  return results;
}

// ─── Dead Heat Fraction Calculator ──────────────────────────────

/**
 * Calculate dead heat fractions for payouts when players tie at a tier boundary.
 *
 * Example: 3 players at T10, top10 pays 10 spots.
 * If players occupy positions 10-12, and only position 10 is in top10,
 * then 1 out of 3 tied players "deserves" top10.
 * Dead heat fraction = (spots available in top10 for tied group) / (tied players count)
 *
 * In practice, most Calcuttas give ALL T10 players full top10 payout
 * since position 10 ≤ 10. This function is for strict dead heat rules only.
 *
 * @param players - array of { position, isCut, isWithdrawn }
 * @param tiers - array of { key, teamsAdvancing }
 * @returns Map of playerId → tierKey → fraction (0-1)
 */
export function calculateDeadHeatFractions(
  players: Array<{ id: number; position: number | null; isCut: boolean; isWithdrawn: boolean }>,
  tiers: Array<{ key: string; teamsAdvancing: number }>
): Map<number, Record<string, number>> {
  const fractions = new Map<number, Record<string, number>>();

  // Group players by position
  const byPosition = new Map<number, number[]>();
  for (const p of players) {
    if (p.position === null || p.isCut || p.isWithdrawn) continue;
    const arr = byPosition.get(p.position) ?? [];
    arr.push(p.id);
    byPosition.set(p.position, arr);
  }

  for (const tier of tiers) {
    const boundary = tier.teamsAdvancing;

    for (const [pos, playerIds] of byPosition) {
      if (playerIds.length <= 1) {
        // No tie — full payout
        for (const id of playerIds) {
          const rec = fractions.get(id) ?? {};
          rec[tier.key] = pos <= boundary ? 1 : 0;
          fractions.set(id, rec);
        }
        continue;
      }

      // Check if this tied group straddles the boundary
      // The tied players occupy positions [pos, pos + count - 1]
      const count = playerIds.length;
      const lastPos = pos + count - 1;

      if (lastPos <= boundary) {
        // All tied players are within the boundary — full payout
        for (const id of playerIds) {
          const rec = fractions.get(id) ?? {};
          rec[tier.key] = 1;
          fractions.set(id, rec);
        }
      } else if (pos > boundary) {
        // All tied players are outside the boundary — no payout
        for (const id of playerIds) {
          const rec = fractions.get(id) ?? {};
          rec[tier.key] = 0;
          fractions.set(id, rec);
        }
      } else {
        // Dead heat: some are in, some would be out
        // Number of spots available = boundary - pos + 1
        const spotsAvailable = boundary - pos + 1;
        const fraction = spotsAvailable / count;
        for (const id of playerIds) {
          const rec = fractions.get(id) ?? {};
          rec[tier.key] = fraction;
          fractions.set(id, rec);
        }
      }
    }
  }

  return fractions;
}
