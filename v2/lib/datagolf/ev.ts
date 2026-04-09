/**
 * Shared EV (expected value) calculation and name normalization utilities.
 * Used by both golf-leaderboard.tsx (per-player EV) and projected-standings.ts (per-participant EV).
 */

import type { DataGolfInPlayPlayer } from './client';
import type { PayoutRules } from '@/lib/tournaments/types';

/**
 * Calculate live expected value from DataGolf probabilities and session payout rules.
 * EV = sum(prob[tier] * pot * payoutPct[tier]) for each tier.
 */
export function calculateLiveEV(
  player: DataGolfInPlayPlayer,
  actualPot: number,
  payoutRules: PayoutRules
): number | null {
  const probMap: Array<[string, number | undefined]> = [
    ['winner', player.win_prob],
    ['top5', player.top_5_prob],
    ['top10', player.top_10_prob],
    ['top20', player.top_20_prob],
    ['makeCut', player.make_cut_prob],
  ];

  let hasAnyProb = false;
  let ev = 0;

  for (const [ruleKey, prob] of probMap) {
    if (prob === undefined || prob === null) continue;
    const pct = payoutRules[ruleKey];
    if (pct === undefined || pct === 0) continue;
    hasAnyProb = true;
    ev += prob * actualPot * (pct / 100);
  }

  return hasAnyProb ? ev : null;
}

/** Normalize a name for matching: lowercase, strip accents (incl. Scandinavian å/ø) */
export function normalizeName(n: string): string {
  return n.toLowerCase()
    .replace(/[áàäâå]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôø]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ß]/g, 'ss')
    .replace(/['']/g, '')
    .trim();
}
