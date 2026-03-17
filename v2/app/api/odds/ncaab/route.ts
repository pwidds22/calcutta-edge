import { NextResponse } from 'next/server';
import { fetchNcaabFutures } from '@/lib/odds-api/client';
import { devigOutrightMarket } from '@/lib/odds-api/devig';
import { resolveTeamId } from '@/lib/odds-api/team-mapping';
import type { OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { MARCH_MADNESS_2026_TEAMS } from '@/lib/tournaments/configs/march-madness-2026';

const TOTAL_TEAMS = MARCH_MADNESS_2026_TEAMS.length; // 68
const MIN_COVERAGE = 0.75; // Require 75%+ team matches to show a bookmaker

// In-memory cache with 15-minute TTL
let cache: { data: OddsApiResponse; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

interface OddsApiResponse {
  bookmakers: Array<{
    key: string;
    title: string;
    teamCount: number;
  }>;
  data: Record<string, OddsSourceProbabilities>;
}

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
    const bookmakerMeta: Record<string, { title: string; teamCount: number }> = {};

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
              if (teamId === null) {
                console.warn(`[odds-api] Unmatched team: "${dv.name}"`);
                continue;
              }

              if (!byBookmaker[bookmaker.key].teams[teamId]) {
                byBookmaker[bookmaker.key].teams[teamId] = {
                  r32: 0, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0,
                };
              }
              byBookmaker[bookmaker.key].teams[teamId].champ = dv.fairProbability;
            }
          }
        }

        bookmakerMeta[bookmaker.key] = {
          title: bookmaker.title,
          teamCount: Object.keys(byBookmaker[bookmaker.key].teams).length,
        };
      }
    }

    // Derive missing round probabilities from championship odds
    // Uses "anchored scaling": scale the Evan Miya model proportionally based on
    // championship ratio, but clamp early rounds to preserve realistic values.
    for (const sourceData of Object.values(byBookmaker)) {
      for (const [teamIdStr, probs] of Object.entries(sourceData.teams)) {
        const teamId = parseInt(teamIdStr, 10);
        const baseTeam = MARCH_MADNESS_2026_TEAMS.find((t) => t.id === teamId);
        if (!baseTeam?.probabilities) continue;

        const baseChamp = baseTeam.probabilities.champ;
        if (baseChamp <= 0 || probs.champ <= 0) continue;

        const champScale = probs.champ / baseChamp;
        // Blend the scale toward 1.0 for earlier rounds (they're less affected by futures)
        // R32 uses 10% of the scale, S16 uses 30%, E8 uses 60%, F4+ uses 100%
        const roundBlend: Record<string, number> = {
          r32: 0.1,
          s16: 0.3,
          e8: 0.6,
          f4: 0.85,
          f2: 0.95,
        };

        for (const [rk, blend] of Object.entries(roundBlend)) {
          if (probs[rk] === 0) {
            const baseProb = baseTeam.probabilities[rk] ?? 0;
            // Blended scale: lerp between 1.0 (no change) and champScale
            const roundScale = 1 + (champScale - 1) * blend;
            probs[rk] = Math.min(0.999, Math.max(0.0001, baseProb * roundScale));
          }
        }

        // Ensure monotonic decrease (each round <= previous round)
        const orderedKeys = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'] as const;
        for (let i = 1; i < orderedKeys.length; i++) {
          if (probs[orderedKeys[i]] > probs[orderedKeys[i - 1]]) {
            probs[orderedKeys[i]] = probs[orderedKeys[i - 1]];
          }
        }
      }
    }

    // Filter out bookmakers with insufficient coverage
    const filteredBookmakers: OddsApiResponse['bookmakers'] = [];
    const filteredData: Record<string, OddsSourceProbabilities> = {};

    for (const [key, meta] of Object.entries(bookmakerMeta)) {
      const coverage = meta.teamCount / TOTAL_TEAMS;
      if (coverage >= MIN_COVERAGE) {
        filteredBookmakers.push({ key, title: meta.title, teamCount: meta.teamCount });
        filteredData[key] = byBookmaker[key];
      }
    }

    const result: OddsApiResponse = {
      bookmakers: filteredBookmakers,
      data: filteredData,
    };

    cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Odds API error:', error);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}
