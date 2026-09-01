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

  it('prefers the config-declared label when a config is passed', () => {
    const config = {
      groups: [
        { key: 'favorites', label: 'Favorites' }, // golf: lowercase key, capitalized label
        { key: 'AFC_East', label: 'AFC East' },
      ],
    };
    expect(formatGroupLabel('favorites', config)).toBe('Favorites');
    expect(formatGroupLabel('AFC_East', config)).toBe('AFC East');
    // Unknown keys fall back to the underscore swap, never crash.
    expect(formatGroupLabel('NFC_Wild', config)).toBe('NFC Wild');
    expect(formatGroupLabel('AFC_East', null)).toBe('AFC East');
  });
});
