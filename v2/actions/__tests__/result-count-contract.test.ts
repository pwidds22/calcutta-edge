import { describe, it, expect } from 'vitest';
import { updateResult, bulkUpdateResults } from '../tournament-results';

describe('write-path contract', () => {
  it('updateResult accepts an optional result count', () => {
    expect(updateResult.length).toBeGreaterThanOrEqual(4);
  });
  it('bulkUpdateResults is exported', () => {
    expect(typeof bulkUpdateResults).toBe('function');
  });
});
