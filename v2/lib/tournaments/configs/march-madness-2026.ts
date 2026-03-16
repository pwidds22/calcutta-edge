import type { TournamentConfig, BaseTeam } from '../types';

export const MARCH_MADNESS_2026_CONFIG: TournamentConfig = {
  id: 'march_madness_2026',
  name: 'March Madness 2026',
  sport: 'ncaa_basketball',
  rounds: [
    { key: 'r32', label: 'R32', teamsAdvancing: 32, payoutLabel: 'Round of 32' },
    { key: 's16', label: 'S16', teamsAdvancing: 16, payoutLabel: 'Sweet 16' },
    { key: 'e8', label: 'E8', teamsAdvancing: 8, payoutLabel: 'Elite 8' },
    { key: 'f4', label: 'F4', teamsAdvancing: 4, payoutLabel: 'Final Four' },
    { key: 'f2', label: 'F2', teamsAdvancing: 2, payoutLabel: 'Championship' },
    { key: 'champ', label: 'Champ', teamsAdvancing: 1, payoutLabel: 'Winner' },
  ],
  groups: [
    { key: 'East', label: 'East' },
    { key: 'West', label: 'West' },
    { key: 'South', label: 'South' },
    { key: 'Midwest', label: 'Midwest' },
  ],
  // Using 'none' because probabilities are from Evan Miya model (already fair, no vig).
  // Switch to 'bracket' if using raw sportsbook American odds that need devigging.
  devigStrategy: 'none',
  bracketDevigConfig: {
    matchupPairs: [
      [1, 16], [8, 9], [5, 12], [4, 13],
      [6, 11], [3, 14], [7, 10], [2, 15],
    ],
    quadrants: [
      [1, 16, 8, 9],
      [5, 12, 4, 13],
      [6, 11, 3, 14],
      [7, 10, 2, 15],
    ],
    halves: [
      [1, 16, 8, 9, 5, 12, 4, 13],
      [6, 11, 3, 14, 7, 10, 2, 15],
    ],
    bracketSides: {
      left: ['East', 'West'],
      right: ['South', 'Midwest'],
    },
    roundGroupings: {
      r32: 'matchup',
      s16: 'quadrant',
      e8: 'half',
      f4: 'region',
      f2: 'side',
      champ: 'global',
    },
  },
  defaultPayoutRules: {
    r32: 0.5,
    s16: 1.0,
    e8: 2.5,
    f4: 4.0,
    f2: 8.0,
    champ: 16.0,
    biggestUpset: 0.0,
    highestSeed: 0.0,
    largestMargin: 0.0,
    customProp: 0.0,
  },
  defaultPotSize: 10000,
  propBets: [
    { key: 'biggestUpset', label: 'Biggest Upset' },
    { key: 'highestSeed', label: 'Highest Seed' },
    { key: 'largestMargin', label: 'Largest Margin' },
    { key: 'customProp', label: 'Custom Prop' },
  ],
  badge: 'March Madness 2026',
  teamLabel: 'Team',
  groupLabel: 'Region',
  startDate: '2026-03-19',
  hostingOpensAt: '2026-03-01',
  isActive: true,
};

// Helper: dummy American odds (not used when probabilities are provided)
const ODDS_UNUSED = { r32: 0, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 };

/**
 * 2026 NCAA March Madness teams — ACTUAL BRACKET (Selection Sunday 3/15/2026).
 * 68 teams across 4 regions. Probabilities from Evan Miya model.
 * Play-in teams listed separately (seeds 11 and 16 with multiple entries).
 */
