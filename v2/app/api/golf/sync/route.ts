import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import { getTournament, listTournamentsByPhase } from '@/lib/tournaments/registry';
import type { TournamentConfig, BaseTeam } from '@/lib/tournaments/types';
import { fetchDataGolfLeaderboard, positionToTierResults, identifyLowRounds } from '@/lib/datagolf/leaderboard';
import type { GolfLeaderboard } from '@/lib/datagolf/leaderboard';
import { fetchInPlay } from '@/lib/datagolf/client';
import { fetchGolfLeaderboard, matchPlayerToTeamId, positionToResults } from '@/lib/espn/golf-leaderboard';

/**
 * POST /api/golf/sync
 *
 * Syncs live golf leaderboard positions into tournament_results for any
 * currently-active golf tournament. Tournament identification is config-driven
 * via `TournamentConfig.liveSyncMatchers` — each registered golf tournament
 * declares the event-name substrings that identify it in upstream feeds.
 *
 * Primary source: DataGolf (richer data, low-round identification).
 * Fallback: ESPN free leaderboard API.
 *
 * Two modes:
 * 1. Vercel Cron — syncs ALL active golf sessions for whatever tournament
 *    is currently live. Protected by CRON_SECRET.
 * 2. Manual — syncs a specific session. Body: { sessionId: string }
 */
export async function POST(req: NextRequest) {
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  const supabase = createAdminClient();

  if (isCron) {
    return await syncAllGolfSessions(supabase);
  }

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('id, tournament_id, status, tournament_status')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const tournament = getTournament(session.tournament_id);
  if (!tournament || tournament.config.sport !== 'golf') {
    return NextResponse.json(
      { error: 'Session is not a golf tournament — golf sync does not apply' },
      { status: 400 }
    );
  }
  if (!tournament.config.liveSyncMatchers || tournament.config.liveSyncMatchers.length === 0) {
    return NextResponse.json(
      { error: `Tournament ${tournament.config.id} has no liveSyncMatchers configured` },
      { status: 400 }
    );
  }

  const result = await syncGolfSession(supabase, sessionId, tournament.config, tournament.teams);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createAdminClient();
  return await syncAllGolfSessions(supabase);
}

async function syncAllGolfSessions(supabase: ReturnType<typeof createAdminClient>) {
  // Find every golf tournament currently in a phase where results could roll in.
  // 'live' is the obvious one. 'hostable' is included too because golf tournaments
  // routinely have ~10 hours of overlap on day 1 where hostingOpensAt is still in
  // effect for late commissioners but the first tee groups are already playing.
  const buckets = listTournamentsByPhase();
  const candidates = [...buckets.live, ...buckets.hostable].filter(
    (t) => t.config.sport === 'golf' && t.config.liveSyncMatchers && t.config.liveSyncMatchers.length > 0
  );

  if (candidates.length === 0) {
    return NextResponse.json({ message: 'No active golf tournaments with sync configured', synced: 0 });
  }

  // Fetch the leaderboard once, then pick which (single) candidate it matches.
  // DataGolf/ESPN return one event at a time, so we can short-circuit after the
  // first match.
  const { leaderboard, error: fetchError } = await fetchLeaderboard();
  if (fetchError || !leaderboard) {
    return NextResponse.json({ error: fetchError ?? 'No leaderboard data', synced: 0 }, { status: 502 });
  }

  const matched = candidates.find((t) => isLeaderboardMatch(leaderboard.tournamentName, t.config));
  if (!matched) {
    return NextResponse.json({
      message: `Leaderboard event "${leaderboard.tournamentName}" doesn't match any active tournament — sync skipped`,
      candidates: candidates.map((t) => t.config.id),
      synced: 0,
    });
  }

  // Pull sessions for the matched tournament. Same status filter as before:
  // auction must be completed (results phase) and tournament_status must be
  // pre_tournament or in_progress (not yet settled).
  const { data: sessions, error } = await supabase
    .from('auction_sessions')
    .select('id')
    .eq('tournament_id', matched.config.id)
    .eq('status', 'completed')
    .in('tournament_status', ['pre_tournament', 'in_progress']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({
      message: `No active ${matched.config.name} sessions to sync`,
      tournament: matched.config.id,
      synced: 0,
    });
  }

  const results = [];
  for (const session of sessions) {
    const result = await syncGolfSession(supabase, session.id, matched.config, matched.teams, leaderboard);
    results.push({ sessionId: session.id, ...result });
  }

  return NextResponse.json({
    message: `Synced ${sessions.length} ${matched.config.name} sessions`,
    tournament: matched.config.id,
    results,
  });
}

