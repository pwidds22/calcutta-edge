import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import { fullRoundRate } from '@/lib/tournaments/payout-presets';

export interface TeamSettlement {
  teamId: number;
  teamName: string;
  seed: number;
  group: string;
  purchasePrice: number;
  /** Cumulative payout if the team wins through each round */
  roundPayouts: Record<string, number>;
  /** Profit (payout - price) at each round */
  roundProfits: Record<string, number>;
}

export interface ParticipantSettlement {
  participantId: string;
  participantName: string;
  totalOwed: number;
  teamCount: number;
  teams: TeamSettlement[];
}

export interface SettlementSummary {
  /** Actual pot = sum of all winning bids */
  actualPot: number;
  participants: ParticipantSettlement[];
  /** Per round: its label, its full percent-of-pot rate, and that rate in dollars.
   *  `pct`/`amount` are unit-aware (see `fullRoundRate`), so the reference chips
   *  and the matrix below can never quote different numbers for the same round. */
  roundLabels: Array<{ key: string; label: string; pct: number; amount: number }>;
}

/**
 * Calculate settlement data for all participants after an auction completes.
 *
 * Uses the ACTUAL pot (sum of all bids) — not the pre-auction estimate.
 * For each team, computes cumulative round-by-round payouts based on payout rules.
 */
export function calculateSettlement(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  config: TournamentConfig,
  payoutRules: PayoutRules
): SettlementSummary {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);

  // Validate payout rules sum to ~100% (allow small floating point tolerance)
  const totalPct = Object.values(payoutRules).reduce((sum: number, v) => sum + ((v as number) ?? 0), 0);
  if (Math.abs(totalPct - 100) > 1) {
    console.warn(`Settlement: payout rules sum to ${totalPct}%, expected ~100%. Payouts may be inaccurate.`);
  }

  // Group sold teams by participant
  const byParticipant = new Map<string, { name: string; teams: SoldTeam[] }>();
  for (const sold of soldTeams) {
    if (!byParticipant.has(sold.winnerId)) {
      byParticipant.set(sold.winnerId, { name: sold.winnerName, teams: [] });
    }
    byParticipant.get(sold.winnerId)!.teams.push(sold);
  }

  const participants: ParticipantSettlement[] = [];

  for (const [participantId, { name, teams }] of byParticipant) {
    const totalOwed = teams.reduce((sum, t) => sum + t.amount, 0);
    const teamSettlements: TeamSettlement[] = [];

    for (const sold of teams) {
      const baseTeam = teamMap.get(sold.teamId);
      const teamName = baseTeam?.name ?? `Team ${sold.teamId}`;
      const seed = baseTeam?.seed ?? 0;
      const group = baseTeam?.group ?? '';

      let cumulative = 0;
      const roundPayouts: Record<string, number> = {};
      const roundProfits: Record<string, number> = {};

      for (const round of config.rounds) {
        // Unit-aware: a flat-rate per-unit round (NFL wins) stores the price of ONE
        // unit, so adding it once per round undervalues the round by `payoutUnits`.
        // No-op for every round without `payoutUnits`.
        const roundPayout = actualPot * (fullRoundRate(round, payoutRules[round.key] ?? 0) / 100);
        cumulative += roundPayout;
        roundPayouts[round.key] = cumulative;
        roundProfits[round.key] = cumulative - sold.amount;
      }

      teamSettlements.push({
        teamId: sold.teamId,
        teamName,
        seed,
        group,
        purchasePrice: sold.amount,
        roundPayouts,
        roundProfits,
      });
    }

    participants.push({
      participantId,
      participantName: name,
      totalOwed,
      teamCount: teams.length,
      teams: teamSettlements.sort((a, b) => a.seed - b.seed),
    });
  }

  // Sort by total owed descending
  participants.sort((a, b) => b.totalOwed - a.totalOwed);

  return {
    actualPot,
    participants,
    roundLabels: config.rounds.map((r) => {
      const pct = fullRoundRate(r, payoutRules[r.key] ?? 0);
      return { key: r.key, label: r.label, pct, amount: actualPot * (pct / 100) };
    }),
  };
}
