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
 * Get standard prop definitions for a tournament.
 * Only March Madness has standard props for now; other tournaments
 * use their own prop keys defined in payout-presets.ts.
 */
export function getStandardProps(tournamentId: string): PropDefinition[] {
  if (tournamentId.startsWith('march_madness')) {
    return MARCH_MADNESS_PROPS;
  }
  // Other tournaments don't have standard prop definitions yet.
  // Their prop keys (goldenBoot, lowRound, etc.) are handled via payout rules directly.
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
