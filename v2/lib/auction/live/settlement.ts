import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import { roundBudget } from '@/lib/tournaments/payout-presets';
import { calculateRoundProfits } from '@/lib/calculations/profits';

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
  /** Per round: label, and what ONE unit of it pays — the percent of pot and the
   *  dollar figure. Deliberately per-unit, not the round's league-wide budget:
   *  these chips sit above a per-team profit matrix, so "Wins $1.03" (the price
   *  of one win) is the number a host can reason about, where the round's whole
   *  $279.89 budget across all 272 league wins would read as one team's prize.
   *  `unitSuffix` is set only for flat-rate rounds (e.g. "per win"). */
  roundLabels: Array<{
    key: string;
    label: string;
    pct: number;
    amount: number;
    unitSuffix?: string;
  }>;
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

  // Validate payout rules sum to ~100%. Must go through `roundBudget` — a raw
  // sum of the stored rates treats NFL's per-win price (0.1029) as if it were a
  // whole round, so a correct NFL structure totals 26.6% and warns on every
  // settlement. Prop keys have no round entry and count once, as they should.
  const roundByKey = new Map(config.rounds.map((r) => [r.key, r]));
  const totalPct = Object.entries(payoutRules).reduce((sum, [key, v]) => {
    const rate = (v as number) ?? 0;
    const round = roundByKey.get(key);
    return sum + (round ? roundBudget(round, rate) : rate);
  }, 0);
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

      // Single source of truth for round-type-aware cumulative math (see
      // `lib/calculations/profits.ts`). The inline left-to-right sum this
      // replaces was wrong twice over for NFL: it added the Division bonus
      // into every later column (a wild card reaches the Super Bowl without
      // winning its division), and it priced the per-win round at the
      // LEAGUE-WIDE budget (rate x 272 = 28% of the pot) as if one team could
      // collect all 272 wins — ~32x what any single team earns.
      //
      // `probabilities` (not the devig pipeline) is the unit source on purpose:
      // it is read ONLY for a flat-rate round, NFL's config carries it already
      // pre-normalized to the round's 272-win target, and going through
      // `initializeTeams` here would make this render path throw for any team
      // whose stored `teamSnapshot` lacks `americanOdds`. Absent odds fall back
      // to one unit, which is the pre-NFL behaviour for every other sport.
      const roundProfits = calculateRoundProfits(
        sold.amount,
        payoutRules,
        actualPot,
        config,
        baseTeam?.probabilities
      );
      // Payout is profit plus what they paid — kept in lockstep by construction.
      const roundPayouts: Record<string, number> = {};
      for (const round of config.rounds) {
        roundPayouts[round.key] = (roundProfits[round.key] ?? 0) + sold.amount;
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
      // The stored rate IS the per-unit rate. For every round without
      // `payoutUnits` this is also the whole round (one payout per team), so
      // only NFL's per-win round is affected — and there the unit is one win.
      const pct = payoutRules[r.key] ?? 0;
      return {
        key: r.key,
        label: r.label,
        pct,
        amount: actualPot * (pct / 100),
        ...(r.flatRate ? { unitSuffix: `per ${r.unitLabel ?? 'unit'}` } : {}),
      };
    }),
  };
}
