'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcastToChannel } from '@/lib/supabase/broadcast';
import type { SessionSettings } from '@/lib/auction/live/types';

/**
 * Parse team_order from DB (text[]) back to (number | string)[].
 * Numeric strings become numbers; bundle IDs (e.g. "b:playin-East-16") stay as strings.
 */
function parseTeamOrder(raw: unknown): (number | string)[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    const s = String(item);
    if (s.startsWith('b:')) return s;
    const n = Number(s);
    return isNaN(n) ? s : n;
  });
}

function channelName(sessionId: string) {
  return `auction:${sessionId}`;
}

/**
 * Helper: open bidding + start timer on the current team.
 * Used by auto-mode after start/sell/skip to keep the auction flowing.
 * Uses admin client to bypass RLS (called from within other server actions).
 */
async function autoOpenBidding(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  settings: SessionSettings | null
) {
  await admin
    .from('auction_sessions')
    .update({ bidding_status: 'open' })
    .eq('id', sessionId);

  await broadcastToChannel(channelName(sessionId), 'BIDDING_OPEN', {});

  // Start timer
  if (settings?.timer?.enabled) {
    const durationMs = settings.timer.initialDurationSec * 1000;
    const endsAt = new Date(Date.now() + durationMs).toISOString();

    await admin
      .from('auction_sessions')
      .update({ timer_ends_at: endsAt, timer_duration_ms: durationMs })
      .eq('id', sessionId);

    await broadcastToChannel(channelName(sessionId), 'TIMER_START', {
      endsAt,
      durationMs,
    });
  }
}

export async function startAuction(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status, team_order, current_team_idx, settings')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  session.team_order = parseTeamOrder(session.team_order);
  if (session.status !== 'lobby' && session.status !== 'paused')
    return { error: 'Cannot start auction in current state' };
  if (!session.team_order?.length) return { error: 'No teams in order' };

  // When resuming from paused, keep current team position; from lobby, start at 0
  const resumeIdx = session.status === 'paused' ? session.current_team_idx : 0;
  const settings = session.settings as SessionSettings | null;
  const isAutoMode = !!settings?.autoMode;

  // Auto-mode: skip 'waiting' → go directly to 'open' to avoid race condition
  // (two rapid broadcasts can cause the second one to be lost)
  const initialBiddingStatus = isAutoMode ? 'open' : 'waiting';

  // If auto-mode + timer, compute timer end time upfront
  let timerEndsAt: string | null = null;
  let timerDurationMs: number | null = null;
  if (isAutoMode && settings?.timer?.enabled) {
    timerDurationMs = settings.timer.initialDurationSec * 1000;
    timerEndsAt = new Date(Date.now() + timerDurationMs).toISOString();
  }

  const { error } = await supabase
    .from('auction_sessions')
    .update({
      status: 'active',
      current_team_idx: resumeIdx,
      bidding_status: initialBiddingStatus,
      current_highest_bid: 0,
      current_highest_bidder_id: null,
      ...(timerEndsAt ? { timer_ends_at: timerEndsAt, timer_duration_ms: timerDurationMs } : {}),
    })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  await broadcastToChannel(channelName(sessionId), 'AUCTION_STARTED', {
    currentTeamIdx: resumeIdx,
    teamId: session.team_order[resumeIdx],
  });

  // Auto-mode: broadcast open + timer events (DB already has the right state)
  if (isAutoMode) {
    await broadcastToChannel(channelName(sessionId), 'BIDDING_OPEN', {});
    if (timerEndsAt && timerDurationMs) {
      await broadcastToChannel(channelName(sessionId), 'TIMER_START', {
        endsAt: timerEndsAt,
        durationMs: timerDurationMs,
      });
    }
  }

  return { success: true };
}

