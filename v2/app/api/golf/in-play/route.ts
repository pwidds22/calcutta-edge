import { fetchInPlay } from '@/lib/datagolf/client';

/**
 * GET /api/golf/in-play
 *
 * Proxies DataGolf in-play leaderboard + live probabilities.
 * Returns player positions, scores, and win/top5/top10/top20/cut probabilities.
 */
export async function GET() {
  if (!process.env.DATAGOLF_API_KEY) {
    return Response.json(
      { error: 'DataGolf API key not configured' },
      { status: 503 }
    );
  }

  try {
    const data = await fetchInPlay();
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch in-play data';
    return Response.json({ error: message }, { status: 502 });
  }
}
