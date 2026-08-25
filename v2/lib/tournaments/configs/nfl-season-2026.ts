import type { TournamentConfig, BaseTeam } from '../types';

export const NFL_SEASON_2026_CONFIG: TournamentConfig = {
  id: 'nfl_season_2026',
  name: 'NFL Season 2026-27',
  sport: 'nfl',
  rounds: [
    // ── Parallel bonuses. MUST come first: getCompletedRounds() stops at the
    //    first unresolved LADDER round, so anything after it is never evaluated.
    { key: 'regularSeasonWins', label: 'Wins', payoutLabel: 'Each Regular-Season Win', gameLabel: 'Season',
      teamsAdvancing: 32, payoutUnits: 272, parallel: true, flatRate: true, devigScope: 'field', unitLabel: 'win' },
    { key: 'divisionWinner', label: 'Div', payoutLabel: 'Win Division', gameLabel: 'Season',
      teamsAdvancing: 8, parallel: true, devigScope: 'group' },
    // ── Strictly nested "reach" ladder. Each rung is a true subset of the one
    //    above it, so a first-round bye still counts as reaching the divisional.
    { key: 'playoffBerth', label: 'Playoff', payoutLabel: 'Make Playoffs', gameLabel: 'Season',
      teamsAdvancing: 14, devigScope: 'global' },
    { key: 'reachDivisional', label: 'Div Rd', payoutLabel: 'Reach Divisional Round', gameLabel: 'Wild Card',
      teamsAdvancing: 8, devigScope: 'global' },
    { key: 'reachConfChamp', label: 'Conf Ch', payoutLabel: 'Reach Conference Championship', gameLabel: 'Divisional',
      teamsAdvancing: 4, devigScope: 'global' },
    { key: 'reachSuperBowl', label: 'SB', payoutLabel: 'Reach Super Bowl', gameLabel: 'Conf Champ',
      teamsAdvancing: 2, devigScope: 'global' },
    { key: 'superBowl', label: 'Champ', payoutLabel: 'Win Super Bowl', gameLabel: 'Super Bowl',
      teamsAdvancing: 1, devigScope: 'global' },
  ],
  groups: [
    { key: 'AFC_East', label: 'AFC East' },
    { key: 'AFC_North', label: 'AFC North' },
    { key: 'AFC_South', label: 'AFC South' },
    { key: 'AFC_West', label: 'AFC West' },
    { key: 'NFC_East', label: 'NFC East' },
    { key: 'NFC_North', label: 'NFC North' },
    { key: 'NFC_South', label: 'NFC South' },
    { key: 'NFC_West', label: 'NFC West' },
  ],
  // 'group' (not 'global'): divisionWinner normalizes within its division and sits
  // outside the cap chain; the reach-ladder is the capped monotone chain; the
  // per-win round is field-scoped. A 'global' strategy would clamp
  // P(make playoffs) <= P(12+ wins), which is nonsense.
  devigStrategy: 'group',
  defaultPayoutRules: {
    regularSeasonWins: 0.1029,
    divisionWinner: 2.0,
    playoffBerth: 0.75,
    reachDivisional: 1.5,
    reachConfChamp: 2.5,
    reachSuperBowl: 3.75,
    superBowl: 10.0,
    bestRecord: 3.0,
    worstRecord: 3.0,
  },
  defaultPotSize: 4000,
  propBets: [
    { key: 'bestRecord', label: 'Best Record in the NFL' },
    { key: 'worstRecord', label: 'Worst Record in the NFL' },
  ],
  badge: 'NFL 2026-27',
  teamLabel: 'Team',
  groupLabel: 'Division',
  startDate: '2026-09-10',
  // Super Bowl LXI — Sunday 2027-02-14, SoFi Stadium. Verified 2026-08-16.
  endDate: '2027-02-14',
  hostingOpensAt: '2026-08-20',
  isActive: true,
  strategyPrice: 1499,
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_NFL',
  liveSyncMatchers: ['nfl', 'nfl season'],
  previewTeamCount: 4,
};

/**
 * All 32 NFL teams for the 2026-27 season Calcutta.
 *
 * Probabilities are REAL Kalshi prediction-market prices (mid of yes_bid/yes_ask),
 * pre-normalized to each round's target so the runtime devig passes them through
 * unchanged. `americanOdds` is intentionally empty — odds.ts only honours
 * `probabilities` when no American odds are present.
 *
 * Generated: 2026-08-25 from Kalshi series KXNFLWINS-27 (expected wins),
 * KXNFL{AFC,NFC}{EAST,NORTH,SOUTH,WEST}-27 (division), KXNFLPLAYOFF-27 (berth),
 * KXNFLSTAGEOFELIM-27 (divisional / conf-championship rungs),
 * KXNFL{AFC,NFC}CHAMP-27 (Super Bowl appearance) and KXSB-27 (Super Bowl win).
 * Re-run: node scripts/fetch-nfl-odds.mjs   (no credentials — Kalshi reads are public)
 *
 * `id`, `seed`, `group` and the ordering below are preserved across re-runs — live
 * sessions' bundles reference ids by value. Don't reorder entries by hand.
 */
