import { MARCH_MADNESS_2026_TEAMS } from '@/lib/tournaments/configs/march-madness-2026';

/**
 * Map sportsbook team names to our internal team IDs.
 * Sportsbooks use various name formats ("Duke Blue Devils" vs "Duke").
 */
const SPORTSBOOK_NAME_MAP: Record<string, string> = {
  'UConn Huskies': 'Connecticut',
  'Connecticut Huskies': 'Connecticut',
  'UConn': 'Connecticut',
  'Miami Hurricanes': 'Miami (Fla.)',
  'Miami (FL) Hurricanes': 'Miami (Fla.)',
  'Miami FL': 'Miami (Fla.)',
  'Miami': 'Miami (Fla.)',
  'St Johns': "St. John's",
  "St. John's Red Storm": "St. John's",
  "Saint John's": "St. John's",
  'Cal Baptist': 'California Baptist',
  'CBU Lancers': 'California Baptist',
  'N Dakota St': 'North Dakota State',
  'NDSU Bison': 'North Dakota State',
  'NDSU': 'North Dakota State',
  'McNeese St': 'McNeese',
  'McNeese State': 'McNeese',
  'McNeese State Cowboys': 'McNeese',
  'McNeese Cowboys': 'McNeese',
  'Iowa St': 'Iowa State',
  'Iowa State Cyclones': 'Iowa State',
  'Michigan St': 'Michigan State',
  'Michigan State Spartans': 'Michigan State',
  'NC St': 'NC State',
  'NC State Wolfpack': 'NC State',
  'N Iowa': 'Northern Iowa',
  'UNI Panthers': 'Northern Iowa',
  'Northern Iowa Panthers': 'Northern Iowa',
  "Saint Mary's Gaels": "Saint Mary's",
  "St. Mary's": "Saint Mary's",
  'Miami Ohio': 'Miami (OH)',
  'Miami (OH) RedHawks': 'Miami (OH)',
  'Miami OH': 'Miami (OH)',
  'USF Bulls': 'South Florida',
  'South Florida Bulls': 'South Florida',
  'USF': 'South Florida',
  'LIU Sharks': 'Long Island',
  'LIU': 'Long Island',
  'Long Island University': 'Long Island',
  'Prairie View A&M': 'Prairie View',
  'Prairie View A&M Panthers': 'Prairie View',
  'PVAMU': 'Prairie View',
  "Hawai'i": 'Hawaii',
  'Hawaii Rainbow Warriors': 'Hawaii',
  'Wright St': 'Wright State',
  'Wright State Raiders': 'Wright State',
  'Tennessee St': 'Tennessee State',
  'Tennessee State Tigers': 'Tennessee State',
  'Kennesaw St': 'Kennesaw State',
  'Kennesaw State Owls': 'Kennesaw State',
  'Utah St': 'Utah State',
  'Utah State Aggies': 'Utah State',
  'BYU Cougars': 'BYU',
  'Brigham Young': 'BYU',
};

/**
 * Resolve a sportsbook team name to our internal team ID.
 */
export function resolveTeamId(sportsbookName: string): number | null {
  // Direct match
  const direct = MARCH_MADNESS_2026_TEAMS.find(
    (t) => t.name.toLowerCase() === sportsbookName.toLowerCase()
  );
  if (direct) return direct.id;

  // Mapped name
  const mapped = SPORTSBOOK_NAME_MAP[sportsbookName];
  if (mapped) {
    const team = MARCH_MADNESS_2026_TEAMS.find(
      (t) => t.name.toLowerCase() === mapped.toLowerCase()
    );
    if (team) return team.id;
  }

  // Strip common mascot suffixes
  for (const t of MARCH_MADNESS_2026_TEAMS) {
    if (sportsbookName.toLowerCase().startsWith(t.name.toLowerCase())) {
      return t.id;
    }
  }

  return null;
}
