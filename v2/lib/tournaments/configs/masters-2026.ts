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
    { key: 'worstRound', label: 'Worst Round' },
    { key: 'worstOverall', label: 'Worst Overall (DFL)' },
  ],
  badge: 'The Masters 2026',
  teamLabel: 'Golfer',
  groupLabel: 'Tier',
  startDate: '2026-04-09',
  hostingOpensAt: '2026-03-26',
  isActive: true,
  strategyPrice: 1999, // $19.99
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MASTERS',
};

/**
 * 2026 Masters field - 89 players from DataGolf API (field-updates endpoint).
 * Grouped into 4 tiers by DataGolf ranking.
 * Odds estimated from DG rank using standard probability scaling.
 * Will be replaced with real sportsbook odds when DataGolf publishes Masters markets (~April 6).
 *
 * DataGolf field last updated: 2026-04-03
 */
export const MASTERS_2026_TEAMS: BaseTeam[] = [
  // --- Favorites (DG Rank 1-10) ---
  { id: 1, name: 'Scottie Scheffler', seed: 1, group: 'favorites', americanOdds: { makeCut: -1200, top20: -400, top10: -110, top5: +150, winner: +450 } },
  { id: 2, name: 'Jon Rahm', seed: 2, group: 'favorites', americanOdds: { makeCut: -900, top20: -300, top10: +100, top5: +220, winner: +700 } },
  { id: 3, name: 'Rory McIlroy', seed: 3, group: 'favorites', americanOdds: { makeCut: -800, top20: -250, top10: +120, top5: +250, winner: +800 } },
  { id: 4, name: 'Xander Schauffele', seed: 4, group: 'favorites', americanOdds: { makeCut: -700, top20: -200, top10: +150, top5: +300, winner: +1000 } },
  { id: 5, name: 'Cameron Young', seed: 5, group: 'favorites', americanOdds: { makeCut: -600, top20: -170, top10: +180, top5: +380, winner: +1200 } },
  { id: 6, name: 'Tommy Fleetwood', seed: 6, group: 'favorites', americanOdds: { makeCut: -550, top20: -150, top10: +200, top5: +420, winner: +1400 } },
  { id: 7, name: 'Matt Fitzpatrick', seed: 7, group: 'favorites', americanOdds: { makeCut: -500, top20: -130, top10: +220, top5: +460, winner: +1500 } },
  { id: 8, name: 'Russell Henley', seed: 8, group: 'favorites', americanOdds: { makeCut: -480, top20: -120, top10: +240, top5: +500, winner: +1600 } },
  { id: 9, name: 'Robert MacIntyre', seed: 9, group: 'favorites', americanOdds: { makeCut: -450, top20: -110, top10: +260, top5: +550, winner: +1800 } },
  { id: 10, name: 'Bryson DeChambeau', seed: 10, group: 'favorites', americanOdds: { makeCut: -420, top20: -100, top10: +280, top5: +600, winner: +2000 } },

  // --- Contenders (DG Rank 11-30) ---
  { id: 11, name: 'Ludvig Aberg', seed: 11, group: 'contenders', americanOdds: { makeCut: -400, top20: +100, top10: +300, top5: +650, winner: +2200 } },
  { id: 12, name: 'Hideki Matsuyama', seed: 12, group: 'contenders', americanOdds: { makeCut: -380, top20: +110, top10: +320, top5: +700, winner: +2500 } },
  { id: 13, name: 'Collin Morikawa', seed: 13, group: 'contenders', americanOdds: { makeCut: -350, top20: +120, top10: +350, top5: +750, winner: +2800 } },
  { id: 14, name: 'Min Woo Lee', seed: 14, group: 'contenders', americanOdds: { makeCut: -320, top20: +140, top10: +380, top5: +800, winner: +3000 } },
  { id: 15, name: 'Si Woo Kim', seed: 15, group: 'contenders', americanOdds: { makeCut: -300, top20: +150, top10: +400, top5: +850, winner: +3200 } },
  { id: 16, name: 'Jake Knapp', seed: 16, group: 'contenders', americanOdds: { makeCut: -280, top20: +160, top10: +420, top5: +900, winner: +3500 } },
  { id: 17, name: 'Jacob Bridgeman', seed: 17, group: 'contenders', americanOdds: { makeCut: -260, top20: +170, top10: +440, top5: +950, winner: +3800 } },
  { id: 18, name: 'Patrick Cantlay', seed: 18, group: 'contenders', americanOdds: { makeCut: -250, top20: +180, top10: +460, top5: +1000, winner: +4000 } },
  { id: 19, name: 'Akshay Bhatia', seed: 19, group: 'contenders', americanOdds: { makeCut: -230, top20: +200, top10: +500, top5: +1100, winner: +4200 } },
  { id: 20, name: 'Sam Burns', seed: 20, group: 'contenders', americanOdds: { makeCut: -220, top20: +210, top10: +520, top5: +1150, winner: +4500 } },
  { id: 21, name: 'Maverick McNealy', seed: 21, group: 'contenders', americanOdds: { makeCut: -200, top20: +230, top10: +550, top5: +1200, winner: +5000 } },
  { id: 22, name: 'Viktor Hovland', seed: 22, group: 'contenders', americanOdds: { makeCut: -200, top20: +240, top10: +570, top5: +1250, winner: +5000 } },
  { id: 23, name: 'Alex Noren', seed: 23, group: 'contenders', americanOdds: { makeCut: -180, top20: +260, top10: +600, top5: +1300, winner: +5500 } },
  { id: 24, name: 'Nicolai Hojgaard', seed: 24, group: 'contenders', americanOdds: { makeCut: -170, top20: +270, top10: +620, top5: +1350, winner: +5500 } },
  { id: 25, name: 'Chris Gotterup', seed: 25, group: 'contenders', americanOdds: { makeCut: -160, top20: +280, top10: +650, top5: +1400, winner: +6000 } },
  { id: 26, name: 'Harris English', seed: 26, group: 'contenders', americanOdds: { makeCut: -150, top20: +300, top10: +680, top5: +1500, winner: +6500 } },
  { id: 27, name: 'Sepp Straka', seed: 27, group: 'contenders', americanOdds: { makeCut: -140, top20: +310, top10: +700, top5: +1550, winner: +6500 } },
  { id: 28, name: 'Ben Griffin', seed: 28, group: 'contenders', americanOdds: { makeCut: -130, top20: +320, top10: +720, top5: +1600, winner: +7000 } },
  { id: 29, name: 'Shane Lowry', seed: 29, group: 'contenders', americanOdds: { makeCut: -120, top20: +340, top10: +750, top5: +1700, winner: +7500 } },
  { id: 30, name: 'Jordan Spieth', seed: 30, group: 'contenders', americanOdds: { makeCut: -110, top20: +350, top10: +780, top5: +1800, winner: +8000 } },

  // --- Longshots (DG Rank 31-60) ---
  { id: 31, name: 'Adam Scott', seed: 31, group: 'longshots', americanOdds: { makeCut: -100, top20: +380, top10: +850, top5: +2000, winner: +9000 } },
  { id: 32, name: 'Harry Hall', seed: 32, group: 'longshots', americanOdds: { makeCut: -100, top20: +400, top10: +900, top5: +2100, winner: +9500 } },
  { id: 33, name: 'J.J. Spaun', seed: 33, group: 'longshots', americanOdds: { makeCut: +100, top20: +420, top10: +950, top5: +2200, winner: +10000 } },
  { id: 34, name: 'Justin Rose', seed: 34, group: 'longshots', americanOdds: { makeCut: +100, top20: +440, top10: +1000, top5: +2300, winner: +10000 } },
  { id: 35, name: 'Ryan Gerard', seed: 35, group: 'longshots', americanOdds: { makeCut: +110, top20: +460, top10: +1050, top5: +2500, winner: +11000 } },
  { id: 36, name: 'Justin Thomas', seed: 36, group: 'longshots', americanOdds: { makeCut: +110, top20: +480, top10: +1100, top5: +2600, winner: +11000 } },
  { id: 37, name: 'Jason Day', seed: 37, group: 'longshots', americanOdds: { makeCut: +120, top20: +500, top10: +1150, top5: +2800, winner: +12000 } },
  { id: 38, name: 'Corey Conners', seed: 38, group: 'longshots', americanOdds: { makeCut: +120, top20: +520, top10: +1200, top5: +2900, winner: +12000 } },
  { id: 39, name: 'Kurt Kitayama', seed: 39, group: 'longshots', americanOdds: { makeCut: +130, top20: +540, top10: +1250, top5: +3000, winner: +13000 } },
  { id: 40, name: 'Sam Stevens', seed: 40, group: 'longshots', americanOdds: { makeCut: +130, top20: +560, top10: +1300, top5: +3200, winner: +14000 } },
  { id: 41, name: 'Nick Taylor', seed: 41, group: 'longshots', americanOdds: { makeCut: +140, top20: +580, top10: +1400, top5: +3400, winner: +15000 } },
  { id: 42, name: 'Keegan Bradley', seed: 42, group: 'longshots', americanOdds: { makeCut: +150, top20: +600, top10: +1500, top5: +3500, winner: +15000 } },
  { id: 43, name: 'Patrick Reed', seed: 43, group: 'longshots', americanOdds: { makeCut: +160, top20: +650, top10: +1600, top5: +3800, winner: +16000 } },
  { id: 44, name: 'Rasmus Hojgaard', seed: 44, group: 'longshots', americanOdds: { makeCut: +160, top20: +650, top10: +1600, top5: +3800, winner: +16000 } },
  { id: 45, name: 'Daniel Berger', seed: 45, group: 'longshots', americanOdds: { makeCut: +170, top20: +700, top10: +1700, top5: +4000, winner: +17000 } },
  { id: 46, name: 'Casey Jarvis', seed: 46, group: 'longshots', americanOdds: { makeCut: +200, top20: +750, top10: +1800, top5: +4500, winner: +20000 } },
  { id: 47, name: 'Ryan Fox', seed: 47, group: 'longshots', americanOdds: { makeCut: +200, top20: +750, top10: +1800, top5: +4500, winner: +20000 } },
  { id: 48, name: 'Carlos Ortiz', seed: 48, group: 'longshots', americanOdds: { makeCut: +220, top20: +800, top10: +2000, top5: +5000, winner: +22000 } },
  { id: 49, name: 'Tyrrell Hatton', seed: 49, group: 'longshots', americanOdds: { makeCut: +220, top20: +800, top10: +2000, top5: +5000, winner: +22000 } },
  { id: 50, name: 'Matt McCarty', seed: 50, group: 'longshots', americanOdds: { makeCut: +230, top20: +850, top10: +2100, top5: +5200, winner: +23000 } },
  { id: 51, name: 'Gary Woodland', seed: 51, group: 'longshots', americanOdds: { makeCut: +240, top20: +900, top10: +2200, top5: +5500, winner: +25000 } },
  { id: 52, name: 'Aaron Rai', seed: 52, group: 'longshots', americanOdds: { makeCut: +240, top20: +900, top10: +2200, top5: +5500, winner: +25000 } },
  { id: 53, name: 'Nico Echavarria', seed: 53, group: 'longshots', americanOdds: { makeCut: +250, top20: +950, top10: +2300, top5: +5800, winner: +25000 } },
  { id: 54, name: 'Marco Penge', seed: 54, group: 'longshots', americanOdds: { makeCut: +250, top20: +950, top10: +2300, top5: +5800, winner: +25000 } },

  // --- Field (DG Rank 60+, past champions, amateurs) ---
  { id: 55, name: 'Max Greyserman', seed: 55, group: 'field', americanOdds: { makeCut: +280, top20: +1000, top10: +2500, top5: +6500, winner: +30000 } },
  { id: 56, name: 'Brian Harman', seed: 56, group: 'field', americanOdds: { makeCut: +280, top20: +1000, top10: +2500, top5: +6500, winner: +30000 } },
  { id: 57, name: 'Wyndham Clark', seed: 57, group: 'field', americanOdds: { makeCut: +300, top20: +1100, top10: +2800, top5: +7000, winner: +33000 } },
  { id: 58, name: 'Haotong Li', seed: 58, group: 'field', americanOdds: { makeCut: +300, top20: +1100, top10: +2800, top5: +7000, winner: +33000 } },
  { id: 59, name: 'Cameron Smith', seed: 59, group: 'field', americanOdds: { makeCut: +320, top20: +1200, top10: +3000, top5: +7500, winner: +35000 } },
  { id: 60, name: 'Johnny Keefer', seed: 60, group: 'field', americanOdds: { makeCut: +320, top20: +1200, top10: +3000, top5: +7500, winner: +35000 } },
  { id: 61, name: 'Kristoffer Reitan', seed: 61, group: 'field', americanOdds: { makeCut: +340, top20: +1300, top10: +3200, top5: +8000, winner: +38000 } },
  { id: 62, name: 'Tom McKibbin', seed: 62, group: 'field', americanOdds: { makeCut: +340, top20: +1300, top10: +3200, top5: +8000, winner: +38000 } },
  { id: 63, name: 'Brooks Koepka', seed: 63, group: 'field', americanOdds: { makeCut: +350, top20: +1400, top10: +3500, top5: +8500, winner: +40000 } },
  { id: 64, name: 'Michael Kim', seed: 64, group: 'field', americanOdds: { makeCut: +360, top20: +1400, top10: +3500, top5: +9000, winner: +42000 } },
  { id: 65, name: 'Rasmus Neergaard-Petersen', seed: 65, group: 'field', americanOdds: { makeCut: +370, top20: +1500, top10: +3800, top5: +9500, winner: +45000 } },
  { id: 66, name: 'Max Homa', seed: 66, group: 'field', americanOdds: { makeCut: +380, top20: +1500, top10: +3800, top5: +9500, winner: +45000 } },
  { id: 67, name: 'Michael Brennan', seed: 67, group: 'field', americanOdds: { makeCut: +380, top20: +1600, top10: +4000, top5: +10000, winner: +48000 } },
  { id: 68, name: 'Sungjae Im', seed: 68, group: 'field', americanOdds: { makeCut: +400, top20: +1600, top10: +4000, top5: +10000, winner: +48000 } },
  { id: 69, name: 'Andrew Novak', seed: 69, group: 'field', americanOdds: { makeCut: +400, top20: +1700, top10: +4200, top5: +10500, winner: +50000 } },
  { id: 70, name: 'Sami Valimaki', seed: 70, group: 'field', americanOdds: { makeCut: +420, top20: +1700, top10: +4200, top5: +10500, winner: +50000 } },
  { id: 71, name: 'Sergio Garcia', seed: 71, group: 'field', americanOdds: { makeCut: +450, top20: +1800, top10: +4500, top5: +12000, winner: +60000 } },
  { id: 72, name: 'Dustin Johnson', seed: 72, group: 'field', americanOdds: { makeCut: +500, top20: +2000, top10: +5000, top5: +13000, winner: +65000 } },
  { id: 73, name: 'Zach Johnson', seed: 73, group: 'field', americanOdds: { makeCut: +500, top20: +2000, top10: +5000, top5: +13000, winner: +65000 } },
  { id: 74, name: 'Charl Schwartzel', seed: 74, group: 'field', americanOdds: { makeCut: +550, top20: +2200, top10: +5500, top5: +14000, winner: +70000 } },
  { id: 75, name: 'Bubba Watson', seed: 75, group: 'field', americanOdds: { makeCut: +600, top20: +2500, top10: +6000, top5: +15000, winner: +80000 } },
  { id: 76, name: 'Aldrich Potgieter', seed: 76, group: 'field', americanOdds: { makeCut: +350, top20: +1400, top10: +3500, top5: +8500, winner: +40000 } },
  { id: 77, name: 'Brian Campbell', seed: 77, group: 'field', americanOdds: { makeCut: +500, top20: +2000, top10: +5000, top5: +12000, winner: +60000 } },
  { id: 78, name: 'Davis Riley', seed: 78, group: 'field', americanOdds: { makeCut: +500, top20: +2000, top10: +5000, top5: +12000, winner: +60000 } },
  { id: 79, name: 'Danny Willett', seed: 79, group: 'field', americanOdds: { makeCut: +600, top20: +2500, top10: +6000, top5: +15000, winner: +80000 } },
  { id: 80, name: 'Angel Cabrera', seed: 80, group: 'field', americanOdds: { makeCut: +800, top20: +3500, top10: +8000, top5: +20000, winner: +100000 } },
  { id: 81, name: 'Fred Couples', seed: 81, group: 'field', americanOdds: { makeCut: +1500, top20: +5000, top10: +12000, top5: +30000, winner: +150000 } },
  { id: 82, name: 'Jose Maria Olazabal', seed: 82, group: 'field', americanOdds: { makeCut: +2000, top20: +6000, top10: +15000, top5: +40000, winner: +200000 } },
  { id: 83, name: 'Vijay Singh', seed: 83, group: 'field', americanOdds: { makeCut: +2000, top20: +6000, top10: +15000, top5: +40000, winner: +200000 } },
  { id: 84, name: 'Mike Weir', seed: 84, group: 'field', americanOdds: { makeCut: +2000, top20: +6000, top10: +15000, top5: +40000, winner: +200000 } },
  { id: 85, name: 'Naoyuki Kataoka', seed: 85, group: 'field', americanOdds: { makeCut: +600, top20: +2500, top10: +6000, top5: +15000, winner: +80000 } },

  // --- Amateurs ---
  { id: 86, name: 'Ethan Fang', seed: 86, group: 'field', americanOdds: { makeCut: +1000, top20: +4000, top10: +10000, top5: +25000, winner: +125000 } },
  { id: 87, name: 'Jackson Herrington', seed: 87, group: 'field', americanOdds: { makeCut: +1000, top20: +4000, top10: +10000, top5: +25000, winner: +125000 } },
  { id: 88, name: 'Brandon Holtz', seed: 88, group: 'field', americanOdds: { makeCut: +1000, top20: +4000, top10: +10000, top5: +25000, winner: +125000 } },
  { id: 89, name: 'Mason Howell', seed: 89, group: 'field', americanOdds: { makeCut: +1000, top20: +4000, top10: +10000, top5: +25000, winner: +125000 } },
];
