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
 * Generated: 2026-09-02 from Kalshi series KXNFLWINS-27 (expected wins),
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
  { id: 1, name: 'Buffalo Bills', seed: 1, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 10.388, divisionWinner: 0.5495, playoffBerth: 0.741, reachDivisional: 0.4538, reachConfChamp: 0.2307, reachSuperBowl: 0.1505, superBowl: 0.0711 } },
  { id: 2, name: 'Miami Dolphins', seed: 2, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 4.1314, divisionWinner: 0.0248, playoffBerth: 0.0687, reachDivisional: 0.0466, reachConfChamp: 0.0323, reachSuperBowl: 0.0049, superBowl: 0.0047 } },
  { id: 3, name: 'New York Jets', seed: 3, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 5.6558, divisionWinner: 0.0347, playoffBerth: 0.1129, reachDivisional: 0.0625, reachConfChamp: 0.0392, reachSuperBowl: 0.0049, superBowl: 0.0047 } },
  { id: 4, name: 'New England Patriots', seed: 4, group: 'AFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.7772, divisionWinner: 0.3911, playoffBerth: 0.6134, reachDivisional: 0.3608, reachConfChamp: 0.168, reachSuperBowl: 0.0922, superBowl: 0.0427 } },
  // AFC North
  { id: 5, name: 'Baltimore Ravens', seed: 5, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.1348, divisionWinner: 0.4657, playoffBerth: 0.7164, reachDivisional: 0.4333, reachConfChamp: 0.2152, reachSuperBowl: 0.1214, superBowl: 0.0616 } },
  { id: 6, name: 'Cincinnati Bengals', seed: 6, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.0404, divisionWinner: 0.3284, playoffBerth: 0.6232, reachDivisional: 0.3445, reachConfChamp: 0.1623, reachSuperBowl: 0.0825, superBowl: 0.0427 } },
  { id: 7, name: 'Pittsburgh Steelers', seed: 7, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.3968, divisionWinner: 0.1716, playoffBerth: 0.3484, reachDivisional: 0.1818, reachConfChamp: 0.0759, reachSuperBowl: 0.0243, superBowl: 0.0047 } },
  { id: 8, name: 'Cleveland Browns', seed: 8, group: 'AFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 5.5515, divisionWinner: 0.0343, playoffBerth: 0.1227, reachDivisional: 0.0703, reachConfChamp: 0.0395, reachSuperBowl: 0.0049, superBowl: 0.0047 } },
  // AFC South
  { id: 9, name: 'Houston Texans', seed: 9, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 10.095, divisionWinner: 0.4612, playoffBerth: 0.6232, reachDivisional: 0.3863, reachConfChamp: 0.194, reachSuperBowl: 0.0922, superBowl: 0.0427 } },
  { id: 10, name: 'Indianapolis Colts', seed: 10, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 8.2131, divisionWinner: 0.1893, playoffBerth: 0.3631, reachDivisional: 0.1878, reachConfChamp: 0.0924, reachSuperBowl: 0.0243, superBowl: 0.0142 } },
  { id: 11, name: 'Jacksonville Jaguars', seed: 11, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 9.2708, divisionWinner: 0.2767, playoffBerth: 0.5054, reachDivisional: 0.2752, reachConfChamp: 0.1299, reachSuperBowl: 0.0631, superBowl: 0.0237 } },
  { id: 12, name: 'Tennessee Titans', seed: 12, group: 'AFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.0084, divisionWinner: 0.0728, playoffBerth: 0.1619, reachDivisional: 0.085, reachConfChamp: 0.0473, reachSuperBowl: 0.0146, superBowl: 0.0047 } },
  // AFC West
  { id: 13, name: 'Kansas City Chiefs', seed: 13, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.8567, divisionWinner: 0.3317, playoffBerth: 0.6232, reachDivisional: 0.3544, reachConfChamp: 0.1731, reachSuperBowl: 0.1117, superBowl: 0.0521 } },
  { id: 14, name: 'Los Angeles Chargers', seed: 14, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.7822, divisionWinner: 0.302, playoffBerth: 0.5987, reachDivisional: 0.344, reachConfChamp: 0.1679, reachSuperBowl: 0.1019, superBowl: 0.0427 } },
  { id: 15, name: 'Denver Broncos', seed: 15, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.7375, divisionWinner: 0.3119, playoffBerth: 0.5839, reachDivisional: 0.3295, reachConfChamp: 0.1579, reachSuperBowl: 0.0922, superBowl: 0.0427 } },
  { id: 16, name: 'Las Vegas Raiders', seed: 16, group: 'AFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 6.1822, divisionWinner: 0.0545, playoffBerth: 0.1423, reachDivisional: 0.0806, reachConfChamp: 0.0412, reachSuperBowl: 0.0146, superBowl: 0.0047 } },
  // NFC East
  { id: 17, name: 'Philadelphia Eagles', seed: 17, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 10.2291, divisionWinner: 0.3894, playoffBerth: 0.6085, reachDivisional: 0.3512, reachConfChamp: 0.1693, reachSuperBowl: 0.0913, superBowl: 0.0427 } },
  { id: 18, name: 'Washington Commanders', seed: 18, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 7.0213, divisionWinner: 0.1106, playoffBerth: 0.2601, reachDivisional: 0.1353, reachConfChamp: 0.0751, reachSuperBowl: 0.024, superBowl: 0.0142 } },
  { id: 19, name: 'Dallas Cowboys', seed: 19, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 9.6829, divisionWinner: 0.3606, playoffBerth: 0.53, reachDivisional: 0.3076, reachConfChamp: 0.1478, reachSuperBowl: 0.0817, superBowl: 0.0427 } },
  { id: 20, name: 'New York Giants', seed: 20, group: 'NFC_East', americanOdds: {}, probabilities: { regularSeasonWins: 7.4236, divisionWinner: 0.1394, playoffBerth: 0.2748, reachDivisional: 0.1258, reachConfChamp: 0.0612, reachSuperBowl: 0.024, superBowl: 0.0142 } },
  // NFC North
  { id: 21, name: 'Detroit Lions', seed: 21, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 10.5966, divisionWinner: 0.3382, playoffBerth: 0.6526, reachDivisional: 0.3612, reachConfChamp: 0.1666, reachSuperBowl: 0.0817, superBowl: 0.0332 } },
  { id: 22, name: 'Green Bay Packers', seed: 22, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.3999, divisionWinner: 0.2696, playoffBerth: 0.5152, reachDivisional: 0.2955, reachConfChamp: 0.1453, reachSuperBowl: 0.0721, superBowl: 0.0332 } },
  { id: 23, name: 'Minnesota Vikings', seed: 23, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 8.7345, divisionWinner: 0.1814, playoffBerth: 0.4073, reachDivisional: 0.2169, reachConfChamp: 0.1075, reachSuperBowl: 0.0337, superBowl: 0.0237 } },
  { id: 24, name: 'Chicago Bears', seed: 24, group: 'NFC_North', americanOdds: {}, probabilities: { regularSeasonWins: 9.2211, divisionWinner: 0.2108, playoffBerth: 0.4956, reachDivisional: 0.2486, reachConfChamp: 0.13, reachSuperBowl: 0.0721, superBowl: 0.0332 } },
  // NFC South
  { id: 25, name: 'Tampa Bay Buccaneers', seed: 25, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 8.5557, divisionWinner: 0.3416, playoffBerth: 0.4122, reachDivisional: 0.2044, reachConfChamp: 0.0936, reachSuperBowl: 0.0337, superBowl: 0.0142 } },
  { id: 26, name: 'Atlanta Falcons', seed: 26, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 6.8922, divisionWinner: 0.1832, playoffBerth: 0.2503, reachDivisional: 0.1213, reachConfChamp: 0.0579, reachSuperBowl: 0.0144, superBowl: 0.0047 } },
  { id: 27, name: 'New Orleans Saints', seed: 27, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 8.0244, divisionWinner: 0.2723, playoffBerth: 0.3386, reachDivisional: 0.1633, reachConfChamp: 0.0781, reachSuperBowl: 0.0144, superBowl: 0.0047 } },
  { id: 28, name: 'Carolina Panthers', seed: 28, group: 'NFC_South', americanOdds: {}, probabilities: { regularSeasonWins: 7.1653, divisionWinner: 0.203, playoffBerth: 0.2895, reachDivisional: 0.1499, reachConfChamp: 0.063, reachSuperBowl: 0.0144, superBowl: 0.0047 } },
  // NFC West
  { id: 29, name: 'San Francisco 49ers', seed: 29, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 9.3899, divisionWinner: 0.201, playoffBerth: 0.5398, reachDivisional: 0.2983, reachConfChamp: 0.1411, reachSuperBowl: 0.0817, superBowl: 0.0427 } },
  { id: 30, name: 'Los Angeles Rams', seed: 30, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 11.7784, divisionWinner: 0.5049, playoffBerth: 0.7802, reachDivisional: 0.564, reachConfChamp: 0.3449, reachSuperBowl: 0.2356, superBowl: 0.1517 } },
  { id: 31, name: 'Seattle Seahawks', seed: 31, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 10.5022, divisionWinner: 0.2892, playoffBerth: 0.6526, reachDivisional: 0.4161, reachConfChamp: 0.2147, reachSuperBowl: 0.1202, superBowl: 0.0711 } },
  { id: 32, name: 'Arizona Cardinals', seed: 32, group: 'NFC_West', americanOdds: {}, probabilities: { regularSeasonWins: 4.1612, divisionWinner: 0.0049, playoffBerth: 0.0442, reachDivisional: 0.0442, reachConfChamp: 0.0369, reachSuperBowl: 0.0048, superBowl: 0.0047 } },
];
