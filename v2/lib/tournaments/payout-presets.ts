import type { PayoutRules } from './types';

export interface PayoutPreset {
  label: string;
  description: string;
  rules: PayoutRules;
}

/**
 * Standard payout presets for March Madness Calcuttas.
 * Per-win percentages — a champion earns cumulative payouts from all rounds.
 *
 * Sources: PrintYourBrackets, CBS Sports, Bet The Process.
 */
export const MARCH_MADNESS_PAYOUT_PRESETS: Record<string, PayoutPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'Equal reward per round — keeps all owners engaged',
    rules: {
      r32: 0.5,
      s16: 1.0,
      e8: 2.5,
      f4: 4.0,
      f2: 8.0,
      champ: 16.0,
      biggestUpset: 0,
      highestSeed: 0,
      largestMargin: 0,
      customProp: 0,
    },
  },
  topHeavy: {
    label: 'Top Heavy',
    description: 'Most of the pot goes to deep runs and the champion',
    rules: {
      r32: 0.125,    // ×32 = 4%
      s16: 0.375,    // ×16 = 6%
      e8: 1.25,      // ×8  = 10%
      f4: 2.5,       // ×4  = 10%
      f2: 5.0,       // ×2  = 10%
      champ: 60.0,   // ×1  = 60%
      biggestUpset: 0,
      highestSeed: 0,
      largestMargin: 0,
      customProp: 0,
    },
  },
  withProps: {
    label: 'With Props',
    description: '80% round payouts, 20% across prop bets',
    rules: {
      r32: 0.4,
      s16: 0.8,
      e8: 2.0,
      f4: 3.2,
      f2: 6.4,
      champ: 12.8,
      biggestUpset: 5.0,
      highestSeed: 5.0,
      largestMargin: 5.0,
      customProp: 5.0,
    },
  },
};

/**
 * Masters: makeCut×50 + top20×20 + top10×10 + top5×5 + winner×1 + props = 100%
 * Prop keys must match the tournament config's propBets[].key exactly
 * (lowRoundR1–R4, worstRound, worstOverall) or they won't be counted in totals.
 */
export const MASTERS_PAYOUT_PRESETS: Record<string, PayoutPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'Spread payouts across finishes — rewards consistency',
    rules: {
      makeCut: 0.10,       // ×50 = 5%
      top20: 0.50,         // ×20 = 10%
      top10: 1.50,         // ×10 = 15%
      top5: 4.00,          // ×5  = 20%
      winner: 50.00,       // ×1  = 50%
      lowRoundR1: 0,
      lowRoundR2: 0,
      lowRoundR3: 0,
      lowRoundR4: 0,
      worstRound: 0,
      worstOverall: 0,
    },
  },
  topHeavy: {
    label: 'Winner Takes Most',
    description: 'Majority of the pot goes to the champion',
    rules: {
      makeCut: 0.04,       // ×50 = 2%
      top20: 0.15,         // ×20 = 3%
      top10: 0.50,         // ×10 = 5%
      top5: 2.00,          // ×5  = 10%
      winner: 80.00,       // ×1  = 80%
      lowRoundR1: 0,
      lowRoundR2: 0,
      lowRoundR3: 0,
      lowRoundR4: 0,
      worstRound: 0,
      worstOverall: 0,
    },
  },
  withProps: {
    label: 'With Low Round',
    description: '85% placement payouts, 15% for daily low round bonuses',
    rules: {
      makeCut: 0.08,       // ×50 = 4%
      top20: 0.40,         // ×20 = 8%
      top10: 1.20,         // ×10 = 12%
      top5: 3.20,          // ×5  = 16%
      winner: 45.00,       // ×1  = 45%
      lowRoundR1: 3.75,    // Thu low round = 3.75%
      lowRoundR2: 3.75,    // Fri low round = 3.75%
      lowRoundR3: 3.75,    // Sat low round = 3.75%
      lowRoundR4: 3.75,    // Sun low round = 3.75%  (total: 15%)
      worstRound: 0,
      worstOverall: 0,
    },
  },
};

