// ─── Prop Bet Definitions & Results ──────────────────────────────

export interface PropDefinition {
  key: string;
  label: string;
  description: string;
  defaultPercentage: number;
  autoCalculated: boolean;
}

export interface PropWinner {
  participantId: string;
  teamId?: number;
}

export interface PropResult {
  key: string;
  label: string;
  /** @deprecated Use `winners` array instead. Kept for backwards compat with existing data. */
  winnerParticipantId: string | null;
  /** @deprecated Use `winners` array instead. */
  winnerTeamId: number | null;
  winners?: PropWinner[]; // Multiple winners for ties — payout splits evenly
  metadata: string; // e.g. "Rory McIlroy, Sam Burns — 65 (-5)"
  payoutPercentage: number;
}

/** Get effective winners list from a PropResult (handles legacy single-winner format) */
export function getPropWinners(result: PropResult): PropWinner[] {
  if (result.winners && result.winners.length > 0) return result.winners;
  if (result.winnerParticipantId) {
    return [{ participantId: result.winnerParticipantId, teamId: result.winnerTeamId ?? undefined }];
  }
  return [];
}

/**
 * Standard props for March Madness Calcuttas.
 * These map to the existing keys in payout-presets.ts (biggestUpset, highestSeed, largestMargin, customProp).
 */
export const MARCH_MADNESS_PROPS: PropDefinition[] = [
  {
    key: 'biggestUpset',
    label: 'Biggest Upset',
    description: 'Largest seed differential win in the tournament',
    defaultPercentage: 5,
    autoCalculated: false, // Requires knowing matchup seeds — complex to auto-determine
  },
  {
    key: 'highestSeed',
    label: 'Highest Final Four Seed',
    description: 'Highest-seeded team to reach the Final Four',
    defaultPercentage: 5,
    autoCalculated: true,
  },
  {
    key: 'largestMargin',
    label: 'Largest Margin of Victory',
    description: 'Team with the biggest winning margin in any single game',
    defaultPercentage: 5,
    autoCalculated: false, // Requires game scores, not tracked
  },
  {
    key: 'customProp',
    label: 'Custom Prop',
    description: 'Commissioner-defined prop bet (e.g., first team eliminated)',
    defaultPercentage: 5,
    autoCalculated: false,
  },
];

/**
 * Standard props for golf Calcuttas (Masters, US Open, etc.).
 * Low round per day is the most common side bet in golf Calcuttas.
 */
export const GOLF_PROPS: PropDefinition[] = [
  {
    key: 'lowRoundR1',
    label: 'Low Round — Thursday',
    description: 'Lowest score in Round 1',
    defaultPercentage: 2.5,
    autoCalculated: false,
  },
  {
    key: 'lowRoundR2',
    label: 'Low Round — Friday',
    description: 'Lowest score in Round 2',
    defaultPercentage: 2.5,
    autoCalculated: false,
  },
  {
    key: 'lowRoundR3',
    label: 'Low Round — Saturday',
    description: 'Lowest score in Round 3 (moving day)',
    defaultPercentage: 2.5,
    autoCalculated: false,
  },
  {
    key: 'lowRoundR4',
    label: 'Low Round — Sunday',
    description: 'Lowest score in the final round',
    defaultPercentage: 2.5,
    autoCalculated: false,
  },
  {
    key: 'worstRound',
    label: 'Worst Single Round',
    description: 'Highest (worst) score in any single round among players who made the cut',
    defaultPercentage: 0,
    autoCalculated: false,
  },
  {
    key: 'worstOverall',
    label: 'Worst Overall Score',
    description: 'Highest (worst) total score among players who made the cut (DFL)',
    defaultPercentage: 0,
    autoCalculated: false,
  },
  {
    key: 'customProp',
    label: 'Custom Prop',
    description: 'Commissioner-defined prop bet (e.g., hole-in-one, ace pool)',
    defaultPercentage: 0,
    autoCalculated: false,
  },
];

/**
 * Standard props for World Cup / soccer Calcuttas.
 * Golden Boot + Golden Ball are the iconic individual awards (and back the
 * "With Individual Awards" preset). The two group-stage goal-differential props
 * reward the most dominant group team and the worst team (a wooden spoon that
 * makes weak nations worth bidding on). All are manually graded for now;
 * the differential props become auto-calculable once group results land.
 */
