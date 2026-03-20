import type { TournamentConfig, BaseTeam } from '../types';

export const MARCH_MADNESS_2026_CONFIG: TournamentConfig = {
  id: 'march_madness_2026',
  name: 'March Madness 2026',
  sport: 'ncaa_basketball',
  rounds: [
    { key: 'r32', label: 'R32', teamsAdvancing: 32, payoutLabel: 'Round of 32', gameLabel: 'R64' },
    { key: 's16', label: 'S16', teamsAdvancing: 16, payoutLabel: 'Sweet 16', gameLabel: 'R32' },
    { key: 'e8', label: 'E8', teamsAdvancing: 8, payoutLabel: 'Elite 8', gameLabel: 'S16' },
    { key: 'f4', label: 'F4', teamsAdvancing: 4, payoutLabel: 'Final Four', gameLabel: 'E8' },
    { key: 'f2', label: 'F2', teamsAdvancing: 2, payoutLabel: 'Championship', gameLabel: 'F4' },
    { key: 'champ', label: 'Champ', teamsAdvancing: 1, payoutLabel: 'Winner', gameLabel: 'Final' },
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
    probabilities: { r32: 0.9958, s16: 0.8814, e8: 0.7143, f4: 0.5608, f2: 0.3562, champ: 0.1896 } },
  { id: 2, name: 'Siena', seed: 16, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0042, s16: 0.0004, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Ohio State vs 9-seed TCU
  { id: 3, name: 'Ohio State', seed: 8, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6387, s16: 0.0789, e8: 0.0344, f4: 0.0125, f2: 0.0028, champ: 0.0008 } },
  { id: 4, name: 'TCU', seed: 9, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3613, s16: 0.0393, e8: 0.0119, f4: 0.0038, f2: 0.0006, champ: 0 } },

  // 5-seed St. John's vs 12-seed Northern Iowa
  { id: 5, name: "St. John's", seed: 5, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8528, s16: 0.551, e8: 0.157, f4: 0.0886, f2: 0.0355, champ: 0.0098 } },
  { id: 6, name: 'Northern Iowa', seed: 12, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1472, s16: 0.039, e8: 0.0024, f4: 0.0002, f2: 0, champ: 0 } },

  // 4-seed Kansas vs 13-seed Cal Baptist
  { id: 7, name: 'Kansas', seed: 4, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9239, s16: 0.4037, e8: 0.0799, f4: 0.0367, f2: 0.0092, champ: 0.0019 } },
  { id: 8, name: 'California Baptist', seed: 13, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0761, s16: 0.0063, e8: 0.0001, f4: 0, f2: 0, champ: 0 } },

  // 6-seed Louisville vs 11-seed South Florida
  { id: 9, name: 'Louisville', seed: 6, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7057, s16: 0.278, e8: 0.1178, f4: 0.022, f2: 0.0037, champ: 0.0007 } },
  { id: 10, name: 'South Florida', seed: 11, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2943, s16: 0.0892, e8: 0.0293, f4: 0.0042, f2: 0.0004, champ: 0 } },

  // 3-seed Michigan State vs 14-seed North Dakota State
  { id: 11, name: 'Michigan State', seed: 3, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9327, s16: 0.627, e8: 0.3474, f4: 0.1166, f2: 0.0446, champ: 0.0141 } },
  { id: 12, name: 'North Dakota State', seed: 14, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0673, s16: 0.0058, e8: 0.0004, f4: 0, f2: 0, champ: 0 } },

  // 7-seed UCLA vs 10-seed UCF
  { id: 13, name: 'UCLA', seed: 7, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7124, s16: 0.21, e8: 0.0707, f4: 0.0098, f2: 0.0015, champ: 0.0002 } },
  { id: 14, name: 'UCF', seed: 10, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2876, s16: 0.0456, e8: 0.0083, f4: 0.0007, f2: 0, champ: 0 } },

  // 2-seed UConn vs 15-seed Furman
  { id: 15, name: 'Connecticut', seed: 2, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9642, s16: 0.7398, e8: 0.426, f4: 0.1441, f2: 0.056, champ: 0.0168 } },
  { id: 16, name: 'Furman', seed: 15, group: 'East', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0358, s16: 0.0046, e8: 0.0001, f4: 0, f2: 0, champ: 0 } },

  // ===== WEST REGION (San Jose) =====
  // 1-seed Arizona vs 16-seed Long Island
  { id: 17, name: 'Arizona', seed: 1, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9927, s16: 0.8975, e8: 0.742, f4: 0.5327, f2: 0.3001, champ: 0.1804 } },
  { id: 18, name: 'Long Island', seed: 16, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0073, s16: 0.0005, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Villanova vs 9-seed Utah State
  { id: 19, name: 'Villanova', seed: 8, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.4164, s16: 0.0304, e8: 0.0102, f4: 0.0024, f2: 0.0002, champ: 0 } },
  { id: 20, name: 'Utah State', seed: 9, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.5836, s16: 0.0716, e8: 0.0302, f4: 0.0088, f2: 0.0011, champ: 0.0003 } },

  // 5-seed Wisconsin vs 12-seed High Point
  { id: 21, name: 'Wisconsin', seed: 5, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7436, s16: 0.2771, e8: 0.0524, f4: 0.0165, f2: 0.0033, champ: 0.0008 } },
  { id: 22, name: 'High Point', seed: 12, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2564, s16: 0.0415, e8: 0.0028, f4: 0.0003, f2: 0, champ: 0 } },

  // 4-seed Arkansas vs 13-seed Hawaii
  { id: 23, name: 'Arkansas', seed: 4, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9532, s16: 0.6697, e8: 0.1624, f4: 0.0612, f2: 0.0158, champ: 0.0041 } },
  { id: 24, name: 'Hawaii', seed: 13, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0468, s16: 0.0117, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 6-seed BYU vs 11-seed Texas/NC State (play-in)
  { id: 25, name: 'BYU', seed: 6, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.4854, s16: 0.1225, e8: 0.0281, f4: 0.0046, f2: 0.0004, champ: 0.0001 } },
  { id: 26, name: 'Texas', seed: 11, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2669, s16: 0.0745, e8: 0.0152, f4: 0.0021, f2: 0.0002, champ: 0.0001 } },
  { id: 27, name: 'NC State', seed: 11, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.2477, s16: 0.055, e8: 0.0098, f4: 0.0012, f2: 0.0001, champ: 0 } },

  // 3-seed Gonzaga vs 14-seed Kennesaw State
  { id: 28, name: 'Gonzaga', seed: 3, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9681, s16: 0.744, e8: 0.3058, f4: 0.1015, f2: 0.0286, champ: 0.0094 } },
  { id: 29, name: 'Kennesaw State', seed: 14, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0319, s16: 0.004, e8: 0.0004, f4: 0, f2: 0, champ: 0 } },

  // 7-seed Miami (Fla.) vs 10-seed Missouri
  { id: 30, name: 'Miami (Fla.)', seed: 7, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6669, s16: 0.1224, e8: 0.0454, f4: 0.0082, f2: 0.0014, champ: 0.0004 } },
  { id: 31, name: 'Missouri', seed: 10, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3331, s16: 0.0342, e8: 0.0071, f4: 0.0009, f2: 0.0002, champ: 0 } },

  // 2-seed Purdue vs 15-seed Queens
  { id: 32, name: 'Purdue', seed: 2, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9972, s16: 0.8431, e8: 0.5882, f4: 0.2596, f2: 0.112, champ: 0.0478 } },
  { id: 33, name: 'Queens', seed: 15, group: 'West', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0028, s16: 0.0003, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // ===== SOUTH REGION (Houston) =====
  // 1-seed Florida vs 16-seed Prairie View/Lehigh (play-in)
  { id: 34, name: 'Florida', seed: 1, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9966, s16: 0.8665, e8: 0.6661, f4: 0.4098, f2: 0.2269, champ: 0.1121 } },
  { id: 35, name: 'Prairie View', seed: 16, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0004, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },
  { id: 36, name: 'Lehigh', seed: 16, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.003, s16: 0.0002, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Clemson vs 9-seed Iowa
  { id: 37, name: 'Clemson', seed: 8, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3977, s16: 0.0479, e8: 0.0162, f4: 0.0033, f2: 0.0004, champ: 0 } },
  { id: 38, name: 'Iowa', seed: 9, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6023, s16: 0.0854, e8: 0.0336, f4: 0.0076, f2: 0.0016, champ: 0.0001 } },

  // 5-seed Vanderbilt vs 12-seed McNeese
  { id: 39, name: 'Vanderbilt', seed: 5, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8571, s16: 0.5148, e8: 0.1626, f4: 0.0576, f2: 0.0173, champ: 0.0047 } },
  { id: 40, name: 'McNeese', seed: 12, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1429, s16: 0.0392, e8: 0.0028, f4: 0.0003, f2: 0, champ: 0 } },

  // 4-seed Nebraska vs 13-seed Troy
  { id: 41, name: 'Nebraska', seed: 4, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8686, s16: 0.432, e8: 0.1178, f4: 0.0347, f2: 0.0087, champ: 0.0021 } },
  { id: 42, name: 'Troy', seed: 13, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1314, s16: 0.014, e8: 0.0009, f4: 0, f2: 0, champ: 0 } },

  // 6-seed North Carolina vs 11-seed VCU
  { id: 43, name: 'North Carolina', seed: 6, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.4658, s16: 0.0607, e8: 0.0064, f4: 0.0006, f2: 0.0002, champ: 0 } },
  { id: 44, name: 'VCU', seed: 11, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.5342, s16: 0.087, e8: 0.0152, f4: 0.0024, f2: 0, champ: 0 } },

  // 3-seed Illinois vs 14-seed Penn
  { id: 45, name: 'Illinois', seed: 3, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9906, s16: 0.851, e8: 0.3787, f4: 0.174, f2: 0.0752, champ: 0.0261 } },
  { id: 46, name: 'Penn', seed: 14, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0094, s16: 0.0013, e8: 0.0001, f4: 0, f2: 0, champ: 0 } },

  // 7-seed Saint Mary's vs 10-seed Texas A&M
  { id: 47, name: "Saint Mary's", seed: 7, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6271, s16: 0.1348, e8: 0.0453, f4: 0.012, f2: 0.003, champ: 0.0006 } },
  { id: 48, name: 'Texas A&M', seed: 10, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3729, s16: 0.0429, e8: 0.0094, f4: 0.0018, f2: 0.0003, champ: 0.0001 } },

  // 2-seed Houston vs 15-seed Idaho
  { id: 49, name: 'Houston', seed: 2, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9942, s16: 0.8221, e8: 0.5449, f4: 0.2959, f2: 0.1559, champ: 0.067 } },
  { id: 50, name: 'Idaho', seed: 15, group: 'South', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0058, s16: 0.0002, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // ===== MIDWEST REGION (Chicago) =====
  // 1-seed Michigan vs 16-seed UMBC/Howard (play-in)
  { id: 51, name: 'Michigan', seed: 1, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9972, s16: 0.9198, e8: 0.8284, f4: 0.6418, f2: 0.41, champ: 0.2647 } },
  { id: 52, name: 'UMBC', seed: 16, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0023, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },
  { id: 53, name: 'Howard', seed: 16, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0005, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0 } },

  // 8-seed Georgia vs 9-seed Saint Louis
  { id: 54, name: 'Georgia', seed: 8, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.5168, s16: 0.0402, e8: 0.0184, f4: 0.0046, f2: 0.0007, champ: 0.0002 } },
  { id: 55, name: 'Saint Louis', seed: 9, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.4832, s16: 0.04, e8: 0.0154, f4: 0.0038, f2: 0.0004, champ: 0 } },

  // 5-seed Texas Tech vs 12-seed Akron
  { id: 56, name: 'Texas Tech', seed: 5, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6697, s16: 0.241, e8: 0.0285, f4: 0.009, f2: 0.0022, champ: 0.0002 } },
  { id: 57, name: 'Akron', seed: 12, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3303, s16: 0.0635, e8: 0.0037, f4: 0.0002, f2: 0, champ: 0 } },

  // 4-seed Alabama vs 13-seed Hofstra
  { id: 58, name: 'Alabama', seed: 4, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.8587, s16: 0.6412, e8: 0.1039, f4: 0.0392, f2: 0.0094, champ: 0.003 } },
  { id: 59, name: 'Hofstra', seed: 13, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.1413, s16: 0.0543, e8: 0.0017, f4: 0, f2: 0, champ: 0 } },

  // 6-seed Tennessee vs 11-seed Miami (OH)/SMU (play-in)
  { id: 60, name: 'Tennessee', seed: 6, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.7688, s16: 0.3805, e8: 0.149, f4: 0.0326, f2: 0.0086, champ: 0.0024 } },
  { id: 61, name: 'SMU', seed: 11, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.198, s16: 0.06, e8: 0.0136, f4: 0.0023, f2: 0.0005, champ: 0 } },
  { id: 62, name: 'Miami (OH)', seed: 11, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0332, s16: 0.0057, e8: 0.0003, f4: 0.0001, f2: 0, champ: 0 } },

  // 3-seed Virginia vs 14-seed Wright State
  { id: 63, name: 'Virginia', seed: 3, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9489, s16: 0.5505, e8: 0.236, f4: 0.0668, f2: 0.0233, champ: 0.0076 } },
  { id: 64, name: 'Wright State', seed: 14, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0511, s16: 0.0033, e8: 0.0001, f4: 0, f2: 0, champ: 0 } },

  // 7-seed Kentucky vs 10-seed Santa Clara
  { id: 65, name: 'Kentucky', seed: 7, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.6172, s16: 0.136, e8: 0.0496, f4: 0.0061, f2: 0.0014, champ: 0.0003 } },
  { id: 66, name: 'Santa Clara', seed: 10, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.3828, s16: 0.0614, e8: 0.0191, f4: 0.002, f2: 0.0001, champ: 0 } },

  // 2-seed Iowa State vs 15-seed Tennessee State
  { id: 67, name: 'Iowa State', seed: 2, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.9862, s16: 0.8021, e8: 0.5323, f4: 0.1915, f2: 0.08, champ: 0.0315 } },
  { id: 68, name: 'Tennessee State', seed: 15, group: 'Midwest', americanOdds: ODDS_UNUSED,
    probabilities: { r32: 0.0138, s16: 0.0005, e8: 0, f4: 0, f2: 0, champ: 0 } },
];
