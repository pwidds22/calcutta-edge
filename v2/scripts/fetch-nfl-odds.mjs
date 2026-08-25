#!/usr/bin/env node
/**
 * Fetch real prediction-market prices from Kalshi for the NFL 2026-27 season and
 * write them into v2/lib/tournaments/configs/nfl-season-2026.ts.
 *
 * Kalshi prices ARE probabilities (a "0.1710" yes price = 17.1% implied), so we write
 * them straight into each team's `probabilities` field and clear `americanOdds` to `{}`
 * — `calculateImpliedProbabilities()` only honours `probabilities` when americanOdds is
 * empty (see lib/calculations/odds.ts), so leaving stale American odds behind would
 * silently discard everything this script fetches.
 *
 * Values are PRE-NORMALIZED to each round's target here. The shared devig never scales
 * UP (it only strips vig), so a round that summed below target would under-distribute
 * the pot. Writing pre-normalized values makes the runtime devig a no-op passthrough.
 *
 * Markets pulled (all *_dollars string fields; integer-cent fields no longer exist):
 *   regularSeasonWins ← KXNFLWINS-{SUF}{ABBR}-{1..17}   Σ P(≥N wins) = expected wins
 *   divisionWinner    ← KXNFL{AFC,NFC}{EAST,…}-{SUF}     normalized to 1 per division
 *   playoffBerth      ← KXNFLPLAYOFF-{SUF}               "Playoff Qualifiers", target 14
 *   reachDivisional   ← KXNFLSTAGEOFELIM-{SUF}{ABBR}     DIV+CONF+FL+FW, target 8
 *   reachConfChamp    ← KXNFLSTAGEOFELIM-{SUF}{ABBR}     CONF+FL+FW,     target 4
 *   reachSuperBowl    ← KXNFL{AFC,NFC}CHAMP-{SUF}        conference champ, 1 per conf
 *   superBowl         ← KXSB-{SUF}                       Super Bowl winner, target 1
 *
 * WHY NOT ALL SEVEN FROM KXNFLSTAGEOFELIM: its deep-tail legs are unpriced. For a bad
 * team the DIV/CONF/FL/FW legs quote 0.0000 bid against the market maker's ~7c minimum
 * ask, and `last_price_dollars` there is a stale print. Deriving superBowl from that leg
 * put Arizona at 6% to win the Super Bowl while the dedicated (and tight, 1c-wide) KXSB
 * market quotes it 0.00/0.01. So each rung is sourced from the most liquid market that
 * prices it directly; STAGEOFELIM is used only for the two rungs nothing else prices.
 * Those two rungs remain the weakest numbers in the file — see the cap chain below.
 *
 * Usage (no credentials — Kalshi market reads are public):
 *   node scripts/fetch-nfl-odds.mjs --dry     # print the table, write nothing
 *   node scripts/fetch-nfl-odds.mjs           # write the config
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', 'lib', 'tournaments', 'configs', 'nfl-season-2026.ts');
const DRY = process.argv.includes('--dry');

const BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Kalshi vs our config. Kalshi's yes_sub_title is city-only and ambiguous
// ("Los Angeles C", "New York G"), so we join on the TICKER SUFFIX. Note the
// dialect differences vs ESPN: Kalshi JAC/WAS/LAR where ESPN uses JAX/WSH/LAR.
// Values MUST match NFL_SEASON_2026_TEAMS[].name character for character.
const KALSHI_ABBR = {
  BUF: 'Buffalo Bills',        MIA: 'Miami Dolphins',
  NYJ: 'New York Jets',        NE:  'New England Patriots',
  BAL: 'Baltimore Ravens',     CIN: 'Cincinnati Bengals',
  PIT: 'Pittsburgh Steelers',  CLE: 'Cleveland Browns',
  HOU: 'Houston Texans',       IND: 'Indianapolis Colts',
  JAC: 'Jacksonville Jaguars', TEN: 'Tennessee Titans',
  KC:  'Kansas City Chiefs',   LAC: 'Los Angeles Chargers',
  DEN: 'Denver Broncos',       LV:  'Las Vegas Raiders',
  PHI: 'Philadelphia Eagles',  DAL: 'Dallas Cowboys',
  NYG: 'New York Giants',      WAS: 'Washington Commanders',
  DET: 'Detroit Lions',        GB:  'Green Bay Packers',
  MIN: 'Minnesota Vikings',    CHI: 'Chicago Bears',
  TB:  'Tampa Bay Buccaneers', NO:  'New Orleans Saints',
  ATL: 'Atlanta Falcons',      CAR: 'Carolina Panthers',
  SF:  'San Francisco 49ers',  SEA: 'Seattle Seahawks',
  LAR: 'Los Angeles Rams',     ARI: 'Arizona Cardinals',
};
const ABBRS = Object.keys(KALSHI_ABBR);

/** Division series → our config group key. */
const DIVISION_SERIES = {
  KXNFLAFCEAST:  'AFC_East',
  KXNFLAFCNORTH: 'AFC_North',
  KXNFLAFCSOUTH: 'AFC_South',
  KXNFLAFCWEST:  'AFC_West',
  KXNFLNFCEAST:  'NFC_East',
  KXNFLNFCNORTH: 'NFC_North',
  KXNFLNFCSOUTH: 'NFC_South',
  KXNFLNFCWEST:  'NFC_West',
};