export const WORLD_CUP_PROPS: PropDefinition[] = [
  {
    key: 'goldenBoot',
    label: 'Golden Boot (Top Scorer)',
    description: 'Player with the most goals across the tournament',
    defaultPercentage: 10,
    autoCalculated: false,
  },
  {
    key: 'goldenBall',
    label: 'Golden Ball (Best Player)',
    description: 'Best player of the tournament',
    defaultPercentage: 10,
    autoCalculated: false,
  },
  {
    key: 'topScoringTeam',
    label: 'Top Scoring Team',
    description: 'Nation that scores the most goals across the tournament',
    defaultPercentage: 5,
    autoCalculated: false,
  },
  {
    key: 'bestGroupDiff',
    label: 'Best Group-Stage Differential',
    description: 'Nation with the best goal differential after the group stage',
    defaultPercentage: 5,
    autoCalculated: false,
  },
  {
    key: 'worstGroupDiff',
    label: 'Worst Group-Stage Differential (Wooden Spoon)',
    description: 'Nation with the worst goal differential after the group stage — rewards owning a weak team',
    defaultPercentage: 5,
    autoCalculated: false,
  },
];

/**
 * Standard props for NFL season Calcuttas.
 * Best/worst record are the two attested NFL Calcutta side bets, and both are
 * auto-gradeable from the same ESPN standings call the per-win round needs.
 * Record ties are COMMON in the NFL (several teams routinely share the worst
 * record), so any auto-grader must emit every tied team — PropResult.winners[]
 * splits the payout evenly.
 */
export const NFL_PROPS: PropDefinition[] = [
  {
    key: 'bestRecord',
    label: 'Best Record in the NFL',
    description: 'Team with the most regular-season wins (ties split the payout)',
    defaultPercentage: 3,
    autoCalculated: true,
  },
  {
    key: 'worstRecord',
    label: 'Worst Record in the NFL',
    description: 'Team with the fewest regular-season wins — makes a bad team worth owning (ties split the payout)',
    defaultPercentage: 3,
    autoCalculated: true,
  },
];

/**
 * Get standard prop definitions for a tournament.
 */
export function getStandardProps(tournamentId: string): PropDefinition[] {
  if (tournamentId.startsWith('march_madness')) {
    return MARCH_MADNESS_PROPS;
  }
  if (tournamentId.startsWith('world_cup')) {
    return WORLD_CUP_PROPS;
  }
  if (tournamentId.startsWith('masters') || tournamentId.includes('golf') || tournamentId.includes('open') || tournamentId.includes('pga')) {
    return GOLF_PROPS;
  }
  if (tournamentId.startsWith('nfl')) {
    return NFL_PROPS;
  }
  return [];
}

/**
 * Given a payout-rules record (e.g. a payout preset's `rules`) and a
 * tournament's standard prop definitions, determine which props the rules
 * enable (any standard prop key present with a positive value) and at what
 * percentage.
 *
 * Used by the create-session form to keep its Prop Bets toggles in sync with
 * whichever preset is active — both on initial page load and when a preset
 * is (re-)selected. Without this, a preset whose props default to non-zero
 * (NFL's Balanced preset enables bestRecord + worstRecord at 3% each) shows
 * as selected but leaves those props un-enabled until the host clicks the
 * preset again, so the pot silently under-distributes by their share.
 */
export function syncPropsFromRules(
  rules: Record<string, number>,
  standardProps: PropDefinition[]
): { enabledKeys: Set<string>; percentages: Record<string, number> } {
  const propKeySet = new Set(standardProps.map((p) => p.key));
  const enabledKeys = new Set<string>();
  const percentages: Record<string, number> = {};
  for (const [key, val] of Object.entries(rules)) {
    if (propKeySet.has(key) && val > 0) {
      enabledKeys.add(key);
      percentages[key] = val;
    }
  }
  return { enabledKeys, percentages };
}

/**
 * Enabled prop — stored in SessionSettings.
 * The commissioner chooses which props to enable and at what percentage.
 */
export interface EnabledProp {
  key: string;
  label: string;
  percentage: number;
  isCustom?: boolean; // true for commissioner-created custom props
  customLabel?: string; // Only for isCustom props
}
