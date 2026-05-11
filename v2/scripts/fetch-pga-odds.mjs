#!/usr/bin/env node
/**
 * Fetch real sportsbook odds from DataGolf for the upcoming PGA Tour event
 * and write the result directly to v2/lib/tournaments/configs/pga-championship-2026.ts.
 *
 * Usage:
 *   DATAGOLF_API_KEY=xxx node scripts/fetch-pga-odds.mjs
 *
 * Uses DraftKings as primary source (most comprehensive coverage).
 * Falls back to FanDuel, then Bovada, etc. if DK is missing.
 *
 * This is the PGA Championship variant of fetch-masters-odds.mjs — the next
 * incremental polish would be to generalize into a single fetch script that
 * accepts a tournament-config path as an arg.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', 'lib', 'tournaments', 'configs', 'pga-championship-2026.ts');

const API_KEY = process.env.DATAGOLF_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set DATAGOLF_API_KEY env var');
  console.error('  e.g. DATAGOLF_API_KEY=xxx node scripts/fetch-pga-odds.mjs');
  process.exit(1);
}
const BASE = 'https://feeds.datagolf.com';
const BOOK_PRIORITY = ['draftkings', 'fanduel', 'bovada', 'caesars', 'betmgm', 'bet365'];

const MARKETS = ['win', 'top_5', 'top_10', 'top_20', 'make_cut'];
const ROUND_KEY_MAP = {
  win: 'winner',
  top_5: 'top5',
  top_10: 'top10',
  top_20: 'top20',
  make_cut: 'makeCut',
};

async function fetchMarket(market) {
  const url = `${BASE}/betting-tools/outrights?tour=pga&market=${market}&odds_format=american&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${market}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  console.log('Fetching all 5 markets from DataGolf (tour=pga)...\n');

  const allData = {};
  for (const market of MARKETS) {
    const data = await fetchMarket(market);
    allData[market] = data;
    console.log(`  ${market.padEnd(10)} → ${data.odds.length.toString().padStart(3)} players  (${data.event_name})`);
  }

  // Verify all 5 markets point at the same event — DataGolf returns the next upcoming
  // PGA event for each market, so a mismatch means we're caught mid-rollover.
  const eventNames = new Set(MARKETS.map((m) => allData[m].event_name));
  if (eventNames.size > 1) {
    console.warn(`\nWARNING: markets are pointing at different events: ${[...eventNames].join(', ')}`);
    console.warn('         DataGolf may be mid-rollover. Verify the output before committing.');
  }

  const eventName = allData.win.event_name;
  if (!/championship/i.test(eventName)) {
    console.warn(`\nWARNING: event_name "${eventName}" doesn't look like the PGA Championship.`);
    console.warn('         This script is intended to run within ~2 weeks of the championship.');
    console.warn('         Outside that window DataGolf returns whatever next PGA Tour event is up.');
  }

  // Build player map: dg_id → { name, odds per round }
  const players = new Map();
  for (const market of MARKETS) {
    const roundKey = ROUND_KEY_MAP[market];
    for (const p of allData[market].odds) {
      if (!players.has(p.dg_id)) {
        players.set(p.dg_id, { dg_id: p.dg_id, name: formatName(p.player_name), odds: {} });
      }
      const odds = getBestOdds(p, BOOK_PRIORITY);
      if (odds !== null) {
        players.get(p.dg_id).odds[roundKey] = odds;
      }
    }
  }

  // Sort by implied win probability (favorites first)
  const sorted = [...players.values()]
    .filter((p) => p.odds.winner !== undefined)
    .sort((a, b) => americanToProb(b.odds.winner) - americanToProb(a.odds.winner));

  console.log(`\n${sorted.length} players have win odds. Building tiers...`);
  const tiers = assignTiers(sorted);
  for (const t of tiers) {
    console.log(`  ${t.label.padEnd(12)} ${t.players.length} players`);
  }

  // Build the new teams array as a string
  const generatedAt = new Date().toISOString().split('T')[0];
  const teamsBlock = buildTeamsBlock(tiers, sorted, eventName, generatedAt);

  // Replace the existing PGA_CHAMPIONSHIP_2026_TEAMS array in the config file.
  const configSource = readFileSync(CONFIG_PATH, 'utf-8');
  const TEAMS_REGEX = /\/\*\*[\s\S]*?\*\/\nexport const PGA_CHAMPIONSHIP_2026_TEAMS: BaseTeam\[\] = \[[\s\S]*?\n\];/;
  if (!TEAMS_REGEX.test(configSource)) {
    console.error('\nERROR: could not locate PGA_CHAMPIONSHIP_2026_TEAMS array in config file.');
    console.error(`       Expected the placeholder array at: ${CONFIG_PATH}`);
    process.exit(1);
  }
  const updated = configSource.replace(TEAMS_REGEX, teamsBlock);
  writeFileSync(CONFIG_PATH, updated, 'utf-8');

  console.log(`\n✓ Wrote ${sorted.length} players to ${CONFIG_PATH}`);
  console.log(`  Source event: ${eventName}`);
  console.log(`  Run: git diff v2/lib/tournaments/configs/pga-championship-2026.ts  # review`);
  console.log(`  Run: git add v2/lib/tournaments/configs/pga-championship-2026.ts && git commit  # ship`);
}

function buildTeamsBlock(tiers, sorted, eventName, generatedAt) {
  const lines = [];
  lines.push('/**');
  lines.push(` * PGA Championship 2026 field — real sportsbook odds from DataGolf API.`);
  lines.push(` * Source: DraftKings (primary), FanDuel/Bovada/Caesars/BetMGM/Bet365 (fallback).`);
  lines.push(` *`);
  lines.push(` * Generated: ${generatedAt} from DataGolf outrights API (all 5 markets).`);
  lines.push(` * Event: ${eventName}`);
  lines.push(` * Re-run: DATAGOLF_API_KEY=xxx node scripts/fetch-pga-odds.mjs`);
  lines.push(` */`);
  lines.push(`export const PGA_CHAMPIONSHIP_2026_TEAMS: BaseTeam[] = [`);

  for (let i = 0; i < tiers.length; i++) {
    const { label, players: tierPlayers } = tiers[i];
    lines.push(`  // --- ${label} ---`);
    for (const p of tierPlayers) {
      const seed = sorted.indexOf(p) + 1;
      const group = label.toLowerCase();
      const mc = p.odds.makeCut ?? estimateMakeCut(p.odds.winner);
      const t20 = p.odds.top20 ?? estimateFromWinner(p.odds.winner, 20);
      const t10 = p.odds.top10 ?? estimateFromWinner(p.odds.winner, 10);
      const t5 = p.odds.top5 ?? estimateFromWinner(p.odds.winner, 5);
      const w = p.odds.winner;
      const safeName = p.name.replace(/'/g, "\\'");
      lines.push(`  { id: ${seed}, name: '${safeName}', seed: ${seed}, group: '${group}', americanOdds: { makeCut: ${fmt(mc)}, top20: ${fmt(t20)}, top10: ${fmt(t10)}, top5: ${fmt(t5)}, winner: ${fmt(w)} } },`);
    }
    if (i < tiers.length - 1) lines.push('');
  }
  lines.push(`];`);
  return lines.join('\n');
}