export const MARCH_MADNESS_2026_TEAMS: BaseTeam[] = [
  // ===== EAST REGION (Washington D.C.) =====
  // 1-seed Duke vs 16-seed Siena
  { id: 1, name: 'Duke', seed: 1, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9975, s16: 0.8849, e8: 0.7143, f4: 0.5586, f2: 0.3667, champ: 0.1884 } },
  { id: 2, name: 'Siena', seed: 16, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0025, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Ohio State vs 9-seed TCU
  { id: 3, name: 'Ohio State', seed: 8, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6437, s16: 0.0786, e8: 0.0327, f4: 0.0106, f2: 0.0031, champ: 0.0004 } },
  { id: 4, name: 'TCU', seed: 9, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3563, s16: 0.0365, e8: 0.0100, f4: 0.0029, f2: 0.0010, champ: 0.0002 } },

  // 5-seed St. John's vs 12-seed Northern Iowa
  { id: 5, name: "St. John's", seed: 5, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8584, s16: 0.5543, e8: 0.1624, f4: 0.0900, f2: 0.0357, champ: 0.0102 } },
  { id: 6, name: 'Northern Iowa', seed: 12, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1416, s16: 0.0365, e8: 0.0022, f4: 0.0004, f2: 0, champ: 0 } },

  // 4-seed Kansas vs 13-seed Cal Baptist
  { id: 7, name: 'Kansas', seed: 4, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9288, s16: 0.4031, e8: 0.0784, f4: 0.0300, f2: 0.0063, champ: 0.0020 } },
  { id: 8, name: 'California Baptist', seed: 13, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0712, s16: 0.0061, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 6-seed Louisville vs 11-seed South Florida
  { id: 9, name: 'Louisville', seed: 6, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7312, s16: 0.2896, e8: 0.1151, f4: 0.0178, f2: 0.0022, champ: 0 } },
  { id: 10, name: 'South Florida', seed: 11, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2688, s16: 0.0678, e8: 0.0196, f4: 0.0024, f2: 0.0004, champ: 0 } },

  // 3-seed Michigan State vs 14-seed North Dakota State
  { id: 11, name: 'Michigan State', seed: 3, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9416, s16: 0.6373, e8: 0.3682, f4: 0.1275, f2: 0.0492, champ: 0.0163 } },
  { id: 12, name: 'North Dakota State', seed: 14, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0584, s16: 0.0053, e8: 0.0006, f4: 0, f2: 0, champ: 0 } },

  // 7-seed UCLA vs 10-seed UCF
  { id: 13, name: 'UCLA', seed: 7, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7233, s16: 0.2194, e8: 0.0708, f4: 0.0124, f2: 0.0020, champ: 0.0002 } },
  { id: 14, name: 'UCF', seed: 10, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2767, s16: 0.0406, e8: 0.0073, f4: 0, f2: 0, champ: 0 } },

  // 2-seed UConn vs 15-seed Furman
  { id: 15, name: 'Connecticut', seed: 2, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9720, s16: 0.7355, e8: 0.4182, f4: 0.1475, f2: 0.0525, champ: 0.0163 } },
  { id: 16, name: 'Furman', seed: 15, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0280, s16: 0.0045, e8: 0.0002, f4: 0, f2: 0, champ: 0 } },

  // ===== WEST REGION (San Jose) =====
  // 1-seed Arizona vs 16-seed Long Island
  { id: 17, name: 'Arizona', seed: 1, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9945, s16: 0.9084, e8: 0.7714, f4: 0.5849, f2: 0.3024, champ: 0.1741 } },
  { id: 18, name: 'Long Island', seed: 16, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0055, s16: 0.0008, e8: 0.0002, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Villanova vs 9-seed Utah State
  { id: 19, name: 'Villanova', seed: 8, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3984, s16: 0.0237, e8: 0.0061, f4: 0.0006, f2: 0, champ: 0 } },
  { id: 20, name: 'Utah State', seed: 9, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6016, s16: 0.0671, e8: 0.0247, f4: 0.0082, f2: 0.0012, champ: 0.0002 } },

  // 5-seed Wisconsin vs 12-seed High Point
  { id: 21, name: 'Wisconsin', seed: 5, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7359, s16: 0.2884, e8: 0.0508, f4: 0.0147, f2: 0.0018, champ: 0.0008 } },
  { id: 22, name: 'High Point', seed: 12, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2641, s16: 0.0439, e8: 0.0024, f4: 0, f2: 0, champ: 0 } },

  // 4-seed Arkansas vs 13-seed Hawaii
  { id: 23, name: 'Arkansas', seed: 4, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9529, s16: 0.6567, e8: 0.1445, f4: 0.0567, f2: 0.0118, champ: 0.0020 } },
  { id: 24, name: 'Hawaii', seed: 13, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0471, s16: 0.0110, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 6-seed BYU vs 11-seed Texas/NC State (play-in)
  { id: 25, name: 'BYU', seed: 6, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.4943, s16: 0.1265, e8: 0.0278, f4: 0.0037, f2: 0.0004, champ: 0 } },
  { id: 26, name: 'Texas', seed: 11, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2582, s16: 0.0700, e8: 0.0155, f4: 0.0020, f2: 0, champ: 0 } },
  { id: 27, name: 'NC State', seed: 11, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2475, s16: 0.0510, e8: 0.0082, f4: 0.0010, f2: 0, champ: 0 } },

  // 3-seed Gonzaga vs 14-seed Kennesaw State
  { id: 28, name: 'Gonzaga', seed: 3, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9725, s16: 0.7498, e8: 0.3237, f4: 0.0951, f2: 0.0210, champ: 0.0043 } },
  { id: 29, name: 'Kennesaw State', seed: 14, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0275, s16: 0.0027, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 7-seed Miami (Fla.) vs 10-seed Missouri
  { id: 30, name: 'Miami (Fla.)', seed: 7, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6755, s16: 0.1314, e8: 0.0449, f4: 0.0043, f2: 0, champ: 0 } },
  { id: 31, name: 'Missouri', seed: 10, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3245, s16: 0.0286, e8: 0.0061, f4: 0.0006, f2: 0, champ: 0 } },

  // 2-seed Purdue vs 15-seed Queens
  { id: 32, name: 'Purdue', seed: 2, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9976, s16: 0.8400, e8: 0.5737, f4: 0.2282, f2: 0.0839, champ: 0.0329 } },
  { id: 33, name: 'Queens', seed: 15, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0024, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // ===== SOUTH REGION (Houston) =====
  // 1-seed Florida vs 16-seed Prairie View/Lehigh (play-in)
  { id: 34, name: 'Florida', seed: 1, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9982, s16: 0.8643, e8: 0.6557, f4: 0.3994, f2: 0.2216, champ: 0.1059 } },
  { id: 35, name: 'Prairie View', seed: 16, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0002, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },
  { id: 36, name: 'Lehigh', seed: 16, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0016, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Clemson vs 9-seed Iowa
  { id: 37, name: 'Clemson', seed: 8, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3918, s16: 0.0453, e8: 0.0149, f4: 0.0025, f2: 0.0002, champ: 0 } },
  { id: 38, name: 'Iowa', seed: 9, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6082, s16: 0.0904, e8: 0.0320, f4: 0.0043, f2: 0.0010, champ: 0.0002 } },

  // 5-seed Vanderbilt vs 12-seed McNeese
  { id: 39, name: 'Vanderbilt', seed: 5, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8673, s16: 0.5418, e8: 0.1786, f4: 0.0631, f2: 0.0210, champ: 0.0051 } },
  { id: 40, name: 'McNeese', seed: 12, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1327, s16: 0.0298, e8: 0.0025, f4: 0.0002, f2: 0, champ: 0 } },

  // 4-seed Nebraska vs 13-seed Troy
  { id: 41, name: 'Nebraska', seed: 4, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8710, s16: 0.4161, e8: 0.1155, f4: 0.0361, f2: 0.0082, champ: 0.0014 } },
  { id: 42, name: 'Troy', seed: 13, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1290, s16: 0.0124, e8: 0.0008, f4: 0, f2: 0, champ: 0 } },

  // 6-seed North Carolina vs 11-seed VCU
  { id: 43, name: 'North Carolina', seed: 6, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.4763, s16: 0.0573, e8: 0.0059, f4: 0.0006, f2: 0.0002, champ: 0 } },
  { id: 44, name: 'VCU', seed: 11, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.5237, s16: 0.0767, e8: 0.0127, f4: 0.0029, f2: 0, champ: 0 } },

  // 3-seed Illinois vs 14-seed Penn
  { id: 45, name: 'Illinois', seed: 3, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9955, s16: 0.8653, e8: 0.3804, f4: 0.1698, f2: 0.0676, champ: 0.0222 } },
  { id: 46, name: 'Penn', seed: 14, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0045, s16: 0.0008, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 7-seed Saint Mary's vs 10-seed Texas A&M
  { id: 47, name: "Saint Mary's", seed: 7, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6337, s16: 0.1296, e8: 0.0449, f4: 0.0114, f2: 0.0031, champ: 0 } },
  { id: 48, name: 'Texas A&M', seed: 10, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3663, s16: 0.0390, e8: 0.0082, f4: 0.0031, f2: 0.0004, champ: 0 } },

  // 2-seed Houston vs 15-seed Idaho
  { id: 49, name: 'Houston', seed: 2, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9949, s16: 0.8310, e8: 0.5478, f4: 0.3065, f2: 0.1576, champ: 0.0639 } },
  { id: 50, name: 'Idaho', seed: 15, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0051, s16: 0.0004, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // ===== MIDWEST REGION (Chicago) =====
  // 1-seed Michigan vs 16-seed UMBC/Howard (play-in)
  { id: 51, name: 'Michigan', seed: 1, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9975, s16: 0.9369, e8: 0.8631, f4: 0.6869, f2: 0.4661, champ: 0.3143 } },
  { id: 52, name: 'UMBC', seed: 16, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0020, s16: 0.0002, e8: 0, f4: 0, f2: 0, champ: 0 } },
  { id: 53, name: 'Howard', seed: 16, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0006, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Georgia vs 9-seed Saint Louis
  { id: 54, name: 'Georgia', seed: 8, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.5104, s16: 0.0251, e8: 0.0094, f4: 0.0014, f2: 0.0002, champ: 0 } },
  { id: 55, name: 'Saint Louis', seed: 9, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.4896, s16: 0.0378, e8: 0.0180, f4: 0.0033, f2: 0.0008, champ: 0 } },

  // 5-seed Texas Tech vs 12-seed Akron
  { id: 56, name: 'Texas Tech', seed: 5, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6710, s16: 0.2390, e8: 0.0218, f4: 0.0045, f2: 0.0006, champ: 0 } },
  { id: 57, name: 'Akron', seed: 12, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3290, s16: 0.0569, e8: 0.0018, f4: 0.0002, f2: 0, champ: 0 } },

  // 4-seed Alabama vs 13-seed Hofstra
  { id: 58, name: 'Alabama', seed: 4, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8708, s16: 0.6586, e8: 0.0829, f4: 0.0322, f2: 0.0086, champ: 0.0020 } },
  { id: 59, name: 'Hofstra', seed: 13, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1292, s16: 0.0455, e8: 0.0029, f4: 0, f2: 0, champ: 0 } },

  // 6-seed Tennessee vs 11-seed Miami (OH)/SMU (play-in)
  { id: 60, name: 'Tennessee', seed: 6, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7796, s16: 0.3922, e8: 0.1435, f4: 0.0290, f2: 0.0078, champ: 0.0020 } },
  { id: 61, name: 'SMU', seed: 11, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1941, s16: 0.0659, e8: 0.0125, f4: 0.0012, f2: 0.0002, champ: 0 } },
  { id: 62, name: 'Miami (OH)', seed: 11, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0263, s16: 0.0043, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 3-seed Virginia vs 14-seed Wright State
  { id: 63, name: 'Virginia', seed: 3, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9551, s16: 0.5357, e8: 0.2335, f4: 0.0602, f2: 0.0169, champ: 0.0037 } },
  { id: 64, name: 'Wright State', seed: 14, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0449, s16: 0.0020, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 7-seed Kentucky vs 10-seed Santa Clara
  { id: 65, name: 'Kentucky', seed: 7, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6057, s16: 0.1163, e8: 0.0420, f4: 0.0047, f2: 0.0006, champ: 0 } },
  { id: 66, name: 'Santa Clara', seed: 10, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3943, s16: 0.0643, e8: 0.0198, f4: 0.0020, f2: 0.0002, champ: 0.0002 } },

  // 2-seed Iowa State vs 15-seed Tennessee State
  { id: 67, name: 'Iowa State', seed: 2, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9880, s16: 0.8186, e8: 0.5484, f4: 0.1745, f2: 0.0757, champ: 0.0310 } },
  { id: 68, name: 'Tennessee State', seed: 15, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0120, s16: 0.0008, e8: 0.0002, f4: 0, f2: 0, champ: 0 } },
];
