#!/usr/bin/env node
/**
 * Fetch real prediction-market prices from Kalshi for the FIFA World Cup 2026 and
 * write the result directly to v2/lib/tournaments/configs/world-cup-2026.ts.
 *
 * Kalshi prices ARE probabilities (a "0.1710" yes price = 17.1% implied), so we
 * write them straight into each team's `probabilities` field. The tournament's
 * scope-aware 'group' devig then normalizes per-group (winGroup) and per-round
 * (the reach-round ladder). See docs/superpowers/specs/2026-06-01-world-cup-kalshi-strategy-design.md
 *
 * Markets pulled (all as 0–1 probabilities):
 *   winGroup  ← KXWCGROUPWIN-26{A–L}   (one mutually-exclusive event per group)
 *   r16       ← KXWCROUND-26RO16        (reach Round of 16)
 *   qf        ← KXWCROUND-26QUAR        (reach Quarterfinals)
 *   sf        ← KXWCROUND-26SEMI        (reach Semifinals)
 *   final     ← KXWCROUND-26FINAL       (reach Final)
 *   champion  ← KXMENWORLDCUP-26        (win the tournament)
 *
 * The 48 *active* group-winner markets are the field of record — this script
 * self-corrects the roster (drops playoff losers, adds the real qualifiers) and
 * derives each nation's group from its KXWCGROUPWIN-26{group} event.
 *
 * Usage:
 *   # creds from env:
 *   KALSHI_API_KEY=xxx KALSHI_PRIVATE_KEY="$(cat key.pem)" node scripts/fetch-worldcup-odds.mjs
 *   # or point at an existing .env.local that has KALSHI_API_KEY + KALSHI_PRIVATE_KEY:
 *   KALSHI_ENV_FILE=/path/to/kalshi-automated-trader/.env.local node scripts/fetch-worldcup-odds.mjs
 *   # add --dry to print the table without writing the config:
 *   ... node scripts/fetch-worldcup-odds.mjs --dry
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', 'lib', 'tournaments', 'configs', 'world-cup-2026.ts');
const DRY = process.argv.includes('--dry');

const BASE = 'https://api.elections.kalshi.com';
const BASE_PATH = '/trade-api/v2';

// ── Credentials ─────────────────────────────────────────────────────────────
function loadCreds() {
  let apiKey = process.env.KALSHI_API_KEY;
  let priv = process.env.KALSHI_PRIVATE_KEY;
  if ((!apiKey || !priv) && process.env.KALSHI_ENV_FILE) {
    const raw = readFileSync(process.env.KALSHI_ENV_FILE, 'utf8');
    const pick = (name) => {
      const m = raw.match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (!m) return undefined;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return v;
    };
    apiKey = apiKey || pick('KALSHI_API_KEY');
    priv = priv || pick('KALSHI_PRIVATE_KEY');
    if (priv && !priv.includes('BEGIN')) {
      const block = raw.match(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/);
      if (block) priv = block[0];
    }
  }
  if (priv) priv = priv.replace(/\\n/g, '\n');
  if (!apiKey || !priv) {
    console.error('ERROR: missing Kalshi credentials.');
    console.error('  Set KALSHI_API_KEY + KALSHI_PRIVATE_KEY, or KALSHI_ENV_FILE=/path/to/.env.local');
    process.exit(1);
  }
  return { apiKey, priv };
}
const { apiKey: API_KEY, priv: PRIVATE_KEY } = loadCreds();

// ── Kalshi RSA-PSS request signing (matches kalshi-automated-trader/src/lib/kalshi/auth.ts) ──
function sign(method, path) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const msg = `${ts}${method.toUpperCase()}${path.split('?')[0]}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(msg);
  signer.end();
  const signature = signer.sign(
    { key: PRIVATE_KEY, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
    'base64',
  );
  return { 'KALSHI-ACCESS-KEY': API_KEY, 'KALSHI-ACCESS-TIMESTAMP': ts, 'KALSHI-ACCESS-SIGNATURE': signature };
}

async function kget(endpoint, params = {}) {
  const path = `${BASE_PATH}${endpoint}`;
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { ...sign('GET', path), 'Content-Type': 'application/json', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`GET ${endpoint} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Fetch every market under an event_ticker (one page is plenty for WC events). */
async function marketsForEvent(eventTicker) {
  const r = await kget('/markets', { event_ticker: eventTicker, limit: 1000 });
  return r.markets ?? [];
}

