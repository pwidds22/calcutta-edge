/**
 * DataGolf API client for fetching tournament fields and odds.
 * Docs: https://datagolf.com/api-access
 *
 * Endpoints used:
 * - field-updates: Current/upcoming tournament field
 * - betting-tools/outrights: Sportsbook odds + DataGolf model predictions
 */

const DATAGOLF_BASE = 'https://feeds.datagolf.com';

function getApiKey(): string {
  const key = process.env.DATAGOLF_API_KEY;
  if (!key) throw new Error('DATAGOLF_API_KEY is not set');
  return key;
}

// ─── Types ────────────────────────────────────────────────────────

export interface DataGolfPlayer {
  player_name: string; // "Last, First" format
  dg_id: number;
  country: string;
  am: 0 | 1; // 0 = pro, 1 = amateur
  dg_rank: number | null;
  owgr_rank: number | null;
  tour_rank: string | null;
}

export interface DataGolfFieldResponse {
  event_name: string;
  event_id: number;
  field: DataGolfPlayer[];
  last_updated: string;
}

export type OddsMarket = 'win' | 'top_5' | 'top_10' | 'top_20' | 'make_cut';

/** Sportsbook names in DataGolf odds responses */
export const SPORTSBOOKS = [
  'bet365', 'betcris', 'betonline', 'betmgm', 'betway',
  'bovada', 'caesars', 'draftkings', 'fanduel', 'pinnacle',
  'skybet', 'williamhill', 'unibet',
] as const;

export type Sportsbook = typeof SPORTSBOOKS[number];

export interface DataGolfOddsPlayer {
  player_name: string;
  dg_id: number;
  /** American odds from each sportsbook (null if not offered) */
  [book: string]: number | string | null | { baseline: number; baseline_history_fit: number };
  /** DataGolf model predictions */
  datagolf: { baseline: number; baseline_history_fit: number };
}

export interface DataGolfOddsResponse {
  event_name: string;
  event_id: number;
  market: string;
  odds_format: string;
  odds: DataGolfOddsPlayer[];
  last_updated: string;
}

// ─── API Fetchers ─────────────────────────────────────────────────

/**
 * Fetch the field for an upcoming tournament.
 * @param tour - 'upcoming_pga' for next PGA event (often Masters near April)
 */
export async function fetchField(tour = 'upcoming_pga'): Promise<DataGolfFieldResponse> {
  const url = `${DATAGOLF_BASE}/field-updates?tour=${tour}&key=${getApiKey()}`;
  const res = await fetch(url, { next: { revalidate: 3600 } }); // Cache 1 hour
  if (!res.ok) throw new Error(`DataGolf field API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch outright odds for a specific market from all sportsbooks.
 * @param market - 'win', 'top_5', 'top_10', 'top_20', or 'make_cut'
 * @param tour - 'pga' for current PGA Tour event
 */
export async function fetchOdds(
  market: OddsMarket,
  tour = 'pga'
): Promise<DataGolfOddsResponse> {
  const url = `${DATAGOLF_BASE}/betting-tools/outrights?tour=${tour}&market=${market}&odds_format=american&key=${getApiKey()}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`DataGolf odds API error: ${res.status} for market=${market}`);
  return res.json();
}

/**
 * Fetch all 5 odds markets at once.
 * Returns a map of market → odds data.
 */
export async function fetchAllOdds(
  tour = 'pga'
): Promise<Record<OddsMarket, DataGolfOddsResponse>> {
  const markets: OddsMarket[] = ['win', 'top_5', 'top_10', 'top_20', 'make_cut'];
  const results = await Promise.all(markets.map((m) => fetchOdds(m, tour)));
  return Object.fromEntries(markets.map((m, i) => [m, results[i]])) as Record<OddsMarket, DataGolfOddsResponse>;
}

// ─── In-Play / Leaderboard ───────────────────────────────────────

export interface DataGolfInPlayPlayer {
  player_name: string; // "Last, First" format
  dg_id: number;
  current_pos: string | null; // "T8", "1", "CUT", "WD", "DQ", "MDF"
  current_round: number; // 1-4
  thru: number | null; // holes completed in current round (null = not started)
  today: number | null; // score today relative to par
  total: number | null; // total score relative to par
  /** DataGolf model probabilities */
  win_prob?: number;
  top_5_prob?: number;
  top_10_prob?: number;
  top_20_prob?: number;
  make_cut_prob?: number;
}

export interface DataGolfInPlayResponse {
  event_name: string;
  event_id: number;
  current_round: number;
  /** Array of player leaderboard entries */
  data: DataGolfInPlayPlayer[];
  last_updated: string;
}

/**
 * Fetch live in-play leaderboard + probabilities.
 * During Masters week, `tour=pga` auto-returns Masters data.
 * @param tour - 'pga' for PGA Tour (default)
 */
export async function fetchInPlay(tour = 'pga'): Promise<DataGolfInPlayResponse> {
  const url = `${DATAGOLF_BASE}/preds/in-play?tour=${tour}&key=${getApiKey()}`;
  const res = await fetch(url, { cache: 'no-store' }); // Always fresh for live data
  if (!res.ok) throw new Error(`DataGolf in-play API error: ${res.status}`);
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Convert "Last, First" → "First Last" */
export function formatPlayerName(dgName: string): string {
  const parts = dgName.split(', ');
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return dgName;
}

/**
 * Parse a position string like "T8", "1", "CUT", "WD", "DQ", "MDF"
 * into a numeric position (or null if non-numeric).
 * Ties: "T8" → 8, "T22" → 22
 */
export function parsePosition(pos: string | null): { position: number | null; isTied: boolean } {
  if (!pos) return { position: null, isTied: false };
  const upper = pos.toUpperCase().trim();
  if (['CUT', 'WD', 'DQ', 'MDF'].includes(upper)) return { position: null, isTied: false };
  const isTied = upper.startsWith('T');
  const numStr = isTied ? upper.slice(1) : upper;
  const position = parseInt(numStr, 10);
  return { position: isNaN(position) ? null : position, isTied };
}
