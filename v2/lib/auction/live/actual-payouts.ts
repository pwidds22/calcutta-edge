import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';

// ─── Types ────────────────────────────────────────────────────────

export interface TeamResult {
  teamId: number;
  teamName: string;
  seed: number;
  group: string;
  purchasePrice: number;
  ownerId: string;
  ownerName: string;
  status: 'alive' | 'eliminated' | 'champion';
  roundsWon: string[];
  eliminatedInRound: string | null;
  earnings: number;
}

export interface PropEarning {
  propKey: string;
  propLabel: string;
  amount: number;
}

export interface LeaderboardEntry {
  participantId: string;
  participantName: string;
  totalSpent: number;
  totalEarned: number;
  netPL: number;
  teamsOwned: number;
  teamsAlive: number;
  teamsEliminated: number;
  teams: TeamResult[];
  propEarnings: PropEarning[];
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  actualPot: number;
  completedRounds: string[];
  currentRound: string | null;
  isTournamentComplete: boolean;
}

// ─── Pure Calculation Functions ───────────────────────────────────

/**
 * Get team IDs that are "alive" entering a given round.
 * A team is alive if it has won all previous rounds (or there are no previous rounds).
 */
export function getAliveTeamsForRound(
  soldTeamIds: number[],
  results: TournamentResult[],
  config: TournamentConfig,
  roundKey: string
): number[] {
  const roundIndex = config.rounds.findIndex((r) => r.key === roundKey);
  if (roundIndex < 0) return [];

  // For the first round, all sold teams are alive
  if (roundIndex === 0) return [...soldTeamIds];

  // For subsequent rounds, a team must have won ALL previous rounds
  const previousRounds = config.rounds.slice(0, roundIndex).map((r) => r.key);
  const resultMap = buildResultMap(results);

  return soldTeamIds.filter((teamId) => {
    return previousRounds.every((prevRound) => {
      const result = resultMap.get(`${teamId}:${prevRound}`);
      return result === 'won';
    });
  });
}

/**
 * Determine the status of a single team based on results.
 */
export function getTeamStatus(
  teamId: number,
  results: TournamentResult[],
  config: TournamentConfig
): { status: 'alive' | 'eliminated' | 'champion'; roundsWon: string[]; eliminatedInRound: string | null } {
  const resultMap = buildResultMap(results);
  const roundsWon: string[] = [];
  let eliminatedInRound: string | null = null;

  for (const round of config.rounds) {
    const result = resultMap.get(`${teamId}:${round.key}`);
    if (result === 'won') {
      roundsWon.push(round.key);
    } else if (result === 'lost') {
      eliminatedInRound = round.key;
      break;
    } else {
      // No result yet — team is alive (pending or no entry)
      break;
    }
  }

  const lastRound = config.rounds[config.rounds.length - 1];
  const isChampion = roundsWon.includes(lastRound.key);

  return {
    status: isChampion ? 'champion' : eliminatedInRound ? 'eliminated' : 'alive',
    roundsWon,
    eliminatedInRound,
  };
}

/**
 * Calculate actual earnings for a team based on results entered so far.
 * Each round the team won earns: actualPot * (payoutRules[roundKey] / 100)
 */
export function calculateTeamEarnings(
  roundsWon: string[],
  actualPot: number,
  payoutRules: PayoutRules
): number {
  return roundsWon.reduce((total, roundKey) => {
    const pct = payoutRules[roundKey] ?? 0;
    return total + actualPot * (pct / 100);
  }, 0);
}

/**
 * Which rounds are fully completed (all alive teams have a result)?
 */
export function getCompletedRounds(
  soldTeamIds: number[],
  results: TournamentResult[],
  config: TournamentConfig
): string[] {
  const completed: string[] = [];

  for (const round of config.rounds) {
    const aliveTeams = getAliveTeamsForRound(soldTeamIds, results, config, round.key);
    if (aliveTeams.length === 0) break;

    const resultMap = buildResultMap(results);
    const allResolved = aliveTeams.every((teamId) => {
      const result = resultMap.get(`${teamId}:${round.key}`);
      return result === 'won' || result === 'lost';
    });

    if (allResolved) {
      completed.push(round.key);
    } else {
      break; // Rounds must be sequential
    }
  }

  return completed;
}

