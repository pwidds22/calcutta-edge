// ─── Prop Bet Definitions & Results ──────────────────────────────

export interface PropDefinition {
  key: string;
  label: string;
  description: string;
  defaultPercentage: number;
  autoCalculated: boolean;
}

export interface PropResult {
  key: string;
  label: string;
  winnerParticipantId: string | null;
  winnerTeamId: number | null;
  metadata: string; // e.g. "14-seed Colgate beat 3-seed Baylor by 12"
  payoutPercentage: number;
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
 * Get standard prop definitions for a tournament.
 */
export function getStandardProps(tournamentId: string): PropDefinition[] {
  if (tournamentId.startsWith('march_madness')) {
    return MARCH_MADNESS_PROPS;
  }
  if (tournamentId.startsWith('masters') || tournamentId.includes('golf') || tournamentId.includes('open') || tournamentId.includes('pga')) {
    return GOLF_PROPS;
  }
  return [];
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
