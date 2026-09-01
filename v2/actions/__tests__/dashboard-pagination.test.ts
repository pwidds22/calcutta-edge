/**
 * Regression: getDashboardData vs PostgREST's silent 1,000-row cap.
 *
 * Supabase truncates ANY select at `max-rows` (1,000) with no error. The
 * dashboard's multi-session selects (`tournament_results`, the user's winning
 * bids, ALL winning bids) grow with lifetime league count, so heavy users got
 * silently-wrong money numbers: truncated results → earnings dropped → net
 * P&L showed −$buyIn instead of winnings (prod repro 2026-09-01: −$270 shown,
 * +$486 true).
 *
 * The mock client below reproduces the cap on EVERY response — un-ranged
 * selects get exactly the first 1,000 matching rows, ranged selects get their
 * slice (also capped). The fixture puts >1,000 rows of OTHER sessions' data in
 * front of the session under test, so any un-ranged call site starves it.
 * These tests exercise `getDashboardData` itself, not the pagination helper —
 * reverting the dashboard call sites to un-ranged selects turns them red.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const POSTGREST_MAX_ROWS = 1000;

type Row = Record<string, unknown>;

class MockQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private rangeBounds: [number, number] | null = null;

  constructor(private rows: Row[]) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    const set = new Set(vals);
    this.filters.push((r) => set.has(r[col]));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }
  // Thenable, like the real PostgrestFilterBuilder.
  then<R>(resolve: (value: { data: Row[]; error: null }) => R): R {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol !== null) {
      const col = this.orderCol;
      const dir = this.orderAsc ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = String(a[col]);
        const bv = String(b[col]);
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    if (this.rangeBounds) {
      out = out.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
    }
    // PostgREST max-rows: applies to every response, ranged or not, silently.
    if (out.length > POSTGREST_MAX_ROWS) {
      out = out.slice(0, POSTGREST_MAX_ROWS);
    }
    return resolve({ data: out, error: null });
  }
}

const holder = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  userId: 'user-1',
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: holder.userId } } }),
    },
    from: (table: string) => new MockQuery(holder.tables[table] ?? []),
  }),
}));

// Keep the featured-event enrichment away from the paid_tournaments table shape.
vi.mock('@/lib/auth/tournament-access', () => ({
  hasTournamentAccess: async () => false,
}));

import { getDashboardData } from '../dashboard';

const USER = 'user-1';
const pad = (n: number) => String(n).padStart(5, '0');

/**
 * Three completed sessions for the same user:
 *  - s-real   (march_madness_2026): user won Duke ($100); pot $500; Duke won
 *              every round. Its result rows sit AFTER 1,200 filler rows.
 *  - s-filler (unknown tournament): 1,200 result rows that eat the row cap.
 *  - s-bids   (unknown tournament): 1,001 winning bids by the user ($1 each) —
 *              overflows both bid selects.
 *
 * s-real is a fully-graded 3-team league (Duke 1, Ohio State 3, St. John's 5 —
 * none is a play-in pair member) using the default MM per-position rules,
 * whose tier budgets each × teamsAdvancing sum to 100%. Every round completes,
 * so adjustPayoutRulesForTies redistributes each tier's full budget among its
 * SOLD winners (unsold slots forfeit upward — pot conservation):
 *   r32: 0.5% × 32 = 16% split by 2 winners (Duke, Ohio St) → 8% each
 *   s16 16%, e8 20%, f4 16%, f2 16%, champ 16% → Duke alone
 * Duke earns 92% × $500 = $460; Ohio State the other 8% — pot conserved.
 */
