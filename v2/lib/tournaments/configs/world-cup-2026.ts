import type { TournamentConfig, BaseTeam } from '../types';

export const WORLD_CUP_2026_CONFIG: TournamentConfig = {
  id: 'world_cup_2026',
  name: 'FIFA World Cup 2026',
  sport: 'soccer',
  // Round model is Kalshi-aligned: winGroup (per-group market) + the reach-round
  // ladder (global markets). teamsAdvancing drives the payout-preset sum math
  // (winGroup = 12 group winners); the per-group devig target is always 1.
  rounds: [
    { key: 'winGroup', label: 'Win Group', teamsAdvancing: 12, payoutLabel: 'Win Group', gameLabel: 'Group', devigScope: 'group' },
    { key: 'r32', label: 'R32', teamsAdvancing: 32, payoutLabel: 'Advance (Round of 32)', gameLabel: 'R32', devigScope: 'global' },
    { key: 'r16', label: 'R16', teamsAdvancing: 16, payoutLabel: 'Reach Round of 16', gameLabel: 'R16', devigScope: 'global' },
    { key: 'qf', label: 'QF', teamsAdvancing: 8, payoutLabel: 'Reach Quarterfinals', gameLabel: 'QF', devigScope: 'global' },
    { key: 'sf', label: 'SF', teamsAdvancing: 4, payoutLabel: 'Reach Semifinals', gameLabel: 'SF', devigScope: 'global' },
    { key: 'final', label: 'Final', teamsAdvancing: 2, payoutLabel: 'Reach Final', gameLabel: 'Final', devigScope: 'global' },
    { key: 'champion', label: 'Champion', teamsAdvancing: 1, payoutLabel: 'Champion', gameLabel: 'Champion', devigScope: 'global' },
  ],
  groups: [
    { key: 'A', label: 'Group A' },
    { key: 'B', label: 'Group B' },
    { key: 'C', label: 'Group C' },
    { key: 'D', label: 'Group D' },
    { key: 'E', label: 'Group E' },
    { key: 'F', label: 'Group F' },
    { key: 'G', label: 'Group G' },
    { key: 'H', label: 'Group H' },
    { key: 'I', label: 'Group I' },
    { key: 'J', label: 'Group J' },
    { key: 'K', label: 'Group K' },
    { key: 'L', label: 'Group L' },
  ],
  devigStrategy: 'group',
  // Per-position % — Σ(% × teamsAdvancing) = 100%:
  // winGroup 0.5×12=6 · r32 0.5×32=16 · r16 0.75×16=12 · qf 1.5×8=12 · sf 3.0×4=12 · final 5.0×2=10 · champion 32×1=32
  defaultPayoutRules: {
    winGroup: 0.50,
    r32: 0.50,
    r16: 0.75,
    qf: 1.50,
    sf: 3.00,
    final: 5.00,
    champion: 32.00,
    goldenBoot: 0.0,
    goldenBall: 0.0,
    topScoringTeam: 0.0,
    bestGroupDiff: 0.0,
    worstGroupDiff: 0.0,
  },
  defaultPotSize: 10000,
  propBets: [
    { key: 'goldenBoot', label: 'Golden Boot (Top Scorer)' },
    { key: 'goldenBall', label: 'Golden Ball (Best Player)' },
    { key: 'topScoringTeam', label: 'Top Scoring Team' },
    { key: 'bestGroupDiff', label: 'Best Group-Stage Differential' },
    { key: 'worstGroupDiff', label: 'Worst Group-Stage Differential (Wooden Spoon)' },
  ],
  badge: 'World Cup 2026',
  teamLabel: 'Nation',
  groupLabel: 'Group',
  startDate: '2026-06-11',
  endDate: '2026-07-19',
  hostingOpensAt: '2026-05-28',
  isActive: true, // legacy alias — phase derives to 'hostable' (now) → 'live' on 2026-06-11
  strategyPrice: 1499,
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_WORLDCUP',
  // Live results are ESPN-sourced (Phase 2); liveSyncMatchers intentionally unset so
  // the golf-sync cron (DataGolf event-name matching) skips this soccer tournament.
  // Soccer seed is only within-group position (1–4), not a global strength rank — so
  // sort the strategy table by value, hide the Seed column, and gate the free preview
  // on top-N-by-value instead of the seed cutoff (which would leak all 24 seeds 1–2).
  defaultSort: 'valuePercentage',
  defaultSortDirection: 'desc',
  showSeedColumn: false,
  previewTeamCount: 8,
};

