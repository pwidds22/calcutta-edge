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
  strategyPrice: 1999, // $19.99 — a season-long pool is 5 months of value, not 4 days
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_NFL',
  liveSyncMatchers: ['nfl', 'nfl season'],
  // `seed` is division-positional (Bills 1 ... Cardinals 32, in division order),
  // NOT a strength rank — the strongest team (LA Rams) is seed 30. Same
  // treatment as World Cup's within-group seed: sort/preview by value instead.
  defaultSort: 'valuePercentage',
  defaultSortDirection: 'desc',
  showSeedColumn: false,
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
  { id: 1, name: 'Buffalo Bills', seed: 1, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 10.5182, divisionWinner: 0.5495, playoffBerth: 0.7317, reachDivisional: 0.4461, reachConfChamp: 0.2019, reachSuperBowl: 0.1436, superBowl: 0.0714 } },
  { id: 2, name: 'Miami Dolphins', seed: 2, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 4.3094, divisionWinner: 0.0248, playoffBerth: 0.0727, reachDivisional: 0.0565, reachConfChamp: 0.0365, reachSuperBowl: 0.005, superBowl: 0.0048 } },
  { id: 3, name: 'New York Jets', seed: 3, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 5.8567, divisionWinner: 0.0347, playoffBerth: 0.1163, reachDivisional: 0.0662, reachConfChamp: 0.0424, reachSuperBowl: 0.005, superBowl: 0.0048 } },
  { id: 4, name: 'New England Patriots', seed: 4, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.8636, divisionWinner: 0.3911, playoffBerth: 0.6106, reachDivisional: 0.3415, reachConfChamp: 0.1578, reachSuperBowl: 0.0941, superBowl: 0.0429 } },
  // AFC North
  { id: 5, name: 'Baltimore Ravens', seed: 5, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.3893, divisionWinner: 0.4527, playoffBerth: 0.7075, reachDivisional: 0.4259, reachConfChamp: 0.2286, reachSuperBowl: 0.1238, superBowl: 0.0619 } },
  { id: 6, name: 'Cincinnati Bengals', seed: 6, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.176, divisionWinner: 0.3333, playoffBerth: 0.6203, reachDivisional: 0.344, reachConfChamp: 0.164, reachSuperBowl: 0.0842, superBowl: 0.0429 } },
  { id: 7, name: 'Pittsburgh Steelers', seed: 7, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.3114, divisionWinner: 0.1791, playoffBerth: 0.3586, reachDivisional: 0.1969, reachConfChamp: 0.0928, reachSuperBowl: 0.0248, superBowl: 0.0143 } },
  { id: 8, name: 'Cleveland Browns', seed: 8, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 5.45, divisionWinner: 0.0348, playoffBerth: 0.1454, reachDivisional: 0.0749, reachConfChamp: 0.044, reachSuperBowl: 0.005, superBowl: 0.0048 } },
  // AFC South
  { id: 9, name: 'Houston Texans', seed: 9, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 10.1958, divisionWinner: 0.4505, playoffBerth: 0.63, reachDivisional: 0.3904, reachConfChamp: 0.1913, reachSuperBowl: 0.0941, superBowl: 0.0429 } },
  { id: 10, name: 'Indianapolis Colts', seed: 10, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.8254, divisionWinner: 0.1832, playoffBerth: 0.3538, reachDivisional: 0.1675, reachConfChamp: 0.0889, reachSuperBowl: 0.0248, superBowl: 0.0143 } },
  { id: 11, name: 'Jacksonville Jaguars', seed: 11, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 9.1495, divisionWinner: 0.2822, playoffBerth: 0.504, reachDivisional: 0.2895, reachConfChamp: 0.1377, reachSuperBowl: 0.0644, superBowl: 0.0238 } },
  { id: 12, name: 'Tennessee Titans', seed: 12, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.1096, divisionWinner: 0.0842, playoffBerth: 0.189, reachDivisional: 0.1098, reachConfChamp: 0.0578, reachSuperBowl: 0.0149, superBowl: 0.0048 } },
  // AFC West
  { id: 13, name: 'Kansas City Chiefs', seed: 13, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8785, divisionWinner: 0.3286, playoffBerth: 0.6203, reachDivisional: 0.3779, reachConfChamp: 0.1817, reachSuperBowl: 0.1139, superBowl: 0.0524 } },
  { id: 14, name: 'Los Angeles Chargers', seed: 14, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8289, divisionWinner: 0.3095, playoffBerth: 0.5718, reachDivisional: 0.3403, reachConfChamp: 0.1655, reachSuperBowl: 0.104, superBowl: 0.0429 } },
  { id: 15, name: 'Denver Broncos', seed: 15, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.7148, divisionWinner: 0.3095, playoffBerth: 0.5767, reachDivisional: 0.3528, reachConfChamp: 0.1734, reachSuperBowl: 0.0842, superBowl: 0.0429 } },
  { id: 16, name: 'Las Vegas Raiders', seed: 16, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 6.2137, divisionWinner: 0.0524, playoffBerth: 0.1308, reachDivisional: 0.0708, reachConfChamp: 0.035, reachSuperBowl: 0.0149, superBowl: 0.0048 } },
  // NFC East
  { id: 17, name: 'Philadelphia Eagles', seed: 17, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.9925, divisionWinner: 0.3839, playoffBerth: 0.6009, reachDivisional: 0.3436, reachConfChamp: 0.1645, reachSuperBowl: 0.0931, superBowl: 0.0429 } },
  { id: 18, name: 'Washington Commanders', seed: 18, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 7.2204, divisionWinner: 0.1374, playoffBerth: 0.2665, reachDivisional: 0.1334, reachConfChamp: 0.0725, reachSuperBowl: 0.0245, superBowl: 0.0143 } },
  { id: 19, name: 'Dallas Cowboys', seed: 19, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.6851, divisionWinner: 0.3412, playoffBerth: 0.5282, reachDivisional: 0.3108, reachConfChamp: 0.16, reachSuperBowl: 0.0833, superBowl: 0.0429 } },
  { id: 20, name: 'New York Giants', seed: 20, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 7.3394, divisionWinner: 0.1374, playoffBerth: 0.2811, reachDivisional: 0.1257, reachConfChamp: 0.0658, reachSuperBowl: 0.0245, superBowl: 0.0143 } },
  // NFC North
  { id: 21, name: 'Detroit Lions', seed: 21, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.4785, divisionWinner: 0.3301, playoffBerth: 0.6348, reachDivisional: 0.3456, reachConfChamp: 0.1672, reachSuperBowl: 0.0833, superBowl: 0.0333 } },
  { id: 22, name: 'Green Bay Packers', seed: 22, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.4817, divisionWinner: 0.2632, playoffBerth: 0.5379, reachDivisional: 0.2991, reachConfChamp: 0.1493, reachSuperBowl: 0.0735, superBowl: 0.0333 } },
  { id: 23, name: 'Minnesota Vikings', seed: 23, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.9313, divisionWinner: 0.1722, playoffBerth: 0.4022, reachDivisional: 0.2252, reachConfChamp: 0.1073, reachSuperBowl: 0.0343, superBowl: 0.0143 } },
  { id: 24, name: 'Chicago Bears', seed: 24, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.4074, divisionWinner: 0.2344, playoffBerth: 0.4943, reachDivisional: 0.229, reachConfChamp: 0.117, reachSuperBowl: 0.0735, superBowl: 0.0333 } },
  // NFC South
  { id: 25, name: 'Tampa Bay Buccaneers', seed: 25, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 8.2816, divisionWinner: 0.3119, playoffBerth: 0.4071, reachDivisional: 0.1963, reachConfChamp: 0.086, reachSuperBowl: 0.0343, superBowl: 0.0143 } },
  { id: 26, name: 'Atlanta Falcons', seed: 26, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.5063, divisionWinner: 0.1832, playoffBerth: 0.2665, reachDivisional: 0.0994, reachConfChamp: 0.0513, reachSuperBowl: 0.0147, superBowl: 0.0048 } },
  { id: 27, name: 'New Orleans Saints', seed: 27, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.8056, divisionWinner: 0.2822, playoffBerth: 0.3344, reachDivisional: 0.1441, reachConfChamp: 0.0679, reachSuperBowl: 0.0147, superBowl: 0.0048 } },
  { id: 28, name: 'Carolina Panthers', seed: 28, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.1857, divisionWinner: 0.2228, playoffBerth: 0.3053, reachDivisional: 0.1438, reachConfChamp: 0.0567, reachSuperBowl: 0.0147, superBowl: 0.0048 } },
  // NFC West
  { id: 29, name: 'San Francisco 49ers', seed: 29, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.5016, divisionWinner: 0.2092, playoffBerth: 0.5331, reachDivisional: 0.3279, reachConfChamp: 0.1365, reachSuperBowl: 0.0833, superBowl: 0.0429 } },
  { id: 30, name: 'Los Angeles Rams', seed: 30, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 11.505, divisionWinner: 0.4847, playoffBerth: 0.7608, reachDivisional: 0.5655, reachConfChamp: 0.3533, reachSuperBowl: 0.2206, superBowl: 0.1476 } },
  { id: 31, name: 'Seattle Seahawks', seed: 31, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 10.6918, divisionWinner: 0.2908, playoffBerth: 0.6542, reachDivisional: 0.4063, reachConfChamp: 0.2089, reachSuperBowl: 0.1225, superBowl: 0.0714 } },
  { id: 32, name: 'Arizona Cardinals', seed: 32, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 4.1954, divisionWinner: 0.0153, playoffBerth: 0.0533, reachDivisional: 0.0533, reachConfChamp: 0.0365, reachSuperBowl: 0.0049, superBowl: 0.0048 } },
];
