import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import { MASTERS_2026_TEAMS, MASTERS_2026_CONFIG } from '@/lib/tournaments/configs/masters-2026';
import { fetchDataGolfLeaderboard, positionToTierResults, identifyLowRounds } from '@/lib/datagolf/leaderboard';
import type { GolfLeaderboard } from '@/lib/datagolf/leaderboard';
import { fetchInPlay } from '@/lib/datagolf/client';
import { fetchGolfLeaderboard, matchPlayerToTeamId, positionToResults } from '@/lib/espn/golf-leaderboard';

/**
 * POST /api/golf/sync
 *
 * Syncs live golf leaderboard positions into tournament_results.
 * Primary source: DataGolf (richer data, live probabilities).
 * Fallback: ESPN free leaderboard API.
 *
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

// ─── Fetch Leaderboard (DataGolf primary, ESPN fallback) ─────────

async function fetchLeaderboard(): Promise<{
  leaderboard: GolfLeaderboard | null;
  error: string | null;
}> {
  // Try DataGolf first (richer data, live probabilities)
  if (process.env.DATAGOLF_API_KEY) {
    try {
      const lb = await fetchDataGolfLeaderboard();
      // Verify it's returning Masters data (event name check)
      const isMasters = lb.tournamentName.toLowerCase().includes('masters')
        || lb.tournamentName.toLowerCase().includes('augusta');
      if (isMasters || lb.status !== 'pre') {
        return { leaderboard: lb, error: null };
      }
      console.log(`[Golf Sync] DataGolf returned "${lb.tournamentName}", not Masters. Falling back to ESPN.`);
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
        players: espn.players.map(p => ({
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
  sessionId: string
) {
  const { leaderboard, error: fetchError } = await fetchLeaderboard();
  if (fetchError || !leaderboard) {
    return { error: fetchError ?? 'No leaderboard data', inserted: 0, updated: 0 };
  }

  // Verify it's a Masters event
  const isMasters = leaderboard.tournamentName.toLowerCase().includes('masters')
    || leaderboard.tournamentName.toLowerCase().includes('augusta');

  if (!isMasters && leaderboard.status === 'pre') {
    return { error: 'Current event is not The Masters and has not started', inserted: 0, updated: 0 };
  }

  if (leaderboard.status === 'pre') {
    return { message: 'Tournament has not started yet', inserted: 0, updated: 0 };
  }

  // Get tier configs for position mapping
  const tiers = MASTERS_2026_CONFIG.rounds
    .filter(r => !r.key.startsWith('lowRound') && r.key !== 'worstRound' && r.key !== 'worstOverall')
    .map(r => ({ key: r.key, teamsAdvancing: r.teamsAdvancing }));

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
    const teamId = matchPlayerToTeamId(player.name, MASTERS_2026_TEAMS);

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
          players: lr.players.map(p => p.name),
          isComplete: lr.isComplete,
        });

        // Only auto-grade completed rounds
        if (!lr.isComplete) continue;

        // Grade each low round winner
        for (const winner of lr.players) {
          const teamId = matchPlayerToTeamId(winner.name, MASTERS_2026_TEAMS);
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