export async function presentTeam(sessionId: string, teamIdx: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status, team_order, bidding_status')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  session.team_order = parseTeamOrder(session.team_order);
  if (session.status !== 'active') return { error: 'Auction not active' };
  if (session.bidding_status === 'open')
    return { error: 'Close bidding before presenting a new team' };
  if (teamIdx < 0 || teamIdx >= session.team_order.length)
    return { error: 'Invalid team index' };

  const { error } = await supabase
    .from('auction_sessions')
    .update({
      current_team_idx: teamIdx,
      bidding_status: 'waiting',
      current_highest_bid: 0,
      current_highest_bidder_id: null,
    })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  await broadcastToChannel(channelName(sessionId), 'TEAM_PRESENTED', {
    teamIdx,
    teamId: session.team_order[teamIdx],
  });

  return { success: true };
}

export async function openBidding(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status, bidding_status, settings')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  if (session.status !== 'active') return { error: 'Auction not active' };
  if (session.bidding_status !== 'waiting')
    return { error: 'Bidding already open or closed' };

  const { error } = await supabase
    .from('auction_sessions')
    .update({ bidding_status: 'open' })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  await broadcastToChannel(channelName(sessionId), 'BIDDING_OPEN', {});

  // Start timer if enabled
  const settings = session.settings as SessionSettings | null;
  if (settings?.timer?.enabled) {
    const durationMs = settings.timer.initialDurationSec * 1000;
    const endsAt = new Date(Date.now() + durationMs).toISOString();

    // Persist timer to DB for reconnection
    await supabase
      .from('auction_sessions')
      .update({ timer_ends_at: endsAt, timer_duration_ms: durationMs })
      .eq('id', sessionId);

    await broadcastToChannel(channelName(sessionId), 'TIMER_START', {
      endsAt,
      durationMs,
    });
  }

  return { success: true };
}

export async function placeBid(sessionId: string, amount: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate participant
  const { data: participant } = await supabase
    .from('auction_participants')
    .select('id, display_name')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!participant) return { error: 'Not a participant in this session' };

  // Validate session state
  const { data: session } = await supabase
    .from('auction_sessions')
    .select(
      'status, bidding_status, current_highest_bid, team_order, current_team_idx, settings, timer_ends_at'
    )
    .eq('id', sessionId)
    .single();

  if (!session) return { error: 'Session not found' };
  session.team_order = parseTeamOrder(session.team_order);
  if (session.status !== 'active') return { error: 'Auction not active' };
  if (session.bidding_status !== 'open')
    return { error: 'Bidding is not open' };
  if (amount <= 0) return { error: 'Bid must be positive' };

  // Enforce minimum bid floor (from session settings)
  // minimumBid of 0 or undefined = no floor beyond the amount > 0 check above
  const sessionSettings = session.settings as SessionSettings | null;
  const minimumBid = sessionSettings?.minimumBid ?? 0;
  if (minimumBid > 0 && amount < minimumBid) {
    return { error: `Minimum bid is $${minimumBid}` };
  }

  if (amount <= (session.current_highest_bid ?? 0)) {
    return {
      error: `Bid must be higher than $${session.current_highest_bid}`,
    };
  }

  // Resolve team_id for bid tracking — bundles use first member team
  const currentOrderItem = session.team_order[session.current_team_idx];
  let teamId: number;
  if (typeof currentOrderItem === 'string' && currentOrderItem.startsWith('b:')) {
    const bundleId = currentOrderItem.slice(2);
    const settings = session.settings as SessionSettings | null;
    const bundle = settings?.bundles?.find((b: { id: string }) => b.id === bundleId);
    if (!bundle || !bundle.teamIds?.length) return { error: 'Bundle not found' };
    teamId = bundle.teamIds[0];
  } else {
    teamId = currentOrderItem as number;
  }

  const admin = createAdminClient();

  // Atomic conditional update (handles race conditions)
  // The .lt() filter means this only updates if incoming bid > current high bid.
  // If another bid was placed first, this returns count=0 (no rows matched).
  const { error: updateError, count } = await admin
    .from('auction_sessions')
    .update({
      current_highest_bid: amount,
      current_highest_bidder_id: user.id,
    })
    .eq('id', sessionId)
    .eq('bidding_status', 'open')
    .lt('current_highest_bid', amount);

  if (updateError) return { error: updateError.message };

  // If no rows matched, the bid was outpaced by another — reject it
  if (count === 0) {
    return { error: 'Bid must be higher than current high bid' };
  }

  // Insert bid record (only if we won the atomic update)
  await admin.from('auction_bids').insert({
    session_id: sessionId,
    team_id: teamId,
    bidder_id: user.id,
    amount,
    is_winning_bid: false,
  });

  // Broadcast only after confirmed DB update
  await broadcastToChannel(channelName(sessionId), 'NEW_BID', {
    teamId,
    bidderId: user.id,
    bidderName: participant.display_name,
    amount,
  });

  // Reset timer on new bid — only extend if remaining time is LESS than reset duration
  const settings = session.settings as SessionSettings | null;
  if (settings?.timer?.enabled) {
    const resetMs = settings.timer.resetDurationSec * 1000;
    const remainingMs = session.timer_ends_at
      ? new Date(session.timer_ends_at).getTime() - Date.now()
      : 0;

    // Only reset if the clock has less time than the reset window
    if (remainingMs < resetMs) {
      const endsAt = new Date(Date.now() + resetMs).toISOString();

      await admin
        .from('auction_sessions')
        .update({ timer_ends_at: endsAt, timer_duration_ms: resetMs })
        .eq('id', sessionId);

      await broadcastToChannel(channelName(sessionId), 'TIMER_RESET', {
        endsAt,
        durationMs: resetMs,
      });
    }
  }

  return { success: true };
}