function formatName(dgName) {
  const parts = dgName.split(', ');
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return dgName;
}

function getBestOdds(player, books) {
  for (const book of books) {
    const val = player[book];
    if (val === null || val === undefined) continue;
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (!isNaN(num) && num !== 0) return num;
  }
  return null;
}

function americanToProb(odds) {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function fmt(odds) {
  if (odds === undefined || odds === null) return 0;
  const n = Math.round(odds);
  return n > 0 ? `+${n}` : `${n}`;
}

function estimateMakeCut(winnerOdds) {
  const winProb = americanToProb(winnerOdds);
  const cutProb = Math.min(0.95, winProb * 8 + 0.3);
  return probToAmerican(cutProb);
}

function estimateFromWinner(winnerOdds, topN) {
  const winProb = americanToProb(winnerOdds);
  const scale = { 5: 4, 10: 7, 20: 12 }[topN] || topN;
  const prob = Math.min(0.95, winProb * scale);
  return probToAmerican(prob);
}

function probToAmerican(prob) {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) return Math.round(-prob * 100 / (1 - prob));
  return Math.round(100 / prob - 100);
}

function assignTiers(sorted) {
  const n = sorted.length;
  // Same thresholds as Masters: Favorites 1-10, Contenders 11-30, Longshots 31-54, Field 55+.
  // For a typical PGA Championship field (~156 players) this leaves a healthy Field tier.
  const favEnd = Math.min(10, n);
  const contEnd = Math.min(30, n);
  const longEnd = Math.min(54, n);

  return [
    { label: 'Favorites', players: sorted.slice(0, favEnd) },
    { label: 'Contenders', players: sorted.slice(favEnd, contEnd) },
    { label: 'Longshots', players: sorted.slice(contEnd, longEnd) },
    { label: 'Field', players: sorted.slice(longEnd) },
  ].filter((t) => t.players.length > 0);
}

main().catch((err) => {
  console.error('\n✗ Fetch failed:', err.message);
  process.exit(1);
});
