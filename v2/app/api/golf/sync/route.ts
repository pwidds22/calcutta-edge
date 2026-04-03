import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchGolfLeaderboard,
  matchPlayerToTeamId,
  positionToResults,
} from '@/lib/espn/golf-leaderboard';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import { MASTERS_2026_TEAMS } from '@/lib/tournaments/configs/masters-2026';
import { MASTERS_2026_CONFIG } from '@/lib/tournaments/configs/masters-2026';

/**
 * POST /api/golf/sync
 *
 * Syncs live golf leaderboard positions into tournament_results.
 * Two modes:
 * 1. Vercel Cron — syncs ALL active golf sessions. Protected by CRON_SECRET.
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

  if (session.tournament_id !== 'masters_2026') {
    return NextResponse.json({ error: 'Only Masters 2026 sessions supported' }, { status: 400 });
  }

  const result = await syncGolfSession(supabase, sessionId);
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
  const { data: sessions, error } = await supabase
    .from('auction_sessions')
    .select('id')
    .eq('tournament_id', 'masters_2026')
    .eq('status', 'completed')
    .in('tournament_status', ['pre_tournament', 'in_progress']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ message: 'No active Masters sessions to sync', synced: 0 });
  }

  const results = [];
  for (const session of sessions) {
    const result = await syncGolfSession(supabase, session.id);
    results.push({ sessionId: session.id, ...result });
  }

  return NextResponse.json({ message: `Synced ${sessions.length} sessions`, results });
}

async function syncGolfSession(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string
) {
  let leaderboard;
  try {
    leaderboard = await fetchGolfLeaderboard();
  } catch (err) {
    return { error: `ESPN Golf fetch failed: ${err}`, inserted: 0, updated: 0 };
  }

  // Verify it's a Masters tournament (or at least a PGA event)
  const isMasters = leaderboard.tournamentName.toLowerCase().includes('masters')
    || leaderboard.tournamentName.toLowerCase().includes('augusta');

  if (!isMasters && leaderboard.status === 'pre') {
    return { error: 'Current ESPN event is not The Masters and has not started', inserted: 0, updated: 0 };
  }

  // Only sync if tournament is in progress or completed
  if (leaderboard.status === 'pre') {
    return { message: 'Tournament has not started yet', inserted: 0, updated: 0 };
  }

  // Get round configs for position mapping
  const roundConfigs = MASTERS_2026_CONFIG.rounds
    .filter(r => r.key !== 'lowRound') // Skip prop bets
    .map(r => ({ key: r.key, teamsAdvancing: r.teamsAdvancing }));

  let inserted = 0;
  let updated = 0;
  const matched: string[] = [];
  const unmatched: string[] = [];
  const allUpdates: Array<{ teamId: number; roundKey: string; result: 'won' | 'lost' }> = [];

  // Determine if we should assign results based on tournament state:
  // - After R2 (cut is made): can assign makeCut results
  // - After R4 (tournament over): can assign all position-based results
  const cutMade = leaderboard.currentRound > 2 || leaderboard.status === 'post';
  const tournamentOver = leaderboard.status === 'post';

  for (const player of leaderboard.players) {
    const teamId = matchPlayerToTeamId(player.name, MASTERS_2026_TEAMS);

    if (teamId === null) {
      unmatched.push(player.name);
      continue;
    }

    matched.push(`${player.name} → ID ${teamId} (pos: ${player.positionDisplay})`);

    // Determine which results to record based on tournament state
    let results: Array<{ roundKey: string; result: 'won' | 'lost' }> = [];

    if (tournamentOver) {
      // Tournament complete — record all results
      results = positionToResults(player.position, player.isCut, player.isWithdrawn, roundConfigs);
    } else if (cutMade) {
      // Only record makeCut result after R2
      if (player.isCut || player.isWithdrawn) {
        results = [{ roundKey: 'makeCut', result: 'lost' }];
      } else if (player.madeCut) {
        results = [{ roundKey: 'makeCut', result: 'won' }];
      }
    }
    // Before cut: don't record anything yet

    for (const { roundKey, result } of results) {
      const { error: upsertErr, status: upsertStatus } = await supabase
        .from('tournament_results')
        .upsert(
          {
            session_id: sessionId,
            team_id: teamId,
            round_key: roundKey,
            result,
            entered_by: null,
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
    tournament: leaderboard.tournamentName,
    status: leaderboard.status,
    currentRound: leaderboard.currentRound,
    matched: matched.length,
    unmatched: unmatched.length > 0 ? unmatched : undefined,
    inserted,
    updated,
  };
}