export async function closeBidding(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, bidding_status, timer_ends_at, timer_duration_ms')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  if (session.bidding_status !== 'open')
    return { error: 'Bidding is not open' };

  const { error } = await supabase
    .from('auction_sessions')
    .update({ bidding_status: 'closed', timer_ends_at: null, timer_duration_ms: null })
    .eq('id', sessionId);

  if (error) return { error: error.message };

  await broadcastToChannel(channelName(sessionId), 'BIDDING_CLOSED', {});
  await broadcastToChannel(channelName(sessionId), 'TIMER_STOP', {});

  return { success: true };
}

export async function sellTeam(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  session.team_order = parseTeamOrder(session.team_order);
  if (session.bidding_status !== 'closed')
    return { error: 'Close bidding first' };
  if (
    !session.current_highest_bidder_id ||
    session.current_highest_bid <= 0
  ) {
    return { error: 'No bids placed' };
  }

  const currentOrderItem = session.team_order[session.current_team_idx];
  const winnerId = session.current_highest_bidder_id;
  const winAmount = session.current_highest_bid;
  const isBundle = typeof currentOrderItem === 'string' && currentOrderItem.startsWith('b:');

  const admin = createAdminClient();

  // 2. Get winner's display name
  const { data: winnerParticipant } = await admin
    .from('auction_participants')
    .select('display_name')
    .eq('session_id', sessionId)
    .eq('user_id', winnerId)
    .single();

  let bundleTeamIds: number[] | undefined;

  if (isBundle) {
    const bundleId = String(currentOrderItem).slice(2);
    const settings = session.settings as SessionSettings | null;
    const bundle = settings?.bundles?.find((b: { id: string }) => b.id === bundleId);
    if (!bundle) return { error: 'Bundle not found' };

    bundleTeamIds = bundle.teamIds;
    const splitAmount = Math.round(winAmount / bundle.teamIds.length);
    const remainder = winAmount - (splitAmount * bundle.teamIds.length);

    // Bids were tracked against first team — mark winning bid there
    await admin
      .from('auction_bids')
      .update({ is_winning_bid: true })
      .eq('session_id', sessionId)
      .eq('team_id', bundle.teamIds[0])
      .eq('bidder_id', winnerId)
      .eq('amount', winAmount);

    // Record winning bid + sync for each member team
    for (let i = 0; i < bundle.teamIds.length; i++) {
      const memberTeamId = bundle.teamIds[i];
      const amount = i === 0 ? splitAmount + remainder : splitAmount;

      // Insert individual bid records for each member (for settlement/results tracking)
      if (i > 0) {
        await admin.from('auction_bids').insert({
          session_id: sessionId,
          team_id: memberTeamId,
          bidder_id: winnerId,
          amount,
          is_winning_bid: true,
        });
      }

      await syncAuctionData(
        admin,
        sessionId,
        session.tournament_id,
        memberTeamId,
        winnerId,
        amount,
        session.payout_rules,
        session.estimated_pot_size
      );
    }
  } else {
    const teamId = currentOrderItem as number;

    // 1. Mark winning bid
    await admin
      .from('auction_bids')
      .update({ is_winning_bid: true })
      .eq('session_id', sessionId)
      .eq('team_id', teamId)
      .eq('bidder_id', winnerId)
      .eq('amount', winAmount);

    // 3. Auto-sync: update paid participants' auction_data
    await syncAuctionData(
      admin,
      sessionId,
      session.tournament_id,
      teamId,
      winnerId,
      winAmount,
      session.payout_rules,
      session.estimated_pot_size
    );
  }

  // 4. Advance to next team
  const nextIdx = session.current_team_idx + 1;
  const isLastTeam = nextIdx >= session.team_order.length;

  await admin
    .from('auction_sessions')
    .update({
      current_team_idx: isLastTeam ? session.current_team_idx : nextIdx,
      bidding_status: 'waiting',
      current_highest_bid: 0,
      current_highest_bidder_id: null,
      timer_ends_at: null,
      timer_duration_ms: null,
      ...(isLastTeam ? { status: 'completed' } : {}),
    })
    .eq('id', sessionId);

  // 5. Stop timer + broadcast
  await broadcastToChannel(channelName(sessionId), 'TIMER_STOP', {});
  await broadcastToChannel(channelName(sessionId), 'TEAM_SOLD', {
    teamId: isBundle ? bundleTeamIds![0] : (currentOrderItem as number),
    winnerId,
    winnerName: winnerParticipant?.display_name ?? 'Unknown',
    amount: winAmount,
    nextTeamIdx: isLastTeam ? null : nextIdx,
    isComplete: isLastTeam,
    ...(bundleTeamIds ? { bundleTeamIds } : {}),
  });

  if (isLastTeam) {
    await broadcastToChannel(
      channelName(sessionId),
      'AUCTION_COMPLETED',
      {}
    );
  }

  // Auto-mode: open bidding on next team automatically
  const settings = session.settings as SessionSettings | null;
  if (!isLastTeam && settings?.autoMode) {
    await autoOpenBidding(admin, sessionId, settings);
  }

  return { success: true, isComplete: isLastTeam };
}

