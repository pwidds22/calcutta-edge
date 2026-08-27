import { describe, it, expect } from 'vitest';
import { updateResult, bulkUpdateResults } from '../tournament-results';
import { normalizeResultCount } from '@/lib/auction/live/unit-entry';

describe('write-path contract', () => {
  it('updateResult accepts an optional result count', () => {
    expect(updateResult.length).toBeGreaterThanOrEqual(4);
  });
  it('bulkUpdateResults is exported', () => {
    expect(typeof bulkUpdateResults).toBe('function');
  });
});

describe('normalizeResultCount (write shape === broadcast shape)', () => {
  it('drops the count on a pending result', () => {
    // bulkUpdateResults used to write NULL here but re-broadcast the raw update,
    // so a pending row carrying a count painted that count on every client.
    expect(normalizeResultCount('pending', 11)).toBeNull();
    expect(normalizeResultCount('pending', 0)).toBeNull();
    expect(normalizeResultCount('pending')).toBeNull();
  });

  it('preserves a real count on a decided result', () => {
    expect(normalizeResultCount('won', 11)).toBe(11);
    expect(normalizeResultCount('lost', 0)).toBe(0);
  });

  it('coerces a missing count to null, never 0', () => {
    // getTeamStatus defaults an absent count to 1 unit. Writing 0 would pay nothing.
    expect(normalizeResultCount('won')).toBeNull();
    expect(normalizeResultCount('won', null)).toBeNull();
  });
});