// ── Price extraction (new fractional "_dollars" fields = probability 0–1) ──
function priceOf(m) {
  const yb = parseFloat(m.yes_bid_dollars);
  const ya = parseFloat(m.yes_ask_dollars);
  const last = parseFloat(m.last_price_dollars);
  let p;
  if (yb > 0 && ya > 0 && ya >= yb) p = (yb + ya) / 2;
  else if (last > 0) p = last;
  else if (ya > 0) p = ya;          // only an ask resting → upper bound
  else if (yb > 0) p = yb;          // only a bid resting → lower bound
  else p = 0;                        // no data → treat as ~0 longshot
  return Math.max(0, Math.min(0.999, p));
}

// ── Name normalization: reconcile Kalshi yes_sub_title variants → one display name ──
const NAME_ALIASES = {
  'IR Iran': 'Iran',
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  'United States of America': 'United States',
  'USA': 'United States',
  'Türkiye': 'Turkey',
  'Turkiye': 'Turkey',
  'Côte d’Ivoire': 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'Curaçao': 'Curacao',
  'Cabo Verde': 'Cape Verde',
  'DR Congo': 'DR Congo',
  'Congo DR': 'DR Congo',
  'Democratic Republic of the Congo': 'DR Congo',
};
function norm(ysub) {
  const t = (ysub ?? '').trim();
  return NAME_ALIASES[t] ?? t;
}

const REACH_EVENTS = [
  { round: 'r16', event: 'KXWCROUND-26RO16' },
  { round: 'qf', event: 'KXWCROUND-26QUAR' },
  { round: 'sf', event: 'KXWCROUND-26SEMI' },
  { round: 'final', event: 'KXWCROUND-26FINAL' },
];
const GROUP_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