/** Update each paid participant's auction_data with the sale result */
async function syncAuctionData(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  tournamentId: string,
  teamId: number,
  winnerId: string,
  winAmount: number,
  payoutRules?: Record<string, number>,
  estimatedPotSize?: number
) {
  try {
    const { data: participants } = await admin
      .from('auction_participants')
      .select('user_id')
      .eq('session_id', sessionId);

    if (!participants?.length) return;

    const userIds = participants.map((p) => p.user_id);
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, has_paid')
      .in('id', userIds);

    const paidUsers = profiles?.filter((p) => p.has_paid).map((p) => p.id) ?? [];

    for (const userId of paidUsers) {
      const isWinner = userId === winnerId;

      const { data: existing } = await admin
        .from('auction_data')
        .select('teams')
        .eq('user_id', userId)
        .eq('event_type', tournamentId)
        .single();

      const existingTeams: Array<{
        id: number;
        purchasePrice: number;
        isMyTeam: boolean;
      }> =
        (existing?.teams as Array<{
          id: number;
          purchasePrice: number;
          isMyTeam: boolean;
        }>) ?? [];

      const teamIdx = existingTeams.findIndex((t) => t.id === teamId);
      const teamEntry = {
        id: teamId,
        purchasePrice: winAmount,
        isMyTeam: isWinner,
      };

      if (teamIdx >= 0) {
        existingTeams[teamIdx] = teamEntry;
      } else {
        existingTeams.push(teamEntry);
      }

      const upsertPayload: Record<string, unknown> = {
        user_id: userId,
        event_type: tournamentId,
        teams: existingTeams,
      };
      // Include payout rules and pot size so new rows get correct values
      // instead of falling back to stale DB column defaults
      if (payoutRules) upsertPayload.payout_rules = payoutRules;
      if (estimatedPotSize) upsertPayload.estimated_pot_size = estimatedPotSize;

      await admin.from('auction_data').upsert(
        upsertPayload,
        { onConflict: 'user_id,event_type' }
      );
    }
  } catch (err) {
    console.error('[syncAuctionData] Failed to sync auction data:', err);
  }
}