/**
 * FIFA World Cup 2026 — 48 nations across 12 groups.
 * First expanded World Cup (USA/Mexico/Canada hosts).
 *
 * Probabilities are REAL Kalshi prediction-market prices (mid of yes_bid/yes_ask,
 * last-trade fallback) — fed directly as fair-ish probabilities and normalized by
 * the scope-aware 'group' devig (winGroup per-group → 1; reach-round ladder global).
 *
  * Generated: 2026-06-03 from Kalshi (KXWCGROUPWIN / KXWCSTAGEOFELIM / KXWCROUND / KXMENWORLDCUP).
 * Re-run: KALSHI_ENV_FILE=/path/.env.local node scripts/fetch-worldcup-odds.mjs
 *
 * The active group-winner markets are the field of record — re-running self-corrects
 * the roster. `id` is stable across re-runs (matched by name); `seed` reflects current
 * within-group win odds. Don't reorder entries by hand.
 */
export const WORLD_CUP_2026_TEAMS: BaseTeam[] = [
  // ─── Group A ───
  { id: 1, name: 'Mexico', seed: 1, group: 'A', americanOdds: {}, probabilities: { winGroup: 0.525, r32: 0.905, r16: 0.505, qf: 0.235, sf: 0.11, final: 0.05, champion: 0.012 } },
  { id: 2, name: 'South Korea', seed: 2, group: 'A', americanOdds: {}, probabilities: { winGroup: 0.22, r32: 0.685, r16: 0.305, qf: 0.09, sf: 0.025, final: 0.01, champion: 0.0025 } },
  { id: 4, name: 'Czechia', seed: 3, group: 'A', americanOdds: {}, probabilities: { winGroup: 0.215, r32: 0.71, r16: 0.305, qf: 0.08, sf: 0.02, final: 0.02, champion: 0.01 } },
  { id: 3, name: 'South Africa', seed: 4, group: 'A', americanOdds: {}, probabilities: { winGroup: 0.055, r32: 0.415, r16: 0.105, qf: 0.025, sf: 0.02, final: 0.01, champion: 0.001 } },

  // ─── Group B ───
  { id: 6, name: 'Switzerland', seed: 1, group: 'B', americanOdds: {}, probabilities: { winGroup: 0.535, r32: 0.91, r16: 0.54, qf: 0.205, sf: 0.085, final: 0.03, champion: 0.0105 } },
  { id: 5, name: 'Canada', seed: 2, group: 'B', americanOdds: {}, probabilities: { winGroup: 0.305, r32: 0.835, r16: 0.39, qf: 0.14, sf: 0.04, final: 0.025, champion: 0.0025 } },
  { id: 8, name: 'Bosnia and Herzegovina', seed: 3, group: 'B', americanOdds: {}, probabilities: { winGroup: 0.12, r32: 0.64, r16: 0.22, qf: 0.065, sf: 0.02, final: 0.01, champion: 0.01 } },
  { id: 7, name: 'Qatar', seed: 4, group: 'B', americanOdds: {}, probabilities: { winGroup: 0.025, r32: 0.32, r16: 0.05, qf: 0.02, sf: 0.02, final: 0.02, champion: 0.001 } },

  // ─── Group C ───
  { id: 9, name: 'Brazil', seed: 1, group: 'C', americanOdds: {}, probabilities: { winGroup: 0.725, r32: 0.97, r16: 0.69, qf: 0.435, sf: 0.305, final: 0.175, champion: 0.0865 } },
  { id: 10, name: 'Morocco', seed: 2, group: 'C', americanOdds: {}, probabilities: { winGroup: 0.195, r32: 0.905, r16: 0.425, qf: 0.22, sf: 0.095, final: 0.045, champion: 0.015 } },
  { id: 11, name: 'Scotland', seed: 3, group: 'C', americanOdds: {}, probabilities: { winGroup: 0.075, r32: 0.77, r16: 0.24, qf: 0.085, sf: 0.03, final: 0.03, champion: 0.0025 } },
  { id: 12, name: 'Haiti', seed: 4, group: 'C', americanOdds: {}, probabilities: { winGroup: 0.01, r32: 0.165, r16: 0.04, qf: 0.04, sf: 0.04, final: 0.04, champion: 0.002 } },

  // ─── Group D ───
  { id: 13, name: 'United States', seed: 1, group: 'D', americanOdds: {}, probabilities: { winGroup: 0.38, r32: 0.855, r16: 0.455, qf: 0.23, sf: 0.085, final: 0.045, champion: 0.014 } },
  { id: 16, name: 'Turkey', seed: 2, group: 'D', americanOdds: {}, probabilities: { winGroup: 0.325, r32: 0.79, r16: 0.455, qf: 0.195, sf: 0.08, final: 0.03, champion: 0.0075 } },
  { id: 14, name: 'Paraguay', seed: 3, group: 'D', americanOdds: {}, probabilities: { winGroup: 0.165, r32: 0.675, r16: 0.285, qf: 0.085, sf: 0.03, final: 0.015, champion: 0.0025 } },
  { id: 15, name: 'Australia', seed: 4, group: 'D', americanOdds: {}, probabilities: { winGroup: 0.095, r32: 0.49, r16: 0.175, qf: 0.05, sf: 0.02, final: 0.01, champion: 0.0015 } },

  // ─── Group E ───
  { id: 17, name: 'Germany', seed: 1, group: 'E', americanOdds: {}, probabilities: { winGroup: 0.675, r32: 0.975, r16: 0.675, qf: 0.385, sf: 0.255, final: 0.135, champion: 0.0575 } },
  { id: 18, name: 'Ecuador', seed: 2, group: 'E', americanOdds: {}, probabilities: { winGroup: 0.215, r32: 0.885, r16: 0.405, qf: 0.155, sf: 0.06, final: 0.035, champion: 0.0075 } },
  { id: 19, name: 'Ivory Coast', seed: 3, group: 'E', americanOdds: {}, probabilities: { winGroup: 0.105, r32: 0.805, r16: 0.27, qf: 0.09, sf: 0.035, final: 0.015, champion: 0.0025 } },
  { id: 20, name: 'Curacao', seed: 4, group: 'E', americanOdds: {}, probabilities: { winGroup: 0.01, r32: 0.11, r16: 0.015, qf: 0.015, sf: 0.015, final: 0.015, champion: 0.001 } },

  // ─── Group F ───
  { id: 21, name: 'Netherlands', seed: 1, group: 'F', americanOdds: {}, probabilities: { winGroup: 0.535, r32: 0.91, r16: 0.56, qf: 0.375, sf: 0.205, final: 0.1, champion: 0.0405 } },
  { id: 22, name: 'Japan', seed: 2, group: 'F', americanOdds: {}, probabilities: { winGroup: 0.255, r32: 0.77, r16: 0.385, qf: 0.195, sf: 0.085, final: 0.035, champion: 0.0125 } },
  { id: 24, name: 'Sweden', seed: 3, group: 'F', americanOdds: {}, probabilities: { winGroup: 0.155, r32: 0.67, r16: 0.265, qf: 0.115, sf: 0.035, final: 0.02, champion: 0.0055 } },
  { id: 23, name: 'Tunisia', seed: 4, group: 'F', americanOdds: {}, probabilities: { winGroup: 0.065, r32: 0.41, r16: 0.105, qf: 0.035, sf: 0.035, final: 0.01, champion: 0.001 } },

  // ─── Group G ───
  { id: 25, name: 'Belgium', seed: 1, group: 'G', americanOdds: {}, probabilities: { winGroup: 0.675, r32: 0.94, r16: 0.59, qf: 0.365, sf: 0.14, final: 0.075, champion: 0.0185 } },
  { id: 27, name: 'Egypt', seed: 2, group: 'G', americanOdds: {}, probabilities: { winGroup: 0.175, r32: 0.69, r16: 0.325, qf: 0.08, sf: 0.025, final: 0.02, champion: 0.0025 } },
  { id: 26, name: 'Iran', seed: 3, group: 'G', americanOdds: {}, probabilities: { winGroup: 0.115, r32: 0.48, r16: 0.2, qf: 0.065, sf: 0.02, final: 0.02, champion: 0.001 } },
  { id: 28, name: 'New Zealand', seed: 4, group: 'G', americanOdds: {}, probabilities: { winGroup: 0.035, r32: 0.345, r16: 0.085, qf: 0.02, sf: 0.01, final: 0.01, champion: 0.001 } },

  // ─── Group H ───
  { id: 29, name: 'Spain', seed: 1, group: 'H', americanOdds: {}, probabilities: { winGroup: 0.78, r32: 0.985, r16: 0.775, qf: 0.58, sf: 0.445, final: 0.285, champion: 0.1665 } },
  { id: 30, name: 'Uruguay', seed: 2, group: 'H', americanOdds: {}, probabilities: { winGroup: 0.185, r32: 0.895, r16: 0.39, qf: 0.2, sf: 0.095, final: 0.025, champion: 0.0115 } },
  { id: 32, name: 'Cape Verde', seed: 3, group: 'H', americanOdds: {}, probabilities: { winGroup: 0.015, r32: 0.32, r16: 0.055, qf: 0.025, sf: 0.025, final: 0.025, champion: 0.001 } },
  { id: 31, name: 'Saudi Arabia', seed: 4, group: 'H', americanOdds: {}, probabilities: { winGroup: 0.015, r32: 0.395, r16: 0.08, qf: 0.025, sf: 0.02, final: 0.02, champion: 0.001 } },

  // ─── Group I ───
  { id: 33, name: 'France', seed: 1, group: 'I', americanOdds: {}, probabilities: { winGroup: 0.655, r32: 0.975, r16: 0.775, qf: 0.565, sf: 0.425, final: 0.265, champion: 0.1645 } },
  { id: 35, name: 'Norway', seed: 2, group: 'I', americanOdds: {}, probabilities: { winGroup: 0.235, r32: 0.86, r16: 0.535, qf: 0.3, sf: 0.14, final: 0.075, champion: 0.0245 } },
  { id: 34, name: 'Senegal', seed: 3, group: 'I', americanOdds: {}, probabilities: { winGroup: 0.105, r32: 0.735, r16: 0.325, qf: 0.14, sf: 0.055, final: 0.025, champion: 0.0075 } },
  { id: 36, name: 'Iraq', seed: 4, group: 'I', americanOdds: {}, probabilities: { winGroup: 0.015, r32: 0.19, r16: 0.025, qf: 0.02, sf: 0.01, final: 0.01, champion: 0.01 } },

  // ─── Group J ───
  { id: 37, name: 'Argentina', seed: 1, group: 'J', americanOdds: {}, probabilities: { winGroup: 0.71, r32: 0.935, r16: 0.685, qf: 0.495, sf: 0.31, final: 0.185, champion: 0.088 } },
  { id: 38, name: 'Austria', seed: 2, group: 'J', americanOdds: {}, probabilities: { winGroup: 0.185, r32: 0.81, r16: 0.315, qf: 0.145, sf: 0.05, final: 0.015, champion: 0.0055 } },
  { id: 39, name: 'Algeria', seed: 3, group: 'J', americanOdds: {}, probabilities: { winGroup: 0.095, r32: 0.64, r16: 0.225, qf: 0.075, sf: 0.03, final: 0.015, champion: 0.0015 } },
  { id: 40, name: 'Jordan', seed: 4, group: 'J', americanOdds: {}, probabilities: { winGroup: 0.015, r32: 0.24, r16: 0.03, qf: 0.01, sf: 0.01, final: 0.01, champion: 0.001 } },

  // ─── Group K ───
  { id: 41, name: 'Portugal', seed: 1, group: 'K', americanOdds: {}, probabilities: { winGroup: 0.635, r32: 0.98, r16: 0.695, qf: 0.51, sf: 0.295, final: 0.175, champion: 0.0935 } },
  { id: 42, name: 'Colombia', seed: 2, group: 'K', americanOdds: {}, probabilities: { winGroup: 0.305, r32: 0.92, r16: 0.5, qf: 0.27, sf: 0.145, final: 0.065, champion: 0.0185 } },
  { id: 44, name: 'DR Congo', seed: 3, group: 'K', americanOdds: {}, probabilities: { winGroup: 0.035, r32: 0.455, r16: 0.1, qf: 0.035, sf: 0.02, final: 0.01, champion: 0.01 } },
  { id: 43, name: 'Uzbekistan', seed: 4, group: 'K', americanOdds: {}, probabilities: { winGroup: 0.015, r32: 0.32, r16: 0.075, qf: 0.02, sf: 0.02, final: 0.02, champion: 0.001 } },

  // ─── Group L ───
  { id: 45, name: 'England', seed: 1, group: 'L', americanOdds: {}, probabilities: { winGroup: 0.695, r32: 0.965, r16: 0.72, qf: 0.545, sf: 0.335, final: 0.2, champion: 0.1105 } },
  { id: 46, name: 'Croatia', seed: 2, group: 'L', americanOdds: {}, probabilities: { winGroup: 0.205, r32: 0.855, r16: 0.415, qf: 0.17, sf: 0.08, final: 0.035, champion: 0.0095 } },
  { id: 48, name: 'Ghana', seed: 3, group: 'L', americanOdds: {}, probabilities: { winGroup: 0.065, r32: 0.535, r16: 0.18, qf: 0.065, sf: 0.02, final: 0.01, champion: 0.0025 } },
  { id: 47, name: 'Panama', seed: 4, group: 'L', americanOdds: {}, probabilities: { winGroup: 0.025, r32: 0.325, r16: 0.07, qf: 0.025, sf: 0.01, final: 0.01, champion: 0.001 } },
];
