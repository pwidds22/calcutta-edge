import type { TournamentConfig, BaseTeam } from '../types';

export const MASTERS_2026_CONFIG: TournamentConfig = {
  id: 'masters_2026',
  name: 'The Masters 2026',
  sport: 'golf',
  rounds: [
    { key: 'makeCut', label: 'Cut', teamsAdvancing: 50, payoutLabel: 'Make the Cut', gameLabel: 'Cut' },
    { key: 'top20', label: 'T20', teamsAdvancing: 20, payoutLabel: 'Top 20', gameLabel: 'Top 20' },
    { key: 'top10', label: 'T10', teamsAdvancing: 10, payoutLabel: 'Top 10', gameLabel: 'Top 10' },
    { key: 'top5', label: 'T5', teamsAdvancing: 5, payoutLabel: 'Top 5', gameLabel: 'Top 5' },
    { key: 'winner', label: 'Win', teamsAdvancing: 1, payoutLabel: 'Winner', gameLabel: 'Final' },
  ],
  groups: [
    { key: 'favorites', label: 'Favorites' },
    { key: 'contenders', label: 'Contenders' },
    { key: 'longshots', label: 'Longshots' },
    { key: 'fieldPlayers', label: 'Field' },
  ],
  devigStrategy: 'global',
  defaultPayoutRules: {
    makeCut: 0.10,
    top20: 0.50,
    top10: 1.50,
    top5: 4.00,
    winner: 50.00,
    lowRound: 0.0,
  },
  defaultPotSize: 5000,
  propBets: [
    { key: 'lowRound', label: 'Low Round' },
  ],
  badge: 'The Masters 2026',
  teamLabel: 'Golfer',
  groupLabel: 'Tier',
  startDate: '2026-04-09',
  hostingOpensAt: '2026-03-26',
  isActive: false,
};

/**
 * 2026 Masters field — real golfers with sportsbook-sourced outright winner odds.
 * Winner odds from DraftKings/sportsbettingdime (Feb 2026).
 * Intermediate odds (cut/top20/top10/top5) derived from winner odds using
 * standard probability scaling. Will be updated closer to tournament.
 */