/** Reverse sync for a single team when a sale is undone — resets purchasePrice & isMyTeam */
async function reverseSyncAuctionData(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  tournamentId: string,
  teamId: number
) {
  try {
    const { data: participants } = await admin
      .from('auction_participants')
      .select('user_id')
      .eq('session_id', sessionId);

    if (!participants?.length) return;

    const userIds = participants.map((p) => p.user_id);
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, has_paid')
      .in('id', userIds);

    const paidUsers =
      profiles?.filter((p) => p.has_paid).map((p) => p.id) ?? [];

    for (const userId of paidUsers) {
      const { data: existing } = await admin
        .from('auction_data')
        .select('teams')
        .eq('user_id', userId)
        .eq('event_type', tournamentId)
        .single();

      if (!existing?.teams) continue;

      const existingTeams = existing.teams as Array<{
        id: number;
        purchasePrice: number;
        isMyTeam: boolean;
      }>;

      // Reset the undone team to unowned state
      const updatedTeams = existingTeams.map((t) =>
        t.id === teamId ? { ...t, purchasePrice: 0, isMyTeam: false } : t
      );

      await admin
        .from('auction_data')
        .update({ teams: updatedTeams })
        .eq('user_id', userId)
        .eq('event_type', tournamentId);
    }
  } catch (err) {
    console.error('[reverseSyncAuctionData] Failed to reverse sync:', err);
  }
}

export async function skipTeam(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, status, bidding_status, team_order, current_team_idx, settings')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  session.team_order = parseTeamOrder(session.team_order);
  if (session.status !== 'active') return { error: 'Auction not active' };
  if (session.bidding_status === 'open')
    return { error: 'Close bidding before skipping a team' };

  const teamId = session.team_order[session.current_team_idx];
  const nextIdx = session.current_team_idx + 1;
  const isLastTeam = nextIdx >= session.team_order.length;

  const admin = createAdminClient();

  await admin
    .from('auction_sessions')
    .update({
      current_team_idx: isLastTeam ? session.current_team_idx : nextIdx,
      bidding_status: 'waiting',
      current_highest_bid: 0,
      current_highest_bidder_id: null,
      timer_ends_at: null,
      timer_duration_ms: null,
      ...(isLastTeam ? { status: 'completed' } : {}),
    })
    .eq('id', sessionId);

  await broadcastToChannel(channelName(sessionId), 'TIMER_STOP', {});
  await broadcastToChannel(channelName(sessionId), 'TEAM_SKIPPED', {
    teamId,
    nextTeamIdx: isLastTeam ? null : nextIdx,
  });

  if (isLastTeam) {
    await broadcastToChannel(channelName(sessionId), 'AUCTION_COMPLETED', {});
    return { success: true, isComplete: true };
  }

  // Auto-mode: open bidding on next team automatically
  const settings = session.settings as SessionSettings | null;
  if (settings?.autoMode) {
    await autoOpenBidding(admin, sessionId, settings);
  }

  return { success: true };
}

