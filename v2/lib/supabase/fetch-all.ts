/**
 * Paginated fetch for Supabase selects that can exceed PostgREST's row cap.
 *
 * PostgREST silently truncates ANY select at the server's `max-rows` setting
 * (1,000 on Supabase) — no error, no warning, the query "succeeds" with
 * partial data. Every un-ranged multi-session select is a time bomb: it works
 * in testing and then silently corrupts results for the most active users
 * (caught 2026-09-01: dashboard P&L showed −$270 instead of +$486 because a
 * user's `tournament_results` spanned ~1,450 rows).
 *
 * Usage — the caller applies `.order(<unique column>)` and `.range(from, to)`:
 *
 *   const rows = await fetchAllPages<ResultRow>((from, to) =>
 *     supabase.from('tournament_results')
 *       .select('session_id, team_id, round_key, result, result_count')
 *       .in('session_id', ids)
 *       .order('id')          // REQUIRED: stable order — LIMIT/OFFSET without
 *       .range(from, to)      // ORDER BY can repeat/skip rows across pages
 *   );
 *
 * Errors THROW rather than resolving to partial data: for money-bearing
 * queries a visible failure beats a silently-wrong number.
 */

export const SUPABASE_PAGE_SIZE = 1000;

/** Backstop against a server that keeps returning full pages forever. */
const MAX_PAGES = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Paginated fetch failed on rows ${from}+: ${error.message}`);
    }
    const rows = data ?? [];
    all.push(...rows);
    // Terminate only on an EMPTY page, advancing by however many rows the
    // server actually returned. Stopping on `rows.length < SUPABASE_PAGE_SIZE`
    // would silently truncate if the server's `max-rows` setting is ever
    // configured below our page size (it caps every response, so a "full"
    // page would come back short forever) — the exact bug class this helper
    // exists to kill. Costs one extra (empty) request per fetch; callers run
    // their fetches in parallel, so the wall-clock price is one round-trip.
    if (rows.length === 0) return all;
    from += rows.length;
  }
  throw new Error(
    `Paginated fetch still returning rows after ${MAX_PAGES} pages (${all.length} so far) — aborting rather than trusting an unbounded result`
  );
}
