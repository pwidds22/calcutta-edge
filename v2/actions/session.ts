'use server';

import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import { getTournament, isHostable } from '@/lib/tournaments/registry';
import { getUnbundledTeams } from '@/lib/tournaments/bundles';
import type { PayoutRules } from '@/lib/tournaments/types';
import type { SessionSettings } from '@/lib/auction/live/types';

/**
 * Parse team_order from DB (text[]) back to (number | string)[].
 * Numeric strings become numbers; bundle IDs (e.g. "b:playin-East-16") stay as strings.
 */
function parseTeamOrder(raw: string[] | null): (number | string)[] {
  if (!raw) return [];
  return raw.map((item) => {
    if (typeof item === 'string' && !item.startsWith('b:')) {
      const n = Number(item);
      if (!isNaN(n)) return n;
    }
    return item;
  });
}

/** SHA-256 hash for session passwords (room access codes, not user credentials) */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// 6-char code using unambiguous characters (no I/O/1/0)
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createSession(input: {
  tournamentId: string;
  name: string;
  payoutRules: PayoutRules;
  estimatedPotSize: number;
  settings?: SessionSettings;
  password?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const tournament = getTournament(input.tournamentId);
  if (!tournament) return { error: 'Invalid tournament' };
  if (!isHostable(tournament.config)) return { error: 'Hosting for this tournament is not open yet' };

  // Generate unique join code (retry on collision)
  const admin = createAdminClient();
  let joinCode = generateJoinCode();
  let codeIsUnique = false;
  for (let attempts = 0; attempts < 5; attempts++) {
    const { data: existing } = await admin
      .from('auction_sessions')
      .select('id')
      .eq('join_code', joinCode)
      .single();
    if (!existing) {
      codeIsUnique = true;
      break;
    }
    joinCode = generateJoinCode();
  }
  if (!codeIsUnique) {
    return { error: 'Could not generate unique join code. Please try again.' };
  }

  // Build team order: unbundled team IDs + bundle IDs (prefixed with b:)
  // All values stored as strings in text[] column
  const bundles = input.settings?.bundles ?? [];
  const unbundledTeams = getUnbundledTeams(tournament.teams, bundles);
  const teamOrder: string[] = [
    ...unbundledTeams.map((t) => String(t.id)),
    ...bundles.map((b) => `b:${b.id}`),
  ];

  const { data: session, error } = await supabase
    .from('auction_sessions')
    .insert({
      join_code: joinCode,
      tournament_id: input.tournamentId,
      commissioner_id: user.id,
      name: input.name,
      payout_rules: input.payoutRules,
      estimated_pot_size: input.estimatedPotSize,
      team_order: teamOrder,
      status: 'lobby',
      settings: input.settings ?? {},
      password_hash: input.password ? hashPassword(input.password) : null,
    })
    .select('id, join_code')
    .single();

  if (error) return { error: error.message };

  // Add commissioner as first participant
  await supabase.from('auction_participants').insert({
    session_id: session.id,
    user_id: user.id,
    display_name: user.email?.split('@')[0] ?? 'Commissioner',
    is_commissioner: true,
  });

  return { sessionId: session.id, joinCode: session.join_code };
}

export async function joinSession(joinCode: string, displayName: string, password?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!displayName.trim()) return { error: 'Display name is required' };

  // Case-insensitive join code lookup
  const { data: session, error: lookupError } = await supabase
    .from('auction_sessions')
    .select('id, status, name, password_hash')
    .eq('join_code', joinCode.toUpperCase().trim())
    .single();

  if (lookupError || !session) return { error: 'Invalid join code' };
  if (session.status === 'completed') return { error: 'This auction has ended' };

  // Check if already joined FIRST — returning participants skip password re-entry
  const { data: existing } = await supabase
    .from('auction_participants')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return { sessionId: session.id, name: session.name };
  }

  // Validate password if session has one (only for new participants)
  if (session.password_hash) {
    if (!password) return { error: 'This session requires a password' };
    if (hashPassword(password) !== session.password_hash) {
      return { error: 'Incorrect password' };
    }
  }

  const { error: joinError } = await supabase
    .from('auction_participants')
    .insert({
      session_id: session.id,
      user_id: user.id,
      display_name: displayName.trim(),
      is_commissioner: false,
    });

  if (joinError) return { error: joinError.message };
  return { sessionId: session.id, name: session.name };
}