export async function undoLastSale(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, team_order, current_team_idx, tournament_id, settings')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  session.team_order = parseTeamOrder(session.team_order);

  const admin = createAdminClient();
  const settings = session.settings as SessionSettings | null;

  // Find most recent winning bid
  const { data: lastSale } = await admin
    .from('auction_bids')
    .select('id, team_id, bidder_id, amount, created_at')
    .eq('session_id', sessionId)
    .eq('is_winning_bid', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastSale) return { error: 'No sales to undo' };

  // Check if last sale was part of a bundle — find the bundle containing this team
  const bundles = settings?.bundles ?? [];
  const parentBundle = bundles.find((b: { teamIds: number[] }) =>
    b.teamIds.includes(lastSale.team_id)
  );

  let bundleTeamIds: number[] | undefined;

  if (parentBundle) {
    bundleTeamIds = parentBundle.teamIds;
    // Undo ALL winning bids for member teams in this bundle
    for (const memberTeamId of parentBundle.teamIds) {
      await admin
        .from('auction_bids')
        .update({ is_winning_bid: false })
        .eq('session_id', sessionId)
        .eq('team_id', memberTeamId)
        .eq('is_winning_bid', true);

      await reverseSyncAuctionData(
        admin,
        sessionId,
        session.tournament_id,
        memberTeamId
      );
    }
  } else {
    // Single team: unmark the winning bid
    await admin
      .from('auction_bids')
      .update({ is_winning_bid: false })
      .eq('id', lastSale.id);

    await reverseSyncAuctionData(
      admin,
      sessionId,
      session.tournament_id,
      lastSale.team_id
    );
  }

  // Find the item's index in the current order
  // For bundles, look for the b: prefixed entry; for teams, look for the team id
  let teamIdx: number;
  if (parentBundle) {
    teamIdx = session.team_order.indexOf(`b:${parentBundle.id}`);
  } else {
    teamIdx = session.team_order.indexOf(lastSale.team_id);
  }

  if (teamIdx < 0) {
    // Item not found in order (e.g., after shuffle) — fall back to previous position
    const fallbackIdx = Math.max(0, session.current_team_idx - 1);
    await admin
      .from('auction_sessions')
      .update({
        current_team_idx: fallbackIdx,
        bidding_status: 'waiting',
        current_highest_bid: 0,
        current_highest_bidder_id: null,
        status: 'active',
      })
      .eq('id', sessionId);

    await broadcastToChannel(channelName(sessionId), 'SALE_UNDONE', {
      teamId: lastSale.team_id,
      teamIdx: fallbackIdx,
      ...(bundleTeamIds ? { bundleTeamIds } : {}),
    });

    // Auto-open bidding if auto-mode enabled
    if (settings?.autoMode) {
      await autoOpenBidding(admin, sessionId, settings);
    }
  } else {
    await admin
      .from('auction_sessions')
      .update({
        current_team_idx: teamIdx,
        bidding_status: 'waiting',
        current_highest_bid: 0,
        current_highest_bidder_id: null,
        status: 'active',
      })
      .eq('id', sessionId);

    await broadcastToChannel(channelName(sessionId), 'SALE_UNDONE', {
      teamId: lastSale.team_id,
      teamIdx,
      ...(bundleTeamIds ? { bundleTeamIds } : {}),
    });

    // Auto-open bidding if auto-mode enabled
    if (settings?.autoMode) {
      await autoOpenBidding(admin, sessionId, settings);
    }
  }

  return { success: true };
}

export async function pauseAuction(sessionId: string) {
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

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  if (session.status !== 'active') return { error: 'Auction not active' };

  await supabase
    .from('auction_sessions')
    .update({ status: 'paused', bidding_status: 'waiting', timer_ends_at: null, timer_duration_ms: null })
    .eq('id', sessionId);

  await broadcastToChannel(channelName(sessionId), 'TIMER_STOP', {});
  await broadcastToChannel(channelName(sessionId), 'AUCTION_PAUSED', {});

  return { success: true };
}

