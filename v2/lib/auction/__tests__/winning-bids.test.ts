import { describe, it, expect } from 'vitest';
import { dedupeBy } from '../winning-bids';

describe('dedupeBy', () => {
  it('keeps one row per team_id within a session (the duplicate-winning-bid bug)', () => {
    const bids = [
      { team_id: 19, amount: 6 },
      { team_id: 19, amount: 6 }, // duplicate winning bid for the same team
      { team_id: 20, amount: 6 },
    ];
    const out = dedupeBy(bids, (b) => b.team_id);
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.team_id)).toEqual([19, 20]);
  });

  it('dedupes across sessions by a composite key', () => {
    const bids = [
      { session_id: 's1', team_id: 19, amount: 6 },
      { session_id: 's1', team_id: 19, amount: 6 },
      { session_id: 's2', team_id: 19, amount: 8 }, // different session — kept
    ];
    const out = dedupeBy(bids, (b) => `${b.session_id}:${b.team_id}`);
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.session_id)).toEqual(['s1', 's2']);
  });

  it('is a no-op when there are no duplicates', () => {
    const bids = [{ team_id: 1 }, { team_id: 2 }, { team_id: 3 }];
    expect(dedupeBy(bids, (b) => b.team_id)).toEqual(bids);
  });
});
