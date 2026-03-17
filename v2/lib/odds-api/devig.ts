/**
 * Devig utilities for sportsbook odds.
 * Sportsbook odds include "vig" (commission). We remove it to get fair probabilities.
 */

/**
 * Devig a set of outright/futures decimal odds.
 * For an outright market (e.g., 68 teams to win championship):
 * 1. Convert each decimal odds → implied probability: 1/odds
 * 2. Sum all implied probabilities (> 1 due to vig)
 * 3. Fair probability = implied / sum (normalize to 1)
 */
export function devigOutrightMarket(
  outcomes: Array<{ name: string; decimalOdds: number }>
): Array<{ name: string; fairProbability: number }> {
  const implied = outcomes.map((o) => ({
    name: o.name,
    impliedProb: 1 / o.decimalOdds,
  }));

  const totalImplied = implied.reduce((sum, o) => sum + o.impliedProb, 0);
  if (totalImplied === 0) return [];

  return implied.map((o) => ({
    name: o.name,
    fairProbability: o.impliedProb / totalImplied,
  }));
}

/**
 * Devig a binary YES/NO futures market.
 * E.g., "Arizona to reach Sweet 16: Yes 1.090 / No 7.670"
 */
export function devigBinaryMarket(
  yesDecimalOdds: number,
  noDecimalOdds: number
): number {
  const impliedYes = 1 / yesDecimalOdds;
  const impliedNo = 1 / noDecimalOdds;
  return impliedYes / (impliedYes + impliedNo);
}
