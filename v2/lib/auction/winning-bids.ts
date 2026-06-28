/**
 * A team can only be WON ONCE. The bid-settling step in actions/bidding.ts marks
 * the winning bid with an UPDATE filtered on (session_id, team_id, bidder_id,
 * amount) — no single-row limit — so if a bidder ever has two bid rows at the same
 * amount on the same team (e.g. a double-submit), BOTH get is_winning_bid=true.
 * That duplicate would otherwise double-count the team in the pot, settlement,
 * P&L, and EV. Dedupe winning-bid rows by team at every read boundary so a stray
 * duplicate can never inflate the math. Keeps the first occurrence.
 *
 * (Caught 2026-06-22: a WC league showed "Ivory Coast" twice for one owner; 3
 * sessions had a duplicate winning bid. The DB-level fix — clean the dup rows +
 * a partial unique index on (session_id, team_id) where is_winning_bid — is a
 * separate follow-up; this guards the read path now.)
 */
export function dedupeBy<T>(items: T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
