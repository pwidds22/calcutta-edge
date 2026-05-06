import type { TournamentConfig, BaseTeam } from '../types';

export const PGA_CHAMPIONSHIP_2026_CONFIG: TournamentConfig = {
  id: 'pga_championship_2026',
  name: 'PGA Championship 2026',
  sport: 'golf',
  rounds: [
    { key: 'makeCut', label: 'Cut', teamsAdvancing: 70, payoutLabel: 'Make the Cut', gameLabel: 'Cut' },
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
    makeCut: 0.20,
    top20: 0.50,
    top10: 1.50,
    top5: 4.00,
    winner: 45.00,
    lowRoundR1: 0,
    lowRoundR2: 0,
    lowRoundR3: 0,
    lowRoundR4: 0,
    worstRound: 0,
    worstOverall: 0,
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
  badge: 'PGA Championship 2026',
  teamLabel: 'Golfer',
  groupLabel: 'Tier',
  startDate: '2026-05-14',
  endDate: '2026-05-17',
  hostingOpensAt: '2026-04-30',
  isActive: true, // legacy alias — phase derives to 'hostable' on 2026-05-05
  strategyPrice: 1999,
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PGA',
};

/**
 * PGA Championship 2026 field — placeholder until real DataGolf odds are pulled.
 * Run a fetch script (adapted from scripts/fetch-masters-odds.mjs) before May 14
 * to populate the full field with current sportsbook odds.
 */
export const PGA_CHAMPIONSHIP_2026_TEAMS: BaseTeam[] = [
  // TODO: populate from DataGolf before May 14, 2026.
  // Use scripts/fetch-masters-odds.mjs as template — adapt event slug to PGA Championship.
  { id: 1, name: 'Scottie Scheffler', seed: 1, group: 'favorites', americanOdds: { makeCut: -10000, top20: -1000, top10: -400, top5: -150, winner: +600 } },
  { id: 2, name: 'Rory McIlroy', seed: 2, group: 'favorites', americanOdds: { makeCut: -5000, top20: -500, top10: -200, top5: +100, winner: +1000 } },
];
