import type { TournamentConfig, BaseTeam } from './types';
import type { OddsSourceRegistry } from './odds-sources';
import { buildMarchMadness2026Registry, buildGolfOddsRegistry } from './odds-sources';
import {
  MARCH_MADNESS_2026_CONFIG,
  MARCH_MADNESS_2026_TEAMS,
} from './configs/march-madness-2026';
import {
  MASTERS_2026_CONFIG,
  MASTERS_2026_TEAMS,
} from './configs/masters-2026';
import {
  KENTUCKY_DERBY_2026_CONFIG,
  KENTUCKY_DERBY_2026_TEAMS,
} from './configs/kentucky-derby-2026';
import {
  NFL_SEASON_2026_CONFIG,
  NFL_SEASON_2026_TEAMS,
} from './configs/nfl-season-2026';
import {
  WORLD_CUP_2026_CONFIG,
  WORLD_CUP_2026_TEAMS,
} from './configs/world-cup-2026';

interface TournamentEntry {
  config: TournamentConfig;
  teams: BaseTeam[];
}

const TOURNAMENTS: Record<string, TournamentEntry> = {
  march_madness_2026: {
    config: MARCH_MADNESS_2026_CONFIG,
    teams: MARCH_MADNESS_2026_TEAMS,
  },
  masters_2026: {
    config: MASTERS_2026_CONFIG,
    teams: MASTERS_2026_TEAMS,
  },
  kentucky_derby_2026: {
    config: KENTUCKY_DERBY_2026_CONFIG,
    teams: KENTUCKY_DERBY_2026_TEAMS,
  },
  world_cup_2026: {
    config: WORLD_CUP_2026_CONFIG,
    teams: WORLD_CUP_2026_TEAMS,
  },
  nfl_season_2026: {
    config: NFL_SEASON_2026_CONFIG,
    teams: NFL_SEASON_2026_TEAMS,
  },
};

export function getTournament(id: string): TournamentEntry | undefined {
  return TOURNAMENTS[id];
}

export function getActiveTournament(): TournamentEntry {
  const active = Object.values(TOURNAMENTS).find((t) => t.config.isActive);
  if (!active) {
    // Fallback to first tournament
    return Object.values(TOURNAMENTS)[0];
  }
  return active;
}

export function listTournaments(): TournamentConfig[] {
  return Object.values(TOURNAMENTS).map((t) => t.config);
}

export function listTournamentsWithTeams(): TournamentEntry[] {
  return Object.values(TOURNAMENTS);
}

/** Check if a tournament's hosting window is currently open */
export function isHostable(config: TournamentConfig): boolean {
  if (!config.hostingOpensAt) return true; // no gate = always open
  return new Date() >= new Date(config.hostingOpensAt);
}

/** List only tournaments whose hosting window is open */
export function listHostableTournaments(): TournamentConfig[] {
  return listTournaments().filter(isHostable);
}

// ─── Odds Registry (with caching for async sources) ─────────────

let golfRegistryCache: { data: OddsSourceRegistry; expiresAt: number } | null = null;
const GOLF_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get odds source registry for a tournament (if available).
 * March Madness: sync (static data).
 * Golf tournaments: async (fetches from DataGolf API, cached 1hr).
 */
export async function getOddsRegistry(tournamentId: string): Promise<OddsSourceRegistry | undefined> {
  if (tournamentId === 'march_madness_2026') {
    return buildMarchMadness2026Registry();
  }

  // Golf tournaments: fetch from DataGolf API
  const tournament = TOURNAMENTS[tournamentId];
  if (tournament?.config.sport === 'golf') {
    // Return cached if fresh
    if (golfRegistryCache && Date.now() < golfRegistryCache.expiresAt) {
      return golfRegistryCache.data;
    }

    try {
      const registry = await buildGolfOddsRegistry(tournament.teams);
      golfRegistryCache = { data: registry, expiresAt: Date.now() + GOLF_CACHE_TTL };
      return registry;
    } catch (err) {
      console.error('[OddsRegistry] Failed to fetch golf odds from DataGolf:', err);
      // Return stale cache if available, otherwise undefined
      return golfRegistryCache?.data;
    }
  }

  return undefined;
}
