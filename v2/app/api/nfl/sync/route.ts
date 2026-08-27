import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import { listSyncEligibleTournaments, getTournament } from '@/lib/tournaments/registry';
import { parseStandings, computeSeasonResults } from '@/lib/espn/nfl';
import type { NflSyncResultRow } from '@/lib/espn/nfl';
import { fetchStandings } from '@/lib/espn/nfl-client';

/**
 * POST /api/nfl/sync — ESPN NFL standings → tournament_results.
 *
 * Modes (mirrors /api/soccer/sync):
 * 1. Vercel Cron — Authorization: Bearer <CRON_SECRET>; syncs ALL active
 *    sessions of every sync-eligible NFL tournament.
 * 2. Commissioner — body { sessionId }; the "Sync Scores" button. UNLIKE the
 *    soccer and golf routes, this one actually authenticates: see the gate
 *    below. Those two allow any caller who knows a session UUID to force a
 *    sync, despite middleware.ts allowlisting them as "they handle their own
 *    auth". Do not copy that hole into new routes.
 *
 * SCOPE — weekly wins only. This phase writes the `regularSeasonWins` running
 * total and nothing else. `divisionWinner`, `playoffBerth` and the playoff
 * ladder are all gated on regular-season completeness (a full weeks 1-18
 * sweep, not a game count — 2022 played 271) and land in a later phase.
 * `computeSeasonResults` keeps division grading behind an explicit
 * `seasonComplete` option, which is deliberately NOT passed here.
 *
 * Idempotent upserts on (session_id, team_id, round_key); never writes
 * 'pending'.
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  if (isCronRequest(req)) return await syncAllNflSessions(supabase);

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // ── Auth gate (pattern from actions/tournament-results.ts) ──────────────
  // The user client reads the caller's cookies; writes below still go through
  // the admin client because system rows need `entered_by: null`, which RLS
  // will not accept from a user session.
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: session, error } = await supabase
    .from('auction_sessions')
    .select('id, tournament_id, commissioner_id')
    .eq('id', body.sessionId)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const tournament = getTournament(session.tournament_id);
  if (!tournament || tournament.config.sport !== 'nfl') {
    return NextResponse.json({ error: 'Not an NFL tournament session' }, { status: 400 });
  }

  const rows = await computeTournamentRows(session.tournament_id);
  if ('error' in rows) return NextResponse.json(rows, { status: 502 });
  const result = await writeSessionResults(supabase, session.id, rows.rows);
  return NextResponse.json(result);
}

// Vercel Cron uses GET by default.
export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return await syncAllNflSessions(createAdminClient());
}

/**
 * `header === \`Bearer ${process.env.CRON_SECRET}\`` — the shape the other sync
 * routes use — matches the literal string 'Bearer undefined' when the secret is
 * unset, handing cron privileges to anyone who sends it. Require the secret to
 * exist first.
 */
function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Fetch ESPN once per tournament and compute the decidable row set. */
async function computeTournamentRows(
  tournamentId: string
): Promise<{ rows: NflSyncResultRow[] } | { error: string }> {
  const tournament = getTournament(tournamentId);
  if (!tournament) return { error: `Unknown tournament ${tournamentId}` };
  try {
    // From the CONFIG, never `new Date().getFullYear()`. In January 2027 the
    // wall-clock year is 2027 but the 2026 NFL season is still ESPN season
    // 2026 — a clock-year call would ask for an unplayed season and settle
    // everyone at zero, mid-playoffs.
    const seasonYear = Number(tournament.config.startDate.slice(0, 4));
    if (!Number.isInteger(seasonYear)) {
      return { error: `Bad startDate on ${tournamentId}: ${tournament.config.startDate}` };
    }

    const standings = parseStandings(await fetchStandings(seasonYear));

    // seasonType is NOT top-level in the ESPN payload — it hangs off each
    // division node, and parseStandings hoists it. Reading it from raw JSON
    // gives `undefined` and would reject every run. This is defence in depth:
    // `computeSeasonResults` asserts it too, and `&seasontype=2` on the
    // request is the primary guard. Preseason records are real numbers in the
    // same shape as regular-season ones, so nothing downstream would notice.
    if (standings.seasonType !== 2) {
      return {
        error:
          `ESPN returned seasonType ${standings.seasonType} for ${seasonYear} — ` +
          'refusing to settle anything but the regular season (2).',
      };
    }

    // No `seasonComplete` — weekly wins only this phase.
    return { rows: computeSeasonResults(standings, tournament.teams) };
  } catch (err) {
    return { error: `ESPN fetch failed: ${err}` };
  }
}

async function syncAllNflSessions(supabase: ReturnType<typeof createAdminClient>) {
  // Registry-driven discovery by SPORT, not by `matchesTournamentEvent`:
  // ESPN's NFL feed is league-wide, so there is no upstream event name to
  // match against `liveSyncMatchers` (that flag is inert for this sport).
  //
  // graceDays: 2, not 1 — endDate 2027-02-14 flips the phase to `completed` at
  // 2027-02-15T00:00Z, roughly 3.5 hours BEFORE Super Bowl LXI ends.
  const nfl = listSyncEligibleTournaments(2).filter((t) => t.config.sport === 'nfl');
  if (nfl.length === 0) {
    return NextResponse.json({ message: 'No sync-eligible NFL tournaments', synced: 0 });
  }

  const summaries = [];
  for (const tournament of nfl) {
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
      summaries.push({ tournamentId: tournament.config.id, sessionId: session.id, ...result });
    }
  }
  return NextResponse.json({ message: `Synced ${summaries.length} sessions`, results: summaries });
}

async function writeSessionResults(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  rows: NflSyncResultRow[]
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
        // Without this the wins round pays every team exactly 1 — no other
        // writer in the codebase sets this column, so soccer's payload copied
        // verbatim would look correct and settle wrong.
        result_count: row.resultCount ?? null,
        entered_by: null, // system-entered (ESPN)
        entered_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,team_id,round_key' }
    );
    if (error) {
      console.error(`[NFL Sync] upsert failed team ${row.teamId} ${row.roundKey}:`, error);
    } else if (status === 201) {
      inserted++;
    } else {
      updated++;
    }
  }

  // This is a WRITE-SUCCESS gate, not a change signal: the wins round is a
  // running total re-upserted every week, so "nothing changed" is a state these
  // counters cannot express and must never be inferred from them. What they can
  // tell us is that every upsert failed — in which case broadcasting a full set
  // of results the DB does not hold would paint wins that vanish on reload.
  if (inserted === 0 && updated === 0) {
    return { error: 'All result upserts failed — see server logs', inserted, updated };
  }

  await supabase
    .from('auction_sessions')
    .update({ tournament_status: 'in_progress' })
    .eq('id', sessionId)
    .eq('tournament_status', 'pre_tournament');

  await broadcastToChannel(`auction:${sessionId}`, 'RESULTS_BULK_UPDATED', {
    updates: rows.map((r) => ({
      teamId: r.teamId,
      roundKey: r.roundKey,
      result: r.result,
      // Additive — existing consumers that don't read it are unaffected.
      resultCount: r.resultCount ?? null,
    })),
  });

  // `matched` feeds the dashboard's "Synced N teams" message.
  return { message: `Synced ${rows.length} result rows`, matched: rows.length, inserted, updated };
}
