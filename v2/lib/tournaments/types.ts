// ─── Tournament Configuration ───────────────────────────────────────

/** A round identifier — dynamic per tournament */
export type RoundKey = string;

/** A group identifier (region, conference, pool, etc.) */
export type GroupKey = string;

/** Devigging strategy — how to normalize odds */
export type DevigStrategy = 'bracket' | 'global' | 'group' | 'none';

export interface RoundConfig {
  key: RoundKey;
  label: string;
  teamsAdvancing: number;
  payoutLabel: string;
}

export interface GroupConfig {
  key: GroupKey;
  label: string;
}

export interface PropBetConfig {
  key: string;
  label: string;
}

/** Bracket-specific devigging config (only when devigStrategy === 'bracket') */
export interface BracketDevigConfig {
  matchupPairs: [number, number][];
  quadrants: number[][];
  halves: number[][];
  bracketSides: { left: GroupKey[]; right: GroupKey[] };
  roundGroupings: Record<RoundKey, 'matchup' | 'quadrant' | 'half' | 'region' | 'side' | 'global'>;
}

export interface TournamentConfig {
  id: string;
  name: string;
  sport: string;
  rounds: RoundConfig[];
  groups: GroupConfig[];
  devigStrategy: DevigStrategy;
  bracketDevigConfig?: BracketDevigConfig;
  defaultPayoutRules: Record<string, number>;
  defaultPotSize: number;
  propBets: PropBetConfig[];
  badge: string;
  teamLabel: string;
  groupLabel: string;
  startDate: string;
  /** ISO date when hosting opens (typically 2-3 weeks before startDate). If omitted, hosting is always open. */
  hostingOpensAt?: string;
  isActive: boolean;
}

// ─── Team Types ─────────────────────────────────────────────────────

export interface BaseTeam {
  id: number;
  name: string;
  seed: number;
  group: GroupKey;
  americanOdds: Record<RoundKey, number>;
  /** Direct probabilities (0–1) per round. When provided, these are used
   *  instead of converting americanOdds. Useful for model-based data
   *  (e.g., Evan Miya, KenPom) that already represents fair probabilities. */
  probabilities?: Record<RoundKey, number>;
}

export interface Team extends BaseTeam {
  rawImpliedProbabilities: Record<RoundKey, number>;
  odds: Record<RoundKey, number>;
  roundValues: Record<RoundKey, number>;
  valuePercentage: number;
  fairValue: number;
  purchasePrice: number;
  isMyTeam: boolean;
}

export interface SavedTeamData {
  id: number;
  purchasePrice: number;
  isMyTeam: boolean;
}

// ─── Dynamic PayoutRules ────────────────────────────────────────────

export type PayoutRules = Record<string, number>;

// ─── Filter and Sort Types ──────────────────────────────────────────

export type GroupFilter = 'All' | GroupKey;
export type StatusFilter = 'All' | 'Available' | 'Taken' | 'My Teams';
export type SortOption = 'seed' | 'name' | 'valuePercentage' | 'group';
export type SortDirection = 'asc' | 'desc';
