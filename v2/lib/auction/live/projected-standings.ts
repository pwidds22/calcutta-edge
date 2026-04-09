/**
 * Projected standings — aggregates DataGolf per-player EV into
 * per-participant projected P&L for the Leaderboard tab.
 */

import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, PayoutRules } from '@/lib/tournaments/types';
import type { DataGolfInPlayPlayer } from '@/lib/datagolf/client';
import { formatPlayerName } from '@/lib/datagolf/client';
import { calculateLiveEV, normalizeName } from '@/lib/datagolf/ev';

// ─── Types ────────────────────────────────────────────────────────

export interface ProjectedTeam {
  teamId: number;
  teamName: string;
  seed: number;
  group: string;
  purchasePrice: number;
  projectedEV: number | null;
  winProb: number | null;
}

export interface ProjectedEntry {
  participantId: string;
  participantName: string;
  totalSpent: number;
  projectedEarnings: number;
  projectedPL: number;
  teamsOwned: number;
  teams: ProjectedTeam[];
}

// ─── Calculation ─────────────────────────────────────────────────

/**
 * Build a name → DataGolfInPlayPlayer lookup from the in-play data.
 * DataGolf uses "Last, First" format; we normalize to match baseTeam names.
 */
function buildPlayerMap(
  players: DataGolfInPlayPlayer[]
): Map<string, DataGolfInPlayPlayer> {
  const map = new Map<string, DataGolfInPlayPlayer>();
  for (const p of players) {
    const displayName = formatPlayerName(p.player_name);
    map.set(normalizeName(displayName), p);
  }
  return map;
}

/**
 * Calculate projected standings for all participants.
 * For each sold team, matches to a DataGolf player and computes expected value.
 * Returns entries sorted by projected P&L descending.
 */
export function calculateProjectedStandings(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  payoutRules: PayoutRules,
  players: DataGolfInPlayPlayer[]
): ProjectedEntry[] {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const playerMap = buildPlayerMap(players);
  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);

  // Group sold teams by participant
  const byParticipant = new Map<string, { name: string; teams: SoldTeam[] }>();
  for (const sold of soldTeams) {
    if (!byParticipant.has(sold.winnerId)) {
      byParticipant.set(sold.winnerId, { name: sold.winnerName, teams: [] });
    }
    byParticipant.get(sold.winnerId)!.teams.push(sold);
  }

  const entries: ProjectedEntry[] = [];

  for (const [participantId, { name, teams }] of byParticipant) {
    const totalSpent = teams.reduce((sum, t) => sum + t.amount, 0);
    let projectedEarnings = 0;
    const projectedTeams: ProjectedTeam[] = [];

    for (const sold of teams) {
      const base = teamMap.get(sold.teamId);
      const teamName = base?.name ?? `Team ${sold.teamId}`;
      const seed = base?.seed ?? 0;
      const group = base?.group ?? '';

      // Match to DataGolf player
      const dgPlayer = base ? playerMap.get(normalizeName(base.name)) : null;
      const ev = dgPlayer ? calculateLiveEV(dgPlayer, actualPot, payoutRules) : null;
      const winProb = dgPlayer?.win_prob ?? null;

      if (ev !== null) projectedEarnings += ev;

      projectedTeams.push({
        teamId: sold.teamId,
        teamName,
        seed,
        group,
        purchasePrice: sold.amount,
        projectedEV: ev,
        winProb,
      });
    }

    projectedTeams.sort((a, b) => (b.projectedEV ?? 0) - (a.projectedEV ?? 0));

    entries.push({
      participantId,
      participantName: name,
      totalSpent,
      projectedEarnings,
      projectedPL: projectedEarnings - totalSpent,
      teamsOwned: teams.length,
      teams: projectedTeams,
    });
  }

  // Sort by projected P&L descending
  entries.sort((a, b) => b.projectedPL - a.projectedPL);

  return entries;
}
