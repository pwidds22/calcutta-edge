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
 * Odds are placeholders — will be updated when preseason odds drop (~August 2026).
 * Seeded by rough power ranking; odds represent futures for each payout tier.
 */
export const NFL_SEASON_2026_TEAMS: BaseTeam[] = [
  // AFC East
  { id: 1, name: 'Buffalo Bills', seed: 1, group: 'AFC_East', americanOdds: { playoffBerth: -400, divisionWinner: -200, conferenceChamp: +300, superBowl: +600 } },
  { id: 2, name: 'Miami Dolphins', seed: 2, group: 'AFC_East', americanOdds: { playoffBerth: +100, divisionWinner: +250, conferenceChamp: +1200, superBowl: +2500 } },
  { id: 3, name: 'New York Jets', seed: 3, group: 'AFC_East', americanOdds: { playoffBerth: +150, divisionWinner: +400, conferenceChamp: +1800, superBowl: +4000 } },
  { id: 4, name: 'New England Patriots', seed: 4, group: 'AFC_East', americanOdds: { playoffBerth: +500, divisionWinner: +1200, conferenceChamp: +5000, superBowl: +10000 } },
  // AFC North
  { id: 5, name: 'Baltimore Ravens', seed: 5, group: 'AFC_North', americanOdds: { playoffBerth: -350, divisionWinner: -150, conferenceChamp: +350, superBowl: +700 } },
  { id: 6, name: 'Cincinnati Bengals', seed: 6, group: 'AFC_North', americanOdds: { playoffBerth: +110, divisionWinner: +300, conferenceChamp: +1400, superBowl: +3000 } },
  { id: 7, name: 'Pittsburgh Steelers', seed: 7, group: 'AFC_North', americanOdds: { playoffBerth: +130, divisionWinner: +350, conferenceChamp: +1600, superBowl: +3500 } },
  { id: 8, name: 'Cleveland Browns', seed: 8, group: 'AFC_North', americanOdds: { playoffBerth: +400, divisionWinner: +1000, conferenceChamp: +4000, superBowl: +8000 } },
  // AFC South
  { id: 9, name: 'Houston Texans', seed: 9, group: 'AFC_South', americanOdds: { playoffBerth: -300, divisionWinner: -180, conferenceChamp: +500, superBowl: +1000 } },
  { id: 10, name: 'Indianapolis Colts', seed: 10, group: 'AFC_South', americanOdds: { playoffBerth: +140, divisionWinner: +350, conferenceChamp: +1800, superBowl: +4000 } },
  { id: 11, name: 'Jacksonville Jaguars', seed: 11, group: 'AFC_South', americanOdds: { playoffBerth: +300, divisionWinner: +700, conferenceChamp: +3000, superBowl: +6000 } },
  { id: 12, name: 'Tennessee Titans', seed: 12, group: 'AFC_South', americanOdds: { playoffBerth: +500, divisionWinner: +1200, conferenceChamp: +5000, superBowl: +10000 } },
  // AFC West
  { id: 13, name: 'Kansas City Chiefs', seed: 13, group: 'AFC_West', americanOdds: { playoffBerth: -500, divisionWinner: -250, conferenceChamp: +200, superBowl: +400 } },
  { id: 14, name: 'Los Angeles Chargers', seed: 14, group: 'AFC_West', americanOdds: { playoffBerth: +100, divisionWinner: +300, conferenceChamp: +1200, superBowl: +2500 } },
  { id: 15, name: 'Denver Broncos', seed: 15, group: 'AFC_West', americanOdds: { playoffBerth: +200, divisionWinner: +500, conferenceChamp: +2000, superBowl: +4500 } },
  { id: 16, name: 'Las Vegas Raiders', seed: 16, group: 'AFC_West', americanOdds: { playoffBerth: +600, divisionWinner: +1500, conferenceChamp: +6000, superBowl: +12000 } },
  // NFC East
  { id: 17, name: 'Philadelphia Eagles', seed: 17, group: 'NFC_East', americanOdds: { playoffBerth: -350, divisionWinner: -180, conferenceChamp: +300, superBowl: +600 } },
  { id: 18, name: 'Washington Commanders', seed: 18, group: 'NFC_East', americanOdds: { playoffBerth: +120, divisionWinner: +350, conferenceChamp: +1500, superBowl: +3000 } },
  { id: 19, name: 'Dallas Cowboys', seed: 19, group: 'NFC_East', americanOdds: { playoffBerth: +200, divisionWinner: +500, conferenceChamp: +2000, superBowl: +4500 } },
  { id: 20, name: 'New York Giants', seed: 20, group: 'NFC_East', americanOdds: { playoffBerth: +600, divisionWinner: +1500, conferenceChamp: +6000, superBowl: +15000 } },
  // NFC North
  { id: 21, name: 'Detroit Lions', seed: 21, group: 'NFC_North', americanOdds: { playoffBerth: -400, divisionWinner: -200, conferenceChamp: +250, superBowl: +500 } },
  { id: 22, name: 'Green Bay Packers', seed: 22, group: 'NFC_North', americanOdds: { playoffBerth: +100, divisionWinner: +280, conferenceChamp: +1200, superBowl: +2500 } },
  { id: 23, name: 'Minnesota Vikings', seed: 23, group: 'NFC_North', americanOdds: { playoffBerth: +120, divisionWinner: +320, conferenceChamp: +1400, superBowl: +3000 } },
  { id: 24, name: 'Chicago Bears', seed: 24, group: 'NFC_North', americanOdds: { playoffBerth: +350, divisionWinner: +800, conferenceChamp: +3500, superBowl: +7000 } },
  // NFC South
  { id: 25, name: 'Tampa Bay Buccaneers', seed: 25, group: 'NFC_South', americanOdds: { playoffBerth: -150, divisionWinner: +100, conferenceChamp: +1000, superBowl: +2000 } },
  { id: 26, name: 'Atlanta Falcons', seed: 26, group: 'NFC_South', americanOdds: { playoffBerth: +150, divisionWinner: +350, conferenceChamp: +1800, superBowl: +4000 } },
  { id: 27, name: 'New Orleans Saints', seed: 27, group: 'NFC_South', americanOdds: { playoffBerth: +300, divisionWinner: +600, conferenceChamp: +2500, superBowl: +5000 } },
  { id: 28, name: 'Carolina Panthers', seed: 28, group: 'NFC_South', americanOdds: { playoffBerth: +600, divisionWinner: +1500, conferenceChamp: +6000, superBowl: +12000 } },
  // NFC West
  { id: 29, name: 'San Francisco 49ers', seed: 29, group: 'NFC_West', americanOdds: { playoffBerth: -250, divisionWinner: -120, conferenceChamp: +400, superBowl: +800 } },
  { id: 30, name: 'Los Angeles Rams', seed: 30, group: 'NFC_West', americanOdds: { playoffBerth: +130, divisionWinner: +300, conferenceChamp: +1400, superBowl: +3000 } },
  { id: 31, name: 'Seattle Seahawks', seed: 31, group: 'NFC_West', americanOdds: { playoffBerth: +200, divisionWinner: +500, conferenceChamp: +2000, superBowl: +4500 } },
  { id: 32, name: 'Arizona Cardinals', seed: 32, group: 'NFC_West', americanOdds: { playoffBerth: +400, divisionWinner: +1000, conferenceChamp: +4000, superBowl: +8000 } },
];
