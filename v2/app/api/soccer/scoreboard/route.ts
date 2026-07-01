import { getTournament } from '@/lib/tournaments/registry';
import { parseScoreboard, computeGroupTables } from '@/lib/espn/soccer';
import { fetchScoreboardWindow } from '@/lib/espn/soccer-client';

/**
 * GET /api/soccer/scoreboard
 *
 * On-demand World Cup group tables + matches from ESPN (mirrors
 * /api/golf/in-play). Tables are computed from per-date scoreboard results —
 * ESPN's standings endpoint is dead and its events carry no group labels, so
 * groups come from our tournament config.
 */
export async function GET() {
  try {
    const tournament = getTournament('world_cup_2026');
    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }
    const { config, teams } = tournament;

    // Window: tournament start → max(today + 7, endDate + 1 day). The far edge
    // keeps the FULL knockout schedule in view for the bracket (ESPN publishes
    // every fixture up front, with placeholder teams); +1 day covers fixtures
    // that spill past midnight UTC. Per-day fetches are 60s-cached and failure-
    // tolerant (allSettled), so the wider window is cheap.
    const start = new Date(config.startDate + 'T00:00:00Z');
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + 7);
    const tournamentEnd = new Date(config.endDate + 'T00:00:00Z');
    tournamentEnd.setUTCDate(tournamentEnd.getUTCDate() + 1);
    if (tournamentEnd > end) end.setTime(tournamentEnd.getTime());

    const espn = await fetchScoreboardWindow(start, end);
    const matches = parseScoreboard(espn, teams);
    const groups = computeGroupTables(matches, teams);

    const recentMatches = matches.filter((m) => m.status === 'final').slice(-12);
    const fixtures = matches.filter((m) => m.status === 'scheduled').slice(0, 12);
    // Full knockout match list (placeholders included) — the bracket's input.
    const knockoutMatches = matches.filter((m) => m.stage !== 'group-stage');

    return Response.json(
      { groups, recentMatches, fixtures, knockoutMatches },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch scoreboard';
    return Response.json({ error: message }, { status: 502 });
  }
}
