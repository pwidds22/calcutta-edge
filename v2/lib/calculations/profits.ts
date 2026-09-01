import type { PayoutRules, RoundKey, TournamentConfig } from './types';

/**
 * Round-by-round profit projections for the strategy table / live overlay.
 *
 * Not every round is a rung on one elimination ladder, so "cumulative payout
 * through column X" is computed per round TYPE (caught 2026-09-01: NFL's
 * Playoff column silently included the Division payout, and the Wins column
 * showed the price of exactly ONE win):
 *
 * - flatRate rounds (NFL regular-season wins) pay per unit, all season, in
 *   every scenario. The column shows the team's EXPECTED payout
 *   (pot × rate × expected units from `odds`), and that expectation is
 *   baseline income included in every later column — a Super Bowl team still
 *   collected its win money. Falls back to 1 unit when `odds` is absent.
 * - parallel non-flatRate rounds (NFL division winner, World Cup group
 *   winner) are qualification honors OUTSIDE the ladder. Winning one implies
 *   qualifying for the first ladder rung (division winners make the playoffs;
 *   group winners advance), so the column shows baseline + own payout + first
 *   rung. It does NOT accumulate into later columns — a wild-card team can
 *   reach the Super Bowl without ever winning its division.
 * - ladder rounds accumulate normally: baseline + ladder payouts so far.
 *
 * Every column subtracts the purchase price. Configs with no parallel or
 * flatRate rounds (March Madness, golf) reduce exactly to the old simple
 * cumulative.
 */
export function calculateRoundProfits(
  purchasePrice: number,
  payoutRules: PayoutRules,
  potSize: number,
  config: TournamentConfig,
  odds?: Record<string, number>
): Record<RoundKey, number> {
  const price = purchasePrice || 0;
  const profits: Record<string, number> = {};

  const roundPayout = (key: string) => potSize * ((payoutRules[key] ?? 0) / 100);
  const firstLadderKey = config.rounds.find((r) => !r.parallel)?.key;
  const firstLadderPayout = firstLadderKey ? roundPayout(firstLadderKey) : 0;

  let baseline = 0; // expected flatRate income, earned in every scenario
  let ladderCumulative = 0;

  for (const round of config.rounds) {
    if (round.flatRate) {
      baseline += roundPayout(round.key) * (odds?.[round.key] ?? 1);
      profits[round.key] = baseline - price;
    } else if (round.parallel) {
      profits[round.key] = baseline + roundPayout(round.key) + firstLadderPayout - price;
    } else {
      ladderCumulative += roundPayout(round.key);
      profits[round.key] = baseline + ladderCumulative - price;
    }
  }

  return profits;
}