export async function getSessionState(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Load session
  const { data: session, error } = await supabase
    .from('auction_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) return { error: 'Session not found' };

  // Parse team_order from text[] back to (number | string)[]
  session.team_order = parseTeamOrder(session.team_order);

  // Load participants
  const { data: participants } = await supabase
    .from('auction_participants')
    .select('id, user_id, display_name, is_commissioner, joined_at')
    .eq('session_id', sessionId)
    .order('joined_at', { ascending: true });

  // Load winning bids (sold teams)
  const { data: winningBids } = await supabase
    .from('auction_bids')
    .select('team_id, bidder_id, amount, created_at')
    .eq('session_id', sessionId)
    .eq('is_winning_bid', true)
    .order('created_at', { ascending: true });

  // Load current team's bid history
  const currentOrderItem = session.team_order?.[session.current_team_idx];
  let currentBids: Array<{
    bidder_id: string;
    amount: number;
    created_at: string;
  }> = [];
  if (currentOrderItem != null && session.status === 'active') {
    // For bundles, bids are tracked against the first member team
    let bidTeamId: number | null = null;
    if (typeof currentOrderItem === 'string' && currentOrderItem.startsWith('b:')) {
      const bundleId = currentOrderItem.slice(2);
      const settings = session.settings as SessionSettings | null;
      const bundle = settings?.bundles?.find((b: { id: string }) => b.id === bundleId);
      bidTeamId = bundle?.teamIds?.[0] ?? null;
    } else if (typeof currentOrderItem === 'number') {
      bidTeamId = currentOrderItem;
    }

    if (bidTeamId != null) {
      const { data } = await supabase
        .from('auction_bids')
        .select('bidder_id, amount, created_at')
        .eq('session_id', sessionId)
        .eq('team_id', bidTeamId)
        .order('created_at', { ascending: true });
      currentBids = data ?? [];
    }
  }

  const isCommissioner = session.commissioner_id === user.id;

  // Load tournament results (for post-auction tournament lifecycle)
  const { data: tournamentResults } = await supabase
    .from('tournament_results')
    .select('team_id, round_key, result')
    .eq('session_id', sessionId);

  // Check payment status for strategy overlay
  const { data: profile } = await supabase
    .from('profiles')
    .select('has_paid')
    .eq('id', user.id)
    .single();

  // Build display name lookup for bid history
  const participantMap: Record<string, string> = {};
  for (const p of participants ?? []) {
    participantMap[p.user_id] = p.display_name;
  }

  return {
    session,
    participants: participants ?? [],
    participantMap,
    winningBids: winningBids ?? [],
    currentBids,
    tournamentResults: (tournamentResults ?? []) as Array<{
      team_id: number;
      round_key: string;
      result: 'won' | 'lost' | 'pending';
    }>,
    isCommissioner,
    hasPaid: profile?.has_paid ?? false,
    userId: user.id,
  };
}

export async function updateTeamOrder(
  sessionId: string,
  teamOrderInput: (number | string)[]
) {
  // Convert to string[] for text[] column
  const teamOrder = teamOrderInput.map(String);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }
  if (session.status !== 'lobby') {
    return { error: 'Can only reorder teams before auction starts' };
  }

  const { error } = await supabase
    .from('auction_sessions')
    .update({ team_order: teamOrder })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  // Broadcast to connected clients
  await broadcastToChannel(`auction:${sessionId}`, 'TEAM_ORDER_UPDATED', {
    teamOrder,
  });

  return { success: true };
}