/**
 * Get the current round (first round that doesn't have all results yet).
 */
export function getCurrentRound(
  soldTeamIds: number[],
  results: TournamentResult[],
  config: TournamentConfig
): string | null {
  const completed = getCompletedRounds(soldTeamIds, results, config);
  const nextRoundIndex = completed.length;
  if (nextRoundIndex >= config.rounds.length) return null; // Tournament complete
  return config.rounds[nextRoundIndex].key;
}

/**
 * Build the full leaderboard from auction results + tournament results.
 * This is the main calculation engine for the tournament lifecycle.
 */
export function calculateLeaderboard(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  results: TournamentResult[],
  config: TournamentConfig,
  payoutRules: PayoutRules,
  propResults: PropResult[] = []
): LeaderboardData {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);
  const soldTeamIds = soldTeams.map((t) => t.teamId);

  const completedRounds = getCompletedRounds(soldTeamIds, results, config);
  const currentRound = getCurrentRound(soldTeamIds, results, config);
  const isTournamentComplete = completedRounds.length === config.rounds.length;

  // Build per-participant data
  const byParticipant = new Map<string, { name: string; teams: SoldTeam[] }>();
  for (const sold of soldTeams) {
    if (!byParticipant.has(sold.winnerId)) {
      byParticipant.set(sold.winnerId, { name: sold.winnerName, teams: [] });
    }
    byParticipant.get(sold.winnerId)!.teams.push(sold);
  }

  const entries: LeaderboardEntry[] = [];

  for (const [participantId, { name, teams }] of byParticipant) {
    const totalSpent = teams.reduce((sum, t) => sum + t.amount, 0);
    let totalEarned = 0;
    let eliminatedCost = 0;
    let teamsAlive = 0;
    let teamsEliminated = 0;
    const teamResults: TeamResult[] = [];

    for (const sold of teams) {
      const base = teamMap.get(sold.teamId);
      const { status, roundsWon, eliminatedInRound } = getTeamStatus(
        sold.teamId,
        results,
        config
      );
      const earnings = calculateTeamEarnings(roundsWon, actualPot, payoutRules);
      totalEarned += earnings;

      if (status === 'alive' || status === 'champion') teamsAlive++;
      if (status === 'eliminated') {
        teamsEliminated++;
        eliminatedCost += sold.amount;
      }

      teamResults.push({
        teamId: sold.teamId,
        teamName: base?.name ?? `Team ${sold.teamId}`,
        seed: base?.seed ?? 0,
        group: base?.group ?? '',
        purchasePrice: sold.amount,
        ownerId: sold.winnerId,
        ownerName: sold.winnerName,
        status,
        roundsWon,
        eliminatedInRound,
        earnings,
      });
    }

    // Add prop bet earnings for this participant
    const participantPropEarnings: PropEarning[] = [];
    for (const pr of propResults) {
      if (pr.winnerParticipantId === participantId) {
        const propPayout = actualPot * (pr.payoutPercentage / 100);
        participantPropEarnings.push({
          propKey: pr.key,
          propLabel: pr.label,
          amount: propPayout,
        });
        totalEarned += propPayout;
      }
    }

    entries.push({
      participantId,
      participantName: name,
      totalSpent,
      totalEarned,
      netPL: totalEarned - eliminatedCost, // Only count eliminated teams as losses
      teamsOwned: teams.length,
      teamsAlive,
      teamsEliminated,
      teams: teamResults.sort((a, b) => a.seed - b.seed),
      propEarnings: participantPropEarnings,
    });
  }

  // Sort by net P&L descending
  entries.sort((a, b) => b.netPL - a.netPL);

  return {
    entries,
    actualPot,
    completedRounds,
    currentRound,
    isTournamentComplete,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildResultMap(results: TournamentResult[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of results) {
    map.set(`${r.team_id}:${r.round_key}`, r.result);
  }
  return map;
}
