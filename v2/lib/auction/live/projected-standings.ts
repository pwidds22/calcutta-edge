/**
 * Projected standings — aggregates DataGolf per-player EV into
 * per-participant projected P&L for the Leaderboard tab.
 *
 * When tournament results exist (e.g., cut round settled), blends
 * actual settled earnings with projected EV for unsettled rounds.
 */

import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, PayoutRules } from '@/lib/tournaments/types';
import type { DataGolfInPlayPlayer } from '@/lib/datagolf/client';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import { getPropWinners } from '@/lib/tournaments/props';
import { formatPlayerName } from '@/lib/datagolf/client';
import { normalizeName } from '@/lib/datagolf/ev';
import { getTeamStatus, calculateTeamEarnings, buildPlayInLoserSet, countWinnersPerRound, adjustPayoutRulesForTies, getCompletedRounds } from './actual-payouts';
import type { TournamentConfig } from '@/lib/tournaments/types';

// ─── Types ────────────────────────────────────────────────────────

export interface ProjectedTeam {
  teamId: number;
  teamName: string;
  seed: number;
  group: string;
  purchasePrice: number;
  projectedEV: number | null;
  settledEarnings: number; // round payouts + prop earnings attributed to this team
  blendedEV: number | null; // settled + projected for unsettled rounds
  winProb: number | null;
  propEarnings: number; // prop earnings attributed to this specific team
}

export interface ProjectedEntry {
  participantId: string;
  participantName: string;
  totalSpent: number;
  projectedEarnings: number;
  settledEarnings: number;
  blendedEarnings: number;
  projectedPL: number;
  teamsOwned: number;
  teams: ProjectedTeam[];
}

// ─── Payout tier keys that map to DataGolf probability fields ────

const PAYOUT_TIERS: Array<{ ruleKey: string; probField: keyof DataGolfInPlayPlayer }> = [
  { ruleKey: 'winner', probField: 'win_prob' },
  { ruleKey: 'top5', probField: 'top_5_prob' },
  { ruleKey: 'top10', probField: 'top_10_prob' },
  { ruleKey: 'top20', probField: 'top_20_prob' },
  { ruleKey: 'makeCut', probField: 'make_cut_prob' },
];

// ─── Calculation ─────────────────────────────────────────────────

/**
 * Build a name → DataGolfInPlayPlayer lookup from the in-play data.
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
 * Calculate blended EV for a team:
 * - For settled rounds (team has a 'won' result): use actual payout
 * - For unsettled rounds: use projected prob * pot * pct
 */
function calculateBlendedEV(
  dgPlayer: DataGolfInPlayPlayer,
  actualPot: number,
  payoutRules: PayoutRules,
  settledRoundKeys: Set<string>,
  settledEarnings: number
): number {
  let projectedUnsettled = 0;

  for (const { ruleKey, probField } of PAYOUT_TIERS) {
    // Skip rounds that are already settled — we use actual earnings for those
    if (settledRoundKeys.has(ruleKey)) continue;

    const prob = dgPlayer[probField] as number | undefined;
    const pct = payoutRules[ruleKey];
    if (prob === undefined || prob === null || !pct) continue;
    projectedUnsettled += prob * actualPot * (pct / 100);
  }

  return settledEarnings + projectedUnsettled;
}

/**
 * Calculate projected standings for all participants.
 * Blends settled earnings with projected EV for unsettled rounds.
 */
