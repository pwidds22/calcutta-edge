/**
 * Soccer projected standings — the World Cup twin of projected-standings.ts.
 *
 * Per-team expected value comes from the SAME machinery the strategy tool uses:
 * initializeTeams() devigs the (Kalshi) probabilities and calculateTeamValues
 * fills team.roundValues[k] = odds[k] × payoutPct/100 and team.fairValue = pot × Σ.
 * We then blend with actual results: rounds a team has already won pay their real
 * amount; still-open rounds project; an eliminated team's remaining LADDER rounds
 * project 0 (it can't reach them), while a parallel bonus round (winGroup) is
 * scored independently. Joins by teamId — no name matching needed (unlike golf).
 */

import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, PayoutRules, TournamentConfig } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import { getPropWinners } from '@/lib/tournaments/props';
import { initializeTeams } from '@/lib/calculations/initialize';
import {
  getTeamStatus,
  calculateTeamEarnings,
  buildPlayInLoserSet,
  countWinnersPerRound,
  adjustPayoutRulesForTies,
} from './actual-payouts';
import type { ProjectedEntry, ProjectedTeam } from './projected-standings';

export function calculateSoccerProjectedStandings(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  payoutRules: PayoutRules,
  config: TournamentConfig,
  results: TournamentResult[] = [],
  propResults: PropResult[] = []
): ProjectedEntry[] {
  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);

  // Per-team devigged round values + fair value (odds → value via payout rules).
  const valued = initializeTeams(baseTeams, [], payoutRules, actualPot, config);
  const valuedById = new Map(valued.map((t) => [t.id, t]));
  const baseById = new Map(baseTeams.map((t) => [t.id, t]));

  // Prop earnings per team (mirror golf).
  const propEarningsByTeam = new Map<number, number>();
  for (const pr of propResults) {
    const winners = getPropWinners(pr);
    if (!winners.length) continue;
    const perWinner = (actualPot * (pr.payoutPercentage / 100)) / winners.length;
    for (const w of winners) {
      if (w.teamId) {
        propEarningsByTeam.set(w.teamId, (propEarningsByTeam.get(w.teamId) ?? 0) + perWinner);
      }
    }
  }

  const playInLosers = results.length ? buildPlayInLoserSet(baseTeams, results, config) : new Set<number>();
  const winnersPerRound = results.length
    ? countWinnersPerRound(soldTeams, results, config, playInLosers)
    : new Map<string, number>();
  const adjustedPayoutRules = winnersPerRound.size
    ? adjustPayoutRulesForTies(payoutRules, winnersPerRound, config)
    : payoutRules;

  const byParticipant = new Map<string, { name: string; teams: SoldTeam[] }>();
  for (const s of soldTeams) {
    if (!byParticipant.has(s.winnerId)) byParticipant.set(s.winnerId, { name: s.winnerName, teams: [] });
    byParticipant.get(s.winnerId)!.teams.push(s);
  }

  const entries: ProjectedEntry[] = [];
  for (const [participantId, { name, teams }] of byParticipant) {
    const totalSpent = teams.reduce((sum, t) => sum + t.amount, 0);
    let projectedEarnings = 0;
    let totalSettledEarnings = 0;
    let totalBlendedEarnings = 0;
    const projectedTeams: ProjectedTeam[] = [];

    for (const sold of teams) {
      const base = baseById.get(sold.teamId);
      const valuedTeam = valuedById.get(sold.teamId);
      const teamName = base?.name ?? `Team ${sold.teamId}`;

      // Settled earnings + alive/eliminated status from real results.
      let roundEarnings = 0;
      const settledRoundKeys = new Set<string>();
      let status: 'alive' | 'eliminated' | 'champion' = 'alive';
      if (results.length) {
        const ts = getTeamStatus(sold.teamId, results, config, playInLosers);
        roundEarnings = calculateTeamEarnings(ts.roundsWon, actualPot, adjustedPayoutRules);
        ts.roundsWon.forEach((rk) => settledRoundKeys.add(rk));
        status = ts.status;
      }
      const teamProp = propEarningsByTeam.get(sold.teamId) ?? 0;
      const settledEarnings = roundEarnings + teamProp;
      totalSettledEarnings += settledEarnings;

      // Pure projected EV (all rounds, ignoring results) — the pre-tournament fair value.
      const pureEV: number | null = valuedTeam ? (valuedTeam.fairValue ?? 0) : null;

      // Blended EV: settled rounds use actuals; unsettled rounds project. An eliminated
      // team's remaining LADDER rounds project 0; parallel rounds (winGroup) still project.
      let projectedUnsettled = 0;
      if (valuedTeam) {
        for (const round of config.rounds) {
          if (settledRoundKeys.has(round.key)) continue;
          if (status === 'eliminated' && !round.parallel) continue;
          projectedUnsettled += (valuedTeam.roundValues[round.key] ?? 0) * actualPot;
        }
      }
      const blendedEV = settledEarnings + projectedUnsettled;

      if (pureEV !== null) projectedEarnings += pureEV;
      totalBlendedEarnings += blendedEV;

      projectedTeams.push({
        teamId: sold.teamId,
        teamName,
        seed: base?.seed ?? 0,
        group: base?.group ?? '',
        purchasePrice: sold.amount,
        projectedEV: pureEV,
        settledEarnings,
        blendedEV,
        winProb: valuedTeam?.odds['champion'] ?? null,
        propEarnings: teamProp,
      });
    }

    projectedTeams.sort((a, b) => (b.blendedEV ?? 0) - (a.blendedEV ?? 0));
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

  entries.sort((a, b) => b.projectedPL - a.projectedPL);
  return entries;
}
