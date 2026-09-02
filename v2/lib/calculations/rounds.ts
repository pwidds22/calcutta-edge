import type { PayoutRules, RoundConfig, TournamentConfig } from './types';

/**
 * The rounds a league actually pays for.
 *
 * A tournament config lists every round the sport HAS; a league's payout rules
 * decide which of them are worth anything. Those are different questions, and
 * the strategy surfaces were answering the first when the reader wanted the
 * second: an NFL league paying only for wins, division titles and playoff
 * berths still displayed "Div Rd 45.38% / Conf Ch 23.07% / SB 15.05% /
 * Champ 7.11%" beside its fair value, in the same styling as the rounds that
 * pay. The numbers were only probabilities and contributed exactly $0 to fair
 * value (`calculateTeamValues` multiplies each round's odds by its rate), but
 * nothing on screen said so — an owner reasonably reads four more percentages
 * next to a dollar figure as four more ways to get paid.
 *
 * Filter DISPLAY lists with this. Do NOT filter the config before handing it to
 * `calculateRoundProfits` or `calculateTeamValues` — both walk the full round
 * list to build their ladder and baseline, and a zero-rate round already
 * contributes zero on its own.
 *
 * Falls back to every round when nothing pays at all. That state means the
 * league is unconfigured rather than season-only, and blanking the entire strip
 * would hide the data that makes the problem diagnosable.
 */
export function payingRounds(
  config: TournamentConfig | null | undefined,
  payoutRules: PayoutRules | null | undefined
): RoundConfig[] {
  const rounds = config?.rounds ?? [];
  if (!payoutRules) return rounds;
  const paying = rounds.filter((round) => (payoutRules[round.key] ?? 0) > 0);
  return paying.length > 0 ? paying : rounds;
}
