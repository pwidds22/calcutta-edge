/**
 * Unified devigging pipeline for sportsbook American odds.
 *
 * Converts raw American odds from FanDuel, DraftKings, and Pinnacle
 * into fair probabilities (0-1 scale) in OddsSourceProbabilities format.
 *
 * Supports multiple devig methods:
 *  - Matchup (2-way moneyline)
 *  - Binary (YES/NO market)
 *  - Outright (futures market with many outcomes)
 *  - YES-only (single side with estimated overround)
 */

import type { OddsSourceProbabilities } from './odds-sources';
import { MARCH_MADNESS_2026_TEAMS } from './configs/march-madness-2026';
import { FANDUEL_2026, type FDRawBinaryOdds } from './data/fanduel-2026';
import { DRAFTKINGS_2026 } from './data/draftkings-2026';
import { PINNACLE_2026, type PinnacleS16Odds } from './data/pinnacle-2026';

// ── Round ordering (earliest to latest) ──────────────────────────────
const ROUND_KEYS = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'] as const;

// Probability bounds — avoid exact 0 and 1
const PROB_MIN = 0.0001;
const PROB_MAX = 0.999;

// ── Core devig functions ─────────────────────────────────────────────

/** Convert American odds to implied probability */
export function americanToImplied(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Devig a 2-way matchup (e.g., R64 game moneyline) */
export function devigMatchup(oddsA: number, oddsB: number): [number, number] {
  const implA = americanToImplied(oddsA);
  const implB = americanToImplied(oddsB);
  const total = implA + implB;
  return [implA / total, implB / total];
}

/** Devig a binary YES/NO market */
export function devigBinary(yesOdds: number, noOdds: number): number {
  const implYes = americanToImplied(yesOdds);
  const implNo = americanToImplied(noOdds);
  return implYes / (implYes + implNo);
}

/**
 * Devig an outright/futures market (many teams, one round).
 * For mutually exclusive outcomes (one winner), expectedWinners = 1.
 * For reach-round markets (e.g., "reach S16" where 16 teams qualify),
 * set expectedWinners to the number of teams that actually advance.
 *
 * Formula: fairProb = impliedProb × expectedWinners / sumAllImplied
 * When expectedWinners = 1, this is standard outright normalization.
 */
export function devigOutright(
  odds: Record<number, number>,
  expectedWinners: number = 1
): Record<number, number> {
  const implied: Record<number, number> = {};
  let total = 0;
  for (const [id, o] of Object.entries(odds)) {
    const imp = americanToImplied(o);
    implied[Number(id)] = imp;
    total += imp;
  }
  const result: Record<number, number> = {};
  for (const [id, imp] of Object.entries(implied)) {
    result[Number(id)] = total > 0 ? (imp * expectedWinners) / total : 0;
  }
  return result;
}

/** Estimate average overround from markets that have both YES and NO sides */
export function estimateAvgOverround(markets: Array<{ yes: number; no: number }>): number {
  if (markets.length === 0) return 1.05; // sensible default
  let totalOverround = 0;
  for (const m of markets) {
    totalOverround += americanToImplied(m.yes) + americanToImplied(m.no);
  }
  return totalOverround / markets.length;
}

/** Devig a YES-only market using estimated overround */
export function devigYesOnly(yesOdds: number, avgOverround: number): number {
  return americanToImplied(yesOdds) / avgOverround;
}

// ── Utility helpers ──────────────────────────────────────────────────

/** Clamp a probability to [PROB_MIN, PROB_MAX] */
function clamp(p: number): number {
  return Math.min(PROB_MAX, Math.max(PROB_MIN, p));
}

/** Build Evan Miya lookup: teamId -> { roundKey -> prob } */
function getEvanMiyaLookup(): Record<number, Record<string, number>> {
  const lookup: Record<number, Record<string, number>> = {};
  for (const t of MARCH_MADNESS_2026_TEAMS) {
    if (t.probabilities) {
      lookup[t.id] = { ...t.probabilities };
    }
  }
  return lookup;
}

/**
 * Interpolate a missing round probability using Evan Miya model ratios.
 * missingRoundProb = anchorProb * (evanMiya[missingRound] / evanMiya[anchorRound])
 */
function interpolateFromEvanMiya(
  teamId: number,
  missingRound: string,
  anchorRound: string,
  anchorProb: number,
  evanMiya: Record<number, Record<string, number>>
): number {
  const em = evanMiya[teamId];
  if (!em) return PROB_MIN;
  const emAnchor = em[anchorRound] || 0;
  const emMissing = em[missingRound] || 0;
  if (emAnchor <= 0) return PROB_MIN;
  return anchorProb * (emMissing / emAnchor);
}

/**
 * Find the nearest available round to use as interpolation anchor.
 * Prefers the closest round by index in ROUND_KEYS.
 */
function findNearestRound(
  available: Set<string>,
  targetRound: string
): string | null {
  const targetIdx = ROUND_KEYS.indexOf(targetRound as typeof ROUND_KEYS[number]);
  if (targetIdx === -1) return null;

  let bestRound: string | null = null;
  let bestDist = Infinity;
  for (const rk of available) {
    const idx = ROUND_KEYS.indexOf(rk as typeof ROUND_KEYS[number]);
    if (idx === -1) continue;
    const dist = Math.abs(idx - targetIdx);
    if (dist < bestDist) {
      bestDist = dist;
      bestRound = rk;
    }
  }
  return bestRound;
}

/**
 * Enforce monotonic decrease: each later round prob <= previous round prob.
 * Walks from r32 forward, capping each round at the prior round's value.
 */
function enforceMonotonic(probs: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  let prev = 1.0;
  for (const rk of ROUND_KEYS) {
    const p = probs[rk];
    if (p === undefined) continue;
    const clamped = clamp(Math.min(p, prev));
    result[rk] = clamped;
    prev = clamped;
  }
  return result;
}

/**
 * Fill missing rounds for a team using Evan Miya interpolation,
 * then enforce monotonic decrease and clamp.
 */
function fillAndClamp(
  teamId: number,
  knownProbs: Record<string, number>,
  evanMiya: Record<number, Record<string, number>>
): Record<string, number> {
  const filled: Record<string, number> = {};
  const available = new Set(Object.keys(knownProbs));

  for (const rk of ROUND_KEYS) {
    if (knownProbs[rk] !== undefined) {
      filled[rk] = knownProbs[rk];
    } else {
      // Interpolate from nearest available round
      const anchor = findNearestRound(available, rk);
      if (anchor && knownProbs[anchor] !== undefined) {
        filled[rk] = interpolateFromEvanMiya(
          teamId, rk, anchor, knownProbs[anchor], evanMiya
        );
      } else {
        // Fallback: use Evan Miya directly
        filled[rk] = evanMiya[teamId]?.[rk] ?? PROB_MIN;
      }
    }
  }

  return enforceMonotonic(filled);
}

// ── All team IDs ─────────────────────────────────────────────────────

function getAllTeamIds(): number[] {
  return MARCH_MADNESS_2026_TEAMS.map((t) => t.id);
}

// ── FanDuel Builder ──────────────────────────────────────────────────

export function buildFanDuelProbabilities(): OddsSourceProbabilities {
  const evanMiya = getEvanMiyaLookup();
  const teamIds = getAllTeamIds();
  const teams: Record<number, Record<string, number>> = {};

  // r32: matchup devig
  const r32Probs: Record<number, number> = {};
  for (const m of FANDUEL_2026.r32Matchups) {
    const [pA, pB] = devigMatchup(m.teamAOdds, m.teamBOdds);
    r32Probs[m.teamAId] = pA;
    r32Probs[m.teamBId] = pB;
  }

  // s16/e8/f4: binary devig with overround estimation for YES-only
  function devigBinaryRound(
    roundData: Record<number, FDRawBinaryOdds>
  ): Record<number, number> {
    const probs: Record<number, number> = {};
    // Collect markets with both sides for overround estimation
    const pairedMarkets: Array<{ yes: number; no: number }> = [];
    for (const [, entry] of Object.entries(roundData)) {
      if (entry.no !== null) {
        pairedMarkets.push({ yes: entry.yes, no: entry.no });
      }
    }
    const avgOverround = estimateAvgOverround(pairedMarkets);

    for (const [id, entry] of Object.entries(roundData)) {
      const teamId = Number(id);
      if (entry.no !== null) {
        probs[teamId] = devigBinary(entry.yes, entry.no);
      } else {
        probs[teamId] = devigYesOnly(entry.yes, avgOverround);
      }
    }
    return probs;
  }

  const s16Probs = devigBinaryRound(FANDUEL_2026.s16);
  const e8Probs = devigBinaryRound(FANDUEL_2026.e8);
  const f4Probs = devigBinaryRound(FANDUEL_2026.f4);

  // f2: reach-round devig (2 teams reach championship game)
  const f2Probs = devigOutright(FANDUEL_2026.f2 as Record<number, number>, 2);

  // champ: outright devig (1 winner)
  const champProbs = devigOutright(FANDUEL_2026.champ as Record<number, number>, 1);

  // Assemble per-team, fill missing, enforce monotonic
  for (const teamId of teamIds) {
    const known: Record<string, number> = {};
    if (r32Probs[teamId] !== undefined) known.r32 = r32Probs[teamId];
    if (s16Probs[teamId] !== undefined) known.s16 = s16Probs[teamId];
    if (e8Probs[teamId] !== undefined) known.e8 = e8Probs[teamId];
    if (f4Probs[teamId] !== undefined) known.f4 = f4Probs[teamId];
    if (f2Probs[teamId] !== undefined) known.f2 = f2Probs[teamId];
    if (champProbs[teamId] !== undefined) known.champ = champProbs[teamId];
    teams[teamId] = fillAndClamp(teamId, known, evanMiya);
  }

  return { teams, updatedAt: FANDUEL_2026.updatedAt };
}

// ── Matchup pairs for R32 (used by DraftKings which provides individual moneylines) ──
// Pairs: [teamAId, teamBId] — derived from the bracket
const R32_MATCHUP_PAIRS: Array<[number, number]> = [
  [4, 3],    // TCU vs Ohio State
  [42, 41],  // Troy vs Nebraska
  [10, 9],   // South Florida vs Louisville
  [22, 21],  // High Point vs Wisconsin
  [2, 1],    // Siena vs Duke
  [40, 39],  // McNeese vs Vanderbilt
  [12, 11],  // North Dakota State vs Michigan State
  [24, 23],  // Hawaii vs Arkansas
  [44, 43],  // VCU vs North Carolina
  [48, 47],  // Texas A&M vs Saint Mary's
  [46, 45],  // Penn vs Illinois
  [55, 54],  // Saint Louis vs Georgia
  [29, 28],  // Kennesaw State vs Gonzaga
  [50, 49],  // Idaho vs Houston
  [66, 65],  // Santa Clara vs Kentucky
  [57, 56],  // Akron vs Texas Tech
  [18, 17],  // Long Island vs Arizona
  [64, 63],  // Wright State vs Virginia
  [68, 67],  // Tennessee State vs Iowa State
  [59, 58],  // Hofstra vs Alabama
  [20, 19],  // Utah State vs Villanova
  [38, 37],  // Iowa vs Clemson
  [6, 5],    // Northern Iowa vs St. John's
  [14, 13],  // UCF vs UCLA
  [33, 32],  // Queens vs Purdue
  [8, 7],    // California Baptist vs Kansas
  [16, 15],  // Furman vs Connecticut
  [31, 30],  // Missouri vs Miami (Fla.)
  [52, 53],  // UMBC vs Howard (play-in)
  [35, 36],  // Prairie View vs Lehigh (play-in)
  [26, 27],  // Texas vs NC State (play-in)
  [62, 61],  // Miami (OH) vs SMU (play-in)
];

// ── DraftKings Builder ───────────────────────────────────────────────

export function buildDraftKingsProbabilities(): OddsSourceProbabilities {
  const evanMiya = getEvanMiyaLookup();
  const teamIds = getAllTeamIds();
  const teams: Record<number, Record<string, number>> = {};

  // R32: Devig as MATCHUP PAIRS (moneylines, not futures).
  // DK's "Next Game" column has game moneylines like -20000, -8000.
  // These must NOT be devigged as outright futures — that produces ~2% for everyone.
  const r32Probs: Record<number, number> = {};
  for (const [idA, idB] of R32_MATCHUP_PAIRS) {
    const oddsA = DRAFTKINGS_2026.teams[idA]?.r32 ?? 0;
    const oddsB = DRAFTKINGS_2026.teams[idB]?.r32 ?? 0;
    if (oddsA !== 0 && oddsB !== 0) {
      const [pA, pB] = devigMatchup(oddsA, oddsB);
      r32Probs[idA] = pA;
      r32Probs[idB] = pB;
    }
  }

  // S16 through champ: Devig as reach-round markets.
  // These are "reach X round" odds, NOT mutually exclusive.
  // Multiple teams advance per round, so we scale by expected qualifiers.
  const REACH_ROUND_CONFIG: Record<string, number> = {
    s16: 16,   // 16 teams reach Sweet 16
    e8: 8,     // 8 teams reach Elite 8
    f4: 4,     // 4 teams reach Final Four
    f2: 2,     // 2 teams reach Championship game
    champ: 1,  // 1 team wins (standard outright)
  };
  const futuresRounds = ['s16', 'e8', 'f4', 'f2', 'champ'] as const;
  const roundProbs: Record<string, Record<number, number>> = {};

  for (const rk of futuresRounds) {
    const roundOdds: Record<number, number> = {};
    for (const [id, teamOdds] of Object.entries(DRAFTKINGS_2026.teams)) {
      const teamId = Number(id);
      const odds = teamOdds[rk as keyof typeof teamOdds];
      if (odds !== 0) {
        roundOdds[teamId] = odds;
      }
    }
    roundProbs[rk] = devigOutright(roundOdds, REACH_ROUND_CONFIG[rk] ?? 1);
  }

  // Assemble per-team
  for (const teamId of teamIds) {
    const known: Record<string, number> = {};
    if (r32Probs[teamId] !== undefined) known.r32 = r32Probs[teamId];
    for (const rk of futuresRounds) {
      const p = roundProbs[rk]?.[teamId];
      if (p !== undefined) known[rk] = p;
    }
    teams[teamId] = fillAndClamp(teamId, known, evanMiya);
  }

  return { teams, updatedAt: DRAFTKINGS_2026.updatedAt };
}

// ── Pinnacle Builder ─────────────────────────────────────────────────

export function buildPinnacleProbabilities(): OddsSourceProbabilities {
  const evanMiya = getEvanMiyaLookup();
  const teamIds = getAllTeamIds();
  const teams: Record<number, Record<string, number>> = {};

  // champ: outright devig
  const champProbs = devigOutright(PINNACLE_2026.champ as Record<number, number>);

  // f4: regional devig (4 separate regions, each normalized independently)
  const f4Probs: Record<number, number> = {};
  for (const regionTeams of Object.values(PINNACLE_2026.f4Regions)) {
    const regionDevigged = devigOutright(regionTeams as Record<number, number>);
    for (const [id, prob] of Object.entries(regionDevigged)) {
      f4Probs[Number(id)] = prob;
    }
  }

  // s16: binary devig for ~27 teams with YES/NO
  const s16Probs: Record<number, number> = {};
  for (const [id, entry] of Object.entries(PINNACLE_2026.s16)) {
    const teamId = Number(id);
    const odds = entry as PinnacleS16Odds;
    s16Probs[teamId] = devigBinary(odds.yes, odds.no);
  }

  // r32: matchup devig
  const r32Probs: Record<number, number> = {};
  for (const m of PINNACLE_2026.r32Matchups) {
    const [pA, pB] = devigMatchup(m.teamAOdds, m.teamBOdds);
    r32Probs[m.teamAId] = pA;
    r32Probs[m.teamBId] = pB;
  }

  // Missing rounds: e8 (interpolate from f4 and s16), f2 (interpolate from champ and f4)
  // These will be filled by fillAndClamp using Evan Miya ratios

  // Assemble per-team
  for (const teamId of teamIds) {
    const known: Record<string, number> = {};
    if (r32Probs[teamId] !== undefined) known.r32 = r32Probs[teamId];
    if (s16Probs[teamId] !== undefined) known.s16 = s16Probs[teamId];
    // e8: not available from Pinnacle — will be interpolated
    if (f4Probs[teamId] !== undefined) known.f4 = f4Probs[teamId];
    // f2: not available from Pinnacle — will be interpolated
    if (champProbs[teamId] !== undefined) known.champ = champProbs[teamId];
    teams[teamId] = fillAndClamp(teamId, known, evanMiya);
  }

  return { teams, updatedAt: PINNACLE_2026.updatedAt };
}
