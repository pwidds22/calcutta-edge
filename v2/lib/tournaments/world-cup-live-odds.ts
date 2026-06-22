import type { BaseTeam, RoundKey } from './types';

/**
 * Live World Cup odds from Kalshi — fetched server-side, UNAUTHENTICATED (Kalshi's
 * market-read endpoints are public), cached 1 hour via Next's data cache.
 *
 * This is the runtime twin of scripts/fetch-worldcup-odds.mjs: same markets, same
 * `r32 = 1 − P(group-stage elim)` derivation, same name normalization and monotonic
 * clamp — but it returns probabilities in memory instead of writing the config.
 *
 * Used only while the tournament is still draftable (hostable/upcoming). Once the Cup
 * goes live the strategy page stops calling this and falls back to the static config
 * odds (frozen at the last script run) — drafts are done, so odds no longer matter.
 *
 * Every failure path falls back to the static config so the page can never break.
 */

const BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const REVALIDATE_SECONDS = 3600; // 1 hour
const ROUNDS: RoundKey[] = ['winGroup', 'r32', 'r16', 'qf', 'sf', 'final', 'champion'];
const LADDER: RoundKey[] = ['r32', 'r16', 'qf', 'sf', 'final', 'champion'];

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  status: string;
  yes_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
}

const NAME_ALIASES: Record<string, string> = {
  'IR Iran': 'Iran',
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  'United States of America': 'United States',
  USA: 'United States',
  'Türkiye': 'Turkey',
  Turkiye: 'Turkey',
  'Côte d’Ivoire': 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'Curaçao': 'Curacao',
  'Cabo Verde': 'Cape Verde',
  'Congo DR': 'DR Congo',
  'Democratic Republic of the Congo': 'DR Congo',
};
function norm(name: string | undefined): string {
  const t = (name ?? '').trim();
  return NAME_ALIASES[t] ?? t;
}

function priceOf(m: KalshiMarket): number {
  const yb = parseFloat(m.yes_bid_dollars ?? '');
  const ya = parseFloat(m.yes_ask_dollars ?? '');
  const last = parseFloat(m.last_price_dollars ?? '');
  let p: number;
  if (yb > 0 && ya > 0 && ya >= yb) p = (yb + ya) / 2;
  else if (last > 0) p = last;
  else if (ya > 0) p = ya;
  else if (yb > 0) p = yb;
  else p = 0;
  return Math.max(0, Math.min(0.999, p));
}

async function kget(path: string, params: Record<string, string | number>): Promise<{ markets?: KalshiMarket[]; events?: Array<{ event_ticker: string; title?: string }> }> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`Kalshi ${path} -> ${res.status}`);
  return res.json();
}

type ProbsByRound = Partial<Record<RoundKey, number>>;

