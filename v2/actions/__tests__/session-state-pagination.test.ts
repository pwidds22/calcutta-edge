/**
 * Regression: per-SESSION reads vs PostgREST's silent 1,000-row cap.
 *
 * Supabase truncates ANY select at `max-rows` (1,000) with no error. Two
 * single-session reads can cross it:
 *  - the current team's bid history in getSessionState — bid-war length has no
 *    schema ceiling (a $1-increment war on a big-money lot can pass 1,000
 *    bids), and with ascending created_at the cap keeps the EARLIEST rows,
 *    silently dropping the newest bids;
 *  - tournament_results for one session — bounded by teams × rounds, which is
 *    already ~780 for PGA (156 golfers × 5 rounds); the next big-field config
 *    crosses the cap with no error anywhere.
 *
 * The mock client reproduces the cap on EVERY response — un-ranged selects get
 * exactly the first `maxRows` matching rows, ranged selects get their slice
 * (also capped), and un-ordered ranged reads are rotated differently per call
 * so pagination that drops its .order() goes red. The fixture gives ONE
 * session >1,000 bids on the current team and >1,000 result rows. These tests
 * exercise getSessionState / getTournamentResults themselves, not the
 * pagination helper — reverting the call sites to un-ranged selects turns
 * them red.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

/** Rotates un-ordered ranged reads differently per call — Postgres LIMIT/OFFSET
 *  without ORDER BY guarantees nothing, so pagination that drops its .order()
 *  must produce inconsistent pages here (and turn the assertions red). */
let unorderedCallCounter = 0;

class MockQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private orderCols: Array<{ col: string; asc: boolean }> = [];
  private rangeBounds: [number, number] | null = null;
  private singleMode = false;

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
  // PostgREST supports chained .order() calls (comma-joined ORDER BY) — the
  // paginated call sites use created_at + id tiebreak, so the mock must too.
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCols.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }
  single() {
    this.singleMode = true;
    return this;
  }
  // Thenable, like the real PostgrestFilterBuilder.
  then<R>(
    resolve: (value: { data: Row[] | Row | null; error: { message: string } | null }) => R
  ): R {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCols.length > 0) {
      const cols = this.orderCols;
      out = [...out].sort((a, b) => {
        for (const { col, asc } of cols) {
          const av = String(a[col]);
          const bv = String(b[col]);
          if (av !== bv) return (av < bv ? -1 : 1) * (asc ? 1 : -1);
        }
        return 0;
      });
    }
    if (this.orderCols.length === 0 && this.rangeBounds) {
      const shift = unorderedCallCounter++ % Math.max(out.length, 1);
      out = [...out.slice(shift), ...out.slice(0, shift)];
    }
    if (this.rangeBounds) {
      out = out.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
    }
    // PostgREST max-rows: applies to every response, ranged or not, silently.
    if (out.length > holder.maxRows) {
      out = out.slice(0, holder.maxRows);
    }
    if (this.singleMode) {
      if (out.length === 1) return resolve({ data: out[0], error: null });
      return resolve({
        data: null,
        error: { message: `JSON object requested, ${out.length} rows returned` },
      });
    }
    return resolve({ data: out, error: null });
  }
}

const holder = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  userId: 'user-1',
  /** The server's PostgREST max-rows setting. Supabase's default is 1,000 but
   *  it is dashboard-editable — the helper must survive it being lowered. */
  maxRows: 1000,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: holder.userId } } }),
    },
    from: (table: string) => new MockQuery(holder.tables[table] ?? []),
  }),
}));

// getSessionState dynamically imports this for the strategy-overlay gate; keep
// it away from the paid_tournaments table shape.
vi.mock('@/lib/auth/tournament-access', () => ({
  hasTournamentAccess: async () => false,
}));

import { getSessionState } from '../session';
import { getTournamentResults } from '../tournament-results';

const USER = 'user-1';
const SESSION = 's-live';
const CURRENT_TEAM = 7;
const BID_COUNT = 1050; // > POSTGREST_MAX_ROWS
const RESULT_COUNT = 1050; // > POSTGREST_MAX_ROWS

const pad = (n: number) => String(n).padStart(5, '0');
const at = (i: number) => new Date(Date.UTC(2026, 8, 1, 12, 0, 0) + i * 1000).toISOString();

/**
 * One ACTIVE session mid-auction on team 7, with a 1,050-bid war on that team
 * (amounts 1..1050, ascending in time — the newest bids are the ones an
 * un-ranged ascending select silently drops) and 1,050 result rows.
 */
