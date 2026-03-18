import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTournamentResults } from '@/lib/espn/scoreboard';
import { broadcastToChannel } from '@/lib/supabase/broadcast';

/**
 * POST /api/espn/sync
 *
 * Two modes:
 * 1. Vercel Cron — called every 15 min during tournament, syncs today's results
 *    for ALL active sessions. Protected by CRON_SECRET.
 * 2. Commissioner — called from "Sync Results" button, syncs for a specific session.
 *    Protected by session ownership check.
 *
 * Body (commissioner mode): { sessionId: string }
 * Header (cron mode): Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;

  const supabase = createAdminClient();

  if (isCron) {
    // ── Cron mode: sync ALL active March Madness sessions ──
    return await syncAllSessions(supabase);
  }

  // ── Commissioner mode: sync a specific session ──
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

  // Verify the session exists and is a March Madness tournament
  const { data: session, error: sessionErr } = await supabase
    .from('auction_sessions')
    .select('id, tournament_id, status, tournament_status')
    .eq('id', sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.tournament_id !== 'march_madness_2026') {
    return NextResponse.json({ error: 'Only March Madness 2026 sessions supported' }, { status: 400 });
  }

  const result = await syncSessionResults(supabase, sessionId);
  return NextResponse.json(result);
}

// Also support GET for Vercel Cron (cron jobs use GET by default)
export async function GET(req: NextRequest) {
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  return await syncAllSessions(supabase);
}

async function syncAllSessions(supabase: ReturnType<typeof createAdminClient>) {
  // Find all completed March Madness 2026 auction sessions
  const { data: sessions, error } = await supabase
    .from('auction_sessions')
    .select('id')
    .eq('tournament_id', 'march_madness_2026')
    .eq('status', 'completed')
    .in('tournament_status', ['pre_tournament', 'in_progress']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ message: 'No active sessions to sync', synced: 0 });
  }

  const results = [];
  for (const session of sessions) {
    const result = await syncSessionResults(supabase, session.id);
    results.push({ sessionId: session.id, ...result });
  }

  return NextResponse.json({
    message: `Synced ${sessions.length} sessions`,
    results,
  });
}

async function syncSessionResults(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string
) {
  // Fetch today's games + a range of recent dates to catch any missed results
  const today = new Date();
  // Go back 3 days to catch any games we might have missed
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 3);

  const todayStr = today.toISOString().slice(0, 10);
  const startStr = startDate.toISOString().slice(0, 10);

  let games;
  try {
    games = await fetchTournamentResults(startStr, todayStr);
  } catch (err) {
    return { error: `ESPN fetch failed: ${err}`, inserted: 0, updated: 0 };
  }

  if (games.length === 0) {
    return { message: 'No completed tournament games found', inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  for (const game of games) {
    // Upsert winner as 'won'
    const { error: winErr, status: winStatus } = await supabase
      .from('tournament_results')
      .upsert(
        {
          session_id: sessionId,
          team_id: game.winnerId,
          round_key: game.roundKey,
          result: 'won',
          entered_by: null, // System-entered (ESPN)
          entered_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,team_id,round_key' }
      );

    if (winErr) {
      console.error(`[ESPN Sync] Error upserting winner ${game.winnerName}:`, winErr);
    } else {
      winStatus === 201 ? inserted++ : updated++;
    }

    // Upsert loser as 'lost'
    const { error: loseErr, status: loseStatus } = await supabase
      .from('tournament_results')
      .upsert(
        {
          session_id: sessionId,
          team_id: game.loserId,
          round_key: game.roundKey,
          result: 'lost',
          entered_by: null,
          entered_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,team_id,round_key' }
      );

    if (loseErr) {
      console.error(`[ESPN Sync] Error upserting loser ${game.loserName}:`, loseErr);
    } else {
      loseStatus === 201 ? inserted++ : updated++;
    }
  }

  // Update session tournament_status if we have results
  if (inserted > 0 || updated > 0) {
    await supabase
      .from('auction_sessions')
      .update({ tournament_status: 'in_progress' })
      .eq('id', sessionId)
      .eq('tournament_status', 'pre_tournament');

    // Broadcast bulk update so connected clients update in real-time
    const updates = games.flatMap(g => [
      { teamId: g.winnerId, roundKey: g.roundKey, result: 'won' as const },
      { teamId: g.loserId, roundKey: g.roundKey, result: 'lost' as const },
    ]);
    await broadcastToChannel(`auction:${sessionId}`, 'RESULTS_BULK_UPDATED', { updates });
  }

  return {
    message: `Synced ${games.length} games`,
    games: games.map(g => `${g.winnerName} def. ${g.loserName} (${g.roundKey})`),
    inserted,
    updated,
  };
}