/**
 * PGA Championship: makeCut×70 + top20×20 + top10×10 + top5×5 + winner×1 + props = 100%
 *
 * Same round structure and props as Masters, but the PGA Championship cuts at
 * the lowest 70 (not 50 like Masters). The per-golfer rates for makeCut differ
 * accordingly to keep the cut tier at a comparable share of the pot.
 *
 * Real-world calcutta inspiration (per BettorEdge / Live Tourney):
 *   - Classic 70/20/10 split → "Winner Takes Most" preset
 *   - Spread/positional with daily props → "With Low Round" preset
 *   - Balanced consistency-rewarding → "Balanced" preset
 */
export const PGA_CHAMPIONSHIP_PAYOUT_PRESETS: Record<string, PayoutPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'Spread payouts across finishes — rewards consistency',
    rules: {
      makeCut: 0.10,       // ×70 = 7%
      top20: 0.40,         // ×20 = 8%
      top10: 1.50,         // ×10 = 15%
      top5: 4.00,          // ×5  = 20%
      winner: 50.00,       // ×1  = 50%
      lowRoundR1: 0,
      lowRoundR2: 0,
      lowRoundR3: 0,
      lowRoundR4: 0,
      worstRound: 0,
      worstOverall: 0,
    },
  },
  topHeavy: {
    label: 'Winner Takes Most',
    description: 'Majority of the pot goes to the champion (close to classic 70/20/10)',
    rules: {
      makeCut: 0.05,       // ×70 = 3.5%
      top20: 0.10,         // ×20 = 2%
      top10: 0.45,         // ×10 = 4.5%
      top5: 2.00,          // ×5  = 10%
      winner: 80.00,       // ×1  = 80%
      lowRoundR1: 0,
      lowRoundR2: 0,
      lowRoundR3: 0,
      lowRoundR4: 0,
      worstRound: 0,
      worstOverall: 0,
    },
  },
  withProps: {
    label: 'With Low Round',
    description: '85% placement payouts, 15% for daily low round bonuses',
    rules: {
      makeCut: 0.06,       // ×70 = 4.2%
      top20: 0.40,         // ×20 = 8%
      top10: 1.18,         // ×10 = 11.8%
      top5: 3.20,          // ×5  = 16%
      winner: 45.00,       // ×1  = 45%
      lowRoundR1: 3.75,    // Thu low round = 3.75%
      lowRoundR2: 3.75,    // Fri low round = 3.75%
      lowRoundR3: 3.75,    // Sat low round = 3.75%
      lowRoundR4: 3.75,    // Sun low round = 3.75%  (total: 15%)
      worstRound: 0,
      worstOverall: 0,
    },
  },
};

/**
 * Kentucky Derby: show×3 + place×2 + win×1 = 100%
 */
export const KENTUCKY_DERBY_PAYOUT_PRESETS: Record<string, PayoutPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'Reward show, place, and win finishes',
    rules: {
      show: 5.00,      // ×3 = 15%
      place: 10.00,    // ×2 = 20%
      win: 65.00,      // ×1 = 65%
      bestName: 0,
    },
  },
  topHeavy: {
    label: 'Winner Takes Most',
    description: 'Heavy payout for the winner — small show/place bonus',
    rules: {
      show: 2.00,      // ×3 = 6%
      place: 4.50,     // ×2 = 9%
      win: 85.00,      // ×1 = 85%
      bestName: 0,
    },
  },
  withProps: {
    label: 'With Best Name',
    description: '85% race payouts, 15% for best horse name vote',
    rules: {
      show: 4.00,      // ×3 = 12%
      place: 8.00,     // ×2 = 16%
      win: 57.00,      // ×1 = 57%
      bestName: 15.00,
    },
  },
};

/**
 * NFL: playoffBerth×14 + divisionWinner×8 + conferenceChamp×2 + superBowl×1 = 100%
 */
