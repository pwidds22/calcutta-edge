import { fetchInPlay, fetchPreTournament, formatPlayerName } from '@/lib/datagolf/client';
import type { DataGolfInPlayPlayer } from '@/lib/datagolf/client';

/**
 * GET /api/golf/projections
 *
 * Returns player probabilities for projected standings.
 * Strategy: try in-play API first — if it's the Masters, use live odds.
 * Otherwise fall back to pre-tournament model predictions.
 *
 * Returns a normalized array of { player_name, dg_id, win_prob, top_5_prob, ... }
 * matching the DataGolfInPlayPlayer shape so the client doesn't care about the source.
 */
export async function GET() {
  if (!process.env.DATAGOLF_API_KEY) {
    return Response.json(
      { error: 'DataGolf API key not configured' },
      { status: 503 }
    );
  }

  // Try in-play first — best data during tournament
  try {
    const inPlay = await fetchInPlay();
    const isMasters = inPlay.event_name.toLowerCase().includes('masters')
      || inPlay.event_name.toLowerCase().includes('augusta');

    if (isMasters) {
      return Response.json({
        source: 'in-play',
        event_name: inPlay.event_name,
        players: inPlay.data,
      }, {
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' },
      });
    }
    // Not Masters — fall through to pre-tournament
  } catch {
    // In-play failed — fall through to pre-tournament
  }

  // Fall back to pre-tournament model predictions
  try {
    const preTourney = await fetchPreTournament();
    const isMasters = preTourney.event_name.toLowerCase().includes('masters')
      || preTourney.event_name.toLowerCase().includes('augusta');

    if (!isMasters) {
      return Response.json({
        source: 'none',
        event_name: preTourney.event_name,
        error: `DataGolf showing "${preTourney.event_name}", not Masters`,
        players: [],
      }, {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    // Use baseline_history_fit (more accurate) with fallback to baseline
    const players = (preTourney.baseline_history_fit ?? preTourney.baseline).map(
      (p): DataGolfInPlayPlayer => ({
        player_name: p.player_name,
        dg_id: p.dg_id,
        current_pos: null,
        current_round: 0,
        thru: null,
        today: null,
        total: null,
        // Map pre-tournament fields to in-play prob fields
        win_prob: p.win,
        top_5_prob: p.top_5,
        top_10_prob: p.top_10,
        top_20_prob: p.top_20,
        make_cut_prob: p.make_cut,
      })
    );

    return Response.json({
      source: 'pre-tournament',
      event_name: preTourney.event_name,
      players,
    }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch predictions';
    return Response.json({ error: message }, { status: 502 });
  }
}
