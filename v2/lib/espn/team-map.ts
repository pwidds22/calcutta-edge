/**
 * ESPN team name → Calcutta Edge team ID mapping for March Madness 2026.
 *
 * ESPN API returns `shortDisplayName` (e.g., "Duke", "NC State") which we map
 * to our internal team IDs from march-madness-2026.ts config.
 *
 * We store multiple aliases per team because ESPN may use different name formats
 * across different API responses (displayName vs shortDisplayName vs abbreviation).
 */

import { MARCH_MADNESS_2026_TEAMS } from '@/lib/tournaments/configs/march-madness-2026';

// Manual overrides for names where ESPN and our config diverge
const ESPN_NAME_OVERRIDES: Record<string, number> = {
  // ESPN shortDisplayName → our team ID
  'UConn': 15,
  'UCONN': 15,
  'Connecticut Huskies': 15,
  'Cal Baptist': 8,
  'CBU': 8,
  'California Baptist Lancers': 8,
  'N. Iowa': 6,
  'UNI': 6,
  'Northern Iowa Panthers': 6,
  'NDSU': 12,
  'N. Dakota St': 12,
  'North Dakota State Bison': 12,
  'LIU': 18,
  'Long Island University': 18,
  'Long Island Sharks': 18,
  'Utah St': 20,
  'USU': 20,
  'Utah State Aggies': 20,
  'Kennesaw St': 29,
  'KSU': 29,
  'Kennesaw State Owls': 29,
  'Miami FL': 30,
  'Miami': 30,
  'Miami Hurricanes': 30,
  "St. John's": 5,
  "St. John's Red Storm": 5,
  'Saint Johns': 5,
  'Prairie View A&M': 35,
  'PVAMU': 35,
  'Prairie View A&M Panthers': 35,
  'Texas A&M Aggies': 48,
  'TAMU': 48,
  "Saint Mary's Gaels": 47,
  'Saint Marys': 47,
  'SMC': 47,
  'Miami OH': 62,
  'Miami (OH)': 62,
  'Miami Ohio': 62,
  'Miami (Ohio)': 62,
  'Miami RedHawks': 62,
  'Wright St': 64,
  'WSU': 64,
  'Wright State Raiders': 64,
  'Iowa St': 67,
  'ISU': 67,
  'Iowa State Cyclones': 67,
  'Tennessee St': 68,
  'TSU': 68,
  'Tennessee State Tigers': 68,
  'NC State Wolfpack': 27,
  'Texas Tech Red Raiders': 56,
  'South Florida Bulls': 10,
  'USF': 10,
  'Michigan St': 11,
  'MSU': 11,
  'Michigan State Spartans': 11,
  'High Point Panthers': 22,
  'HPU': 22,
};

// Build lookup from our config: name → id
const CONFIG_NAME_MAP = new Map<string, number>();
for (const team of MARCH_MADNESS_2026_TEAMS) {
  CONFIG_NAME_MAP.set(team.name.toLowerCase(), team.id);
}

/**
 * Resolve an ESPN team name to our internal team ID.
 * Tries: exact override → config name match → abbreviation override → null
 */
export function resolveEspnTeam(espnName: string): number | null {
  // 1. Check explicit overrides first
  if (ESPN_NAME_OVERRIDES[espnName] !== undefined) {
    return ESPN_NAME_OVERRIDES[espnName];
  }

  // 2. Try direct match against our config names (case-insensitive)
  const configMatch = CONFIG_NAME_MAP.get(espnName.toLowerCase());
  if (configMatch !== undefined) {
    return configMatch;
  }

  // 3. Try partial match — ESPN "Duke Blue Devils" → we have "Duke"
  for (const [configName, id] of CONFIG_NAME_MAP) {
    if (espnName.toLowerCase().startsWith(configName)) {
      return id;
    }
  }

  return null;
}

/**
 * Map ESPN round headline text to our round keys.
 * ESPN headline format: "NCAA Men's Basketball Championship - West Region - First Round"
 */
export function resolveEspnRound(headline: string): string | null {
  const lower = headline.toLowerCase();

  if (lower.includes('first four')) return null; // Play-in, not tracked as a round
  if (lower.includes('first round')) return 'r32';
  if (lower.includes('second round')) return 's16';
  if (lower.includes('sweet 16') || lower.includes('regional semifinal')) return 'e8';
  if (lower.includes('elite eight') || lower.includes('elite 8') || lower.includes('regional final')) return 'f4';
  if (lower.includes('final four') || lower.includes('national semifinal')) return 'f2';
  if (lower.includes('championship') || lower.includes('national championship')) return 'champ';

  return null;
}
