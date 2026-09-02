import { describe, it, expect } from 'vitest';
import { safeNext } from '../safe-redirect';

describe('safeNext', () => {
  it('keeps a same-origin path, with its query and hash', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard');
    expect(safeNext('/host/create?tournament=nfl_season_2026')).toBe(
      '/host/create?tournament=nfl_season_2026'
    );
    expect(safeNext('/strategy?tournament=nfl_season_2026#teams')).toBe(
      '/strategy?tournament=nfl_season_2026#teams'
    );
  });

  it('rejects every off-origin shape', () => {
    // The obvious one.
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext('http://evil.com/host')).toBeNull();
    // Protocol-relative — a browser treats this as absolute.
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('//evil.com/host/create')).toBeNull();
    // Backslash disguise: the URL parser normalises `\` to `/`, so this is
    // `//evil.com`. A hand-rolled `startsWith('//')` check misses it — this is
    // the case that motivates parsing rather than prefix-matching.
    expect(safeNext('/\\evil.com')).toBeNull();
    expect(safeNext('\\\\evil.com')).toBeNull();
    // Non-http schemes.
    expect(safeNext('javascript:alert(1)')).toBeNull();
    expect(safeNext('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects anything that is not a usable relative path', () => {
    expect(safeNext('evil.com')).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(42)).toBeNull();
    expect(safeNext({ toString: () => '/dashboard' })).toBeNull();
  });

  it('never returns a value carrying an origin', () => {
    // Whatever survives must be safe to hand straight to redirect().
    const inputs = [
      '/dashboard',
      '/host/create?tournament=nfl_season_2026',
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      '/a/b/c?d=e#f',
    ];
    for (const input of inputs) {
      const out = safeNext(input);
      if (out === null) continue;
      expect(out.startsWith('/')).toBe(true);
      expect(out.startsWith('//')).toBe(false);
      expect(out).not.toContain('evil.com');
    }
  });
});
