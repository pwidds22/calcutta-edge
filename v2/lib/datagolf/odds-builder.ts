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
 *
 * The DataGolf API is called with odds_format=percent, which returns
 * vigged implied probabilities (0-1). We normalize these to fair
 * probabilities by dividing by the overround.
 */

import type { BaseTeam } from '@/lib/tournaments/types';
import type { DataGolfOddsResponse, DataGolfPreTournamentPlayer, OddsMarket, Sportsbook } from './client';
import { SPORTSBOOKS, formatPlayerName } from './client';

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

/**
 * Devig outright market with expectedWinners.
 * Each player's fair probability = impliedProb * expectedWinners / sum(all implied probs)
 *
 * Input: vigged probabilities from a sportsbook (sum > expectedWinners due to vig).
 * Output: fair probabilities that sum to expectedWinners.
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
 * Extract a probability value from a player odds entry.
 * Handles both number (from percent format) and string ("+485" from american format).
 */
function extractProb(raw: unknown): number | null {
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

/**
 * Build devigged probabilities from a single sportsbook across all markets.
 *
 * Uses the DataGolf model as reference to determine the correct devig target:
 * If a book only has odds for 60 of 91 players for make_cut, the expected
 * winners for that subset = sum of DG model make_cut probs for those 60 players
 * (NOT the full-field 50). This prevents over-inflating probabilities.
 *
 * Players the book doesn't cover get DataGolf model values directly.
 */
function buildBookProbabilities(
  allOdds: Record<OddsMarket, DataGolfOddsResponse>,
  book: Sportsbook,
  dgModelProbs: Map<number, Record<string, number>>
): Map<number, Record<string, number>> {
  const playerProbs = new Map<number, Record<string, number>>();

  for (const [roundKey, market] of Object.entries(ROUND_TO_MARKET)) {
    const oddsData = allOdds[market];
    if (!oddsData) continue;

    // Extract vigged implied probabilities for this book
    const implied = new Map<number, number>();
    for (const player of oddsData.odds) {
      const prob = extractProb((player as Record<string, unknown>)[book]);
      if (prob !== null && prob > 0) {
        implied.set(player.dg_id, prob);
      }
    }

    if (implied.size === 0) continue;

    // Calculate the correct devig target: sum of DG model probs for the
    // subset of players this book actually covers for this market.
    let targetSum = EXPECTED_WINNERS[market]; // fallback
    let dgSubsetSum = 0;
    let dgSubsetCount = 0;
    for (const dgId of implied.keys()) {
      const dgProb = dgModelProbs.get(dgId)?.[roundKey];
      if (dgProb && dgProb > 0) {
        dgSubsetSum += dgProb;
        dgSubsetCount++;
      }
    }
    if (dgSubsetCount > 0) {
      targetSum = dgSubsetSum;
    }

    // Devig using the correct target for this subset
    const fair = devigOutright(implied, targetSum);

    for (const [dgId, fairProb] of fair) {
      const existing = playerProbs.get(dgId) ?? {};
      existing[roundKey] = fairProb;
      playerProbs.set(dgId, existing);
    }
  }

  return playerProbs;
}

// ─── DataGolf Model Builders ─────────────────────────────────────

/**
 * Fallback: extract DataGolf model probabilities from outrights endpoint.
 * These are embedded in each player's `datagolf.baseline_history_fit` field.
 * Already fair probabilities (no vig), but one API call per market.
 */
function buildModelFromOutrights(
  allOdds: Record<OddsMarket, DataGolfOddsResponse>
): Map<number, Record<string, number>> {
  const probs = new Map<number, Record<string, number>>();
  for (const [roundKey, market] of Object.entries(ROUND_TO_MARKET)) {
    const oddsData = allOdds[market];
    if (!oddsData) continue;
    for (const player of oddsData.odds) {
      const val = (player.datagolf as { baseline_history_fit?: number })?.baseline_history_fit;
      if (typeof val === 'number' && val > 0) {
        const existing = probs.get(player.dg_id) ?? {};
        existing[roundKey] = val;
        probs.set(player.dg_id, existing);
      }
    }
  }
  return probs;
}

// ─── DataGolf Model Builder (from pre-tournament endpoint) ──────

/**
 * Build DataGolf model probabilities from the pre-tournament endpoint.
 * These are already fair (no vig) and more accurate than outrights-embedded model values.
 */
function buildPreTournamentSource(
  players: DataGolfPreTournamentPlayer[]
): Map<number, Record<string, number>> {
  const probs = new Map<number, Record<string, number>>();
  for (const p of players) {
    probs.set(p.dg_id, {
      makeCut: p.make_cut ?? 0,
      top20: p.top_20 ?? 0,
      top10: p.top_10 ?? 0,
      top5: p.top_5 ?? 0,
      winner: p.win ?? 0,
    });
  }
  return probs;
}

/**
 * Fill missing round probabilities in a sportsbook source using DataGolf model values.
 * Some books only offer win/top5 but not make_cut/top20 — fill gaps so users don't see 0%.
 */
function fillGapsWithModel(
  bookProbs: Map<number, Record<string, number>>,
  modelProbs: Map<number, Record<string, number>>
): void {
  const roundKeys = ['makeCut', 'top20', 'top10', 'top5', 'winner'];
  for (const [dgId, rounds] of bookProbs) {
    const model = modelProbs.get(dgId);
    if (!model) continue;
    for (const rk of roundKeys) {
      if (!rounds[rk] || rounds[rk] === 0) {
        rounds[rk] = model[rk] ?? 0;
      }
    }
  }
  // Also add players the book doesn't have at all (use model as-is)
  for (const [dgId, model] of modelProbs) {
    if (!bookProbs.has(dgId)) {
      bookProbs.set(dgId, { ...model });
    }
  }

  // Enforce monotonicity: Cut >= T20 >= T10 >= T5 >= Win
  // Mixing devigged book values with DG fallbacks can create inversions on longshots.
  for (const [, rounds] of bookProbs) {
    for (let i = 1; i < roundKeys.length; i++) {
      const higher = roundKeys[i - 1]; // broader tier (e.g. makeCut)
      const lower = roundKeys[i];      // narrower tier (e.g. top20)
      if (rounds[lower] > rounds[higher]) {
        rounds[higher] = rounds[lower]; // cap up to match
      }
    }
  }
}

/**
 * Build all odds sources from DataGolf API data.
 *
 * @param allOdds - Outrights data (for sportsbook odds)
 * @param preTournament - Pre-tournament model predictions (for DataGolf model, already fair)
 */
export function buildAllOddsSources(
  allOdds: Record<OddsMarket, DataGolfOddsResponse>,
  preTournament?: DataGolfPreTournamentPlayer[]
): DevigedOddsSource[] {
  const sources: DevigedOddsSource[] = [];

  // DataGolf model: use pre-tournament data if available (more accurate, all markets).
  // Fallback: extract from outrights embedded model values (less accurate but works).
  const dgModelProbs = preTournament
    ? buildPreTournamentSource(preTournament)
    : buildModelFromOutrights(allOdds);

  sources.push({
    name: 'datagolf_history',
    label: 'DataGolf',
    probabilities: dgModelProbs,
  });

  // Sportsbook sources — devig from outrights (using DG as reference), fill gaps
  for (const book of SPORTSBOOKS) {
    const probs = buildBookProbabilities(allOdds, book, dgModelProbs);
    if (probs.size > 10) { // Skip books with very sparse coverage
      fillGapsWithModel(probs, dgModelProbs);
      sources.push({
        name: book,
        label: formatBookLabel(book),
        probabilities: probs,
      });
    }
  }

  return sources;
}

// ─── dg_id → teamId Mapping ─────────────────────────────────────

/** Normalize a name for fuzzy matching: lowercase, strip accents */
function normalizeName(n: string): string {
  return n.toLowerCase()
    .replace(/[áàäâå]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôø]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ß]/g, 'ss')
    .replace(/[''.\-]/g, '')
    .trim();
}

