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
    { key: 'field', label: 'Field' },
  ],
  devigStrategy: 'global',
  defaultPayoutRules: {
    makeCut: 0.20,     // 0.20% each × 50 cut-makers = 10% of pot
    top20: 0.50,       // 0.50% each × 20 = 10% of pot
    top10: 1.50,       // 1.50% each × 10 = 15% of pot
    top5: 4.00,        // 4.00% each × 5  = 20% of pot
    winner: 45.00,     // 45.00% × 1      = 45% of pot
    lowRoundR1: 0,     // Props default to 0% — commissioner enables during session setup
    lowRoundR2: 0,
    lowRoundR3: 0,
    lowRoundR4: 0,
    worstRound: 0,
    worstOverall: 0,   // Total: 100% (props are additive when enabled)
  },
  defaultPotSize: 5000,
  propBets: [
    { key: 'lowRoundR1', label: 'Low Round — Thu' },
    { key: 'lowRoundR2', label: 'Low Round — Fri' },
    { key: 'lowRoundR3', label: 'Low Round — Sat' },
    { key: 'lowRoundR4', label: 'Low Round — Sun' },
    { key: 'worstRound', label: 'Worst Single Round' },
    { key: 'worstOverall', label: 'DFL (Dead Last Overall)' },
  ],
  badge: 'The Masters 2026',
  teamLabel: 'Golfer',
  groupLabel: 'Tier',
  startDate: '2026-04-09',
  endDate: '2026-04-12',
  hostingOpensAt: '2026-03-26',
  isActive: false, // Tournament completed 2026-04-12 — kept for legacy alias compat
  strategyPrice: 1999, // $19.99
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MASTERS',
};

/**
 * 2026 Masters field - 91 players with REAL sportsbook odds from DataGolf API.
 * Source: DraftKings (primary), FanDuel/Bovada (fallback).
 * Grouped into 4 tiers by sportsbook win probability.
 *
 * Generated: 2026-04-06 from DataGolf outrights API (all 5 markets).
 * Re-run: node scripts/fetch-masters-odds.mjs
 */
