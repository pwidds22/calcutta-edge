import type { TournamentConfig, BaseTeam } from '../types';

export const WORLD_CUP_2026_CONFIG: TournamentConfig = {
  id: 'world_cup_2026',
  name: 'FIFA World Cup 2026',
  sport: 'soccer',
  rounds: [
    { key: 'groupStage', label: 'Group', teamsAdvancing: 32, payoutLabel: 'Advance from Group', gameLabel: 'Groups' },
    { key: 'r32', label: 'R32', teamsAdvancing: 16, payoutLabel: 'Win Round of 32', gameLabel: 'R32' },
    { key: 'r16', label: 'R16', teamsAdvancing: 8, payoutLabel: 'Win Round of 16', gameLabel: 'R16' },
    { key: 'qf', label: 'QF', teamsAdvancing: 4, payoutLabel: 'Win Quarterfinal', gameLabel: 'QF' },
    { key: 'sf', label: 'SF', teamsAdvancing: 2, payoutLabel: 'Win Semifinal', gameLabel: 'SF' },
    { key: 'champion', label: 'Final', teamsAdvancing: 1, payoutLabel: 'Win Final', gameLabel: 'Final' },
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
  defaultPayoutRules: {
    groupStage: 0.125,
    r32: 0.375,
    r16: 1.25,
    qf: 4.00,
    sf: 7.00,
    champion: 50.00,
    goldenBoot: 0.0,
    goldenBall: 0.0,
  },
  defaultPotSize: 10000,
  propBets: [
    { key: 'goldenBoot', label: 'Golden Boot (Top Scorer)' },
    { key: 'goldenBall', label: 'Golden Ball (Best Player)' },
  ],
  badge: 'World Cup 2026',
  teamLabel: 'Nation',
  groupLabel: 'Group',
  startDate: '2026-06-11',
  hostingOpensAt: '2026-05-28',
  isActive: false,
};

/**
 * FIFA World Cup 2026 — 48 teams across 12 groups.
 * First expanded World Cup (USA/Mexico/Canada hosts).
 * Draw held December 5, 2025 at Kennedy Center, Washington DC.
 *
 * Winner odds sourced from DraftKings (Feb 2026).
 * Round-by-round odds derived from winner odds using probability scaling.
 *
 * NOTE: 6 spots are pending playoff results (March 2026):
 *   - Group A pos 4: UEFA Playoff D (Denmark*, Czechia, Rep. of Ireland, North Macedonia)
 *   - Group B pos 4: UEFA Playoff A (Italy*, Wales, Bosnia-Herzegovina, N. Ireland)
 *   - Group D pos 4: UEFA Playoff C (Turkey*, Slovakia, Kosovo, Romania)
 *   - Group F pos 4: UEFA Playoff B (Ukraine*, Poland, Albania, Sweden)
 *   - Group I pos 4: Inter-conf Playoff 2 (Bolivia*, Iraq, Suriname)
 *   - Group K pos 4: Inter-conf Playoff 1 (DR Congo*, Jamaica, New Caledonia)
 *   * = most likely qualifier (used as placeholder). Update after playoffs conclude.
 */
export const WORLD_CUP_2026_TEAMS: BaseTeam[] = [
  // ─── Group A: Mexico, South Korea, South Africa, [Playoff D → Denmark*] ───
  { id: 1, name: 'Mexico', seed: 1, group: 'A', americanOdds: { groupStage: -300, r32: -100, r16: +250, qf: +700, sf: +2000, champion: +8000 } },
  { id: 2, name: 'South Korea', seed: 2, group: 'A', americanOdds: { groupStage: +100, r32: +350, r16: +900, qf: +3000, sf: +7000, champion: +15000 } },
  { id: 3, name: 'South Africa', seed: 3, group: 'A', americanOdds: { groupStage: +350, r32: +1000, r16: +3500, qf: +10000, sf: +25000, champion: +100000 } },
  { id: 4, name: 'Denmark', seed: 4, group: 'A', americanOdds: { groupStage: +100, r32: +400, r16: +1200, qf: +3500, sf: +8000, champion: +20000 } },

  // ─── Group B: Canada, Switzerland, Qatar, [Playoff A → Italy*] ───
  { id: 5, name: 'Canada', seed: 1, group: 'B', americanOdds: { groupStage: -120, r32: +200, r16: +700, qf: +2500, sf: +6000, champion: +25000 } },
  { id: 6, name: 'Switzerland', seed: 2, group: 'B', americanOdds: { groupStage: -110, r32: +250, r16: +800, qf: +2500, sf: +5000, champion: +10000 } },
  { id: 7, name: 'Qatar', seed: 3, group: 'B', americanOdds: { groupStage: +400, r32: +1200, r16: +4000, qf: +12000, sf: +30000, champion: +100000 } },
  { id: 8, name: 'Italy', seed: 4, group: 'B', americanOdds: { groupStage: -250, r32: +100, r16: +350, qf: +800, sf: +1800, champion: +3000 } },

  // ─── Group C: Brazil, Morocco, Scotland, Haiti ───
  { id: 9, name: 'Brazil', seed: 1, group: 'C', americanOdds: { groupStage: -800, r32: -300, r16: -100, qf: +150, sf: +350, champion: +800 } },
  { id: 10, name: 'Morocco', seed: 2, group: 'C', americanOdds: { groupStage: -120, r32: +250, r16: +800, qf: +2500, sf: +5000, champion: +10000 } },
  { id: 11, name: 'Scotland', seed: 3, group: 'C', americanOdds: { groupStage: +180, r32: +600, r16: +1800, qf: +5000, sf: +12000, champion: +25000 } },
  { id: 12, name: 'Haiti', seed: 4, group: 'C', americanOdds: { groupStage: +500, r32: +1500, r16: +5000, qf: +15000, sf: +40000, champion: +200000 } },

  // ─── Group D: USA, Paraguay, Australia, [Playoff C → Turkey*] ───
  { id: 13, name: 'United States', seed: 1, group: 'D', americanOdds: { groupStage: -500, r32: -180, r16: +100, qf: +300, sf: +800, champion: +8000 } },
  { id: 14, name: 'Paraguay', seed: 2, group: 'D', americanOdds: { groupStage: +100, r32: +400, r16: +1200, qf: +3500, sf: +8000, champion: +15000 } },
  { id: 15, name: 'Australia', seed: 3, group: 'D', americanOdds: { groupStage: +250, r32: +700, r16: +2500, qf: +8000, sf: +20000, champion: +50000 } },
  { id: 16, name: 'Turkey', seed: 4, group: 'D', americanOdds: { groupStage: +150, r32: +500, r16: +1500, qf: +4500, sf: +10000, champion: +25000 } },

  // ─── Group E: Germany, Ecuador, Ivory Coast, Curacao ───
  { id: 17, name: 'Germany', seed: 1, group: 'E', americanOdds: { groupStage: -600, r32: -200, r16: +100, qf: +250, sf: +600, champion: +1200 } },
  { id: 18, name: 'Ecuador', seed: 2, group: 'E', americanOdds: { groupStage: -110, r32: +250, r16: +800, qf: +2500, sf: +5000, champion: +10000 } },
  { id: 19, name: 'Ivory Coast', seed: 3, group: 'E', americanOdds: { groupStage: +100, r32: +350, r16: +1200, qf: +3500, sf: +8000, champion: +20000 } },
  { id: 20, name: 'Curacao', seed: 4, group: 'E', americanOdds: { groupStage: +500, r32: +1500, r16: +5000, qf: +15000, sf: +40000, champion: +200000 } },

  // ─── Group F: Netherlands, Japan, Tunisia, [Playoff B → Ukraine*] ───
  { id: 21, name: 'Netherlands', seed: 1, group: 'F', americanOdds: { groupStage: -500, r32: -150, r16: +120, qf: +400, sf: +1000, champion: +2000 } },
  { id: 22, name: 'Japan', seed: 2, group: 'F', americanOdds: { groupStage: -120, r32: +250, r16: +800, qf: +2500, sf: +5000, champion: +10000 } },
  { id: 23, name: 'Tunisia', seed: 3, group: 'F', americanOdds: { groupStage: +250, r32: +700, r16: +2500, qf: +7000, sf: +18000, champion: +40000 } },
  { id: 24, name: 'Ukraine', seed: 4, group: 'F', americanOdds: { groupStage: +120, r32: +400, r16: +1200, qf: +3500, sf: +8000, champion: +20000 } },

  // ─── Group G: Belgium, Iran, Egypt, New Zealand ───
  { id: 25, name: 'Belgium', seed: 1, group: 'G', americanOdds: { groupStage: -400, r32: -130, r16: +200, qf: +600, sf: +1500, champion: +5000 } },
  { id: 26, name: 'Iran', seed: 2, group: 'G', americanOdds: { groupStage: +200, r32: +600, r16: +2000, qf: +6000, sf: +15000, champion: +50000 } },
  { id: 27, name: 'Egypt', seed: 3, group: 'G', americanOdds: { groupStage: +150, r32: +500, r16: +1500, qf: +4500, sf: +10000, champion: +25000 } },
  { id: 28, name: 'New Zealand', seed: 4, group: 'G', americanOdds: { groupStage: +400, r32: +1200, r16: +4000, qf: +12000, sf: +30000, champion: +100000 } },

  // ─── Group H: Spain, Uruguay, Saudi Arabia, Cape Verde ───
  { id: 29, name: 'Spain', seed: 1, group: 'H', americanOdds: { groupStage: -900, r32: -350, r16: -150, qf: +100, sf: +220, champion: +450 } },
  { id: 30, name: 'Uruguay', seed: 2, group: 'H', americanOdds: { groupStage: -200, r32: +100, r16: +400, qf: +1200, sf: +3000, champion: +5000 } },
  { id: 31, name: 'Saudi Arabia', seed: 3, group: 'H', americanOdds: { groupStage: +350, r32: +1000, r16: +3500, qf: +10000, sf: +25000, champion: +100000 } },
  { id: 32, name: 'Cape Verde', seed: 4, group: 'H', americanOdds: { groupStage: +500, r32: +1500, r16: +5000, qf: +15000, sf: +40000, champion: +200000 } },

  // ─── Group I: France, Senegal, Norway, [Inter-conf 2 → Bolivia*] ───
  { id: 33, name: 'France', seed: 1, group: 'I', americanOdds: { groupStage: -800, r32: -300, r16: -120, qf: +130, sf: +300, champion: +700 } },
  { id: 34, name: 'Senegal', seed: 2, group: 'I', americanOdds: { groupStage: -100, r32: +300, r16: +900, qf: +2500, sf: +6000, champion: +12000 } },
  { id: 35, name: 'Norway', seed: 3, group: 'I', americanOdds: { groupStage: -150, r32: +200, r16: +600, qf: +1500, sf: +2000, champion: +3000 } },
  { id: 36, name: 'Bolivia', seed: 4, group: 'I', americanOdds: { groupStage: +300, r32: +800, r16: +2500, qf: +7000, sf: +18000, champion: +25000 } },

  // ─── Group J: Argentina, Austria, Algeria, Jordan ───
  { id: 37, name: 'Argentina', seed: 1, group: 'J', americanOdds: { groupStage: -800, r32: -300, r16: -100, qf: +150, sf: +350, champion: +800 } },
  { id: 38, name: 'Austria', seed: 2, group: 'J', americanOdds: { groupStage: -100, r32: +300, r16: +1000, qf: +3000, sf: +7000, champion: +15000 } },
  { id: 39, name: 'Algeria', seed: 3, group: 'J', americanOdds: { groupStage: +100, r32: +400, r16: +1200, qf: +3500, sf: +8000, champion: +20000 } },
  { id: 40, name: 'Jordan', seed: 4, group: 'J', americanOdds: { groupStage: +400, r32: +1200, r16: +4000, qf: +12000, sf: +30000, champion: +150000 } },

  // ─── Group K: Portugal, Colombia, Uzbekistan, [Inter-conf 1 → DR Congo*] ───
  { id: 41, name: 'Portugal', seed: 1, group: 'K', americanOdds: { groupStage: -700, r32: -280, r16: -100, qf: +180, sf: +400, champion: +1000 } },
  { id: 42, name: 'Colombia', seed: 2, group: 'K', americanOdds: { groupStage: -200, r32: +100, r16: +400, qf: +1200, sf: +3000, champion: +5000 } },
  { id: 43, name: 'Uzbekistan', seed: 3, group: 'K', americanOdds: { groupStage: +350, r32: +1000, r16: +3500, qf: +10000, sf: +25000, champion: +200000 } },
  { id: 44, name: 'DR Congo', seed: 4, group: 'K', americanOdds: { groupStage: +350, r32: +1000, r16: +3500, qf: +10000, sf: +25000, champion: +100000 } },

  // ─── Group L: England, Croatia, Panama, Ghana ───
  { id: 45, name: 'England', seed: 1, group: 'L', americanOdds: { groupStage: -700, r32: -280, r16: -110, qf: +160, sf: +350, champion: +600 } },
  { id: 46, name: 'Croatia', seed: 2, group: 'L', americanOdds: { groupStage: -120, r32: +250, r16: +800, qf: +2500, sf: +5000, champion: +10000 } },
  { id: 47, name: 'Panama', seed: 3, group: 'L', americanOdds: { groupStage: +350, r32: +1000, r16: +3500, qf: +10000, sf: +25000, champion: +70000 } },
  { id: 48, name: 'Ghana', seed: 4, group: 'L', americanOdds: { groupStage: +100, r32: +400, r16: +1200, qf: +3500, sf: +8000, champion: +15000 } },
];
