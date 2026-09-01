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
  // Keep this near what real pools actually raise (median real drafted pot is
  // ~$1,900; the owner's own is ~$1,000). $4,000 read as wildly optimistic on
  // the pre-draft strategy page (Pat's walkthrough, 2026-09-01).
  defaultPotSize: 1000,
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
 * Generated: 2026-09-01 from Kalshi series KXNFLWINS-27 (expected wins),
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
  { id: 1, name: 'Buffalo Bills', seed: 1, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 10.3365, divisionWinner: 0.5495, playoffBerth: 0.7407, reachDivisional: 0.4663, reachConfChamp: 0.2357, reachSuperBowl: 0.1505, superBowl: 0.0708 } },
  { id: 2, name: 'Miami Dolphins', seed: 2, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 4.0512, divisionWinner: 0.0248, playoffBerth: 0.0589, reachDivisional: 0.0459, reachConfChamp: 0.0313, reachSuperBowl: 0.0049, superBowl: 0.0047 } },
  { id: 3, name: 'New York Jets', seed: 3, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 5.8484, divisionWinner: 0.0347, playoffBerth: 0.1177, reachDivisional: 0.0632, reachConfChamp: 0.0391, reachSuperBowl: 0.0049, superBowl: 0.0047 } },
  { id: 4, name: 'New England Patriots', seed: 4, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.835, divisionWinner: 0.3911, playoffBerth: 0.6377, reachDivisional: 0.3466, reachConfChamp: 0.1577, reachSuperBowl: 0.0922, superBowl: 0.0425 } },
  // AFC North
  { id: 5, name: 'Baltimore Ravens', seed: 5, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.128, divisionWinner: 0.4657, playoffBerth: 0.7064, reachDivisional: 0.4341, reachConfChamp: 0.2247, reachSuperBowl: 0.1214, superBowl: 0.0613 } },
  { id: 6, name: 'Cincinnati Bengals', seed: 6, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.8996, divisionWinner: 0.3284, playoffBerth: 0.623, reachDivisional: 0.3425, reachConfChamp: 0.1655, reachSuperBowl: 0.0825, superBowl: 0.0425 } },
  { id: 7, name: 'Pittsburgh Steelers', seed: 7, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.4846, divisionWinner: 0.1716, playoffBerth: 0.3532, reachDivisional: 0.181, reachConfChamp: 0.0763, reachSuperBowl: 0.0243, superBowl: 0.0142 } },
  { id: 8, name: 'Cleveland Browns', seed: 8, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 5.5704, divisionWinner: 0.0343, playoffBerth: 0.1226, reachDivisional: 0.0805, reachConfChamp: 0.0469, reachSuperBowl: 0.0049, superBowl: 0.0047 } },
  // AFC South
  { id: 9, name: 'Houston Texans', seed: 9, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 10.1577, divisionWinner: 0.4532, playoffBerth: 0.623, reachDivisional: 0.3906, reachConfChamp: 0.1959, reachSuperBowl: 0.0922, superBowl: 0.0425 } },
  { id: 10, name: 'Indianapolis Colts', seed: 10, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 8.2265, divisionWinner: 0.1921, playoffBerth: 0.363, reachDivisional: 0.1827, reachConfChamp: 0.0885, reachSuperBowl: 0.0243, superBowl: 0.0142 } },
  { id: 11, name: 'Jacksonville Jaguars', seed: 11, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 9.2988, divisionWinner: 0.2808, playoffBerth: 0.5053, reachDivisional: 0.2797, reachConfChamp: 0.1357, reachSuperBowl: 0.0631, superBowl: 0.0236 } },
  { id: 12, name: 'Tennessee Titans', seed: 12, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.1314, divisionWinner: 0.0739, playoffBerth: 0.1619, reachDivisional: 0.0891, reachConfChamp: 0.052, reachSuperBowl: 0.0146, superBowl: 0.0047 } },
  // AFC West
  { id: 13, name: 'Kansas City Chiefs', seed: 13, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8797, divisionWinner: 0.3317, playoffBerth: 0.6181, reachDivisional: 0.3647, reachConfChamp: 0.1819, reachSuperBowl: 0.1117, superBowl: 0.0519 } },
  { id: 14, name: 'Los Angeles Chargers', seed: 14, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8648, divisionWinner: 0.302, playoffBerth: 0.6034, reachDivisional: 0.3568, reachConfChamp: 0.1743, reachSuperBowl: 0.1019, superBowl: 0.0425 } },
  { id: 15, name: 'Denver Broncos', seed: 15, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8549, divisionWinner: 0.3119, playoffBerth: 0.5837, reachDivisional: 0.3513, reachConfChamp: 0.1687, reachSuperBowl: 0.0922, superBowl: 0.0425 } },
  { id: 16, name: 'Las Vegas Raiders', seed: 16, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 6.3449, divisionWinner: 0.0545, playoffBerth: 0.1472, reachDivisional: 0.078, reachConfChamp: 0.0393, reachSuperBowl: 0.0146, superBowl: 0.0047 } },
  // NFC East
  { id: 17, name: 'Philadelphia Eagles', seed: 17, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 10.0684, divisionWinner: 0.3932, playoffBerth: 0.6132, reachDivisional: 0.3453, reachConfChamp: 0.1657, reachSuperBowl: 0.0913, superBowl: 0.0425 } },
  { id: 18, name: 'Washington Commanders', seed: 18, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 6.9108, divisionWinner: 0.1117, playoffBerth: 0.2404, reachDivisional: 0.1307, reachConfChamp: 0.0714, reachSuperBowl: 0.024, superBowl: 0.0142 } },
  { id: 19, name: 'Dallas Cowboys', seed: 19, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.6067, divisionWinner: 0.3544, playoffBerth: 0.5249, reachDivisional: 0.2884, reachConfChamp: 0.1468, reachSuperBowl: 0.0817, superBowl: 0.0425 } },
  { id: 20, name: 'New York Giants', seed: 20, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 7.4867, divisionWinner: 0.1408, playoffBerth: 0.2649, reachDivisional: 0.1162, reachConfChamp: 0.0553, reachSuperBowl: 0.024, superBowl: 0.0142 } },
  // NFC North
  { id: 21, name: 'Detroit Lions', seed: 21, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.6046, divisionWinner: 0.335, playoffBerth: 0.6573, reachDivisional: 0.3553, reachConfChamp: 0.1632, reachSuperBowl: 0.0817, superBowl: 0.033 } },
  { id: 22, name: 'Green Bay Packers', seed: 22, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.3783, divisionWinner: 0.267, playoffBerth: 0.5151, reachDivisional: 0.2993, reachConfChamp: 0.1517, reachSuperBowl: 0.0721, superBowl: 0.033 } },
  { id: 23, name: 'Minnesota Vikings', seed: 23, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.6038, divisionWinner: 0.1796, playoffBerth: 0.4071, reachDivisional: 0.216, reachConfChamp: 0.1019, reachSuperBowl: 0.0337, superBowl: 0.0236 } },
  { id: 24, name: 'Chicago Bears', seed: 24, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.1996, divisionWinner: 0.2184, playoffBerth: 0.4954, reachDivisional: 0.2251, reachConfChamp: 0.1112, reachSuperBowl: 0.0721, superBowl: 0.033 } },
  // NFC South
  { id: 25, name: 'Tampa Bay Buccaneers', seed: 25, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 8.574, divisionWinner: 0.335, playoffBerth: 0.417, reachDivisional: 0.1928, reachConfChamp: 0.0877, reachSuperBowl: 0.0337, superBowl: 0.0142 } },
  { id: 26, name: 'Atlanta Falcons', seed: 26, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.8016, divisionWinner: 0.1823, playoffBerth: 0.2453, reachDivisional: 0.126, reachConfChamp: 0.0532, reachSuperBowl: 0.0144, superBowl: 0.0047 } },
  { id: 27, name: 'New Orleans Saints', seed: 27, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.9584, divisionWinner: 0.2709, playoffBerth: 0.3385, reachDivisional: 0.1531, reachConfChamp: 0.0695, reachSuperBowl: 0.0144, superBowl: 0.0047 } },
  { id: 28, name: 'Carolina Panthers', seed: 28, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.2683, divisionWinner: 0.2118, playoffBerth: 0.2894, reachDivisional: 0.1476, reachConfChamp: 0.0612, reachSuperBowl: 0.0144, superBowl: 0.0047 } },
  // NFC West
  { id: 29, name: 'San Francisco 49ers', seed: 29, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.413, divisionWinner: 0.204, playoffBerth: 0.5396, reachDivisional: 0.3161, reachConfChamp: 0.1357, reachSuperBowl: 0.0817, superBowl: 0.0425 } },
  { id: 30, name: 'Los Angeles Rams', seed: 30, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 11.4783, divisionWinner: 0.4975, playoffBerth: 0.7898, reachDivisional: 0.5607, reachConfChamp: 0.3402, reachSuperBowl: 0.2356, superBowl: 0.1462 } },
  { id: 31, name: 'Seattle Seahawks', seed: 31, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 10.5748, divisionWinner: 0.2935, playoffBerth: 0.6524, reachDivisional: 0.4303, reachConfChamp: 0.2358, reachSuperBowl: 0.1202, superBowl: 0.0708 } },
  { id: 32, name: 'Arizona Cardinals', seed: 32, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 4.1604, divisionWinner: 0.005, playoffBerth: 0.0441, reachDivisional: 0.0441, reachConfChamp: 0.0359, reachSuperBowl: 0.0048, superBowl: 0.0047 } },
];
