import { describe, it, expect } from 'vitest';
import { resolveUnitEntry, MAX_FLAT_RATE_UNITS } from '../unit-entry';

describe('resolveUnitEntry', () => {
  it('treats an empty string as no change (never wipes a saved count)', () => {
    expect(resolveUnitEntry('')).toEqual({ action: 'skip' });
  });

  it('treats whitespace-only input as no change', () => {
    expect(resolveUnitEntry('   ')).toEqual({ action: 'skip' });
  });

  it('treats non-numeric input as no change', () => {
    expect(resolveUnitEntry('abc')).toEqual({ action: 'skip' });
  });

  it('clamps a value above the season max down to the max', () => {
    expect(resolveUnitEntry('25')).toEqual({
      action: 'save',
      result: 'won',
      count: MAX_FLAT_RATE_UNITS,
    });
  });

  it('clamps a negative value up to 0', () => {
    expect(resolveUnitEntry('-3')).toEqual({ action: 'save', result: 'lost', count: 0 });
  });

  it('saves an explicit 0 as lost with count 0, distinct from empty', () => {
    expect(resolveUnitEntry('0')).toEqual({ action: 'save', result: 'lost', count: 0 });
  });

  it('preserves a fractional win count and marks it won', () => {
    expect(resolveUnitEntry('9.5')).toEqual({ action: 'save', result: 'won', count: 9.5 });
  });

  it('marks the maximum in-range value as won', () => {
    expect(resolveUnitEntry('17')).toEqual({ action: 'save', result: 'won', count: 17 });
  });
});