export async function updateSessionSettings(
  sessionId: string,
  updates: {
    payoutRules?: PayoutRules;
    estimatedPotSize?: number;
    settings?: Partial<SessionSettings>;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status, settings, payout_rules, estimated_pot_size')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }
  if (session.status !== 'lobby') {
    return { error: 'Settings can only be changed before the auction starts' };
  }

  // Merge settings (preserve bundles and other fields not being edited)
  const currentSettings = (session.settings ?? {}) as SessionSettings;
  const mergedSettings: SessionSettings = {
    ...currentSettings,
    ...(updates.settings ?? {}),
  };

  const dbUpdate: Record<string, unknown> = { settings: mergedSettings };
  if (updates.payoutRules !== undefined) dbUpdate.payout_rules = updates.payoutRules;
  if (updates.estimatedPotSize !== undefined) dbUpdate.estimated_pot_size = updates.estimatedPotSize;

  const { error } = await supabase
    .from('auction_sessions')
    .update(dbUpdate)
    .eq('id', sessionId);

  if (error) return { error: error.message };

  // Broadcast to all participants
  await broadcastToChannel(`auction:${sessionId}`, 'SETTINGS_UPDATED', {
    settings: mergedSettings,
    payoutRules: updates.payoutRules ?? session.payout_rules,
    estimatedPotSize: updates.estimatedPotSize ?? session.estimated_pot_size,
  });

  return { success: true };
}

export async function deleteSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify commissioner ownership
  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status')
    .eq('id', sessionId)
    .single();

  if (!session) return { error: 'Session not found' };
  if (session.commissioner_id !== user.id) return { error: 'Not authorized' };
  if (session.status === 'active') {
    return { error: 'Cannot delete an active auction. Pause or complete it first.' };
  }

  // CASCADE will auto-delete participants + bids
  const { error } = await supabase
    .from('auction_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function getMyHostedSessions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sessions: [], joined: [] };

  // Sessions I created (include participant count)
  const { data: hosted } = await supabase
    .from('auction_sessions')
    .select('id, name, join_code, status, tournament_id, created_at, password_hash, auction_participants(count)')
    .eq('commissioner_id', user.id)
    .order('created_at', { ascending: false });

  // Sessions I joined (not as commissioner)
  const { data: participations } = await supabase
    .from('auction_participants')
    .select('session_id')
    .eq('user_id', user.id)
    .eq('is_commissioner', false);

  let joined: typeof hosted = [];
  if (participations && participations.length > 0) {
    const sessionIds = participations.map((p) => p.session_id);
    const { data } = await supabase
      .from('auction_sessions')
      .select('id, name, join_code, status, tournament_id, created_at, password_hash, auction_participants(count)')
      .in('id', sessionIds)
      .order('created_at', { ascending: false });
    joined = data ?? [];
  }

  // Flatten participant counts
  const flatten = (sessions: typeof hosted) =>
    (sessions ?? []).map((s) => ({
      ...s,
      participant_count:
        (s.auction_participants as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
    }));

  return { sessions: flatten(hosted), joined: flatten(joined) };
}

/** Check if a session requires a password (for join form UI) */
export async function leaveSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify participant exists and is NOT the commissioner
  const { data: participant } = await supabase
    .from('auction_participants')
    .select('id, is_commissioner')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!participant) return { error: 'Not a participant' };
  if (participant.is_commissioner) return { error: 'Commissioner cannot leave their own auction' };

  // Only allow leaving in lobby or completed state
  const { data: session } = await supabase
    .from('auction_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) return { error: 'Session not found' };
  if (session.status === 'active') {
    return { error: 'Cannot leave during an active auction' };
  }

  const { error } = await supabase
    .from('auction_participants')
    .delete()
    .eq('id', participant.id);

  if (error) return { error: error.message };

  await broadcastToChannel(`auction:${sessionId}`, 'PARTICIPANT_LEFT', {
    userId: user.id,
  });

  return { success: true };
}

export async function kickParticipant(sessionId: string, targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify caller is commissioner
  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id) {
    return { error: 'Not authorized' };
  }
  if (session.status !== 'lobby') {
    return { error: 'Can only remove participants before the auction starts' };
  }

  if (targetUserId === user.id) {
    return { error: 'Cannot remove yourself' };
  }

  const { error } = await supabase
    .from('auction_participants')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', targetUserId);

  if (error) return { error: error.message };

  await broadcastToChannel(`auction:${sessionId}`, 'PARTICIPANT_KICKED', {
    userId: targetUserId,
  });

  return { success: true };
}

export async function checkSessionRequiresPassword(joinCode: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('id, password_hash')
    .eq('join_code', joinCode.toUpperCase().trim())
    .single();

  if (!session) return { requiresPassword: false };
  return { requiresPassword: !!session.password_hash };
}
