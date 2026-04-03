/**
 * DataGolf Odds Builder — converts sportsbook odds from DataGolf API
 * into devigged fair probabilities for the strategy tool.
 *
 * Golf uses 'global' devigging: normalize all players in a market so
 * probabilities sum to the expected number of winners.
 *
 * Markets and expected winners:
 * - make_cut: ~50 (top 50 + ties at Augusta)
 * - top_20: 20
 * - top_10: 10
 * - top_5: 5
 * - win: 1
 */

import type { DataGolfOddsResponse, OddsMarket, Sportsbook } from './client';
import { SPORTSBOOKS } from './client';

// ─── Types ────────────────────────────────────────────────────────

/** Maps round keys (makeCut, top20, etc.) to DataGolf market names */
const ROUND_TO_MARKET: Record<string, OddsMarket> = {
  makeCut: 'make_cut',
  top20: 'top_20',
  top10: 'top_10',
  top5: 'top_5',
  winner: 'win',
};

/** Expected number of "winners" per market (for outright devigging) */
const EXPECTED_WINNERS: Record<OddsMarket, number> = {
  make_cut: 50,
  top_20: 20,
  top_10: 10,
  top_5: 5,
  win: 1,
};

export interface DevigedOddsSource {
  name: string;
  label: string;
  /** Map of dg_id → probabilities per round */
  probabilities: Map<number, Record<string, number>>;
}

// ─── Core Devigging ───────────────────────────────────────────────

/** Convert American odds to implied probability (0-1) */
function americanToImplied(odds: number): number {
  if (odds === 0) return 0;
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/**
 * Devig outright market with expectedWinners.
 * Each player's fair probability = impliedProb * expectedWinners / sum(all implied probs)
 */
function devigOutright(
  impliedProbs: Map<number, number>,
  expectedWinners: number
): Map<number, number> {
  const total = Array.from(impliedProbs.values()).reduce((s, v) => s + v, 0);
  if (total === 0) return impliedProbs;

  const scale = expectedWinners / total;
  const devigged = new Map<number, number>();
  for (const [id, prob] of impliedProbs) {
    devigged.set(id, Math.min(prob * scale, 1)); // Cap at 1.0
  }
  return devigged;
}

// ─── Source Builders ──────────────────────────────────────────────

/**
 * Build devigged probabilities from a single sportsbook across all markets.
 */
function buildBookProbabilities(
  allOdds: Record<OddsMarket, DataGolfOddsResponse>,
  book: Sportsbook | 'datagolf_baseline' | 'datagolf_history'
): Map<number, Record<string, number>> {
  const playerProbs = new Map<number, Record<string, number>>();

  for (const [roundKey, market] of Object.entries(ROUND_TO_MARKET)) {
    const oddsData = allOdds[market];
    if (!oddsData) continue;

    // Extract implied probabilities for this book
    const implied = new Map<number, number>();
    for (const player of oddsData.odds) {
      let odds: number | null = null;

      if (book === 'datagolf_baseline') {
        odds = (player.datagolf as { baseline: number })?.baseline ?? null;
      } else if (book === 'datagolf_history') {
        odds = (player.datagolf as { baseline_history_fit: number })?.baseline_history_fit ?? null;
      } else {
        const raw = (player as Record<string, unknown>)[book];
        odds = typeof raw === 'number' ? raw : null;
      }

      if (odds !== null && odds !== 0) {
        implied.set(player.dg_id, americanToImplied(odds));
      }
    }

    if (implied.size === 0) continue;

    // Devig with expected winners
    const devigged = devigOutright(implied, EXPECTED_WINNERS[market]);

    // Merge into player records
    for (const [dgId, prob] of devigged) {
      const existing = playerProbs.get(dgId) ?? {};
      existing[roundKey] = prob;
      playerProbs.set(dgId, existing);
    }
  }

  return playerProbs;
}

/**
 * Build all odds sources from DataGolf API data.
 * Returns an array of named sources, each with devigged probabilities per player.
 */
export function buildAllOddsSources(
  allOdds: Record<OddsMarket, DataGolfOddsResponse>
): DevigedOddsSource[] {
  const sources: DevigedOddsSource[] = [];

  // DataGolf model sources
  sources.push({
    name: 'datagolf_baseline',
    label: 'DataGolf Model',
    probabilities: buildBookProbabilities(allOdds, 'datagolf_baseline'),
  });

  sources.push({
    name: 'datagolf_history',
    label: 'DataGolf (Course Fit)',
    probabilities: buildBookProbabilities(allOdds, 'datagolf_history'),
  });

  // Sportsbook sources — only include books that have data
  for (const book of SPORTSBOOKS) {
    const probs = buildBookProbabilities(allOdds, book);
    if (probs.size > 10) { // Skip books with very sparse coverage
      sources.push({
        name: book,
        label: formatBookLabel(book),
        probabilities: probs,
      });
    }
  }

  return sources;
}

function formatBookLabel(book: Sportsbook): string {
  const labels: Record<string, string> = {
    bet365: 'Bet365',
    betcris: 'BetCRIS',
    betonline: 'BetOnline',
    betmgm: 'BetMGM',
    betway: 'Betway',
    bovada: 'Bovada',
    caesars: 'Caesars',
    draftkings: 'DraftKings',
    fanduel: 'FanDuel',
    pinnacle: 'Pinnacle',
    skybet: 'Sky Bet',
    williamhill: 'William Hill',
    unibet: 'Unibet',
  };
  return labels[book] ?? book;
}
