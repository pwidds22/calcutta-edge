import { NextResponse } from 'next/server';
import { fetchNcaabFutures } from '@/lib/odds-api/client';
import { devigOutrightMarket } from '@/lib/odds-api/devig';
import { resolveTeamId } from '@/lib/odds-api/team-mapping';
import type { OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { MARCH_MADNESS_2026_TEAMS } from '@/lib/tournaments/configs/march-madness-2026';

// In-memory cache with 15-minute TTL
let cache: { data: Record<string, OddsSourceProbabilities>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET() {
  // Check cache
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Odds API not configured' }, { status: 500 });
  }

  try {
    const responses = await fetchNcaabFutures(apiKey);
    const byBookmaker: Record<string, OddsSourceProbabilities> = {};

    for (const event of responses) {
      for (const bookmaker of event.bookmakers) {
        if (!byBookmaker[bookmaker.key]) {
          byBookmaker[bookmaker.key] = {
            teams: {},
            updatedAt: new Date().toISOString(),
          };
        }

        for (const market of bookmaker.markets) {
          if (market.key === 'outrights') {
            const outcomes = market.outcomes.map((o) => ({
              name: o.name,
              decimalOdds: o.price,
            }));
            const devigged = devigOutrightMarket(outcomes);

            for (const dv of devigged) {
              const teamId = resolveTeamId(dv.name);
              if (teamId === null) continue;

              if (!byBookmaker[bookmaker.key].teams[teamId]) {
                byBookmaker[bookmaker.key].teams[teamId] = {
                  r32: 0, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0,
                };
              }
              byBookmaker[bookmaker.key].teams[teamId].champ = dv.fairProbability;
            }
          }
        }
      }
    }

    // Derive missing round probabilities from championship odds
    // Scale the Evan Miya model proportionally based on championship probability ratio
    for (const sourceData of Object.values(byBookmaker)) {
      for (const [teamIdStr, probs] of Object.entries(sourceData.teams)) {
        const teamId = parseInt(teamIdStr, 10);
        const baseTeam = MARCH_MADNESS_2026_TEAMS.find((t) => t.id === teamId);
        if (!baseTeam?.probabilities) continue;

        const baseChamp = baseTeam.probabilities.champ;
        if (baseChamp <= 0 || probs.champ <= 0) continue;

        const scale = probs.champ / baseChamp;
        const roundKeys = ['r32', 's16', 'e8', 'f4', 'f2'] as const;
        for (const rk of roundKeys) {
          if (probs[rk] === 0) {
            const baseProb = baseTeam.probabilities[rk] ?? 0;
            probs[rk] = Math.min(0.999, Math.max(0, baseProb * scale));
          }
        }

        // Ensure monotonic decrease
        const orderedKeys = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'] as const;
        for (let i = 1; i < orderedKeys.length; i++) {
          if (probs[orderedKeys[i]] > probs[orderedKeys[i - 1]]) {
            probs[orderedKeys[i]] = probs[orderedKeys[i - 1]];
          }
        }
      }
    }

    cache = { data: byBookmaker, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(byBookmaker);
  } catch (error) {
    console.error('Odds API error:', error);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}