function buildFixture() {
  const sessions: Row[] = [
    {
      id: 's-real',
      name: 'Real MM League',
      join_code: 'REAL01',
      status: 'completed',
      tournament_id: 'march_madness_2026',
      created_at: '2026-03-01T00:00:00Z',
      estimated_pot_size: 1000,
      payout_rules: { r32: 0.5, s16: 1, e8: 2.5, f4: 4, f2: 8, champ: 16 },
      prop_results: null,
      auction_participants: [{ count: 3 }],
    },
    {
      id: 's-filler',
      name: 'Filler League',
      join_code: 'FILL01',
      status: 'completed',
      tournament_id: 'ghost_tournament',
      created_at: '2026-02-01T00:00:00Z',
      estimated_pot_size: 0,
      payout_rules: {},
      prop_results: null,
      auction_participants: [{ count: 1 }],
    },
    {
      id: 's-bids',
      name: 'Bid-Heavy League',
      join_code: 'BIDS01',
      status: 'completed',
      tournament_id: 'ghost_tournament',
      created_at: '2026-01-01T00:00:00Z',
      estimated_pot_size: 0,
      payout_rules: {},
      prop_results: null,
      auction_participants: [{ count: 1 }],
    },
  ];

  const participants: Row[] = sessions.map((s) => ({
    session_id: s.id,
    user_id: USER,
    is_commissioner: false,
  }));

  const bids: Row[] = [
    // s-real first, so the capped un-ranged read keeps these and starves s-bids.
    { id: `b-${pad(1)}`, session_id: 's-real', team_id: 1, amount: 100, bidder_id: USER, is_winning_bid: true },
    { id: `b-${pad(2)}`, session_id: 's-real', team_id: 3, amount: 150, bidder_id: 'user-2', is_winning_bid: true },
    { id: `b-${pad(3)}`, session_id: 's-real', team_id: 5, amount: 250, bidder_id: 'user-3', is_winning_bid: true },
  ];
  for (let i = 1; i <= 1001; i++) {
    bids.push({
      id: `b-${pad(100 + i)}`,
      session_id: 's-bids',
      team_id: i,
      amount: 1,
      bidder_id: USER,
      is_winning_bid: true,
    });
  }

  const results: Row[] = [];
  // 1,200 filler rows FIRST — an un-ranged select returns only these.
  for (let i = 1; i <= 1200; i++) {
    results.push({
      id: `r-1${pad(i)}`,
      session_id: 's-filler',
      team_id: i,
      round_key: 'x',
      result: 'lost',
      result_count: null,
    });
  }
  // The rows that actually matter sit beyond the cap: a fully-graded league.
  const realRows: Array<[number, string, string]> = [
    // Duke (user's team) runs the table.
    [1, 'r32', 'won'], [1, 's16', 'won'], [1, 'e8', 'won'],
    [1, 'f4', 'won'], [1, 'f2', 'won'], [1, 'champ', 'won'],
    // Ohio State wins R32, out in S16. St. John's out in R64.
    [3, 'r32', 'won'], [3, 's16', 'lost'],
    [5, 'r32', 'lost'],
  ];
  for (const [i, [teamId, roundKey, result]] of realRows.entries()) {
    results.push({
      id: `r-9${pad(i)}`,
      session_id: 's-real',
      team_id: teamId,
      round_key: roundKey,
      result,
      result_count: null,
    });
  }

  return {
    auction_participants: participants,
    auction_sessions: sessions,
    auction_bids: bids,
    tournament_results: results,
  };
}

beforeEach(() => {
  holder.tables = buildFixture();
  holder.userId = USER;
  // Belt and braces: keep the golf-projection branch (and its fetches) off.
  vi.stubEnv('DATAGOLF_API_KEY', '');
});

describe('getDashboardData beyond the 1,000-row cap', () => {
  it('computes earnings from tournament_results rows past row 1,000', async () => {
    const data = await getDashboardData();
    const real = data.sessions.find((s) => s.id === 's-real');
    expect(real).toBeDefined();
    // Champion earnings: 92% of the $500 pot = $460 (see fixture comment);
    // spent $100 → net +$360. The buggy un-ranged select saw ZERO of s-real's
    // rows (all capped away by the 1,200 filler rows) and reported −100.
    expect(real!.userTotalEarned).toBeCloseTo(460, 5);
    expect(real!.userNetPL).toBeCloseTo(360, 5);
    expect(real!.userTeams[0]?.status).toBe('champion');
    expect(data.totalNetPL).toBeCloseTo(360, 5);
  });

  it('sums pots and exposure from winning bids past row 1,000', async () => {
    const data = await getDashboardData();
    const bidHeavy = data.sessions.find((s) => s.id === 's-bids');
    // All 1,001 winning bids count toward the completed session's actual pot…
    expect(bidHeavy!.potSize).toBe(1001);
    expect(bidHeavy!.userTotalSpent).toBe(1001);
    // …and toward lifetime exposure ($100 in s-real + $1,001 in s-bids).
    expect(data.totalPotExposure).toBe(1101);
    // s-real's pot is unaffected either way (its rows sit before the cap).
    expect(data.sessions.find((s) => s.id === 's-real')!.potSize).toBe(500);
  });
});
