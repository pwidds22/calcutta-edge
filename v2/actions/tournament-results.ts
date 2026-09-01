'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchAllPages } from '@/lib/supabase/fetch-all';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import { normalizeResultCount } from '@/lib/auction/live/unit-entry';
import type { PropWinner } from '@/lib/tournaments/props';

export interface TournamentResult {
  team_id: number;
  round_key: string;
  result: 'won' | 'lost' | 'pending';
  /** Units won, for flat-rate rounds. NULL/undefined means 1. */
  result_count?: number | null;
}

/**
 * Fetch all tournament results for a session.
 */
export async function getTournamentResults(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Bounded by teams × rounds, but that's config-driven and already ~780 for
  // PGA (156 golfers × 5 rounds) — close enough to PostgREST's silent
  // 1,000-row cap that the next big-field config would cross it. Page it.
  try {
    const data = await fetchAllPages<TournamentResult>((from, to) =>
      supabase
        .from('tournament_results')
        .select('team_id, round_key, result, result_count')
        .eq('session_id', sessionId)
        .order('id')
        .range(from, to)
    );
    return { results: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load results' };
  }
}

/**
 * Commissioner upserts a single result (won/lost/pending).
 * Uses ON CONFLICT to handle both insert and update.
 */
export async function updateResult(
  sessionId: string,
  teamId: number,
  roundKey: string,
  result: 'won' | 'lost' | 'pending',
  resultCount?: number | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify user is commissioner
  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }

  // Upsert the result
  const { error } = await supabase.from('tournament_results').upsert(
    {
      session_id: sessionId,
      team_id: teamId,
      round_key: roundKey,
      result,
      result_count: normalizeResultCount(result, resultCount),
      entered_by: user.id,
      entered_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,team_id,round_key' }
  );

  if (error) return { error: error.message };

  // Update tournament status if needed
  if (result !== 'pending') {
    await supabase
      .from('auction_sessions')
      .update({ tournament_status: 'in_progress' })
      .eq('id', sessionId)
      .eq('tournament_status', 'pre_tournament');
  }

  // Broadcast to all connected participants
  await broadcastToChannel(`auction:${sessionId}`, 'RESULT_UPDATED', {
    teamId,
    roundKey,
    result,
    resultCount: normalizeResultCount(result, resultCount),
  });

  return { success: true };
}

/**
 * Commissioner bulk-updates results for a round.
 * Used when marking multiple teams at once.
 */
export async function bulkUpdateResults(
  sessionId: string,
  updates: Array<{
    teamId: number;
    roundKey: string;
    result: 'won' | 'lost' | 'pending';
    resultCount?: number | null;
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify commissioner
  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }

  const now = new Date().toISOString();

  // Normalize ONCE, then write and broadcast the same shape. Emitting the raw
  // `updates` array let a 'pending' update carrying a count push that count to
  // every client while the DB stored null — a write-shape/read-shape divergence.
  const normalized = updates.map((u) => ({
    teamId: u.teamId,
    roundKey: u.roundKey,
    result: u.result,
    resultCount: normalizeResultCount(u.result, u.resultCount),
  }));

  const rows = normalized.map((u) => ({
    session_id: sessionId,
    team_id: u.teamId,
    round_key: u.roundKey,
    result: u.result,
    result_count: u.resultCount,
    entered_by: user.id,
    entered_at: now,
  }));

  const { error } = await supabase
    .from('tournament_results')
    .upsert(rows, { onConflict: 'session_id,team_id,round_key' });

  if (error) return { error: error.message };

  // Update tournament status
  await supabase
    .from('auction_sessions')
    .update({ tournament_status: 'in_progress' })
    .eq('id', sessionId)
    .eq('tournament_status', 'pre_tournament');

  // Broadcast bulk update
  await broadcastToChannel(`auction:${sessionId}`, 'RESULTS_BULK_UPDATED', {
    updates: normalized,
  });

  return { success: true };
}

/**
 * Commissioner upserts a prop bet result.
 * Stores in the `prop_results` JSONB column on `auction_sessions`.
 */
export async function updatePropResult(
  sessionId: string,
  propKey: string,
  propLabel: string,
  winnerParticipantId: string,
  winnerTeamId: number | null,
  metadata: string,
  payoutPercentage: number,
  winners?: PropWinner[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify commissioner
  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, prop_results')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }

  // Read current prop_results, upsert the entry
  const currentResults: Array<{
    key: string;
    label: string;
    winnerParticipantId: string | null;
    winnerTeamId: number | null;
    winners?: PropWinner[];
    metadata: string;
    payoutPercentage: number;
  }> = Array.isArray(session.prop_results) ? session.prop_results : [];

  const idx = currentResults.findIndex((r) => r.key === propKey);
  const entry = {
    key: propKey,
    label: propLabel,
    winnerParticipantId,
    winnerTeamId,
    winners,
    metadata,
    payoutPercentage,
  };

  if (idx >= 0) {
    currentResults[idx] = entry;
  } else {
    currentResults.push(entry);
  }

  const { error } = await supabase
    .from('auction_sessions')
    .update({ prop_results: currentResults })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  // Broadcast to all connected participants
  await broadcastToChannel(`auction:${sessionId}`, 'PROP_RESULT_UPDATED', {
    propKey,
    propLabel,
    winnerParticipantId,
    winnerTeamId,
    winners,
    metadata,
    payoutPercentage,
  });

  return { success: true };
}

/**
 * Fetch payment tracking state for a session.
 */
export async function getPaymentTracking(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('auction_sessions')
    .select('payment_tracking')
    .eq('id', sessionId)
    .single();

  if (error) return { error: error.message };
  return { paymentTracking: (data?.payment_tracking ?? {}) as Record<string, boolean> };
}

/**
 * Commissioner marks a payment as paid/unpaid.
 * paymentKey format: "fromUserId->toUserId"
 */
export async function markPayment(
  sessionId: string,
  paymentKey: string,
  paid: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify commissioner
  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, payment_tracking')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }

  // Read current tracking, update the specific payment
  const tracking: Record<string, boolean> = (session.payment_tracking as Record<string, boolean>) ?? {};
  if (paid) {
    tracking[paymentKey] = true;
  } else {
    delete tracking[paymentKey];
  }

  const { error } = await supabase
    .from('auction_sessions')
    .update({ payment_tracking: tracking })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  // Broadcast to all connected participants
  await broadcastToChannel(`auction:${sessionId}`, 'PAYMENT_UPDATED', {
    paymentKey,
    paid,
    paymentTracking: tracking,
  });

  return { success: true };
}

/**
 * Mark the tournament as settled (all results entered, final payouts calculated).
 */
export async function settleTournament(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }

  const { error } = await supabase
    .from('auction_sessions')
    .update({ tournament_status: 'settled' })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  await broadcastToChannel(`auction:${sessionId}`, 'TOURNAMENT_SETTLED', {});

  return { success: true };
}
