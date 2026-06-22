import { getTournament } from '@/lib/tournaments/registry';
import { getWorldCupLiveTeamsTolerant } from '@/lib/tournaments/world-cup-live-odds';

/**
 * GET /api/worldcup/ev
 *
 * Tournament-level: returns the World Cup teams with LIVE Kalshi per-round
 * probabilities merged in (per-round tolerant, so alive teams keep live future
 * odds after their group markets settle). League-agnostic and cacheable — the
 * per-team and per-person EV math runs client-side from this, combined with the
 * league's own sold teams / payout rules / results.
 *
 * The expensive Kalshi reads are cached ~1h by Next's data cache inside
 * getWorldCupLiveTeamsTolerant; this response adds a short public edge cache.
 */
export async function GET() {
  try {
    const tournament = getTournament('world_cup_2026');
    if (!tournament || tournament.config.sport !== 'soccer') {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }
    const teams = await getWorldCupLiveTeamsTolerant(tournament.teams);
    return Response.json(
      { teams },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch live odds';
    return Response.json({ error: message }, { status: 502 });
  }
}