export const NFL_SEASON_2026_TEAMS: BaseTeam[] = [
  // AFC East
  { id: 1, name: 'Buffalo Bills', seed: 1, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 10.5145, divisionWinner: 0.5495, playoffBerth: 0.7315, reachDivisional: 0.4215, reachConfChamp: 0.1866, reachSuperBowl: 0.1436, superBowl: 0.0714 } },
  { id: 2, name: 'Miami Dolphins', seed: 2, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 4.3079, divisionWinner: 0.0248, playoffBerth: 0.0727, reachDivisional: 0.0727, reachConfChamp: 0.0684, reachSuperBowl: 0.005, superBowl: 0.0048 } },
  { id: 3, name: 'New York Jets', seed: 3, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 5.8546, divisionWinner: 0.0347, playoffBerth: 0.1163, reachDivisional: 0.1163, reachConfChamp: 0.074, reachSuperBowl: 0.005, superBowl: 0.0048 } },
  { id: 4, name: 'New England Patriots', seed: 4, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.8602, divisionWinner: 0.3911, playoffBerth: 0.6104, reachDivisional: 0.3219, reachConfChamp: 0.1449, reachSuperBowl: 0.0941, superBowl: 0.0429 } },
  // AFC North
  { id: 5, name: 'Baltimore Ravens', seed: 5, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.3857, divisionWinner: 0.4527, playoffBerth: 0.7073, reachDivisional: 0.4053, reachConfChamp: 0.2133, reachSuperBowl: 0.1238, superBowl: 0.0619 } },
  { id: 6, name: 'Cincinnati Bengals', seed: 6, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.1725, divisionWinner: 0.3333, playoffBerth: 0.6201, reachDivisional: 0.3308, reachConfChamp: 0.1557, reachSuperBowl: 0.0842, superBowl: 0.0429 } },
  { id: 7, name: 'Pittsburgh Steelers', seed: 7, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.3284, divisionWinner: 0.1791, playoffBerth: 0.3585, reachDivisional: 0.2039, reachConfChamp: 0.0963, reachSuperBowl: 0.0248, superBowl: 0.0143 } },
  { id: 8, name: 'Cleveland Browns', seed: 8, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 5.458, divisionWinner: 0.0348, playoffBerth: 0.1453, reachDivisional: 0.1145, reachConfChamp: 0.0669, reachSuperBowl: 0.005, superBowl: 0.0048 } },
  // AFC South
  { id: 9, name: 'Houston Texans', seed: 9, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 10.1923, divisionWinner: 0.4505, playoffBerth: 0.6298, reachDivisional: 0.369, reachConfChamp: 0.1765, reachSuperBowl: 0.0941, superBowl: 0.0429 } },
  { id: 10, name: 'Indianapolis Colts', seed: 10, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.8574, divisionWinner: 0.1832, playoffBerth: 0.3536, reachDivisional: 0.1773, reachConfChamp: 0.0933, reachSuperBowl: 0.0248, superBowl: 0.0143 } },
  { id: 11, name: 'Jacksonville Jaguars', seed: 11, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 9.1463, divisionWinner: 0.2822, playoffBerth: 0.5038, reachDivisional: 0.2754, reachConfChamp: 0.1281, reachSuperBowl: 0.0644, superBowl: 0.0238 } },
  { id: 12, name: 'Tennessee Titans', seed: 12, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.162, divisionWinner: 0.0842, playoffBerth: 0.1889, reachDivisional: 0.1424, reachConfChamp: 0.0756, reachSuperBowl: 0.0149, superBowl: 0.0048 } },
  // AFC West
  { id: 13, name: 'Kansas City Chiefs', seed: 13, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8701, divisionWinner: 0.3286, playoffBerth: 0.6249, reachDivisional: 0.3642, reachConfChamp: 0.1736, reachSuperBowl: 0.1139, superBowl: 0.0524 } },
  { id: 14, name: 'Los Angeles Chargers', seed: 14, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8255, divisionWinner: 0.3095, playoffBerth: 0.5716, reachDivisional: 0.3249, reachConfChamp: 0.1551, reachSuperBowl: 0.104, superBowl: 0.0429 } },
  { id: 15, name: 'Denver Broncos', seed: 15, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.7164, divisionWinner: 0.3095, playoffBerth: 0.5765, reachDivisional: 0.3435, reachConfChamp: 0.1678, reachSuperBowl: 0.0842, superBowl: 0.0429 } },
  { id: 16, name: 'Las Vegas Raiders', seed: 16, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 6.2116, divisionWinner: 0.0524, playoffBerth: 0.1308, reachDivisional: 0.101, reachConfChamp: 0.0511, reachSuperBowl: 0.0149, superBowl: 0.0048 } },
  // NFC East
  { id: 17, name: 'Philadelphia Eagles', seed: 17, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.9891, divisionWinner: 0.3839, playoffBerth: 0.6055, reachDivisional: 0.3245, reachConfChamp: 0.1515, reachSuperBowl: 0.0927, superBowl: 0.0429 } },
  { id: 18, name: 'Washington Commanders', seed: 18, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 7.1931, divisionWinner: 0.1374, playoffBerth: 0.2664, reachDivisional: 0.1522, reachConfChamp: 0.0822, reachSuperBowl: 0.0244, superBowl: 0.0143 } },
  { id: 19, name: 'Dallas Cowboys', seed: 19, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.6817, divisionWinner: 0.3412, playoffBerth: 0.528, reachDivisional: 0.307, reachConfChamp: 0.1568, reachSuperBowl: 0.0829, superBowl: 0.0429 } },
  { id: 20, name: 'New York Giants', seed: 20, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 7.3319, divisionWinner: 0.1374, playoffBerth: 0.2761, reachDivisional: 0.1513, reachConfChamp: 0.0796, reachSuperBowl: 0.0244, superBowl: 0.0143 } },
  // NFC North
  { id: 21, name: 'Detroit Lions', seed: 21, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.4699, divisionWinner: 0.3301, playoffBerth: 0.6346, reachDivisional: 0.3271, reachConfChamp: 0.1545, reachSuperBowl: 0.0829, superBowl: 0.0333 } },
  { id: 22, name: 'Green Bay Packers', seed: 22, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.4685, divisionWinner: 0.2632, playoffBerth: 0.5377, reachDivisional: 0.2917, reachConfChamp: 0.1437, reachSuperBowl: 0.0732, superBowl: 0.0333 } },
  { id: 23, name: 'Minnesota Vikings', seed: 23, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.9331, divisionWinner: 0.1722, playoffBerth: 0.4021, reachDivisional: 0.2314, reachConfChamp: 0.1101, reachSuperBowl: 0.0341, superBowl: 0.0143 } },
  { id: 24, name: 'Chicago Bears', seed: 24, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.4041, divisionWinner: 0.2344, playoffBerth: 0.4941, reachDivisional: 0.2096, reachConfChamp: 0.1034, reachSuperBowl: 0.0732, superBowl: 0.0333 } },
  // NFC South
  { id: 25, name: 'Tampa Bay Buccaneers', seed: 25, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 8.3036, divisionWinner: 0.3088, playoffBerth: 0.4069, reachDivisional: 0.2089, reachConfChamp: 0.0933, reachSuperBowl: 0.0341, superBowl: 0.0143 } },
  { id: 26, name: 'Atlanta Falcons', seed: 26, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.504, divisionWinner: 0.1814, playoffBerth: 0.2664, reachDivisional: 0.1153, reachConfChamp: 0.0593, reachSuperBowl: 0.0146, superBowl: 0.0048 } },
  { id: 27, name: 'New Orleans Saints', seed: 27, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.7979, divisionWinner: 0.2892, playoffBerth: 0.3343, reachDivisional: 0.1724, reachConfChamp: 0.0836, reachSuperBowl: 0.0146, superBowl: 0.0048 } },
  { id: 28, name: 'Carolina Panthers', seed: 28, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.1832, divisionWinner: 0.2206, playoffBerth: 0.3052, reachDivisional: 0.1355, reachConfChamp: 0.052, reachSuperBowl: 0.0146, superBowl: 0.0048 } },
  // NFC West
  { id: 29, name: 'San Francisco 49ers', seed: 29, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.4983, divisionWinner: 0.2092, playoffBerth: 0.5329, reachDivisional: 0.3182, reachConfChamp: 0.1325, reachSuperBowl: 0.0829, superBowl: 0.0429 } },
  { id: 30, name: 'Los Angeles Rams', seed: 30, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 11.5011, divisionWinner: 0.4847, playoffBerth: 0.7606, reachDivisional: 0.5335, reachConfChamp: 0.325, reachSuperBowl: 0.2244, superBowl: 0.1476 } },
  { id: 31, name: 'Seattle Seahawks', seed: 31, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 10.6881, divisionWinner: 0.2908, playoffBerth: 0.654, reachDivisional: 0.3835, reachConfChamp: 0.1922, reachSuperBowl: 0.122, superBowl: 0.0714 } },
  { id: 32, name: 'Arizona Cardinals', seed: 32, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 4.189, divisionWinner: 0.0153, playoffBerth: 0.0533, reachDivisional: 0.0533, reachConfChamp: 0.0533, reachSuperBowl: 0.0049, superBowl: 0.0048 } },
];