export function calculateProjectedStandings(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  payoutRules: PayoutRules,
  players: DataGolfInPlayPlayer[],
  results?: TournamentResult[],
  config?: TournamentConfig,
  propResults?: PropResult[]
): ProjectedEntry[] {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const playerMap = buildPlayerMap(players);
  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);

  // Build prop earnings per team (from resolved props with teamId)
  const propEarningsByTeam = new Map<number, number>();
  if (propResults) {
    for (const pr of propResults) {
      const winners = getPropWinners(pr);
      if (winners.length === 0) continue;
      const fullPayout = actualPot * (pr.payoutPercentage / 100);
      const perWinner = fullPayout / winners.length;
      for (const w of winners) {
        if (w.teamId) {
          propEarningsByTeam.set(w.teamId, (propEarningsByTeam.get(w.teamId) ?? 0) + perWinner);
        }
      }
    }
  }

  // Build settled round info per team
  const playInLosers = (config && baseTeams && results)
    ? buildPlayInLoserSet(baseTeams, results, config)
    : new Set<number>();

  // Adjust payout rules for ties (more winners than teamsAdvancing) — but only for
  // COMPLETED rounds. Golf tiers resolve atomically (cut, then final standings), so
  // this is a no-op today; the gate is defensive so a partially-entered round can't
  // hand its whole budget to the few decided winners (the soccer R16 over-credit bug).
  const winnersPerRound = (config && results && results.length > 0)
    ? countWinnersPerRound(soldTeams, results, config, playInLosers)
    : new Map<string, number>();
  const completedRounds = (config && results && results.length > 0)
    ? new Set(getCompletedRounds(soldTeams.map((s) => s.teamId), results, config))
    : new Set<string>();
  const adjustedPayoutRules = (config && winnersPerRound.size > 0)
    ? adjustPayoutRulesForTies(payoutRules, winnersPerRound, config, completedRounds)
    : payoutRules;

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
    let totalSettledEarnings = 0;
    let totalBlendedEarnings = 0;
    const projectedTeams: ProjectedTeam[] = [];

    for (const sold of teams) {
      const base = teamMap.get(sold.teamId);
      const teamName = base?.name ?? `Team ${sold.teamId}`;
      const seed = base?.seed ?? 0;
      const group = base?.group ?? '';

      // Calculate settled earnings for this team (round payouts + prop earnings)
      let roundEarnings = 0;
      const settledRoundKeys = new Set<string>();
      if (config && results && results.length > 0) {
        const teamStatus = getTeamStatus(sold.teamId, results, config, playInLosers);
        roundEarnings = calculateTeamEarnings(teamStatus.roundsWon, actualPot, adjustedPayoutRules);
        for (const rk of teamStatus.roundsWon) {
          settledRoundKeys.add(rk);
        }
      }
      const teamPropEarnings = propEarningsByTeam.get(sold.teamId) ?? 0;
      const settledEarnings = roundEarnings + teamPropEarnings;
      totalSettledEarnings += settledEarnings;

      // Match to DataGolf player
      const dgPlayer = base ? playerMap.get(normalizeName(base.name)) : null;

      // Pure projected EV (all tiers)
      let pureEV: number | null = null;
      if (dgPlayer) {
        let hasAny = false;
        let ev = 0;
        for (const { ruleKey, probField } of PAYOUT_TIERS) {
          const prob = dgPlayer[probField] as number | undefined;
          const pct = payoutRules[ruleKey];
          if (prob === undefined || prob === null || !pct) continue;
          hasAny = true;
          ev += prob * actualPot * (pct / 100);
        }
        if (hasAny) pureEV = ev;
      }

      // Blended EV: settled + projected for unsettled tiers
      let blendedEV: number | null = null;
      if (dgPlayer) {
        blendedEV = calculateBlendedEV(dgPlayer, actualPot, payoutRules, settledRoundKeys, settledEarnings);
      } else if (settledEarnings > 0) {
        blendedEV = settledEarnings;
      }

      if (pureEV !== null) projectedEarnings += pureEV;
      if (blendedEV !== null) totalBlendedEarnings += blendedEV + teamPropEarnings;
      else if (teamPropEarnings > 0) totalBlendedEarnings += teamPropEarnings;

      const winProb = dgPlayer?.win_prob ?? null;

      projectedTeams.push({
        teamId: sold.teamId,
        teamName,
        seed,
        group,
        purchasePrice: sold.amount,
        projectedEV: pureEV,
        settledEarnings,
        blendedEV: blendedEV !== null ? blendedEV + teamPropEarnings : (teamPropEarnings > 0 ? teamPropEarnings : null),
        winProb,
        propEarnings: teamPropEarnings,
      });
    }

    projectedTeams.sort((a, b) => (b.blendedEV ?? b.projectedEV ?? 0) - (a.blendedEV ?? a.projectedEV ?? 0));

    entries.push({
      participantId,
      participantName: name,
      totalSpent,
      projectedEarnings,
      settledEarnings: totalSettledEarnings,
      blendedEarnings: totalBlendedEarnings,
      projectedPL: totalBlendedEarnings - totalSpent,
      teamsOwned: teams.length,
      teams: projectedTeams,
    });
  }

  // Sort by projected P&L descending
  entries.sort((a, b) => b.projectedPL - a.projectedPL);

  return entries;
}