/**
 * Build a mapping from DataGolf player names to tournament team IDs.
 * Uses the win market player list (most complete) to build the map.
 */
export function buildDgIdToTeamIdMap(
  allOdds: Record<OddsMarket, DataGolfOddsResponse>,
  teams: BaseTeam[]
): Map<number, number> {
  const nameToTeamId = new Map<string, number>();
  for (const t of teams) {
    nameToTeamId.set(normalizeName(t.name), t.id);
  }

  // Also build a last-name-only fallback for partial matches
  const lastNameToTeamId = new Map<string, number>();
  for (const t of teams) {
    const parts = t.name.split(' ');
    const last = normalizeName(parts[parts.length - 1]);
    // Only use last name if unique
    if (lastNameToTeamId.has(last)) {
      lastNameToTeamId.set(last, -1); // Mark as ambiguous
    } else {
      lastNameToTeamId.set(last, t.id);
    }
  }

  const dgIdToTeamId = new Map<number, number>();
  const winOdds = allOdds.win;
  if (!winOdds) return dgIdToTeamId;

  for (const player of winOdds.odds) {
    const dgName = formatPlayerName(player.player_name); // "Last, First" → "First Last"
    const normalized = normalizeName(dgName);

    // Try exact match
    let teamId = nameToTeamId.get(normalized);

    // Try last-name fallback
    if (teamId === undefined) {
      const parts = dgName.split(' ');
      const last = normalizeName(parts[parts.length - 1]);
      const fallback = lastNameToTeamId.get(last);
      if (fallback && fallback > 0) {
        teamId = fallback;
      }
    }

    if (teamId !== undefined) {
      dgIdToTeamId.set(player.dg_id, teamId);
    }
  }

  return dgIdToTeamId;
}

/**
 * Convert a DevigedOddsSource (keyed by dg_id) to OddsSourceProbabilities format (keyed by teamId).
 */
export function mapSourceToTeamIds(
  source: DevigedOddsSource,
  dgIdToTeamId: Map<number, number>
): Record<number, Record<string, number>> {
  const teams: Record<number, Record<string, number>> = {};
  for (const [dgId, probs] of source.probabilities) {
    const teamId = dgIdToTeamId.get(dgId);
    if (teamId !== undefined) {
      teams[teamId] = probs;
    }
  }
  return teams;
}

// ─── Helpers ─────────────────────────────────────────────────────

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

export { formatBookLabel, ROUND_TO_MARKET };