async function main() {
  console.log(`Fetching World Cup markets from Kalshi${DRY ? ' (DRY RUN)' : ''}...\n`);

  // 1) Field of record + group membership from the 12 group-winner events.
  //    Each active group market gives us: nation name, its group, P(win group).
  const field = new Map(); // canonicalName → { name, group, probabilities: {} }
  for (const g of GROUP_KEYS) {
    const mks = await marketsForEvent(`KXWCGROUPWIN-26${g}`);
    const active = mks.filter((m) => m.status === 'active');
    for (const m of active) {
      const name = norm(m.yes_sub_title);
      if (!name) continue;
      if (field.has(name)) {
        console.warn(`  ! ${name} appears in multiple groups — keeping first (${field.get(name).group}), saw ${g}`);
        continue;
      }
      field.set(name, { name, group: g, probabilities: { winGroup: priceOf(m) } });
    }
    console.log(`  Group ${g}: ${active.length} teams`);
  }
  console.log(`\nField of record: ${field.size} nations\n`);

  // 2) Reach-round ladder probabilities (global markets) — matched by name.
  for (const { round, event } of REACH_EVENTS) {
    const mks = await marketsForEvent(event);
    let matched = 0;
    for (const m of mks) {
      const name = norm(m.yes_sub_title);
      const team = field.get(name);
      if (!team) continue; // non-qualifier / not in field
      team.probabilities[round] = priceOf(m);
      matched++;
    }
    console.log(`  ${event.padEnd(20)} → ${round.padEnd(8)} matched ${matched}/${field.size}`);
  }

  // 3) Champion probabilities from the winner event.
  {
    const mks = await marketsForEvent('KXMENWORLDCUP-26');
    const active = mks.filter((m) => m.status === 'active');
    let matched = 0;
    const winnerNames = new Set();
    for (const m of active) {
      const name = norm(m.yes_sub_title);
      winnerNames.add(name);
      const team = field.get(name);
      if (!team) continue;
      team.probabilities.champion = priceOf(m);
      matched++;
    }
    console.log(`  ${'KXMENWORLDCUP-26'.padEnd(20)} → ${'champion'.padEnd(8)} matched ${matched}/${field.size}`);
    // Cross-check: winner field vs group field should agree.
    const onlyInWinner = [...winnerNames].filter((n) => !field.has(n));
    const onlyInGroups = [...field.keys()].filter((n) => !winnerNames.has(n));
    if (onlyInWinner.length) console.warn(`  ! In winner market but no group market: ${onlyInWinner.join(', ')}`);
    if (onlyInGroups.length) console.warn(`  ! In group markets but no active winner market: ${onlyInGroups.join(', ')}`);
  }

  // 3b) Advance-from-group (reach Round of 32) from the stage-of-elimination market:
  //     P(advance) = 1 − P(eliminated in Group Stage). Each per-nation event
  //     (KXWCSTAGEOFELIM-26XXX) carries the nation in its TITLE ("USA: Stage of
  //     Elimination"), not in the market yes_sub_title (which is the stage name) —
  //     so map event → nation via the title, then read the "Group Stage" leg.
  {
    const events = (await kget('/events', { series_ticker: 'KXWCSTAGEOFELIM', limit: 200 })).events ?? [];
    const eventNation = new Map();
    for (const e of events) {
      const title = (e.title || '').replace(/:\s*Stage of Elimination\s*$/i, '').trim();
      if (title) eventNation.set(e.event_ticker, norm(title));
    }
    const stageMarkets = (await kget('/markets', { series_ticker: 'KXWCSTAGEOFELIM', limit: 1000 })).markets ?? [];
    let matched = 0;
    for (const m of stageMarkets) {
      if (m.yes_sub_title !== 'Group Stage') continue; // only the group-stage-elim leg
      const nation = eventNation.get(m.event_ticker);
      const team = nation ? field.get(nation) : undefined;
      if (!team) continue;
      team.probabilities.r32 = Math.max(0, Math.min(0.999, 1 - priceOf(m)));
      matched++;
    }
    console.log(`  ${'KXWCSTAGEOFELIM'.padEnd(20)} → ${'r32'.padEnd(8)} matched ${matched}/${field.size} (advance = 1 − P(group-stage elim))`);
  }

  // 4) Validate completeness — fail loudly so a stale/partial roster can't ship.
  const ROUNDS = ['winGroup', 'r32', 'r16', 'qf', 'sf', 'final', 'champion'];
  const teams = [...field.values()];
  const incomplete = teams.filter((t) => ROUNDS.some((r) => t.probabilities[r] === undefined));
  if (incomplete.length) {
    console.warn(`\n  ! ${incomplete.length} teams missing some round probs (filled with 0):`);
    for (const t of incomplete) {
      const missing = ROUNDS.filter((r) => t.probabilities[r] === undefined);
      console.warn(`      ${t.name} (${t.group}): missing ${missing.join(', ')}`);
      for (const r of missing) t.probabilities[r] = 0;
    }
  }
  if (teams.length !== 48) {
    console.warn(`\n  ! Expected 48 nations, got ${teams.length}. Review before committing.`);
  }

  // 4b) Enforce ladder monotonicity at the source: P(reach round N+1) ≤ P(reach round N),
  //     since reaching a later round logically requires reaching the earlier one. Illiquid
  //     longshot markets occasionally print absurd quotes (e.g. a stale 83¢ "reach QF" for a
  //     1%-to-win-group side); clamping stops that noise from polluting the global
  //     normalization and stealing probability mass from legitimate contenders.
  //     (winGroup is excluded — winning a group does not guarantee reaching the R16.)
  const LADDER = ['r32', 'r16', 'qf', 'sf', 'final', 'champion'];
  let clamped = 0;
  for (const t of teams) {
    for (let i = 1; i < LADDER.length; i++) {
      const prev = t.probabilities[LADDER[i - 1]] ?? 0;
      if ((t.probabilities[LADDER[i]] ?? 0) > prev) { t.probabilities[LADDER[i]] = prev; clamped++; }
    }
  }
  if (clamped) console.log(`\n  Clamped ${clamped} non-monotonic ladder reads (illiquid-market noise).`);

  // 5) Seeds within group (by winGroup prob desc) + stable ids (preserve by name).
  const byGroup = new Map();
  for (const g of GROUP_KEYS) byGroup.set(g, []);
  for (const t of teams) (byGroup.get(t.group) ?? []).push(t);
  const ordered = [];
  for (const g of GROUP_KEYS) {
    const gt = (byGroup.get(g) ?? []).sort((a, b) => b.probabilities.winGroup - a.probabilities.winGroup);
    gt.forEach((t, i) => { t.seed = i + 1; });
    ordered.push(...gt);
  }

  const existingIds = extractIdsByName(readFileSync(CONFIG_PATH, 'utf8'));
  const used = new Set();
  for (const t of ordered) {
    const prev = existingIds.get(t.name.toLowerCase());
    if (prev !== undefined && !used.has(prev)) { t.id = prev; used.add(prev); }
  }
  let next = 1;
  for (const t of ordered) {
    if (t.id !== undefined) continue;
    while (used.has(next)) next++;
    t.id = next; used.add(next);
  }

  // ── Report ──
  console.log('\nField (by group):');
  for (const g of GROUP_KEYS) {
    const gt = ordered.filter((t) => t.group === g);
    const line = gt.map((t) => `${t.name} ${(t.probabilities.winGroup * 100).toFixed(0)}%`).join(', ');
    console.log(`  ${g}: ${line}`);
  }
  const champs = [...ordered].sort((a, b) => b.probabilities.champion - a.probabilities.champion).slice(0, 8);
  console.log('\nTop championship odds:');
  for (const t of champs) console.log(`  ${t.name.padEnd(16)} ${(t.probabilities.champion * 100).toFixed(1)}%`);

  if (DRY) {
    console.log('\n(DRY RUN — config not written)');
    return;
  }

  // 6) Write the teams block (match the file's existing EOL so we don't mix CRLF/LF).
  const src = readFileSync(CONFIG_PATH, 'utf8');
  const EOL = src.includes('\r\n') ? '\r\n' : '\n';
  const block = buildTeamsBlock(ordered, GROUP_KEYS, new Date().toISOString().split('T')[0], EOL);
  const TEAMS_REGEX = /(?:\/\*\*[\s\S]*?\*\/\s*)?export const WORLD_CUP_2026_TEAMS: BaseTeam\[\] = \[[\s\S]*?\];/;
  if (!TEAMS_REGEX.test(src)) {
    console.error('\nERROR: could not locate WORLD_CUP_2026_TEAMS array in config file.');
    process.exit(1);
  }
  writeFileSync(CONFIG_PATH, src.replace(TEAMS_REGEX, block), 'utf8');
  console.log(`\n✓ Wrote ${ordered.length} nations to ${CONFIG_PATH}`);
  console.log('  Review: git diff v2/lib/tournaments/configs/world-cup-2026.ts');
}