/**
 * Auto-advance: called by commissioner timer expiry in auto-mode.
 * Closes bidding → sells to highest bidder (or skips if no bids) → opens next.
 * Everything happens server-side in one call to avoid race conditions.
 *
 * SERVER-AUTHORITATIVE TIMER: Before closing, we check the DB's timer_ends_at.
 * If a last-second bid extended the timer, we reject the close and re-broadcast
 * the updated timer so the commissioner's client resyncs. This prevents "sniping"
 * where a valid bid's timer extension is lost due to broadcast latency.
 */
export async function autoAdvance(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };
  session.team_order = parseTeamOrder(session.team_order);
  if (session.status !== 'active') return { error: 'Auction not active' };

  // ── SERVER-AUTHORITATIVE TIMER CHECK ──
  // The commissioner's client thinks the timer expired, but a last-second bid
  // may have extended timer_ends_at in the DB. Check the DB truth + add a
  // grace period to absorb broadcast latency.
  const GRACE_PERIOD_MS = 2000; // 2-second buffer for broadcast propagation
  if (session.timer_ends_at) {
    const dbEndsAt = new Date(session.timer_ends_at).getTime();
    const now = Date.now();
    if (dbEndsAt > now - GRACE_PERIOD_MS) {
      // Timer was extended by a bid OR hasn't truly expired yet.
      // If still in the future, re-broadcast the active timer so the
      // commissioner's client resyncs its countdown.
      if (dbEndsAt > now) {
        await broadcastToChannel(channelName(sessionId), 'TIMER_RESET', {
          endsAt: session.timer_ends_at,
          durationMs: session.timer_duration_ms ?? (dbEndsAt - now),
        });
        return { error: 'Timer was extended by a recent bid', timerExtended: true };
      }
      // Timer ended within the grace window — it's truly expired, proceed.
    }
  }

  const admin = createAdminClient();
  const currentOrderItem = session.team_order[session.current_team_idx];
  const isBundle = typeof currentOrderItem === 'string' && currentOrderItem.startsWith('b:');

  // Resolve teamId for bid tracking (bundles use first member team)
  let teamId: number;
  let bundleTeamIds: number[] | undefined;
  if (isBundle) {
    const bundleId = String(currentOrderItem).slice(2);
    const autoSettings = session.settings as SessionSettings | null;
    const bundle = autoSettings?.bundles?.find((b: { id: string }) => b.id === bundleId);
    if (!bundle || !bundle.teamIds?.length) return { error: 'Bundle not found' };
    teamId = bundle.teamIds[0];
    bundleTeamIds = bundle.teamIds;
  } else {
    teamId = currentOrderItem as number;
  }

  // 1. Close bidding
  await admin
    .from('auction_sessions')
    .update({
      bidding_status: 'closed',
      timer_ends_at: null,
      timer_duration_ms: null,
    })
    .eq('id', sessionId);

  await broadcastToChannel(channelName(sessionId), 'BIDDING_CLOSED', {});
  await broadcastToChannel(channelName(sessionId), 'TIMER_STOP', {});

  const hasBids =
    session.current_highest_bidder_id && session.current_highest_bid > 0;

  const nextIdx = session.current_team_idx + 1;
  const isLastTeam = nextIdx >= session.team_order.length;

  if (hasBids) {
    // 2a. Sell team/bundle to highest bidder
    const winnerId = session.current_highest_bidder_id!;
    const winAmount = session.current_highest_bid;

    // Mark winning bid
    await admin
      .from('auction_bids')
      .update({ is_winning_bid: true })
      .eq('session_id', sessionId)
      .eq('team_id', teamId)
      .eq('bidder_id', winnerId)
      .eq('amount', winAmount);

    // Get winner name
    const { data: winnerParticipant } = await admin
      .from('auction_participants')
      .select('display_name')
      .eq('session_id', sessionId)
      .eq('user_id', winnerId)
      .single();

    if (isBundle && bundleTeamIds) {
      // Split price across member teams and sync each
      const splitAmount = Math.round(winAmount / bundleTeamIds.length);
      const remainder = winAmount - (splitAmount * bundleTeamIds.length);

      for (let i = 0; i < bundleTeamIds.length; i++) {
        const memberTeamId = bundleTeamIds[i];
        const amount = i === 0 ? splitAmount + remainder : splitAmount;

        if (i > 0) {
          await admin.from('auction_bids').insert({
            session_id: sessionId,
            team_id: memberTeamId,
            bidder_id: winnerId,
            amount,
            is_winning_bid: true,
          });
        }

        await syncAuctionData(
          admin,
          sessionId,
          session.tournament_id,
          memberTeamId,
          winnerId,
          amount,
          session.payout_rules,
          session.estimated_pot_size
        );
      }
    } else {
      // Sync single team auction data
      await syncAuctionData(
        admin,
        sessionId,
        session.tournament_id,
        teamId,
        winnerId,
        winAmount,
        session.payout_rules,
        session.estimated_pot_size
      );
    }

    // Advance
    await admin
      .from('auction_sessions')
      .update({
        current_team_idx: isLastTeam ? session.current_team_idx : nextIdx,
        bidding_status: 'waiting',
        current_highest_bid: 0,
        current_highest_bidder_id: null,
        ...(isLastTeam ? { status: 'completed' } : {}),
      })
      .eq('id', sessionId);

    await broadcastToChannel(channelName(sessionId), 'TEAM_SOLD', {
      teamId,
      winnerId,
      winnerName: winnerParticipant?.display_name ?? 'Unknown',
      amount: winAmount,
      nextTeamIdx: isLastTeam ? null : nextIdx,
      isComplete: isLastTeam,
      ...(bundleTeamIds ? { bundleTeamIds } : {}),
    });

    if (isLastTeam) {
      await broadcastToChannel(channelName(sessionId), 'AUCTION_COMPLETED', {});
      return { success: true, isComplete: true };
    }
  } else {
    // 2b. Skip team (no bids)
    await admin
      .from('auction_sessions')
      .update({
        current_team_idx: isLastTeam ? session.current_team_idx : nextIdx,
        bidding_status: 'waiting',
        current_highest_bid: 0,
        current_highest_bidder_id: null,
        ...(isLastTeam ? { status: 'completed' } : {}),
      })
      .eq('id', sessionId);

    await broadcastToChannel(channelName(sessionId), 'TEAM_SKIPPED', {
      teamId: isBundle ? teamId : (currentOrderItem as number),
      nextTeamIdx: isLastTeam ? null : nextIdx,
    });

    if (isLastTeam) {
      await broadcastToChannel(channelName(sessionId), 'AUCTION_COMPLETED', {});
      return { success: true, isComplete: true };
    }
  }

  // 3. Auto-open bidding on next team
  const settings = session.settings as SessionSettings | null;
  if (settings?.autoMode) {
    await autoOpenBidding(admin, sessionId, settings);
  }

  return { success: true, isComplete: false };
}

/**
 * Toggle auto-mode on/off mid-auction.
 */
export async function toggleAutoMode(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('auction_sessions')
    .select('commissioner_id, settings')
    .eq('id', sessionId)
    .single();

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };

  const settings = (session.settings as SessionSettings | null) ?? {};
  const newAutoMode = !settings.autoMode;

  await supabase
    .from('auction_sessions')
    .update({
      settings: { ...settings, autoMode: newAutoMode },
    })
    .eq('id', sessionId);

  await broadcastToChannel(channelName(sessionId), 'AUTO_MODE_TOGGLED', {
    autoMode: newAutoMode,
  });

  return { success: true, autoMode: newAutoMode };
}

export async function completeAuction(sessionId: string) {
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

  if (!session || session.commissioner_id !== user.id)
    return { error: 'Not authorized' };

  await supabase
    .from('auction_sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId);

  await broadcastToChannel(
    channelName(sessionId),
    'AUCTION_COMPLETED',
    {}
  );

  return { success: true };
}