/** Fetch raw (pre-devig) live probabilities per nation, keyed by normalized name. */
async function fetchLiveProbabilities(): Promise<Map<string, ProbsByRound>> {
  const field = new Map<string, ProbsByRound>();
  const ensure = (name: string): ProbsByRound => {
    let p = field.get(name);
    if (!p) { p = {}; field.set(name, p); }
    return p;
  };

  // Win Group — one mutually-exclusive market per nation, grouped by event.
  const groupMarkets = (await kget('/markets', { series_ticker: 'KXWCGROUPWIN', limit: 1000 })).markets ?? [];
  for (const m of groupMarkets) {
    if (m.status !== 'active') continue;
    const name = norm(m.yes_sub_title);
    if (name) ensure(name).winGroup = priceOf(m);
  }

  // Reach-round ladder — KXWCROUND-26{RO16,QUAR,SEMI,FINAL}.
  const roundByEvent: Record<string, RoundKey> = {
    'KXWCROUND-26RO16': 'r16',
    'KXWCROUND-26QUAR': 'qf',
    'KXWCROUND-26SEMI': 'sf',
    'KXWCROUND-26FINAL': 'final',
  };
  const roundMarkets = (await kget('/markets', { series_ticker: 'KXWCROUND', limit: 1000 })).markets ?? [];
  for (const m of roundMarkets) {
    if (m.status !== 'active') continue; // settled/illiquid markets read priceOf=0 and would overwrite a good static prob
    const round = roundByEvent[m.event_ticker];
    const name = norm(m.yes_sub_title);
    if (round && name && field.has(name)) ensure(name)[round] = priceOf(m);
  }

  // Champion — KXMENWORLDCUP-26.
  const winnerMarkets = (await kget('/markets', { event_ticker: 'KXMENWORLDCUP-26', limit: 100 })).markets ?? [];
  for (const m of winnerMarkets) {
    if (m.status !== 'active') continue;
    const name = norm(m.yes_sub_title);
    if (name && field.has(name)) ensure(name).champion = priceOf(m);
  }

  // Advance (reach R32) = 1 − P(group-stage elim), from the stage-of-elimination market.
  // Nation lives in the event title ("USA: Stage of Elimination"), not the market subtitle.
  const stageEvents = (await kget('/events', { series_ticker: 'KXWCSTAGEOFELIM', limit: 200 })).events ?? [];
  const eventNation = new Map<string, string>();
  for (const e of stageEvents) {
    const title = (e.title ?? '').replace(/:\s*Stage of Elimination\s*$/i, '').trim();
    if (title) eventNation.set(e.event_ticker, norm(title));
  }
  const stageMarkets = (await kget('/markets', { series_ticker: 'KXWCSTAGEOFELIM', limit: 1000 })).markets ?? [];
  for (const m of stageMarkets) {
    if (m.status !== 'active') continue; // settled markets read priceOf=0 → r32=1, which would clobber the static value
    if (m.yes_sub_title !== 'Group Stage') continue;
    const name = eventNation.get(m.event_ticker);
    if (name && field.has(name)) ensure(name).r32 = Math.max(0, Math.min(0.999, 1 - priceOf(m)));
  }

  // Clamp the knockout ladder monotone (illiquid-market noise) — same as the script.
  for (const p of field.values()) {
    for (let i = 1; i < LADDER.length; i++) {
      const prev = p[LADDER[i - 1]] ?? 0;
      if ((p[LADDER[i]] ?? 0) > prev) p[LADDER[i]] = prev;
    }
  }
  return field;
}

/**
 * Return the tournament's teams with LIVE Kalshi probabilities merged in (by name).
 * Falls back to the passed-in static teams on any error or if too few nations match.
 */
export async function getWorldCupLiveTeams(staticTeams: BaseTeam[]): Promise<BaseTeam[]> {
  try {
    const live = await fetchLiveProbabilities();
    let matched = 0;
    const merged = staticTeams.map((t) => {
      const p = live.get(norm(t.name));
      // Require a complete-ish read for this nation, else keep its static odds.
      if (p && ROUNDS.every((r) => typeof p[r] === 'number')) {
        matched++;
        return { ...t, americanOdds: {} as Record<RoundKey, number>, probabilities: p as Record<RoundKey, number> };
      }
      return t;
    });
    // If the feed was broadly broken, don't ship a half-live/half-stale board.
    if (matched < staticTeams.length * 0.75) return staticTeams;
    return merged;
  } catch {
    return staticTeams;
  }
}

/**
 * Like getWorldCupLiveTeams but merges live probabilities PER ROUND: a team keeps
 * its static config probability for any round the live feed is missing (e.g. a
 * settled market that went inactive mid-tournament). Used for LIVE in-tournament EV
 * — settled rounds are handled by actual results anyway, so only the still-open
 * future rounds need fresh odds, and the strict all-7-rounds guard in
 * getWorldCupLiveTeams would wrongly drop an alive team to fully-stale odds once any
 * of its earlier-round markets settled. Falls back to static teams on any error.
 */
export async function getWorldCupLiveTeamsTolerant(staticTeams: BaseTeam[]): Promise<BaseTeam[]> {
  try {
    const live = await fetchLiveProbabilities();
    if (live.size === 0) return staticTeams;
    return staticTeams.map((t) => {
      const p = live.get(norm(t.name));
      if (!p) return t;
      const probabilities = { ...(t.probabilities ?? {}) } as Record<RoundKey, number>;
      for (const r of ROUNDS) {
        if (typeof p[r] === 'number') probabilities[r] = p[r] as number;
      }
      return { ...t, americanOdds: {} as Record<RoundKey, number>, probabilities };
    });
  } catch {
    return staticTeams;
  }
}