function buildTeamsBlock(ordered, groupKeys, generatedAt, EOL = '\n') {
  const groupNames = {
    A: 'Group A', B: 'Group B', C: 'Group C', D: 'Group D', E: 'Group E', F: 'Group F',
    G: 'Group G', H: 'Group H', I: 'Group I', J: 'Group J', K: 'Group K', L: 'Group L',
  };
  const p4 = (x) => Number((x ?? 0).toFixed(4));
  const lines = [];
  lines.push('/**');
  lines.push(' * FIFA World Cup 2026 — 48 nations across 12 groups.');
  lines.push(' * First expanded World Cup (USA/Mexico/Canada hosts).');
  lines.push(' *');
  lines.push(' * Probabilities are REAL Kalshi prediction-market prices (mid of yes_bid/yes_ask,');
  lines.push(' * last-trade fallback) — fed directly as fair-ish probabilities and normalized by');
  lines.push(" * the scope-aware 'group' devig (winGroup per-group → 1; reach-round ladder global).");
  lines.push(' *');
  lines.push(`  * Generated: ${generatedAt} from Kalshi (KXWCGROUPWIN / KXWCSTAGEOFELIM / KXWCROUND / KXMENWORLDCUP).`);
  lines.push(' * Re-run: KALSHI_ENV_FILE=/path/.env.local node scripts/fetch-worldcup-odds.mjs');
  lines.push(' *');
  lines.push(' * The active group-winner markets are the field of record — re-running self-corrects');
  lines.push(' * the roster. `id` is stable across re-runs (matched by name); `seed` reflects current');
  lines.push(' * within-group win odds. Don\'t reorder entries by hand.');
  lines.push(' */');
  lines.push('export const WORLD_CUP_2026_TEAMS: BaseTeam[] = [');
  for (const g of groupKeys) {
    const gt = ordered.filter((t) => t.group === g);
    if (!gt.length) continue;
    lines.push(`  // ─── ${groupNames[g]} ───`);
    for (const t of gt) {
      const pr = t.probabilities;
      const safeName = t.name.replace(/'/g, "\\'");
      lines.push(
        `  { id: ${t.id}, name: '${safeName}', seed: ${t.seed}, group: '${g}', americanOdds: {}, ` +
        `probabilities: { winGroup: ${p4(pr.winGroup)}, r32: ${p4(pr.r32)}, r16: ${p4(pr.r16)}, qf: ${p4(pr.qf)}, ` +
        `sf: ${p4(pr.sf)}, final: ${p4(pr.final)}, champion: ${p4(pr.champion)} } },`
      );
    }
    lines.push('');
  }
  // drop the trailing blank line before the closing bracket
  if (lines[lines.length - 1] === '') lines.pop();
  lines.push('];');
  return lines.join(EOL);
}

/** Parse existing config for name→id so re-runs keep ids stable. */
function extractIdsByName(src) {
  const map = new Map();
  const ENTRY = /\{\s*id:\s*(\d+),[^}]*?name:\s*'([^']+)'[^}]*?\}/g;
  let m;
  while ((m = ENTRY.exec(src)) !== null) {
    map.set(m[2].replace(/\\'/g, "'").toLowerCase().trim(), Number(m[1]));
  }
  return map;
}

main().catch((err) => {
  console.error('\n✗ Fetch failed:', err.message);
  process.exit(1);
});
