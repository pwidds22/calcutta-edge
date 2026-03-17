import type { RoundKey } from './types';
import { MARCH_MADNESS_2026_TEAMS } from './configs/march-madness-2026';
import { TEAM_RANKINGS_2026 } from './data/team-rankings-2026';

/** Per-team probability data from a single source */
export interface OddsSourceProbabilities {
  /** Map from teamId to per-round probabilities (0-1, cumulative) */
  teams: Record<number, Record<RoundKey, number>>;
  /** Timestamp when this data was last fetched/updated */
  updatedAt: string;
}

export interface OddsSource {
  id: string;
  name: string;
  description: string;
  type: 'model' | 'sportsbook';
  /** Whether this source requires an API call to fetch */
  isRemote: boolean;
  /** For sportsbook sources: which bookmaker key in The Odds API */
  bookmakerKey?: string;
}

/** Registry of available odds sources for a tournament */
export interface OddsSourceRegistry {
  sources: OddsSource[];
  defaultSourceId: string;
  /** Static probability data keyed by source ID */
  staticData: Record<string, OddsSourceProbabilities>;
}

function buildEvanMiyaData(): OddsSourceProbabilities {
  const teams: Record<number, Record<string, number>> = {};
  for (const t of MARCH_MADNESS_2026_TEAMS) {
    if (t.probabilities) {
      teams[t.id] = { ...t.probabilities };
    }
  }
  return { updatedAt: '2026-03-17T00:00:00Z', teams };
}

export function buildMarchMadness2026Registry(): OddsSourceRegistry {
  return {
    sources: [
      { id: 'evan_miya', name: 'Evan Miya', description: 'Statistical model (updated 3/17)', type: 'model', isRemote: false },
      { id: 'team_rankings', name: 'TeamRankings', description: 'Composite model', type: 'model', isRemote: false },
      { id: 'pinnacle', name: 'Pinnacle', description: 'Sharp sportsbook odds (devigged)', type: 'sportsbook', isRemote: true, bookmakerKey: 'pinnacle' },
      { id: 'draftkings', name: 'DraftKings', description: 'Sportsbook odds (devigged)', type: 'sportsbook', isRemote: true, bookmakerKey: 'draftkings' },
      { id: 'fanduel', name: 'FanDuel', description: 'Sportsbook odds (devigged)', type: 'sportsbook', isRemote: true, bookmakerKey: 'fanduel' },
    ],
    defaultSourceId: 'evan_miya',
    staticData: {
      evan_miya: buildEvanMiyaData(),
      team_rankings: TEAM_RANKINGS_2026,
    },
  };
}
