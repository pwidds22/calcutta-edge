import { fetchInPlay, fetchPreTournament } from '@/lib/datagolf/client';
import type { DataGolfInPlayPlayer } from '@/lib/datagolf/client';

/**
 * GET /api/golf/projections
 *
 * Returns player probabilities for projected standings.
 * Strategy: try in-play API first (live odds during tournament). If that fails
 * or doesn't return data, fall back to pre-tournament model predictions.
 *
 * The endpoint is event-agnostic — it always returns whatever DataGolf has,
 * along with `event_name` so the client can verify it matches the session's
 * tournament (via `matchesTournamentEvent` against the config's
 * `liveSyncMatchers`). Filtering on the server would force this route to know
 * about every active tournament, which is exactly the Masters-only trap the
 * sync route already escaped.
 */
export async function GET() {
  if (!process.env.DATAGOLF_API_KEY) {
    return Response.json(
      { error: 'DataGolf API key not configured' },
      { status: 503 }
    );
  }

  // Try in-play first — best data while play is on.
  try {
    const inPlay = await fetchInPlay();
    if (inPlay.data.length > 0) {
      return Response.json({
        source: 'in-play',
        event_name: inPlay.event_name,
        players: inPlay.data,
      }, {
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' },
      });
    }
    // In-play returned empty — fall through to pre-tournament.
  } catch {
    // In-play failed — fall through to pre-tournament.
  }

  // Fall back to pre-tournament model predictions.
  try {
    const preTourney = await fetchPreTournament();
    const players = (preTourney.baseline_history_fit ?? preTourney.baseline).map(
      (p): DataGolfInPlayPlayer => ({
        player_name: p.player_name,
        dg_id: p.dg_id,
        current_pos: null,
        current_round: 0,
        thru: null,
        today: null,
        total: null,
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
