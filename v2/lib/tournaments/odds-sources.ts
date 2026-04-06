import type { RoundKey, BaseTeam } from './types';
import { MARCH_MADNESS_2026_TEAMS } from './configs/march-madness-2026';
import { TEAM_RANKINGS_2026 } from './data/team-rankings-2026';
import {
  buildFanDuelProbabilities,
  buildDraftKingsProbabilities,
  buildPinnacleProbabilities,
} from './devig-pipeline';
import { fetchAllOdds, fetchPreTournament } from '@/lib/datagolf/client';
import {
  buildAllOddsSources,
  buildDgIdToTeamIdMap,
  mapSourceToTeamIds,
} from '@/lib/datagolf/odds-builder';

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

// ─── Golf Odds Registry (Dynamic from DataGolf API) ──────────────

/**
 * Build an odds source registry for a golf tournament using live DataGolf API data.
 * Fetches all 5 outright markets, devigs each sportsbook, and maps to team IDs.
 *
 * @param teams - The tournament's BaseTeam array (for dg_id → teamId mapping)
 * @param defaultSourceId - Which source to pre-select (default: 'draftkings')
 */
/** Curated list of sources to show in the golf odds selector */
const GOLF_ALLOWED_SOURCES = new Set([
  'datagolf_history', // DataGolf model with course fit — the only model source
  'draftkings',
  'caesars',
  'fanduel',
  'betcris',
  'bet365',
]);

export async function buildGolfOddsRegistry(
  teams: BaseTeam[],
  defaultSourceId = 'datagolf_history'
): Promise<OddsSourceRegistry> {
  // Fetch pre-tournament model predictions (all 5 markets, already fair)
  // and outrights sportsbook odds (vigged, need devigging) in parallel
  const [allOdds, preTournament] = await Promise.all([
    fetchAllOdds('pga'),
    fetchPreTournament('pga'),
  ]);

  const dgSources = buildAllOddsSources(allOdds, preTournament.baseline_history_fit);
  const dgIdMap = buildDgIdToTeamIdMap(allOdds, teams);

  const minCoverage = Math.floor(teams.length * 0.3); // Need 30%+ coverage to include
  const sources: OddsSource[] = [];
  const staticData: Record<string, OddsSourceProbabilities> = {};

  for (const src of dgSources) {
    // Only include curated sources
    if (!GOLF_ALLOWED_SOURCES.has(src.name)) continue;

    const teamProbs = mapSourceToTeamIds(src, dgIdMap);
    const coverage = Object.keys(teamProbs).length;

    if (coverage < minCoverage) continue;

    const sourceType: OddsSource['type'] = src.name.startsWith('datagolf') ? 'model' : 'sportsbook';
    sources.push({
      id: src.name,
      name: src.label,
      description: `${coverage}/${teams.length} golfers`,
      type: sourceType,
      isRemote: false, // Already fetched
    });

    staticData[src.name] = {
      teams: teamProbs,
      updatedAt: allOdds.win?.last_updated ?? new Date().toISOString(),
    };
  }

  // Add blend + custom meta-sources
  sources.push({ id: 'blend', name: 'Blend', description: 'Custom weighted blend', type: 'blend', isRemote: false });
  sources.push({ id: 'custom', name: 'Custom', description: 'Your own probabilities', type: 'custom', isRemote: false });

  // If the requested default isn't available, fall back to first source
  const hasDefault = sources.some(s => s.id === defaultSourceId);
  const resolvedDefault = hasDefault ? defaultSourceId : (sources[0]?.id ?? 'draftkings');

  return { sources, defaultSourceId: resolvedDefault, staticData };
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
