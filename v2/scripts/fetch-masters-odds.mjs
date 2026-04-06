#!/usr/bin/env node
/**
 * Fetch real sportsbook odds from DataGolf and generate updated Masters config.
 * Usage: node scripts/fetch-masters-odds.mjs
 *
 * Uses DraftKings as primary source (most comprehensive coverage).
 * Falls back to FanDuel, then Bovada if DK is missing.
 */

const API_KEY = process.env.DATAGOLF_API_KEY;
if (!API_KEY) { console.error('Set DATAGOLF_API_KEY env var'); process.exit(1); }
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
  if (!res.ok) throw new Error(`Failed to fetch ${market}: ${res.status}`);
  return res.json();
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

async function main() {
  console.log('Fetching all 5 markets from DataGolf...\n');

  const allData = {};
  for (const market of MARKETS) {
    const data = await fetchMarket(market);
    allData[market] = data;
    console.log(`  ${market}: ${data.odds.length} players (${data.event_name})`);
  }

  // Debug: show sample player structure
  const sample = allData.win.odds[0];
  console.log('\nSample player keys:', Object.keys(sample));
  console.log('Sample DK value:', sample.draftkings, typeof sample.draftkings);
  console.log('Sample FD value:', sample.fanduel, typeof sample.fanduel);

  // Build player map: dg_id → { name, odds per round }
  const players = new Map();

  for (const market of MARKETS) {
    const roundKey = ROUND_KEY_MAP[market];
    for (const p of allData[market].odds) {
      if (!players.has(p.dg_id)) {
        players.set(p.dg_id, {
          dg_id: p.dg_id,
          name: formatName(p.player_name),
          odds: {},
        });
      }
      const odds = getBestOdds(p, BOOK_PRIORITY);
      if (odds !== null) {
        players.get(p.dg_id).odds[roundKey] = odds;
      }
    }
  }

  console.log(`\nPlayers with winner odds: ${[...players.values()].filter(p => p.odds.winner !== undefined).length}`);

  // Sort by win probability (lower American odds = higher probability)
  const sorted = [...players.values()]
    .filter(p => p.odds.winner !== undefined)
    .sort((a, b) => {
      const aOdds = a.odds.winner;
      const bOdds = b.odds.winner;
      // Negative odds (favorites) are "better" than positive odds
      return americanToProb(aOdds) - americanToProb(bOdds);
    })
    .reverse();

  // Assign tiers
  const tiers = assignTiers(sorted);

  // Generate TypeScript
  console.log(`\n// Generated ${new Date().toISOString()}`);
  console.log(`// Source: DataGolf API → DraftKings (primary), FanDuel/Bovada (fallback)`);
  console.log(`// Event: ${allData.win.event_name}\n`);
  console.log(`export const MASTERS_2026_TEAMS: BaseTeam[] = [`);

  for (let i = 0; i < tiers.length; i++) {
    const { label, players: tierPlayers } = tiers[i];
    console.log(`  // --- ${label} ---`);
    for (const p of tierPlayers) {
      const seed = sorted.indexOf(p) + 1;
      const group = label.toLowerCase();
      const mc = p.odds.makeCut ?? estimateMakeCut(p.odds.winner);
      const t20 = p.odds.top20 ?? estimateFromWinner(p.odds.winner, 20);
      const t10 = p.odds.top10 ?? estimateFromWinner(p.odds.winner, 10);
      const t5 = p.odds.top5 ?? estimateFromWinner(p.odds.winner, 5);
      const w = p.odds.winner;
      console.log(`  { id: ${seed}, name: '${p.name.replace(/'/g, "\\'")}', seed: ${seed}, group: '${group}', americanOdds: { makeCut: ${fmt(mc)}, top20: ${fmt(t20)}, top10: ${fmt(t10)}, top5: ${fmt(t5)}, winner: ${fmt(w)} } },`);
    }
    if (i < tiers.length - 1) console.log('');
  }

  console.log(`];`);
  console.log(`\n// Total: ${sorted.length} players`);
}

function formatName(dgName) {
  const parts = dgName.split(', ');
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return dgName;
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
  // Rough estimate: if winner odds are X, make_cut odds are much shorter
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
  const favEnd = Math.min(10, n);
  const contEnd = Math.min(30, n);
  const longEnd = Math.min(54, n);

  return [
    { label: 'Favorites', players: sorted.slice(0, favEnd) },
    { label: 'Contenders', players: sorted.slice(favEnd, contEnd) },
    { label: 'Longshots', players: sorted.slice(contEnd, longEnd) },
    { label: 'Field', players: sorted.slice(longEnd) },
  ].filter(t => t.players.length > 0);
}

main().catch(console.error);
