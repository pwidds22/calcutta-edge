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
  getCompletedRounds,
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

  // Rounds DECIDED for each team (won OR lost). A round is never re-projected once
  // resolved — including a LOST parallel winGroup, which getTeamStatus.roundsWon omits
  // (it records only wins). Without this, every non-group-winner would get phantom
  // winGroup EV projected on top of its actual (zero) winGroup earnings.
  const decidedByTeam = new Map<number, Set<string>>();
  for (const r of results) {
    if (r.result === 'won' || r.result === 'lost') {
      if (!decidedByTeam.has(r.team_id)) decidedByTeam.set(r.team_id, new Set());
      decidedByTeam.get(r.team_id)!.add(r.round_key);
    }
  }

  const playInLosers = results.length ? buildPlayInLoserSet(baseTeams, results, config) : new Set<number>();
  const winnersPerRound = results.length
    ? countWinnersPerRound(soldTeams, results, config, playInLosers)
    : new Map<string, number>();
  // Only redistribute a round's budget among its winners once the round is COMPLETE.
  // Mid-round, the tie adjustment would hand the few already-decided winners the whole
  // tier budget (a lone R32 winner → the entire 16-slot R16 budget), while the pending
  // slots are ALSO covered by the roundScale projection below — double-counting the pot.
  // Completed rounds settle normally; in-progress rounds pay base pct and project the rest.
  const completedRounds = results.length
    ? new Set(getCompletedRounds(soldTeams.map((s) => s.teamId), results, config))
    : new Set<string>();
  const adjustedPayoutRules = winnersPerRound.size
    ? adjustPayoutRulesForTies(payoutRules, winnersPerRound, config, completedRounds)
    : payoutRules;

  // Team status (alive / eliminated / champion), computed once and reused.
  const statusByTeam = new Map<number, 'alive' | 'eliminated' | 'champion'>();
  const roundsWonByTeam = new Map<number, string[]>();
  if (results.length) {
    for (const s of soldTeams) {
      const ts = getTeamStatus(s.teamId, results, config, playInLosers);
      statusByTeam.set(s.teamId, ts.status);
      roundsWonByTeam.set(s.teamId, ts.roundsWon);
    }
  }
  const statusOf = (teamId: number) => statusByTeam.get(teamId) ?? 'alive';

  // Per-round normalization so the projection CONSERVES the pot (per-person nets
  // sum to zero). Among the teams that will project a round (alive + round not yet
  // decided for them), their devigged odds should sum to the round's remaining
  // slots — e.g. exactly 16 of the 32 group-stage survivors reach R16. Two reasons
  // the raw odds fall short: the devig only strips vig (never scales up), and
  // eliminated teams keep stale future-round probability mass that gets discarded
  // (they project 0). Scale each round's projected odds to its remaining target =
  // teamsAdvancing − (teams that already WON it).
  const roundOddsSum: Record<string, number> = {};
  for (const round of config.rounds) roundOddsSum[round.key] = 0;
  for (const s of soldTeams) {
    const valuedTeam = valuedById.get(s.teamId);
    if (!valuedTeam) continue;
    const decided = decidedByTeam.get(s.teamId);
    const status = statusOf(s.teamId);
    for (const round of config.rounds) {
      if (decided?.has(round.key)) continue;
      if (status === 'eliminated' && !round.parallel) continue;
      roundOddsSum[round.key] += valuedTeam.odds[round.key] ?? 0;
    }
  }
  const roundScale: Record<string, number> = {};
  for (const round of config.rounds) {
    const remainingSlots = Math.max(0, round.teamsAdvancing - (winnersPerRound.get(round.key) ?? 0));
    const sum = roundOddsSum[round.key];
    roundScale[round.key] = sum > 1e-9 ? remainingSlots / sum : 1;
  }

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

      // Settled earnings (won rounds only pay) + alive/eliminated status (precomputed).
      const status = statusOf(sold.teamId);
      const roundEarnings = results.length
        ? calculateTeamEarnings(roundsWonByTeam.get(sold.teamId) ?? [], actualPot, adjustedPayoutRules)
        : 0;
      const decidedRoundKeys = decidedByTeam.get(sold.teamId) ?? new Set<string>();
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
          if (decidedRoundKeys.has(round.key)) continue; // resolved (won→settled, lost→0); never re-project
          if (status === 'eliminated' && !round.parallel) continue; // dead team can't reach future ladder rounds
          // roundValues[k] = odds[k] × payoutPct/100; scale normalizes the round to
          // its remaining slots so the projection conserves the pot.
          projectedUnsettled += (valuedTeam.roundValues[round.key] ?? 0) * actualPot * roundScale[round.key];
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
        status,
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
