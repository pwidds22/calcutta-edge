import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import { listSyncEligibleTournaments, getTournament } from '@/lib/tournaments/registry';
import {
  parseScoreboard,
  computeGroupResults,
  computeKnockoutResults,
  computeGroupProps,
} from '@/lib/espn/soccer';
import type { SyncResultRow } from '@/lib/espn/soccer';
import { fetchScoreboardWindow } from '@/lib/espn/soccer-client';
import { dedupeBy } from '@/lib/auction/winning-bids';

type GroupProps = { worstGroupDiff: number | null; bestGroupDiff: number | null };
type TournamentEntry = NonNullable<ReturnType<typeof getTournament>>;

/**
 * POST /api/soccer/sync — ESPN World Cup results → tournament_results.
 *
 * Modes (mirrors /api/espn/sync):
 * 1. Vercel Cron — Authorization: Bearer <CRON_SECRET>; syncs ALL active
 *    sessions of every sync-eligible soccer tournament.
 * 2. Commissioner — body { sessionId }; the "Sync Scores" button.
 *
 * Group rows (winGroup/r32 incl. best-8-thirds) come from computeGroupResults;
 * knockout rows from computeKnockoutResults. Idempotent upserts on
 * (session_id, team_id, round_key); never writes 'pending'.
 */
export async function POST(req: NextRequest) {
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  const supabase = createAdminClient();

  if (isCron) return await syncAllSoccerSessions(supabase);

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from('auction_sessions')
    .select('id, tournament_id')
    .eq('id', body.sessionId)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  const tournament = getTournament(session.tournament_id);
  if (!tournament || tournament.config.sport !== 'soccer') {
    return NextResponse.json({ error: 'Not a soccer tournament session' }, { status: 400 });
  }

  const rows = await computeTournamentRows(session.tournament_id);
  if ('error' in rows) return NextResponse.json(rows, { status: 502 });
  const result = await writeSessionResults(supabase, session.id, rows.rows);
  const props = await writeSessionProps(supabase, session.id, rows.groupProps, tournament);
  return NextResponse.json({ ...result, ...props });
}

// Vercel Cron uses GET by default.
export async function GET(req: NextRequest) {
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return await syncAllSoccerSessions(createAdminClient());
}

/** Fetch ESPN once per tournament and compute the full decidable row set + group props. */
async function computeTournamentRows(
  tournamentId: string
): Promise<{ rows: SyncResultRow[]; groupProps: GroupProps } | { error: string }> {
  const tournament = getTournament(tournamentId);
  if (!tournament) return { error: `Unknown tournament ${tournamentId}` };
  try {
    const start = new Date(tournament.config.startDate + 'T00:00:00Z');
    const end = new Date(); // results only — no need for future fixtures
    const espn = await fetchScoreboardWindow(start, end);
    const matches = parseScoreboard(espn, tournament.teams);
    const rows = [
      ...computeGroupResults(matches, tournament.teams),
      ...computeKnockoutResults(matches),
    ];
    const groupProps = computeGroupProps(matches, tournament.teams);
    return { rows, groupProps };
  } catch (err) {
    return { error: `ESPN fetch failed: ${err}` };
  }
}

/**
 * Auto-grade group-stage props (worstGroupDiff / bestGroupDiff) once the group
 * stage is complete. Each goes to whoever owns the min/max-GD nation. Only grades
 * props ENABLED in the session; idempotent (skips a prop already in prop_results,
 * so it never clobbers a manual entry or re-grades on the next sync). topScoringTeam
 * is tournament-wide and is NOT graded here.
 */
