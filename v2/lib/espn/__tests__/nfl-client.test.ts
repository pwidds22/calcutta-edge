import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchStandings } from '../nfl-client';

/**
 * The network layer's only real logic is "prove ESPN gave us what we asked
 * for". These tests stub fetch rather than hitting the live feed.
 */

function stubFetch(payload: unknown, ok = true) {
  const spy = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    void url;
    void _init;
    return { ok, status: ok ? 200 : 503, json: async () => payload };
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchStandings', () => {
  it('requests level=3 and seasontype=2 for the season it was given', async () => {
    const spy = stubFetch({ season: { year: 2026 }, children: [] });
    await fetchStandings(2026);

    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain('season=2026');
    expect(url).toContain('level=3');
    expect(url).toContain('seasontype=2');
    // `&type=2` is NOT a synonym — it drops pointsFor entirely.
    expect(url).not.toContain('&type=2');
    // The standings path only exists on site.web.api; site.api is a dead stub.
    expect(url).toContain('site.web.api.espn.com');
  });

  it('throws when ESPN echoes back a different season year', async () => {
    // The dangerous direction: a PAST season returns complete, perfectly
    // gradable data that is simply the wrong year, and would settle silently.
    stubFetch({ season: { year: 2025 }, children: [] });
    await expect(fetchStandings(2026)).rejects.toThrow(/returned season 2025.*asked for 2026/);
  });

  it('throws when the response carries no season year at all', async () => {
    stubFetch({ children: [] });
    await expect(fetchStandings(2026)).rejects.toThrow(/returned season undefined/);
  });

  it('returns the payload when the echoed year matches', async () => {
    const payload = { season: { year: 2026 }, children: [{ name: 'AFC East' }] };
    stubFetch(payload);
    await expect(fetchStandings(2026)).resolves.toEqual(payload);
  });

  it('throws loudly on a non-ok response rather than returning empty standings', async () => {
    stubFetch({}, false);
    await expect(fetchStandings(2026)).rejects.toThrow(/ESPN standings 503/);
  });
});
