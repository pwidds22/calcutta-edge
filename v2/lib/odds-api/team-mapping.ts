import { MARCH_MADNESS_2026_TEAMS } from '@/lib/tournaments/configs/march-madness-2026';

/**
 * Map sportsbook team names to our internal team IDs.
 * Sportsbooks use various name formats ("Duke Blue Devils" vs "Duke").
 *
 * Strategy:
 * 1. Exact match against our team names
 * 2. Explicit alias map (handles UConn, St. John's, etc.)
 * 3. Normalize abbreviations (St → State, N → North, etc.) and retry
 * 4. Prefix match, preferring the LONGEST matching name to avoid
 *    "Michigan" matching before "Michigan State"
 */

/** Explicit aliases for names that can't be derived algorithmically */
const SPORTSBOOK_NAME_MAP: Record<string, string> = {
  // UConn
  'UConn Huskies': 'Connecticut',
  'Connecticut Huskies': 'Connecticut',
  'UConn': 'Connecticut',
  // Miami disambiguation
  'Miami Hurricanes': 'Miami (Fla.)',
  'Miami (FL) Hurricanes': 'Miami (Fla.)',
  'Miami FL': 'Miami (Fla.)',
  'Miami Ohio': 'Miami (OH)',
  'Miami (OH) RedHawks': 'Miami (OH)',
  'Miami OH': 'Miami (OH)',
  // St. John's
  'St Johns': "St. John's",
  "St. John's Red Storm": "St. John's",
  "Saint John's": "St. John's",
  "St John's Red Storm": "St. John's",
  // Saint Mary's
  "Saint Mary's Gaels": "Saint Mary's",
  "St. Mary's": "Saint Mary's",
  "St Mary's Gaels": "Saint Mary's",
  "Saint Mary's (CA)": "Saint Mary's",
  // Abbreviation collisions — explicit to avoid prefix bugs
  'Michigan Wolverines': 'Michigan',
  'Michigan St Spartans': 'Michigan State',
  'Michigan State Spartans': 'Michigan State',
  'Iowa Hawkeyes': 'Iowa',
  'Iowa St Cyclones': 'Iowa State',
  'Iowa State Cyclones': 'Iowa State',
  'NC State Wolfpack': 'NC State',
  'NC St Wolfpack': 'NC State',
  'Tennessee Volunteers': 'Tennessee',
  'Tennessee St Tigers': 'Tennessee State',
  'Tennessee State Tigers': 'Tennessee State',
  'Utah St Aggies': 'Utah State',
  'Utah State Aggies': 'Utah State',
  'Wright St Raiders': 'Wright State',
  'Wright State Raiders': 'Wright State',
  'Kennesaw St Owls': 'Kennesaw State',
  'Kennesaw State Owls': 'Kennesaw State',
  // Other aliases
  'Cal Baptist': 'California Baptist',
  'Cal Baptist Lancers': 'California Baptist',
  'CBU Lancers': 'California Baptist',
  'California Baptist Lancers': 'California Baptist',
  'N Dakota St': 'North Dakota State',
  'NDSU Bison': 'North Dakota State',
  'NDSU': 'North Dakota State',
  'North Dakota St Bison': 'North Dakota State',
  'North Dakota State Bison': 'North Dakota State',
  'McNeese St': 'McNeese',
  'McNeese State': 'McNeese',
  'McNeese State Cowboys': 'McNeese',
  'McNeese Cowboys': 'McNeese',
  'McNeese St Cowboys': 'McNeese',
  'N Iowa': 'Northern Iowa',
  'UNI Panthers': 'Northern Iowa',
  'Northern Iowa Panthers': 'Northern Iowa',
  'USF Bulls': 'South Florida',
  'South Florida Bulls': 'South Florida',
  'USF': 'South Florida',
  'LIU Sharks': 'Long Island',
  'LIU': 'Long Island',
  'Long Island University': 'Long Island',
  'Long Island Sharks': 'Long Island',
  'Prairie View A&M': 'Prairie View',
  'Prairie View A&M Panthers': 'Prairie View',
  'PVAMU': 'Prairie View',
  "Hawai'i": 'Hawaii',
  "Hawai'i Rainbow Warriors": 'Hawaii',
  'Hawaii Rainbow Warriors': 'Hawaii',
  'BYU Cougars': 'BYU',
  'Brigham Young': 'BYU',
  'Brigham Young Cougars': 'BYU',
  // Common sportsbook formats
  'SMU Mustangs': 'SMU',
  'VCU Rams': 'VCU',
  'TCU Horned Frogs': 'TCU',
  'UCF Knights': 'UCF',
  'UMBC Retrievers': 'UMBC',
};

/**
 * Normalize common abbreviations in team names for fuzzy matching.
 */
function normalizeAbbreviations(name: string): string {
  return name
    .replace(/\bSt\b/gi, 'State')
    .replace(/\bN\b/gi, 'North')
    .replace(/\bS\b/gi, 'South')
    .replace(/\bE\b/gi, 'East')
    .replace(/\bW\b/gi, 'West');
}

// Pre-sort teams by name length descending for prefix matching
// This ensures "Michigan State" is checked before "Michigan"
const TEAMS_BY_NAME_LENGTH = [...MARCH_MADNESS_2026_TEAMS].sort(
  (a, b) => b.name.length - a.name.length
);

/**
 * Resolve a sportsbook team name to our internal team ID.
 */
export function resolveTeamId(sportsbookName: string): number | null {
  const lower = sportsbookName.toLowerCase().trim();

  // 1. Direct match against our team names
  const direct = MARCH_MADNESS_2026_TEAMS.find(
    (t) => t.name.toLowerCase() === lower
  );
  if (direct) return direct.id;

  // 2. Explicit alias map
  const mapped = SPORTSBOOK_NAME_MAP[sportsbookName];
  if (mapped) {
    const team = MARCH_MADNESS_2026_TEAMS.find(
      (t) => t.name.toLowerCase() === mapped.toLowerCase()
    );
    if (team) return team.id;
  }

  // 3. Normalize abbreviations and retry alias map
  const normalized = normalizeAbbreviations(sportsbookName);
  if (normalized !== sportsbookName) {
    const normalizedMapped = SPORTSBOOK_NAME_MAP[normalized];
    if (normalizedMapped) {
      const team = MARCH_MADNESS_2026_TEAMS.find(
        (t) => t.name.toLowerCase() === normalizedMapped.toLowerCase()
      );
      if (team) return team.id;
    }
  }

  // 4. Prefix match — longest name first to avoid "Michigan" < "Michigan State" collisions
  for (const t of TEAMS_BY_NAME_LENGTH) {
    if (lower.startsWith(t.name.toLowerCase())) {
      return t.id;
    }
  }

  // 5. Try normalized prefix match
  const normalizedLower = normalizeAbbreviations(lower);
  for (const t of TEAMS_BY_NAME_LENGTH) {
    if (normalizedLower.startsWith(t.name.toLowerCase())) {
      return t.id;
    }
  }

  return null;
}
