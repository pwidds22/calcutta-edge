import { describe, it, expect } from 'vitest';
import { formatGroupLabel } from '../format';

describe('formatGroupLabel', () => {
  it('humanizes underscore-keyed groups (NFL divisions)', () => {
    expect(formatGroupLabel('AFC_South')).toBe('AFC South');
    expect(formatGroupLabel('NFC_West')).toBe('NFC West');
  });

  it('passes through groups without underscores unchanged', () => {
    expect(formatGroupLabel('A')).toBe('A'); // World Cup
    expect(formatGroupLabel('Midwest')).toBe('Midwest'); // NCAA region
    expect(formatGroupLabel('All')).toBe('All'); // filter sentinel
  });

  it('tolerates missing values', () => {
    expect(formatGroupLabel(undefined)).toBe('');
    expect(formatGroupLabel(null)).toBe('');
    expect(formatGroupLabel('')).toBe('');
  });
});
