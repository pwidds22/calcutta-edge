import type { TournamentConfig, BaseTeam } from '../types';

export const KENTUCKY_DERBY_2026_CONFIG: TournamentConfig = {
  id: 'kentucky_derby_2026',
  name: 'Kentucky Derby 2026',
  sport: 'horse_racing',
  rounds: [
    { key: 'show', label: 'Show', teamsAdvancing: 3, payoutLabel: 'Show (Top 3)', gameLabel: 'Race' },
    { key: 'place', label: 'Place', teamsAdvancing: 2, payoutLabel: 'Place (Top 2)', gameLabel: 'Race' },
    { key: 'win', label: 'Win', teamsAdvancing: 1, payoutLabel: 'Win', gameLabel: 'Race' },
  ],
  groups: [
    { key: 'favorites', label: 'Favorites' },
    { key: 'contenders', label: 'Contenders' },
    { key: 'longshots', label: 'Longshots' },
  ],
  devigStrategy: 'global',
  defaultPayoutRules: {
    show: 5.00,
    place: 10.00,
    win: 65.00,
    bestName: 0.0,
  },
  defaultPotSize: 5000,
  propBets: [
    { key: 'bestName', label: 'Best Horse Name' },
  ],
  badge: 'Kentucky Derby 2026',
  teamLabel: 'Horse',
  groupLabel: 'Tier',
  startDate: '2026-05-02',
  hostingOpensAt: '2026-04-18',
  isActive: false,
};

/**
 * 2026 Kentucky Derby futures — real horses with sportsbook odds.
 * Win odds sourced from Caesars Sportsbook via horseracingnation.com (Feb 2026).
 * Original fractional odds converted to American format (e.g., 6-1 = +600).
 * Show/place odds derived from win odds using standard probability scaling.
 * Field will be finalized closer to race day (20-horse max on Derby day).
 */
export const KENTUCKY_DERBY_2026_TEAMS: BaseTeam[] = [
  // Favorites (seeds 1-5)
  { id: 1, name: 'Paladin', seed: 1, group: 'favorites', americanOdds: { show: -150, place: +100, win: +600 } },
  { id: 2, name: 'Nearly', seed: 2, group: 'favorites', americanOdds: { show: -100, place: +200, win: +1000 } },
  { id: 3, name: 'Renegade', seed: 3, group: 'favorites', americanOdds: { show: -100, place: +200, win: +1000 } },
  { id: 4, name: 'Silent Tactic', seed: 4, group: 'favorites', americanOdds: { show: +100, place: +250, win: +1200 } },
  { id: 5, name: 'Chief Wallabee', seed: 5, group: 'favorites', americanOdds: { show: +120, place: +350, win: +1600 } },

  // Contenders (seeds 6-12)
  { id: 6, name: 'Further Ado', seed: 6, group: 'contenders', americanOdds: { show: +140, place: +400, win: +1800 } },
  { id: 7, name: 'Plutarch', seed: 7, group: 'contenders', americanOdds: { show: +140, place: +400, win: +1800 } },
  { id: 8, name: 'Boyd', seed: 8, group: 'contenders', americanOdds: { show: +140, place: +400, win: +1800 } },
  { id: 9, name: 'Canaletto', seed: 9, group: 'contenders', americanOdds: { show: +170, place: +500, win: +2200 } },
  { id: 10, name: 'Napoleon Solo', seed: 10, group: 'contenders', americanOdds: { show: +170, place: +500, win: +2200 } },
  { id: 11, name: 'Jackson Hole', seed: 11, group: 'contenders', americanOdds: { show: +200, place: +600, win: +2500 } },
  { id: 12, name: 'Golden Tempo', seed: 12, group: 'contenders', americanOdds: { show: +200, place: +600, win: +2500 } },

  // Longshots (seeds 13-20)
  { id: 13, name: 'Cannoneer', seed: 13, group: 'longshots', americanOdds: { show: +230, place: +700, win: +2800 } },
  { id: 14, name: 'Litmus Test', seed: 14, group: 'longshots', americanOdds: { show: +230, place: +700, win: +2800 } },
  { id: 15, name: 'Commandment', seed: 15, group: 'longshots', americanOdds: { show: +250, place: +750, win: +3000 } },
  { id: 16, name: 'Blackout Time', seed: 16, group: 'longshots', americanOdds: { show: +250, place: +750, win: +3000 } },
  { id: 17, name: 'Brant', seed: 17, group: 'longshots', americanOdds: { show: +250, place: +750, win: +3000 } },
  { id: 18, name: 'Six Speed', seed: 18, group: 'longshots', americanOdds: { show: +280, place: +850, win: +3300 } },
  { id: 19, name: 'Intrepido', seed: 19, group: 'longshots', americanOdds: { show: +300, place: +900, win: +3500 } },
  { id: 20, name: 'Potente', seed: 20, group: 'longshots', americanOdds: { show: +300, place: +900, win: +3500 } },
];