export const MASTERS_2026_TEAMS: BaseTeam[] = [
  // Favorites (seeds 1-6)
  { id: 1, name: 'Scottie Scheffler', seed: 1, group: 'favorites', americanOdds: { makeCut: -900, top20: -250, top10: +100, top5: +200, winner: +300 } },
  { id: 2, name: 'Rory McIlroy', seed: 2, group: 'favorites', americanOdds: { makeCut: -700, top20: -180, top10: +140, top5: +300, winner: +500 } },
  { id: 3, name: 'Xander Schauffele', seed: 3, group: 'favorites', americanOdds: { makeCut: -450, top20: +100, top10: +250, top5: +550, winner: +1100 } },
  { id: 4, name: 'Bryson DeChambeau', seed: 4, group: 'favorites', americanOdds: { makeCut: -420, top20: +110, top10: +270, top5: +600, winner: +1200 } },
  { id: 5, name: 'Jon Rahm', seed: 5, group: 'favorites', americanOdds: { makeCut: -400, top20: +120, top10: +300, top5: +650, winner: +1400 } },
  { id: 6, name: 'Ludvig Aberg', seed: 6, group: 'favorites', americanOdds: { makeCut: -400, top20: +120, top10: +300, top5: +650, winner: +1400 } },

  // Contenders (seeds 7-16)
  { id: 7, name: 'Collin Morikawa', seed: 7, group: 'contenders', americanOdds: { makeCut: -350, top20: +150, top10: +400, top5: +800, winner: +1800 } },
  { id: 8, name: 'Justin Thomas', seed: 8, group: 'contenders', americanOdds: { makeCut: -280, top20: +200, top10: +500, top5: +1100, winner: +2500 } },
  { id: 9, name: 'Hideki Matsuyama', seed: 9, group: 'contenders', americanOdds: { makeCut: -250, top20: +220, top10: +550, top5: +1300, winner: +3000 } },
  { id: 10, name: 'Brooks Koepka', seed: 10, group: 'contenders', americanOdds: { makeCut: -250, top20: +220, top10: +550, top5: +1300, winner: +3000 } },
  { id: 11, name: 'Tommy Fleetwood', seed: 11, group: 'contenders', americanOdds: { makeCut: -220, top20: +250, top10: +600, top5: +1500, winner: +3500 } },
  { id: 12, name: 'Jordan Spieth', seed: 12, group: 'contenders', americanOdds: { makeCut: -220, top20: +250, top10: +600, top5: +1500, winner: +3500 } },
  { id: 13, name: 'Joaquin Niemann', seed: 13, group: 'contenders', americanOdds: { makeCut: -220, top20: +250, top10: +600, top5: +1500, winner: +3500 } },
  { id: 14, name: 'Viktor Hovland', seed: 14, group: 'contenders', americanOdds: { makeCut: -220, top20: +250, top10: +600, top5: +1500, winner: +3500 } },
  { id: 15, name: 'Tyrrell Hatton', seed: 15, group: 'contenders', americanOdds: { makeCut: -220, top20: +250, top10: +600, top5: +1500, winner: +3500 } },
  { id: 16, name: 'Shane Lowry', seed: 16, group: 'contenders', americanOdds: { makeCut: -200, top20: +280, top10: +700, top5: +1700, winner: +4000 } },

  // Longshots (seeds 17-24)
  { id: 17, name: 'Patrick Cantlay', seed: 17, group: 'longshots', americanOdds: { makeCut: -200, top20: +280, top10: +700, top5: +1700, winner: +4000 } },
  { id: 18, name: 'Russell Henley', seed: 18, group: 'longshots', americanOdds: { makeCut: -150, top20: +350, top10: +900, top5: +2200, winner: +5000 } },
  { id: 19, name: 'Min Woo Lee', seed: 19, group: 'longshots', americanOdds: { makeCut: -130, top20: +380, top10: +1000, top5: +2500, winner: +5500 } },
  { id: 20, name: 'Will Zalatoris', seed: 20, group: 'longshots', americanOdds: { makeCut: -130, top20: +380, top10: +1000, top5: +2500, winner: +5500 } },
  { id: 21, name: 'Sam Burns', seed: 21, group: 'longshots', americanOdds: { makeCut: -110, top20: +450, top10: +1200, top5: +3000, winner: +6500 } },
  { id: 22, name: 'Corey Conners', seed: 22, group: 'longshots', americanOdds: { makeCut: -110, top20: +450, top10: +1200, top5: +3000, winner: +6500 } },
  { id: 23, name: 'Max Homa', seed: 23, group: 'longshots', americanOdds: { makeCut: -110, top20: +450, top10: +1200, top5: +3000, winner: +6500 } },
  { id: 24, name: 'Sahith Theegala', seed: 24, group: 'longshots', americanOdds: { makeCut: -110, top20: +450, top10: +1200, top5: +3000, winner: +6500 } },

  // Field (seeds 25-30)
  { id: 25, name: 'Tom Kim', seed: 25, group: 'fieldPlayers', americanOdds: { makeCut: +100, top20: +550, top10: +1500, top5: +3500, winner: +8000 } },
  { id: 26, name: 'Wyndham Clark', seed: 26, group: 'fieldPlayers', americanOdds: { makeCut: +100, top20: +550, top10: +1500, top5: +3500, winner: +8000 } },
  { id: 27, name: 'Sungjae Im', seed: 27, group: 'fieldPlayers', americanOdds: { makeCut: +130, top20: +650, top10: +1800, top5: +4500, winner: +10000 } },
  { id: 28, name: 'Sepp Straka', seed: 28, group: 'fieldPlayers', americanOdds: { makeCut: +150, top20: +750, top10: +2200, top5: +5500, winner: +12000 } },
  { id: 29, name: 'Robert MacIntyre', seed: 29, group: 'fieldPlayers', americanOdds: { makeCut: +200, top20: +900, top10: +2800, top5: +7000, winner: +15000 } },
  { id: 30, name: 'Tiger Woods', seed: 30, group: 'fieldPlayers', americanOdds: { makeCut: +400, top20: +1500, top10: +5000, top5: +12000, winner: +25000 } },
];