export const NFL_SEASON_PAYOUT_PRESETS: Record<string, PayoutPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'Reward milestones from playoffs to Super Bowl',
    rules: {
      playoffBerth: 1.00,      // ×14 = 14%
      divisionWinner: 2.00,    // ×8  = 16%
      conferenceChamp: 7.50,   // ×2  = 15%
      superBowl: 55.00,        // ×1  = 55%
      mvp: 0,
      mostWins: 0,
    },
  },
  topHeavy: {
    label: 'Super Bowl Heavy',
    description: 'Most of the pot goes to the champion',
    rules: {
      playoffBerth: 0.50,      // ×14 = 7%
      divisionWinner: 1.00,    // ×8  = 8%
      conferenceChamp: 5.00,   // ×2  = 10%
      superBowl: 75.00,        // ×1  = 75%
      mvp: 0,
      mostWins: 0,
    },
  },
  withProps: {
    label: 'With Awards',
    description: '75% milestone payouts, 25% for MVP + Best Record',
    rules: {
      playoffBerth: 0.75,      // ×14 = 10.5%
      divisionWinner: 1.50,    // ×8  = 12%
      conferenceChamp: 5.00,   // ×2  = 10%
      superBowl: 42.50,        // ×1  = 42.5%
      mvp: 15.00,
      mostWins: 10.00,
    },
  },
};

/**
 * World Cup: winGroup×12 + r16×16 + qf×8 + sf×4 + final×2 + champion×1 (+props) = 100%
 * Round keys are Kalshi-aligned: "Win Group" (per-group) + the reach-round ladder.
 */
export const WORLD_CUP_PAYOUT_PRESETS: Record<string, PayoutPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'Reward every knockout win — keeps all nations\u2019 owners engaged',
    rules: {
      winGroup: 0.75,     // ×12 = 9%
      r16: 1.00,          // ×16 = 16%
      qf: 2.00,           // ×8  = 16%
      sf: 3.50,           // ×4  = 14%
      final: 5.00,        // ×2  = 10%
      champion: 35.00,    // ×1  = 35%
      goldenBoot: 0,
      goldenBall: 0,
    },
  },
  topHeavy: {
    label: 'Champion Heavy',
    description: 'Most of the pot goes to the World Cup winner',
    rules: {
      winGroup: 0.50,     // ×12 = 6%
      r16: 0.75,          // ×16 = 12%
      qf: 1.25,           // ×8  = 10%
      sf: 2.00,           // ×4  = 8%
      final: 4.00,        // ×2  = 8%
      champion: 56.00,    // ×1  = 56%
      goldenBoot: 0,
      goldenBall: 0,
    },
  },
  withProps: {
    label: 'With Individual Awards',
    description: '80% match payouts, 20% for Golden Boot + Golden Ball',
    rules: {
      winGroup: 0.50,     // ×12 = 6%
      r16: 0.75,          // ×16 = 12%
      qf: 1.75,           // ×8  = 14%
      sf: 3.00,           // ×4  = 12%
      final: 4.00,        // ×2  = 8%
      champion: 28.00,    // ×1  = 28%
      goldenBoot: 10.00,
      goldenBall: 10.00,
    },
  },
};

const PRESET_MAP: Record<string, Record<string, PayoutPreset>> = {
  march_madness_2026: MARCH_MADNESS_PAYOUT_PRESETS,
  masters_2026: MASTERS_PAYOUT_PRESETS,
  // Golf majors share round/prop structure but cut sizes differ
  // (Masters cuts at 50, PGA Championship at 70), so each one needs its own
  // preset where the per-cut-maker rate keeps the tier total constant.
  pga_championship_2026: PGA_CHAMPIONSHIP_PAYOUT_PRESETS,
  kentucky_derby_2026: KENTUCKY_DERBY_PAYOUT_PRESETS,
  nfl_season_2026: NFL_SEASON_PAYOUT_PRESETS,
  world_cup_2026: WORLD_CUP_PAYOUT_PRESETS,
};

/**
 * Get payout presets for a given tournament.
 * Falls back to March Madness presets if tournament not found.
 */
export function getPayoutPresets(tournamentId: string): Record<string, PayoutPreset> {
  return PRESET_MAP[tournamentId] ?? MARCH_MADNESS_PAYOUT_PRESETS;
}