/** True if the leaderboard event name matches any of the tournament's match patterns. */
function isLeaderboardMatch(eventName: string, config: TournamentConfig): boolean {
  if (!config.liveSyncMatchers) return false;
  const lower = eventName.toLowerCase();
  return config.liveSyncMatchers.some((m) => lower.includes(m.toLowerCase()));
}

// ─── Fetch Leaderboard (DataGolf primary, ESPN fallback) ─────────

async function fetchLeaderboard(): Promise<{
  leaderboard: GolfLeaderboard | null;
  error: string | null;
}> {
  // Try DataGolf first (richer data, live probabilities).
  if (process.env.DATAGOLF_API_KEY) {
    try {
      const lb = await fetchDataGolfLeaderboard();
      return { leaderboard: lb, error: null };
    } catch (err) {
      console.error('[Golf Sync] DataGolf fetch failed, falling back to ESPN:', err);
    }
  }

  // Fallback to ESPN
  try {
    const espn = await fetchGolfLeaderboard();
    return {
      leaderboard: {
        tournamentName: espn.tournamentName,
        status: espn.status,
        currentRound: espn.currentRound,
        players: espn.players.map((p) => ({
          name: p.name,
          dgId: 0, // No DG ID from ESPN
          position: p.position,
          positionDisplay: p.positionDisplay,
          madeCut: p.madeCut,
          currentRound: p.currentRound,
          totalScore: p.totalScore,
          todayScore: p.roundScore,
          thru: null,
          isCut: p.isCut,
          isWithdrawn: p.isWithdrawn,
        })),
        source: 'espn',
        lastUpdated: new Date().toISOString(),
      },
      error: null,
    };
  } catch (err) {
    return { leaderboard: null, error: `Both DataGolf and ESPN fetch failed: ${err}` };
  }
}

// ─── Sync a Single Session ──────────────────────────────────────

