import type { EspnScoreboard } from './soccer';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

/**
 * Fetch the ESPN scoreboard for a single YYYYMMDD date. ESPN's default
 * (no-dates) scoreboard only shows a narrow current window, so callers must
 * sweep the tournament date range day by day.
 */
async function fetchDate(yyyymmdd: string): Promise<EspnScoreboard> {
  const res = await fetch(`${BASE}?dates=${yyyymmdd}`, {
    headers: { 'User-Agent': 'calcutta-edge' },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return (await res.json()) as EspnScoreboard;
}

/** YYYYMMDD strings from start (inclusive) to end (inclusive), UTC. */
export function dateRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    out.push(
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
    );
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Fetch + merge events across a date window. Individual day failures are
 * tolerated (allSettled) — a missing day degrades the tables rather than
 * failing the whole scoreboard.
 */
export async function fetchScoreboardWindow(start: Date, end: Date): Promise<EspnScoreboard> {
  const days = dateRange(start, end);
  const results = await Promise.allSettled(days.map(fetchDate));
  const events = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value.events ?? [] : []
  );
  return { events };
}
