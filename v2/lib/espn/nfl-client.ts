import type { EspnStandings, EspnNflScoreboard } from './nfl';

/**
 * ESPN NFL network layer. All parsing lives in `nfl.ts` (pure, unit-tested);
 * this file only fetches and fails loudly.
 *
 * NOTE the host: `site.web.api.espn.com/apis/v2/...`, NOT `site.api.espn.com`.
 * The latter's NFL standings path is a dead 86-byte stub that returns only
 * `{"fullViewLink":{...}}` — the same failure CLAUDE.md records for the soccer
 * `fifa.world` standings endpoint. Verified again 2026-08-27.
 */
const STANDINGS_BASE = 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings';

/** The scoreboard is on the ordinary host; only standings needs site.web.api. */
const SCOREBOARD_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

const HEADERS = { 'User-Agent': 'calcutta-edge' };

async function getJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`[nfl] ESPN ${label} ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/**
 * League standings for one season.
 *
 * `seasonYear` MUST come from `config.startDate.slice(0, 4)`, never
 * `new Date().getFullYear()`. In January 2027 the wall-clock year is 2027 but
 * the 2026 NFL season is still ESPN season 2026 — a clock-year call would ask
 * for a season that has not been played and settle everyone at zero, in the
 * middle of the playoffs.
 *
 * `&seasontype=2` is not optional. Without it ESPN returns whatever season type
 * is CURRENTLY ACTIVE: fetched 2026-08-27, `?season=2026&level=3` came back
 * `seasonType: 1` with the Bills 2-0 and 60 points for — preseason results that
 * would have paid out as real wins. Adding it returns `seasonType: 2`, Bills
 * 0-0. This is invisible when testing against a completed season and bites only
 * in Aug/Sep and Jan/Feb — production, in other words.
 *
 * `&type=2` is NOT a synonym for `&seasontype=2`: it selects ESPN's "expanded"
 * stat set, which drops `pointsFor` entirely.
 *
 * `level=3` groups entries by division, which is what division-winner grading
 * needs; the caller should still assert `seasonType === 2` on the parsed result.
 */
export async function fetchStandings(seasonYear: number): Promise<EspnStandings> {
  const url = `${STANDINGS_BASE}?season=${seasonYear}&level=3&seasontype=2`;
  return getJson<EspnStandings>(url, 'standings');
}

/**
 * One regular-season week's scoreboard (weeks 1-18).
 *
 * Deliberately NOT modelled on `fetchScoreboardWindow` in `soccer-client.ts`,
 * which swallows a failed day via `Promise.allSettled` and returns `[]` for it.
 * There a missing day only delays a completeness-gated group table; here a
 * silently missing week makes an incomplete season look complete, which closes
 * rounds early and pays them out wrong. Any failure throws.
 *
 * The same "currently active" trap as standings applies: with no params the
 * scoreboard returned preseason week 4 on 2026-08-27. The response echoes back
 * `season.type` and `week.number`, so we verify we got the week we asked for
 * rather than trusting the query string.
 */
export async function fetchRegularSeasonWeek(
  year: number,
  week: number
): Promise<EspnNflScoreboard> {
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    throw new Error(`[nfl] regular-season week must be 1-18, got ${week}`);
  }
  const url = `${SCOREBOARD_BASE}?dates=${year}&seasontype=2&week=${week}`;
  const data = await getJson<EspnNflScoreboard>(url, `scoreboard week ${week}`);

  if (data.season?.type !== 2 || data.season?.year !== year || data.week?.number !== week) {
    throw new Error(
      `[nfl] ESPN returned season ${data.season?.year} type ${data.season?.type} ` +
        `week ${data.week?.number}, asked for season ${year} type 2 week ${week}`
    );
  }
  return data;
}