async function syncGolfSession(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  config: TournamentConfig,
  teams: BaseTeam[],
  preFetchedLeaderboard?: GolfLeaderboard
) {
  let leaderboard = preFetchedLeaderboard;
  if (!leaderboard) {
    const fetched = await fetchLeaderboard();
    if (fetched.error || !fetched.leaderboard) {
      return { error: fetched.error ?? 'No leaderboard data', inserted: 0, updated: 0 };
    }
    leaderboard = fetched.leaderboard;
  }

  // Verify the leaderboard event matches THIS tournament. The cron flow does
  // this before calling us, but the manual flow doesn't (and the leaderboard
  // could have rolled over to a different event between fetches).
  if (!isLeaderboardMatch(leaderboard.tournamentName, config)) {
    return {
      error: `Current event is "${leaderboard.tournamentName}", not ${config.name}. Sync blocked.`,
      inserted: 0,
      updated: 0,
    };
  }

  if (leaderboard.status === 'pre') {
    return { message: 'Tournament has not started yet', inserted: 0, updated: 0 };
  }

  // Get tier configs for position mapping
  const tiers = config.rounds
    .filter((r) => !r.key.startsWith('lowRound') && r.key !== 'worstRound' && r.key !== 'worstOverall')
    .map((r) => ({ key: r.key, teamsAdvancing: r.teamsAdvancing }));

  let inserted = 0;
  let updated = 0;
  const matched: string[] = [];
  const unmatched: string[] = [];
  const allUpdates: Array<{ teamId: number; roundKey: string; result: 'won' | 'lost' }> = [];

  // Determine what results we can assign based on tournament state:
  // - After R2 (cut made): can assign makeCut results
  // - After R4 (tournament over): can assign all position-based results
  const cutMade = leaderboard.currentRound > 2 || leaderboard.status === 'post';
  const tournamentOver = leaderboard.status === 'post';

  for (const player of leaderboard.players) {
    const teamId = matchPlayerToTeamId(player.name, teams);

    if (teamId === null) {
      unmatched.push(player.name);
      continue;
    }

    matched.push(`${player.name} → ID ${teamId} (pos: ${player.positionDisplay})`);

    let results: Array<{ roundKey: string; result: 'won' | 'lost' }> = [];

    if (tournamentOver) {
      // Tournament complete — record all tier results
      results = positionToTierResults(player.position, player.isCut, player.isWithdrawn, tiers);
    } else if (cutMade) {
      // Only record makeCut after R2
      if (player.isCut || player.isWithdrawn) {
        results = [{ roundKey: 'makeCut', result: 'lost' }];
      } else if (player.madeCut) {
        results = [{ roundKey: 'makeCut', result: 'won' }];
      }
    }

    for (const { roundKey, result } of results) {
      const { error: upsertErr, status: upsertStatus } = await supabase
        .from('tournament_results')
        .upsert(
          {
            session_id: sessionId,
            team_id: teamId,
            round_key: roundKey,
            result,
            entered_by: null, // System-entered
            entered_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,team_id,round_key' }
        );

      if (upsertErr) {
        console.error(`[Golf Sync] Error upserting ${player.name} ${roundKey}:`, upsertErr);
      } else {
        upsertStatus === 201 ? inserted++ : updated++;
        allUpdates.push({ teamId, roundKey, result });
      }
    }
  }

  // ─── Low Round Auto-Grading ─────────────────────────────────────
  // Fetch raw in-play data to get R1-R4 stroke scores for low round identification.
  // Only attempt if we have a DataGolf API key.
  const lowRoundResults: Array<{ round: number; score: number; players: string[]; isComplete: boolean }> = [];
  let lowRoundGraded = 0;

  if (process.env.DATAGOLF_API_KEY) {
    try {
      const rawInPlay = await fetchInPlay('pga');
      const lowRounds = identifyLowRounds(rawInPlay);

      for (const lr of lowRounds) {
        lowRoundResults.push({
          round: lr.round,
          score: lr.lowScore,
          players: lr.players.map((p) => p.name),
          isComplete: lr.isComplete,
        });

        // Only auto-grade completed rounds
        if (!lr.isComplete) continue;

        // Grade each low round winner
        for (const winner of lr.players) {
          const teamId = matchPlayerToTeamId(winner.name, teams);
          if (teamId === null) continue;

          const { error: upsertErr, status: upsertStatus } = await supabase
            .from('tournament_results')
            .upsert(
              {
                session_id: sessionId,
                team_id: teamId,
                round_key: lr.roundKey,
                result: 'won',
                entered_by: null,
                entered_at: new Date().toISOString(),
              },
              { onConflict: 'session_id,team_id,round_key' }
            );

          if (!upsertErr) {
            upsertStatus === 201 ? inserted++ : updated++;
            lowRoundGraded++;
            allUpdates.push({ teamId, roundKey: lr.roundKey, result: 'won' });
          }
        }
      }
    } catch (err) {
      console.error('[Golf Sync] Low round identification failed:', err);
    }
  }

  // Update session status
  if (allUpdates.length > 0) {
    const newStatus = tournamentOver ? 'settled' : 'in_progress';
    await supabase
      .from('auction_sessions')
      .update({ tournament_status: newStatus })
      .eq('id', sessionId)
      .in('tournament_status', ['pre_tournament', 'in_progress']);

    await broadcastToChannel(`auction:${sessionId}`, 'RESULTS_BULK_UPDATED', {
      updates: allUpdates,
    });
  }

  return {
    message: `Synced ${matched.length} players from ${leaderboard.tournamentName}`,
    source: leaderboard.source,
    tournament: leaderboard.tournamentName,
    status: leaderboard.status,
    currentRound: leaderboard.currentRound,
    matched: matched.length,
    unmatched: unmatched.length > 0 ? unmatched : undefined,
    inserted,
    updated,
    lowRounds: lowRoundResults.length > 0 ? lowRoundResults : undefined,
    lowRoundGraded,
  };
}
