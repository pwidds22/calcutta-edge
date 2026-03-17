import type { RoundKey } from './types';
import { MARCH_MADNESS_2026_TEAMS } from './configs/march-madness-2026';
import { TEAM_RANKINGS_2026 } from './data/team-rankings-2026';
import {
  buildFanDuelProbabilities,
  buildDraftKingsProbabilities,
  buildPinnacleProbabilities,
} from './devig-pipeline';

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
  type: 'model' | 'sportsbook' | 'blend' | 'custom';
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
      { id: 'evan_miya', name: 'Evan Miya', description: 'Statistical model (3/17)', type: 'model', isRemote: false },
      { id: 'team_rankings', name: 'TeamRankings', description: 'Composite model (3/17)', type: 'model', isRemote: false },
      { id: 'fanduel', name: 'FanDuel', description: 'Sportsbook odds (3/17)', type: 'sportsbook', isRemote: false },
      { id: 'draftkings', name: 'DraftKings', description: 'Sportsbook odds (3/17)', type: 'sportsbook', isRemote: false },
      { id: 'pinnacle', name: 'Pinnacle', description: 'Sharp book odds (3/17)', type: 'sportsbook', isRemote: false },
      { id: 'blend', name: 'Blend', description: 'Custom weighted blend', type: 'blend', isRemote: false },
      { id: 'custom', name: 'Custom', description: 'Your own probabilities', type: 'custom', isRemote: false },
    ],
    defaultSourceId: 'evan_miya',
    staticData: {
      evan_miya: buildEvanMiyaData(),
      team_rankings: TEAM_RANKINGS_2026,
      fanduel: buildFanDuelProbabilities(),
      draftkings: buildDraftKingsProbabilities(),
      pinnacle: buildPinnacleProbabilities(),
    },
  };
}

/**
 * Compute a weighted blend of multiple probability sources.
 * Weights are normalized to sum to 1.
 */
export function blendProbabilities(
  sources: Array<{ data: OddsSourceProbabilities; weight: number }>,
  teamIds: number[],
  roundKeys: string[]
): OddsSourceProbabilities {
  const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
  if (totalWeight === 0) {
    return { teams: {}, updatedAt: new Date().toISOString() };
  }

  const teams: Record<number, Record<string, number>> = {};

  for (const teamId of teamIds) {
    const blended: Record<string, number> = {};
    for (const rk of roundKeys) {
      let weightedSum = 0;
      let activeWeight = 0;
      for (const { data, weight } of sources) {
        const prob = data.teams[teamId]?.[rk];
        if (prob !== undefined && prob > 0) {
          weightedSum += prob * weight;
          activeWeight += weight;
        }
      }
      blended[rk] = activeWeight > 0 ? weightedSum / activeWeight : 0;
    }
    teams[teamId] = blended;
  }

  return { teams, updatedAt: new Date().toISOString() };
}
