import type { TournamentConfig, BaseTeam } from '../types';

export const NFL_PLAYOFFS_2026_CONFIG: TournamentConfig = {
  id: 'nfl_playoffs_2026',
  name: 'NFL Playoffs 2026',
  sport: 'nfl',
  rounds: [
    { key: 'wildcard', label: 'WC', teamsAdvancing: 8, payoutLabel: 'Win Wild Card', gameLabel: 'Wild Card' },
    { key: 'divisional', label: 'Div', teamsAdvancing: 4, payoutLabel: 'Win Divisional', gameLabel: 'Divisional' },
    { key: 'conference', label: 'Conf', teamsAdvancing: 2, payoutLabel: 'Win Conference', gameLabel: 'Conference' },
    { key: 'superBowl', label: 'SB', teamsAdvancing: 1, payoutLabel: 'Win Super Bowl', gameLabel: 'Super Bowl' },
  ],
  groups: [
    { key: 'AFC', label: 'AFC' },
    { key: 'NFC', label: 'NFC' },
  ],
  devigStrategy: 'global',
  defaultPayoutRules: {
    wildcard: 2.0,
    divisional: 4.0,
    conference: 8.0,
    superBowl: 30.0,
    mvp: 0.0,
  },
  defaultPotSize: 10000,
  propBets: [
    { key: 'mvp', label: 'Super Bowl MVP' },
  ],
  badge: 'NFL Playoffs 2026',
  teamLabel: 'Team',
  groupLabel: 'Conference',
  startDate: '2026-01-10',
  isActive: false,
};

/**
 * 2026 NFL Playoff teams — placeholder based on typical field.
 * 14 teams (7 per conference), seeded 1-7.
 * Odds will be updated when actual playoff field is set.
 */
export const NFL_PLAYOFFS_2026_TEAMS: BaseTeam[] = [
  // AFC
  { id: 1, name: 'Kansas City Chiefs', seed: 1, group: 'AFC', americanOdds: { wildcard: -10000, divisional: -200, conference: +150, superBowl: +300 } },
  { id: 2, name: 'Buffalo Bills', seed: 2, group: 'AFC', americanOdds: { wildcard: -10000, divisional: -150, conference: +200, superBowl: +400 } },
  { id: 3, name: 'Baltimore Ravens', seed: 3, group: 'AFC', americanOdds: { wildcard: -300, divisional: +100, conference: +300, superBowl: +600 } },
  { id: 4, name: 'Houston Texans', seed: 4, group: 'AFC', americanOdds: { wildcard: -250, divisional: +130, conference: +400, superBowl: +800 } },
  { id: 5, name: 'Pittsburgh Steelers', seed: 5, group: 'AFC', americanOdds: { wildcard: +100, divisional: +250, conference: +600, superBowl: +1500 } },
  { id: 6, name: 'Los Angeles Chargers', seed: 6, group: 'AFC', americanOdds: { wildcard: +110, divisional: +280, conference: +700, superBowl: +1800 } },
  { id: 7, name: 'Denver Broncos', seed: 7, group: 'AFC', americanOdds: { wildcard: +150, divisional: +400, conference: +1000, superBowl: +3000 } },
  // NFC
  { id: 8, name: 'Detroit Lions', seed: 1, group: 'NFC', americanOdds: { wildcard: -10000, divisional: -200, conference: +150, superBowl: +350 } },
  { id: 9, name: 'Philadelphia Eagles', seed: 2, group: 'NFC', americanOdds: { wildcard: -10000, divisional: -150, conference: +200, superBowl: +450 } },
  { id: 10, name: 'Minnesota Vikings', seed: 3, group: 'NFC', americanOdds: { wildcard: -300, divisional: +100, conference: +350, superBowl: +700 } },
  { id: 11, name: 'Tampa Bay Buccaneers', seed: 4, group: 'NFC', americanOdds: { wildcard: -250, divisional: +150, conference: +400, superBowl: +900 } },
  { id: 12, name: 'Los Angeles Rams', seed: 5, group: 'NFC', americanOdds: { wildcard: +100, divisional: +250, conference: +600, superBowl: +1400 } },
  { id: 13, name: 'Washington Commanders', seed: 6, group: 'NFC', americanOdds: { wildcard: +120, divisional: +300, conference: +700, superBowl: +2000 } },
  { id: 14, name: 'Green Bay Packers', seed: 7, group: 'NFC', americanOdds: { wildcard: +130, divisional: +350, conference: +800, superBowl: +2500 } },
];