async function writeSessionProps(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  groupProps: GroupProps,
  tournament: TournamentEntry
): Promise<{ propsGraded: number }> {
  const candidates = [
    { key: 'worstGroupDiff', teamId: groupProps.worstGroupDiff },
    { key: 'bestGroupDiff', teamId: groupProps.bestGroupDiff },
  ].filter((c) => c.teamId != null);
  if (candidates.length === 0) return { propsGraded: 0 };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('settings, prop_results')
    .eq('id', sessionId)
    .single();
  if (!session) return { propsGraded: 0 };

  const enabled = ((session.settings as { enabledProps?: Array<{ key: string; label: string; percentage: number }> } | null)?.enabledProps) ?? [];
  const propResults = Array.isArray(session.prop_results) ? [...session.prop_results] : [];
  const gradedKeys = new Set(propResults.map((r: { key: string }) => r.key));

  // Team → owner (deduped winning bids).
  const { data: rawBids } = await supabase
    .from('auction_bids')
    .select('team_id, bidder_id, created_at')
    .eq('session_id', sessionId)
    .eq('is_winning_bid', true)
    .order('created_at', { ascending: true });
  const ownerByTeam = new Map<number, string>();
  for (const b of dedupeBy(rawBids ?? [], (x) => x.team_id)) ownerByTeam.set(b.team_id, b.bidder_id);

  const added: Array<Record<string, unknown>> = [];
  for (const c of candidates) {
    const cfg = enabled.find((e) => e.key === c.key);
    if (!cfg) continue; // prop not enabled in this league
    if (gradedKeys.has(c.key)) continue; // already graded — idempotent
    const ownerId = ownerByTeam.get(c.teamId as number);
    if (!ownerId) continue; // nation unsold — no winner to award
    const teamName = tournament.teams.find((t) => t.id === c.teamId)?.name ?? `Team ${c.teamId}`;
    const entry = {
      key: c.key,
      label: cfg.label,
      winnerParticipantId: ownerId,
      winnerTeamId: c.teamId as number,
      winners: [{ participantId: ownerId, teamId: c.teamId as number }],
      metadata: teamName,
      payoutPercentage: cfg.percentage,
    };
    propResults.push(entry);
    added.push(entry);
  }
  if (added.length === 0) return { propsGraded: 0 };

  await supabase.from('auction_sessions').update({ prop_results: propResults }).eq('id', sessionId);
  for (const entry of added) {
    await broadcastToChannel(`auction:${sessionId}`, 'PROP_RESULT_UPDATED', entry);
  }
  return { propsGraded: added.length };
}

async function syncAllSoccerSessions(supabase: ReturnType<typeof createAdminClient>) {
  // Registry-driven discovery: live soccer tournaments + 1-day post-end grace
  // (same pattern as golf — the final may settle after the phase flips).
  const soccer = listSyncEligibleTournaments(1).filter((t) => t.config.sport === 'soccer');
  if (soccer.length === 0) {
    return NextResponse.json({ message: 'No sync-eligible soccer tournaments', synced: 0 });
  }

  const summaries = [];
  for (const tournament of soccer) {
    const rows = await computeTournamentRows(tournament.config.id);
    if ('error' in rows) {
      summaries.push({ tournamentId: tournament.config.id, ...rows });
      continue;
    }
    if (rows.rows.length === 0) {
      summaries.push({ tournamentId: tournament.config.id, message: 'No decidable results yet' });
      continue;
    }

    const { data: sessions, error } = await supabase
      .from('auction_sessions')
      .select('id')
      .eq('tournament_id', tournament.config.id)
      .eq('status', 'completed')
      .in('tournament_status', ['pre_tournament', 'in_progress']);
    if (error) {
      summaries.push({ tournamentId: tournament.config.id, error: error.message });
      continue;
    }

    for (const session of sessions ?? []) {
      const result = await writeSessionResults(supabase, session.id, rows.rows);
      const props = await writeSessionProps(supabase, session.id, rows.groupProps, tournament);
      summaries.push({ tournamentId: tournament.config.id, sessionId: session.id, ...result, ...props });
    }
  }
  return NextResponse.json({ message: `Synced ${summaries.length} sessions`, results: summaries });
}

async function writeSessionResults(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  rows: SyncResultRow[]
) {
  if (rows.length === 0) return { message: 'No decidable results yet', inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const { error, status } = await supabase.from('tournament_results').upsert(
      {
        session_id: sessionId,
        team_id: row.teamId,
        round_key: row.roundKey,
        result: row.result,
        entered_by: null, // system-entered (ESPN)
        entered_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,team_id,round_key' }
    );
    if (error) {
      console.error(`[Soccer Sync] upsert failed team ${row.teamId} ${row.roundKey}:`, error);
    } else if (status === 201) {
      inserted++;
    } else {
      updated++;
    }
  }

  if (inserted > 0 || updated > 0) {
    await supabase
      .from('auction_sessions')
      .update({ tournament_status: 'in_progress' })
      .eq('id', sessionId)
      .eq('tournament_status', 'pre_tournament');

    await broadcastToChannel(`auction:${sessionId}`, 'RESULTS_BULK_UPDATED', {
      updates: rows.map((r) => ({ teamId: r.teamId, roundKey: r.roundKey, result: r.result })),
    });
  }
  // `matched` feeds the dashboard's "Synced N games" message (data.matched fallback).
  return { message: `Synced ${rows.length} result rows`, matched: rows.length, inserted, updated };
}