function buildFixture() {
  const sessions: Row[] = [
    {
      id: SESSION,
      name: 'Live League',
      join_code: 'LIVE01',
      status: 'active',
      tournament_id: 'nfl_season_2026',
      commissioner_id: USER,
      current_team_idx: 0,
      team_order: [String(CURRENT_TEAM)],
      settings: null,
      payout_rules: {},
      estimated_pot_size: 0,
      current_highest_bid: BID_COUNT,
      current_highest_bidder_id: 'user-2',
      prop_results: null,
    },
  ];

  const participants: Row[] = ['user-1', 'user-2', 'user-3'].map((uid, i) => ({
    id: `p-${uid}`,
    session_id: SESSION,
    user_id: uid,
    display_name: uid,
    is_commissioner: uid === USER,
    joined_at: at(i),
  }));

  const bids: Row[] = [];
  // Two teams already sold — winningBids must survive alongside the big history.
  bids.push(
    { id: `b-w${pad(1)}`, session_id: SESSION, team_id: 1, bidder_id: 'user-2', amount: 40, is_winning_bid: true, created_at: at(0) },
    { id: `b-w${pad(2)}`, session_id: SESSION, team_id: 2, bidder_id: 'user-3', amount: 55, is_winning_bid: true, created_at: at(1) }
  );
  // The bid war on the CURRENT team (unsold), ascending in time.
  for (let i = 1; i <= BID_COUNT; i++) {
    bids.push({
      id: `b-c${pad(i)}`,
      session_id: SESSION,
      team_id: CURRENT_TEAM,
      bidder_id: i % 2 === 0 ? 'user-2' : 'user-3',
      amount: i,
      is_winning_bid: false,
      created_at: at(100 + i),
    });
  }

  const results: Row[] = [];
  for (let i = 1; i <= RESULT_COUNT; i++) {
    results.push({
      id: `r-${pad(i)}`,
      session_id: SESSION,
      team_id: i,
      round_key: 'regularSeasonWins',
      result: i % 2 === 0 ? 'won' : 'lost',
      result_count: null,
    });
  }

  return {
    auction_sessions: sessions,
    auction_participants: participants,
    auction_bids: bids,
    tournament_results: results,
  };
}

beforeEach(() => {
  holder.tables = buildFixture();
  holder.userId = USER;
  holder.maxRows = 1000;
  unorderedCallCounter = 0;
});

describe('getSessionState beyond the 1,000-row cap', () => {
  it('returns the full current-team bid history, newest bids included', async () => {
    const state = await getSessionState(SESSION);
    expect('error' in state && state.error).toBeFalsy();
    if ('error' in state) throw new Error('unexpected error shape');
    // The buggy un-ranged ascending select returned exactly the FIRST 1,000
    // bids — dropping the newest 50, including the current high bid.
    expect(state.currentBids).toHaveLength(BID_COUNT);
    expect(state.currentBids[0]?.amount).toBe(1);
    expect(state.currentBids.at(-1)?.amount).toBe(BID_COUNT);
    // Display order preserved: ascending created_at.
    expect(state.currentBids[999]?.amount).toBe(1000);
    // Unrelated reads keep working alongside the big history.
    expect(state.winningBids).toHaveLength(2);
    expect(state.participants).toHaveLength(3);
  });

  it('returns every tournament_results row past row 1,000', async () => {
    const state = await getSessionState(SESSION);
    if ('error' in state) throw new Error('unexpected error shape');
    expect(state.tournamentResults).toHaveLength(RESULT_COUNT);
    // A row from beyond the cap is present.
    expect(state.tournamentResults.some((r) => r.team_id === RESULT_COUNT)).toBe(true);
  });

  it('survives a server max-rows configured below the page size', async () => {
    // Supabase's max-rows is dashboard-editable. At 100, every response —
    // including a "full" requested page of 1,000 — comes back short, so a
    // pager that terminates on short-but-nonempty pages silently truncates.
    holder.maxRows = 100;
    const state = await getSessionState(SESSION);
    if ('error' in state) throw new Error('unexpected error shape');
    expect(state.currentBids).toHaveLength(BID_COUNT);
    expect(state.currentBids.at(-1)?.amount).toBe(BID_COUNT);
    expect(state.tournamentResults).toHaveLength(RESULT_COUNT);
  });
});

describe('getTournamentResults beyond the 1,000-row cap', () => {
  it('returns every result row for the session', async () => {
    const res = await getTournamentResults(SESSION);
    expect('error' in res && res.error).toBeFalsy();
    if (!('results' in res) || !res.results) throw new Error('unexpected error shape');
    expect(res.results).toHaveLength(RESULT_COUNT);
    expect(res.results.some((r) => r.team_id === RESULT_COUNT)).toBe(true);
  });
});