export const MASTERS_2026_TEAMS: BaseTeam[] = [
  // --- Favorites ---
  { id: 1, name: 'Scottie Scheffler', seed: 1, group: 'favorites', americanOdds: { makeCut: -1500, top20: -380, top10: -160, top5: +125, winner: +485 } },
  { id: 2, name: 'Jon Rahm', seed: 2, group: 'favorites', americanOdds: { makeCut: -1000, top20: -240, top10: +100, top5: +205, winner: +910 } },
  { id: 3, name: 'Bryson DeChambeau', seed: 3, group: 'favorites', americanOdds: { makeCut: -750, top20: -186, top10: +125, top5: +250, winner: +1075 } },
  { id: 4, name: 'Rory McIlroy', seed: 4, group: 'favorites', americanOdds: { makeCut: -750, top20: -178, top10: +130, top5: +265, winner: +1150 } },
  { id: 5, name: 'Ludvig Aberg', seed: 5, group: 'favorites', americanOdds: { makeCut: -525, top20: -124, top10: +186, top5: +380, winner: +1650 } },
  { id: 6, name: 'Xander Schauffele', seed: 6, group: 'favorites', americanOdds: { makeCut: -700, top20: -146, top10: +170, top5: +365, winner: +1800 } },
  { id: 7, name: 'Cameron Young', seed: 7, group: 'favorites', americanOdds: { makeCut: -500, top20: -110, top10: +220, top5: +470, winner: +2300 } },
  { id: 8, name: 'Tommy Fleetwood', seed: 8, group: 'favorites', americanOdds: { makeCut: -575, top20: -122, top10: +205, top5: +450, winner: +2300 } },
  { id: 9, name: 'Matt Fitzpatrick', seed: 9, group: 'favorites', americanOdds: { makeCut: -550, top20: -114, top10: +215, top5: +470, winner: +2350 } },
  { id: 10, name: 'Hideki Matsuyama', seed: 10, group: 'favorites', americanOdds: { makeCut: -500, top20: -104, top10: +240, top5: +530, winner: +2700 } },

  // --- Contenders ---
  { id: 11, name: 'Collin Morikawa', seed: 11, group: 'contenders', americanOdds: { makeCut: -460, top20: +105, top10: +260, top5: +580, winner: +3100 } },
  { id: 12, name: 'Robert MacIntyre', seed: 12, group: 'contenders', americanOdds: { makeCut: -420, top20: +118, top10: +295, top5: +650, winner: +3400 } },
  { id: 13, name: 'Justin Rose', seed: 13, group: 'contenders', americanOdds: { makeCut: -350, top20: +136, top10: +325, top5: +710, winner: +3500 } },
  { id: 14, name: 'Min Woo Lee', seed: 14, group: 'contenders', americanOdds: { makeCut: -400, top20: +120, top10: +300, top5: +660, winner: +3500 } },
  { id: 15, name: 'Brooks Koepka', seed: 15, group: 'contenders', americanOdds: { makeCut: -320, top20: +148, top10: +355, top5: +760, winner: +3700 } },
  { id: 16, name: 'Chris Gotterup', seed: 16, group: 'contenders', americanOdds: { makeCut: -320, top20: +152, top10: +370, top5: +810, winner: +4200 } },
  { id: 17, name: 'Jordan Spieth', seed: 17, group: 'contenders', americanOdds: { makeCut: -350, top20: +142, top10: +355, top5: +790, winner: +4200 } },
  { id: 18, name: 'Patrick Reed', seed: 18, group: 'contenders', americanOdds: { makeCut: -340, top20: +148, top10: +365, top5: +820, winner: +4300 } },
  { id: 19, name: 'Viktor Hovland', seed: 19, group: 'contenders', americanOdds: { makeCut: -320, top20: +154, top10: +380, top5: +850, winner: +4500 } },
  { id: 20, name: 'Russell Henley', seed: 20, group: 'contenders', americanOdds: { makeCut: -390, top20: +134, top10: +350, top5: +810, winner: +4700 } },
  { id: 21, name: 'Si Woo Kim', seed: 21, group: 'contenders', americanOdds: { makeCut: -380, top20: +138, top10: +360, top5: +840, winner: +4900 } },
  { id: 22, name: 'Justin Thomas', seed: 22, group: 'contenders', americanOdds: { makeCut: -265, top20: +188, top10: +460, top5: +1000, winner: +5300 } },
  { id: 23, name: 'Akshay Bhatia', seed: 23, group: 'contenders', americanOdds: { makeCut: -300, top20: +172, top10: +440, top5: +1000, winner: +5700 } },
  { id: 24, name: 'Patrick Cantlay', seed: 24, group: 'contenders', americanOdds: { makeCut: -310, top20: +172, top10: +440, top5: +1000, winner: +5800 } },
  { id: 25, name: 'Adam Scott', seed: 25, group: 'contenders', americanOdds: { makeCut: -300, top20: +176, top10: +450, top5: +1050, winner: +6000 } },
  { id: 26, name: 'Jason Day', seed: 26, group: 'contenders', americanOdds: { makeCut: -310, top20: +180, top10: +475, top5: +1100, winner: +6700 } },
  { id: 27, name: 'Jake Knapp', seed: 27, group: 'contenders', americanOdds: { makeCut: -260, top20: +200, top10: +510, top5: +1175, winner: +6700 } },
  { id: 28, name: 'Shane Lowry', seed: 28, group: 'contenders', americanOdds: { makeCut: -300, top20: +182, top10: +480, top5: +1125, winner: +6900 } },
  { id: 29, name: 'Sam Burns', seed: 29, group: 'contenders', americanOdds: { makeCut: -275, top20: +196, top10: +510, top5: +1175, winner: +7000 } },
  { id: 30, name: 'J.J. Spaun', seed: 30, group: 'contenders', americanOdds: { makeCut: -255, top20: +205, top10: +530, top5: +1225, winner: +7200 } },

  // --- Longshots ---
  { id: 31, name: 'Sepp Straka', seed: 31, group: 'longshots', americanOdds: { makeCut: -280, top20: +198, top10: +520, top5: +1225, winner: +7400 } },
  { id: 32, name: 'Tyrrell Hatton', seed: 32, group: 'longshots', americanOdds: { makeCut: -260, top20: +210, top10: +550, top5: +1275, winner: +7600 } },
  { id: 33, name: 'Corey Conners', seed: 33, group: 'longshots', americanOdds: { makeCut: -275, top20: +205, top10: +540, top5: +1300, winner: +7800 } },
  { id: 34, name: 'Nicolai Hojgaard', seed: 34, group: 'longshots', americanOdds: { makeCut: -255, top20: +210, top10: +560, top5: +1300, winner: +7800 } },
  { id: 35, name: 'Maverick McNealy', seed: 35, group: 'longshots', americanOdds: { makeCut: -255, top20: +215, top10: +580, top5: +1375, winner: +8400 } },
  { id: 36, name: 'Jacob Bridgeman', seed: 36, group: 'longshots', americanOdds: { makeCut: -260, top20: +215, top10: +580, top5: +1400, winner: +8600 } },
  { id: 37, name: 'Kurt Kitayama', seed: 37, group: 'longshots', americanOdds: { makeCut: -265, top20: +235, top10: +640, top5: +1550, winner: +9800 } },
  { id: 38, name: 'Harris English', seed: 38, group: 'longshots', americanOdds: { makeCut: -250, top20: +235, top10: +640, top5: +1550, winner: +10000 } },
  { id: 39, name: 'Gary Woodland', seed: 39, group: 'longshots', americanOdds: { makeCut: -220, top20: +265, top10: +700, top5: +1700, winner: +10500 } },
  { id: 40, name: 'Daniel Berger', seed: 40, group: 'longshots', americanOdds: { makeCut: -240, top20: +245, top10: +670, top5: +1650, winner: +10500 } },
  { id: 41, name: 'Cameron Smith', seed: 41, group: 'longshots', americanOdds: { makeCut: -240, top20: +270, top10: +740, top5: +1800, winner: +11000 } },
  { id: 42, name: 'Ben Griffin', seed: 42, group: 'longshots', americanOdds: { makeCut: -240, top20: +250, top10: +680, top5: +1650, winner: +11000 } },
  { id: 43, name: 'Sungjae Im', seed: 43, group: 'longshots', americanOdds: { makeCut: -225, top20: +265, top10: +730, top5: +1800, winner: +11500 } },
  { id: 44, name: 'Max Homa', seed: 44, group: 'longshots', americanOdds: { makeCut: -188, top20: +305, top10: +820, top5: +1950, winner: +12000 } },
  { id: 45, name: 'Rasmus Hojgaard', seed: 45, group: 'longshots', americanOdds: { makeCut: -198, top20: +300, top10: +810, top5: +2000, winner: +12500 } },
  { id: 46, name: 'Keegan Bradley', seed: 46, group: 'longshots', americanOdds: { makeCut: -205, top20: +300, top10: +830, top5: +2050, winner: +13500 } },
  { id: 47, name: 'Marco Penge', seed: 47, group: 'longshots', americanOdds: { makeCut: -184, top20: +330, top10: +890, top5: +2200, winner: +14000 } },
  { id: 48, name: 'Harry Hall', seed: 48, group: 'longshots', americanOdds: { makeCut: -192, top20: +325, top10: +910, top5: +2300, winner: +15500 } },
  { id: 49, name: 'Alex Noren', seed: 49, group: 'longshots', americanOdds: { makeCut: -200, top20: +320, top10: +910, top5: +2300, winner: +16000 } },
  { id: 50, name: 'Ryan Gerard', seed: 50, group: 'longshots', americanOdds: { makeCut: -196, top20: +325, top10: +920, top5: +2350, winner: +16000 } },
  { id: 51, name: 'Sam Stevens', seed: 51, group: 'longshots', americanOdds: { makeCut: -184, top20: +355, top10: +1000, top5: +2600, winner: +18500 } },
  { id: 52, name: 'Nick Taylor', seed: 52, group: 'longshots', americanOdds: { makeCut: -186, top20: +355, top10: +1025, top5: +2700, winner: +19500 } },
  { id: 53, name: 'Ryan Fox', seed: 53, group: 'longshots', americanOdds: { makeCut: -162, top20: +410, top10: +1175, top5: +3000, winner: +21000 } },
  { id: 54, name: 'Wyndham Clark', seed: 54, group: 'longshots', americanOdds: { makeCut: -140, top20: +465, top10: +1300, top5: +3200, winner: +21000 } },

  // --- Field ---
  { id: 55, name: 'Brian Harman', seed: 55, group: 'field', americanOdds: { makeCut: -178, top20: +400, top10: +1175, top5: +3100, winner: +22500 } },
  { id: 56, name: 'Michael Kim', seed: 56, group: 'field', americanOdds: { makeCut: -162, top20: +420, top10: +1200, top5: +3100, winner: +22500 } },
  { id: 57, name: 'Max Greyserman', seed: 57, group: 'field', americanOdds: { makeCut: -154, top20: +435, top10: +1250, top5: +3200, winner: +22500 } },
  { id: 58, name: 'Aaron Rai', seed: 58, group: 'field', americanOdds: { makeCut: -170, top20: +420, top10: +1225, top5: +3200, winner: +23000 } },
  { id: 59, name: 'Kristoffer Reitan', seed: 59, group: 'field', americanOdds: { makeCut: -156, top20: +435, top10: +1250, top5: +3300, winner: +23000 } },
  { id: 60, name: 'Sergio Garcia', seed: 60, group: 'field', americanOdds: { makeCut: -158, top20: +430, top10: +1250, top5: +3300, winner: +24000 } },
  { id: 61, name: 'Casey Jarvis', seed: 61, group: 'field', americanOdds: { makeCut: -158, top20: +435, top10: +1250, top5: +3300, winner: +24000 } },
  { id: 62, name: 'Carlos Ortiz', seed: 62, group: 'field', americanOdds: { makeCut: -150, top20: +455, top10: +1325, top5: +3500, winner: +25000 } },
  { id: 63, name: 'Tom McKibbin', seed: 63, group: 'field', americanOdds: { makeCut: -158, top20: +445, top10: +1325, top5: +3500, winner: +26000 } },
  { id: 64, name: 'Dustin Johnson', seed: 64, group: 'field', americanOdds: { makeCut: -148, top20: +470, top10: +1375, top5: +3600, winner: +26000 } },
  { id: 65, name: 'Haotong Li', seed: 65, group: 'field', americanOdds: { makeCut: -144, top20: +500, top10: +1475, top5: +4000, winner: +30000 } },
  { id: 66, name: 'Matt McCarty', seed: 66, group: 'field', americanOdds: { makeCut: -148, top20: +490, top10: +1450, top5: +3900, winner: +30000 } },
  { id: 67, name: 'Andrew Novak', seed: 67, group: 'field', americanOdds: { makeCut: -144, top20: +500, top10: +1500, top5: +4100, winner: +31000 } },
  { id: 68, name: 'Rasmus Neergaard-Petersen', seed: 68, group: 'field', americanOdds: { makeCut: -142, top20: +540, top10: +1650, top5: +4500, winner: +34000 } },
  { id: 69, name: 'Nico Echavarria', seed: 69, group: 'field', americanOdds: { makeCut: -138, top20: +530, top10: +1600, top5: +4400, winner: +34000 } },
  { id: 70, name: 'Aldrich Potgieter', seed: 70, group: 'field', americanOdds: { makeCut: -118, top20: +640, top10: +1900, top5: +5200, winner: +39000 } },
  { id: 71, name: 'Sami Valimaki', seed: 71, group: 'field', americanOdds: { makeCut: -132, top20: +580, top10: +1750, top5: +5000, winner: +40000 } },
  { id: 72, name: 'Michael Brennan', seed: 72, group: 'field', americanOdds: { makeCut: -122, top20: +630, top10: +1900, top5: +5200, winner: +40000 } },
  { id: 73, name: 'Johnny Keefer', seed: 73, group: 'field', americanOdds: { makeCut: -125, top20: +610, top10: +1850, top5: +5100, winner: +40000 } },
  { id: 74, name: 'Bubba Watson', seed: 74, group: 'field', americanOdds: { makeCut: -112, top20: +740, top10: +2350, top5: +6800, winner: +55000 } },
  { id: 75, name: 'Zach Johnson', seed: 75, group: 'field', americanOdds: { makeCut: -125, top20: +670, top10: +2200, top5: +6500, winner: +57500 } },
  { id: 76, name: 'Charl Schwartzel', seed: 76, group: 'field', americanOdds: { makeCut: -112, top20: +780, top10: +2500, top5: +7600, winner: +67500 } },
  { id: 77, name: 'Davis Riley', seed: 77, group: 'field', americanOdds: { makeCut: +112, top20: +1025, top10: +3400, top5: +10000, winner: +85000 } },
  { id: 78, name: 'Fifa Laopakdee', seed: 78, group: 'field', americanOdds: { makeCut: +225, top20: +6000, top10: +5500, top5: +12500, winner: +100000 } },
  { id: 79, name: 'Brian Campbell', seed: 79, group: 'field', americanOdds: { makeCut: +146, top20: +1750, top10: +6900, top5: +23000, winner: +250000 } },
  { id: 80, name: 'Danny Willett', seed: 80, group: 'field', americanOdds: { makeCut: +150, top20: +1800, top10: +7000, top5: +23000, winner: +250000 } },
  { id: 81, name: 'Ethan Fang', seed: 81, group: 'field', americanOdds: { makeCut: +180, top20: +2300, top10: +8800, top5: +29000, winner: +300000 } },
  { id: 82, name: 'Mason Howell', seed: 82, group: 'field', americanOdds: { makeCut: +172, top20: +2200, top10: +8600, top5: +29000, winner: +300000 } },
  { id: 83, name: 'Angel Cabrera', seed: 83, group: 'field', americanOdds: { makeCut: +196, top20: +2600, top10: +10000, top5: +33000, winner: +325000 } },
  { id: 84, name: 'Naoyuki Kataoka', seed: 84, group: 'field', americanOdds: { makeCut: +205, top20: +3200, top10: +13500, top5: +46000, winner: +450000 } },
  { id: 85, name: 'Mateo Pulcini', seed: 85, group: 'field', americanOdds: { makeCut: +295, top20: +6400, top10: +29000, top5: +50000, winner: +500000 } },
  { id: 86, name: 'Vijay Singh', seed: 86, group: 'field', americanOdds: { makeCut: +245, top20: +4700, top10: +22000, top5: +49000, winner: +500000 } },
  { id: 87, name: 'Jose Maria Olazabal', seed: 87, group: 'field', americanOdds: { makeCut: +315, top20: +8200, top10: +38000, top5: +50000, winner: +500000 } },
  { id: 88, name: 'Mike Weir', seed: 88, group: 'field', americanOdds: { makeCut: +285, top20: +6300, top10: +30000, top5: +50000, winner: +500000 } },
  { id: 89, name: 'Brandon Holtz', seed: 89, group: 'field', americanOdds: { makeCut: +305, top20: +9400, top10: +39000, top5: +50000, winner: +500000 } },
  { id: 90, name: 'Jackson Herrington', seed: 90, group: 'field', americanOdds: { makeCut: +295, top20: +6400, top10: +29000, top5: +50000, winner: +500000 } },
  { id: 91, name: 'Fred Couples', seed: 91, group: 'field', americanOdds: { makeCut: +255, top20: +5100, top10: +24000, top5: +49000, winner: +500000 } },
];