/** Stage-of-elimination legs, earliest exit first. Mutually exclusive and exhaustive. */
const SOE_LEGS = ['REG', 'WC', 'DIV', 'CONF', 'FL', 'FW'];

/** The nested reach-ladder, in order. Each rung is a subset of the one before it. */
const LADDER = [
  ['playoffBerth', 14],
  ['reachDivisional', 8],
  ['reachConfChamp', 4],
  ['reachSuperBowl', 2],
  ['superBowl', 1],
];

const WINS_TARGET = 272; // 17 games x 32 teams / 2

// ── HTTP ─────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function kget(endpoint, params = {}) {
  const url = new URL(BASE + endpoint);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    throw new Error(`GET ${endpoint} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error(`GET ${endpoint} -> 429 after retries`);
}

/** Every ACTIVE market in a series. A settled/illiquid market prices at 0, which would
 *  overwrite a good value, so non-active markets are dropped at the boundary. */
async function activeMarkets(seriesTicker) {
  const out = [];
  let cursor = '';
  for (;;) {
    const d = await kget('/markets', { series_ticker: seriesTicker, limit: 1000, cursor: cursor || undefined });
    out.push(...(d.markets ?? []));
    cursor = d.cursor || '';
    if (!cursor) break;
    await sleep(200);
  }
  await sleep(200);
  return out.filter((m) => m.status === 'active');
}

/**
 * Prices live only in the *_dollars STRING fields.
 *
 * Use the two-sided quote's MID. A 0.0000 `yes_bid` on an ACTIVE market is a real quote
 * ("nobody bids"), not missing data — falling back to `last_price_dollars` there is what
 * poisons deep longshots with stale prints, so last price is only a last resort when the
 * book is empty on both sides.
 */
function priceOf(m) {
  const bid = Number(m.yes_bid_dollars ?? 0);
  const ask = Number(m.yes_ask_dollars ?? 0);
  if (ask > 0) return (bid + ask) / 2;
  if (bid > 0) return bid;
  return Number(m.last_price_dollars ?? 0);
}

// ── Normalization ────────────────────────────────────────────────────────────

/** Scale a round across the field to its target, scaling UP as well as down. */
function normalize(byTeam, target) {
  const sum = Object.values(byTeam).reduce((a, b) => a + b, 0);
  if (sum === 0) return byTeam;
  const scale = target / sum;
  return Object.fromEntries(Object.entries(byTeam).map(([k, v]) => [k, v * scale]));
}

/**
 * Normalize to `target` while holding every team at or below `caps[team]`.
 *
 * Finds the scale s with Σ min(raw·s, cap) = target by bisection (the sum is monotone
 * in s). This is how the ladder stays nested AND still sums to its target: a plain
 * scale-then-clamp would leave the round short and under-distribute the pot.
 */
function capNormalize(raw, caps, target, label) {
  const capSum = Object.values(caps).reduce((a, b) => a + b, 0);
  if (capSum < target - 1e-9) {
    throw new Error(`${label}: caps sum to ${capSum.toFixed(4)} < target ${target} — cannot normalize`);
  }
  const f = (s) => ABBRS.reduce((acc, a) => acc + Math.min(raw[a] * s, caps[a]), 0);
  let hi = 1;
  while (f(hi) < target) {
    hi *= 2;
    if (hi > 1e12) throw new Error(`${label}: could not reach target ${target}`);
  }
  let lo = 0;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid; else hi = mid;
  }
  const s = (lo + hi) / 2;
  const out = {};
  let clamped = 0;
  for (const a of ABBRS) {
    const v = Math.min(raw[a] * s, caps[a]);
    if (raw[a] * s > caps[a] + 1e-12) clamped++;
    out[a] = v;
  }
  return { out, clamped };
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fetching NFL markets from Kalshi${DRY ? ' (DRY RUN)' : ''}...\n`);

  if (ABBRS.length !== 32) fail(`KALSHI_ABBR has ${ABBRS.length} entries, expected 32.`);
  if (new Set(Object.values(KALSHI_ABBR)).size !== 32) fail('KALSHI_ABBR has duplicate team names.');

  // 1) Resolve the season suffix from the live events — never assume "-27".
  const winsEvents = (await kget('/events', { series_ticker: 'KXNFLWINS', status: 'open', limit: 200 })).events ?? [];
  const suffixes = new Set();
  for (const e of winsEvents) {
    const m = /^KXNFLWINS-(\d{2})([A-Z]+)$/.exec(e.event_ticker);
    if (m) suffixes.add(m[1]);
  }
  if (suffixes.size !== 1) {
    fail(`Expected exactly one KXNFLWINS season suffix, saw [${[...suffixes].join(', ')}] across ${winsEvents.length} open events.`);
  }
  const SUF = [...suffixes][0];
  console.log(`Season suffix: -${SUF}  (${winsEvents.length} open KXNFLWINS events)\n`);

  const P = {};
  for (const a of ABBRS) P[a] = {};
  const require32 = (obj, label) => {
    const have = Object.keys(obj);
    const missing = ABBRS.filter((a) => !(a in obj));
    const extra = have.filter((a) => !ABBRS.includes(a));
    if (missing.length || extra.length) {
      fail(`${label}: resolved ${have.length}/32 teams.` +
        (missing.length ? ` Missing: ${missing.join(', ')}.` : '') +
        (extra.length ? ` Unknown abbreviations: ${extra.join(', ')}.` : ''));
    }
  };

  // 2) regularSeasonWins — Σ P(at least N wins) over the 17 strikes = expected wins.
  {
    const ms = (await activeMarkets('KXNFLWINS')).filter((m) => m.ticker.startsWith(`KXNFLWINS-${SUF}`));
    const ladders = {};
    for (const m of ms) {
      const parts = m.ticker.split('-');
      if (parts.length !== 3) continue;
      const abbr = parts[1].slice(2);
      if (!(abbr in KALSHI_ABBR)) continue;
      (ladders[abbr] ??= {})[Number(parts[2])] = { mid: priceOf(m), bid: Number(m.yes_bid_dollars ?? 0), ask: Number(m.yes_ask_dollars ?? 0) };
    }
    require32(ladders, 'KXNFLWINS');

    // The strike ladder must be non-increasing: P(>=N+1) <= P(>=N). Real mids break this
    // in the illiquid tail (a 0-bid strike whose ask floor sits above its neighbour's
    // mid), so take the running minimum — that only ever LOWERS a read, never invents
    // one. Distinguish artifact from structural break by no-arbitrage: an inversion is
    // just quote width unless the HARDER strike's bid clears the easier strike's ask, in
    // which case the ladder is genuinely mispriced (or mislabeled) and we must not guess.
    const raw = {};
    let clamps = 0;
    for (const a of ABBRS) {
      const l = ladders[a];
      const strikes = Object.keys(l).map(Number).sort((x, y) => x - y);
      if (strikes.length !== 17) fail(`KXNFLWINS ${a} (${KALSHI_ABBR[a]}): ${strikes.length} strikes, expected 17.`);
      let prev = Infinity;
      let prevStrike = null;
      let ev = 0;
      for (const k of strikes) {
        const q = l[k];
        if (prevStrike !== null && q.bid > l[prevStrike].ask + 0.01) {
          fail(`KXNFLWINS ${a} (${KALSHI_ABBR[a]}): strike ladder violates no-arbitrage — ` +
            `${prevStrike}+ asks ${l[prevStrike].ask.toFixed(2)} but ${k}+ bids ${q.bid.toFixed(2)}.`);
        }
        const v = Math.min(q.mid, prev);
        if (v < q.mid - 1e-12) clamps++;
        prev = v;
        prevStrike = k;
        ev += v;
      }
      raw[a] = ev;
    }
    const rawSum = Object.values(raw).reduce((x, y) => x + y, 0);
    console.log(`  regularSeasonWins  17 strikes x 32 teams; ${clamps} tail reads clamped; ` +
      `raw league total ${rawSum.toFixed(2)} -> ${WINS_TARGET}`);
    const norm = normalize(raw, WINS_TARGET);
    for (const a of ABBRS) P[a].regularSeasonWins = norm[a];
  }

  // 3) divisionWinner — one mutually-exclusive event per division, normalized to 1 each.
  {
    const seen = {};
    for (const [series, group] of Object.entries(DIVISION_SERIES)) {
      const ms = (await activeMarkets(series)).filter((m) => m.ticker.startsWith(`${series}-${SUF}-`));
      const raw = {};
      for (const m of ms) {
        const abbr = m.ticker.split('-').pop();
        if (!(abbr in KALSHI_ABBR)) fail(`${series}: unknown team suffix "${abbr}".`);
        raw[abbr] = priceOf(m);
      }
      if (Object.keys(raw).length !== 4) {
        fail(`${series}-${SUF}: ${Object.keys(raw).length} active markets, expected 4.`);
      }
      const sum = Object.values(raw).reduce((x, y) => x + y, 0);
      const norm = normalize(raw, 1);
      for (const [abbr, v] of Object.entries(norm)) {
        if (abbr in seen) fail(`${abbr} appears in two divisions (${seen[abbr]} and ${group}).`);
        seen[abbr] = group;
        P[abbr].divisionWinner = v;
        P[abbr]._group = group;
      }
      console.log(`  divisionWinner     ${group.padEnd(10)} overround ${sum.toFixed(3)} -> 1.000`);
    }
    require32(seen, 'division winner markets');
  }

  // 4) playoffBerth — dedicated "Playoff Qualifiers" market (14 qualify).
  {
    const ms = (await activeMarkets('KXNFLPLAYOFF')).filter((m) => m.ticker.startsWith(`KXNFLPLAYOFF-${SUF}-`));
    const raw = {};
    for (const m of ms) {
      const abbr = m.ticker.split('-').pop();
      if (abbr in KALSHI_ABBR) raw[abbr] = priceOf(m);
    }
    require32(raw, 'KXNFLPLAYOFF');
    const sum = Object.values(raw).reduce((x, y) => x + y, 0);
    console.log(`  playoffBerth       overround ${sum.toFixed(3)} -> 14`);
    for (const [a, v] of Object.entries(normalize(raw, 14))) P[a]._rawBerth = v;
  }

  // 5) reachSuperBowl — conference champion, one winner per conference.
  {
    const raw = {};
    for (const series of ['KXNFLAFCCHAMP', 'KXNFLNFCCHAMP']) {
      const ms = (await activeMarkets(series)).filter((m) => m.ticker.startsWith(`${series}-${SUF}-`));
      const conf = {};
      for (const m of ms) {
        const abbr = m.ticker.split('-').pop();
        if (!(abbr in KALSHI_ABBR)) fail(`${series}: unknown team suffix "${abbr}".`);
        conf[abbr] = priceOf(m);
      }
      if (Object.keys(conf).length !== 16) {
        fail(`${series}-${SUF}: ${Object.keys(conf).length} active markets, expected 16.`);
      }
      const sum = Object.values(conf).reduce((x, y) => x + y, 0);
      console.log(`  reachSuperBowl     ${series.padEnd(14)} overround ${sum.toFixed(3)} -> 1.000`);
      Object.assign(raw, normalize(conf, 1));
    }
    require32(raw, 'conference champion markets');
    for (const a of ABBRS) P[a]._rawSBApp = raw[a];
  }

  // 6) superBowl — dedicated Super Bowl winner market.
  {
    const ms = (await activeMarkets('KXSB')).filter((m) => m.ticker.startsWith(`KXSB-${SUF}-`));
    const raw = {};
    for (const m of ms) {
      const abbr = m.ticker.split('-').pop();
      if (abbr in KALSHI_ABBR) raw[abbr] = priceOf(m);
    }
    require32(raw, 'KXSB');
    const sum = Object.values(raw).reduce((x, y) => x + y, 0);
    console.log(`  superBowl          overround ${sum.toFixed(3)} -> 1`);
    for (const [a, v] of Object.entries(normalize(raw, 1))) P[a]._rawSBWin = v;
  }

  // 7) reachDivisional / reachConfChamp — the only two rungs Kalshi prices nowhere else.
  //    Each team's 6 stage-of-elimination legs are mutually exclusive and exhaustive
  //    (Kalshi flags the event mutually_exclusive), so normalize them to 1 per team to
  //    strip that team's vig, then read off the tails.
  {
    const ms = (await activeMarkets('KXNFLSTAGEOFELIM')).filter((m) => m.ticker.startsWith(`KXNFLSTAGEOFELIM-${SUF}`));
    const legs = {};
    for (const m of ms) {
      const parts = m.ticker.split('-');
      if (parts.length !== 3) continue;
      const abbr = parts[1].slice(2);
      if (!(abbr in KALSHI_ABBR)) continue;
      (legs[abbr] ??= {})[parts[2]] = priceOf(m);
    }
    require32(legs, 'KXNFLSTAGEOFELIM');
    const rawDiv = {};
    const rawConf = {};
    for (const a of ABBRS) {
      const l = legs[a];
      const missing = SOE_LEGS.filter((k) => !(k in l));
      if (missing.length) fail(`KXNFLSTAGEOFELIM ${a} (${KALSHI_ABBR[a]}): missing legs ${missing.join(', ')}.`);
      const sum = SOE_LEGS.reduce((s, k) => s + l[k], 0);
      if (sum <= 0) fail(`KXNFLSTAGEOFELIM ${a} (${KALSHI_ABBR[a]}): all six legs priced at 0.`);
      const n = Object.fromEntries(SOE_LEGS.map((k) => [k, l[k] / sum]));
      rawDiv[a] = n.DIV + n.CONF + n.FL + n.FW;  // = 1 - P(REG) - P(WC)
      rawConf[a] = n.CONF + n.FL + n.FW;
    }
    console.log(`  reachDivisional    STAGEOFELIM tail sum ${Object.values(rawDiv).reduce((x, y) => x + y, 0).toFixed(3)} -> 8`);
    console.log(`  reachConfChamp     STAGEOFELIM tail sum ${Object.values(rawConf).reduce((x, y) => x + y, 0).toFixed(3)} -> 4`);
    for (const a of ABBRS) { P[a]._rawDiv = rawDiv[a]; P[a]._rawConf = rawConf[a]; }
  }

  // 8) Walk the ladder top-down, each rung normalized to target under the previous
  //    rung's cap. This is what keeps STAGEOFELIM's unpriced tail from claiming that a
  //    5%-to-make-the-playoffs team reaches the divisional round 10% of the time.
  {
    const rawByRound = {
      playoffBerth: '_rawBerth',
      reachDivisional: '_rawDiv',
      reachConfChamp: '_rawConf',
      reachSuperBowl: '_rawSBApp',
      superBowl: '_rawSBWin',
    };
    let caps = Object.fromEntries(ABBRS.map((a) => [a, 1]));
    for (const [round, target] of LADDER) {
      const raw = Object.fromEntries(ABBRS.map((a) => [a, P[a][rawByRound[round]]]));
      const { out, clamped } = capNormalize(raw, caps, target, round);
      for (const a of ABBRS) P[a][round] = out[a];
      caps = out;
      if (clamped) console.log(`  ! ${round}: ${clamped} team(s) capped at the previous rung, budget redistributed`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const ROUNDS = ['regularSeasonWins', 'divisionWinner', 'playoffBerth', 'reachDivisional',
                  'reachConfChamp', 'reachSuperBowl', 'superBowl'];
  const p4 = (x) => Number((x ?? 0).toFixed(4));
  const ordered = [...ABBRS].sort((a, b) => P[b].superBowl - P[a].superBowl);

  console.log('\n  team                    div   wins  divWin  berth  divRd  confCh  SBapp  SBwin');
  for (const a of ordered) {
    const p = P[a];
    console.log(
      `  ${KALSHI_ABBR[a].padEnd(22)} ${p._group.padEnd(9)} ` +
      `${p.regularSeasonWins.toFixed(2).padStart(5)} ` +
      [p.divisionWinner, p.playoffBerth, p.reachDivisional, p.reachConfChamp, p.reachSuperBowl, p.superBowl]
        .map((v) => v.toFixed(3).padStart(6)).join(' ')
    );
  }

  console.log('\n  Round sums (after rounding to 4dp):');
  const targets = { regularSeasonWins: WINS_TARGET, divisionWinner: 8, ...Object.fromEntries(LADDER) };
  let sumsOk = true;
  for (const r of ROUNDS) {
    const s = ABBRS.reduce((acc, a) => acc + p4(P[a][r]), 0);
    const ok = Math.abs(s - targets[r]) < 0.01;
    if (!ok) sumsOk = false;
    console.log(`    ${r.padEnd(20)} ${s.toFixed(4).padStart(9)}  target ${String(targets[r]).padStart(3)}  ${ok ? 'ok' : 'OFF TARGET'}`);
  }
  if (!sumsOk) fail('A round does not sum to its target — refusing to write.');

  // Sanity: expected wins in a plausible band, and the ladder nested per team.
  for (const a of ABBRS) {
    const w = P[a].regularSeasonWins;
    if (w < 2 || w > 15) fail(`${KALSHI_ABBR[a]}: expected wins ${w.toFixed(2)} outside the plausible 2-15 band.`);
    for (let i = 1; i < LADDER.length; i++) {
      const [cur] = LADDER[i];
      const [prev] = LADDER[i - 1];
      if (p4(P[a][cur]) > p4(P[a][prev]) + 1e-9) {
        fail(`${KALSHI_ABBR[a]}: ${cur} ${p4(P[a][cur])} > ${prev} ${p4(P[a][prev])} after normalization.`);
      }
    }
    if (p4(P[a].divisionWinner) > p4(P[a].playoffBerth) + 1e-9) {
      console.warn(`  ! ${KALSHI_ABBR[a]}: divisionWinner ${p4(P[a].divisionWinner)} > playoffBerth ${p4(P[a].playoffBerth)}`);
    }
  }

  if (DRY) {
    console.log('\n(DRY RUN — config not written)');
    return;
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  // Existing id/name/seed/group and file order are preserved verbatim: session
  // settings.bundles reference ids that were valid at session-creation time, so an id
  // must never move. Only americanOdds (-> {}) and probabilities change.
  const src = readFileSync(CONFIG_PATH, 'utf8');
  const EOL = src.includes('\r\n') ? '\r\n' : '\n';
  const TEAMS_REGEX = /(?:\/\*\*[\s\S]*?\*\/\s*)?export const NFL_SEASON_2026_TEAMS: BaseTeam\[\] = \[[\s\S]*?\];/;
  const match = TEAMS_REGEX.exec(src);
  if (!match) fail('Could not locate NFL_SEASON_2026_TEAMS array in the config file.');

  const ENTRY = /\{\s*id:\s*(\d+),\s*name:\s*'((?:[^'\\]|\\.)*)',\s*seed:\s*(\d+),\s*group:\s*'([^']+)'/g;
  const existing = [];
  let e;
  while ((e = ENTRY.exec(match[0])) !== null) {
    existing.push({ id: Number(e[1]), name: e[2].replace(/\\'/g, "'"), seed: Number(e[3]), group: e[4] });
  }
  if (existing.length !== 32) fail(`Parsed ${existing.length} existing teams from the config, expected 32.`);

  const byName = Object.fromEntries(ABBRS.map((a) => [KALSHI_ABBR[a], a]));
  for (const t of existing) {
    const abbr = byName[t.name];
    if (!abbr) fail(`Config team "${t.name}" has no entry in KALSHI_ABBR — fix the map, do not guess.`);
    if (P[abbr]._group !== t.group) {
      fail(`${t.name}: config group "${t.group}" but Kalshi division market says "${P[abbr]._group}".`);
    }
    t.abbr = abbr;
  }

  const lines = [];
  lines.push('/**');
  lines.push(' * All 32 NFL teams for the 2026-27 season Calcutta.');
  lines.push(' *');
  lines.push(' * Probabilities are REAL Kalshi prediction-market prices (mid of yes_bid/yes_ask),');
  lines.push(" * pre-normalized to each round's target so the runtime devig passes them through");
  lines.push(' * unchanged. `americanOdds` is intentionally empty — odds.ts only honours');
  lines.push(' * `probabilities` when no American odds are present.');
  lines.push(' *');
  lines.push(` * Generated: ${new Date().toISOString().split('T')[0]} from Kalshi series KXNFLWINS-${SUF} (expected wins),`);
  lines.push(` * KXNFL{AFC,NFC}{EAST,NORTH,SOUTH,WEST}-${SUF} (division), KXNFLPLAYOFF-${SUF} (berth),`);
  lines.push(` * KXNFLSTAGEOFELIM-${SUF} (divisional / conf-championship rungs),`);
  lines.push(` * KXNFL{AFC,NFC}CHAMP-${SUF} (Super Bowl appearance) and KXSB-${SUF} (Super Bowl win).`);
  lines.push(' * Re-run: node scripts/fetch-nfl-odds.mjs   (no credentials — Kalshi reads are public)');
  lines.push(' *');
  lines.push(' * `id`, `seed`, `group` and the ordering below are preserved across re-runs — live');
  lines.push(" * sessions' bundles reference ids by value. Don't reorder entries by hand.");
  lines.push(' */');
  lines.push('export const NFL_SEASON_2026_TEAMS: BaseTeam[] = [');
  let lastGroup = null;
  for (const t of existing) {
    if (t.group !== lastGroup) {
      lines.push(`  // ${t.group.replace(/_/g, ' ')}`);
      lastGroup = t.group;
    }
    const p = P[t.abbr];
    const safeName = t.name.replace(/'/g, "\\'");
    lines.push(
      `  { id: ${t.id}, name: '${safeName}', seed: ${t.seed}, group: '${t.group}', americanOdds: {}, ` +
      `probabilities: { regularSeasonWins: ${p4(p.regularSeasonWins)}, divisionWinner: ${p4(p.divisionWinner)}, ` +
      `playoffBerth: ${p4(p.playoffBerth)}, reachDivisional: ${p4(p.reachDivisional)}, ` +
      `reachConfChamp: ${p4(p.reachConfChamp)}, reachSuperBowl: ${p4(p.reachSuperBowl)}, ` +
      `superBowl: ${p4(p.superBowl)} } },`
    );
  }
  lines.push('];');

  writeFileSync(CONFIG_PATH, src.replace(TEAMS_REGEX, lines.join(EOL)), 'utf8');
  console.log(`\n✓ Wrote 32 teams to ${CONFIG_PATH}`);
  console.log('  Review: git diff v2/lib/tournaments/configs/nfl-season-2026.ts');
}

main().catch((err) => {
  console.error('\n✗ Fetch failed:', err.message);
  process.exit(1);
});
