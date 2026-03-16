'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface BidEntry {
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: string;
}

export interface SoldTeam {
  teamId: number;
  winnerId: string;
  winnerName: string;
  amount: number;
}

export interface AuctionChannelState {
  currentTeamIdx: number | null;
  biddingStatus: 'waiting' | 'open' | 'closed';
  currentHighestBid: number;
  currentHighestBidderName: string | null;
  bidHistory: BidEntry[];
  soldTeams: SoldTeam[];
  auctionStatus: 'lobby' | 'active' | 'paused' | 'completed';
  isConnected: boolean;
  onlineUsers: Array<{
    userId: string;
    displayName: string;
    isCommissioner: boolean;
  }>;
  teamOrder: (number | string)[] | null;
  // Timer state
  timerEndsAt: string | null;
  timerDurationMs: number;
  timerIsRunning: boolean;
  // Auto-auction mode
  autoMode: boolean;
}

export interface UseAuctionChannelOptions {
  sessionId: string;
  userId: string;
  displayName: string;
  isCommissioner: boolean;
  initialState: {
    currentTeamIdx: number | null;
    biddingStatus: 'waiting' | 'open' | 'closed';
    currentHighestBid: number;
    currentHighestBidderName: string | null;
    bidHistory: BidEntry[];
    soldTeams: SoldTeam[];
    auctionStatus: string;
    teamOrder?: (number | string)[];
    timerEndsAt?: string | null;
    timerDurationMs?: number | null;
    autoMode?: boolean;
  };
}

export function useAuctionChannel(
  options: UseAuctionChannelOptions
): AuctionChannelState {
  const { sessionId, userId, displayName, isCommissioner, initialState } =
    options;

  const [state, setState] = useState<AuctionChannelState>({
    currentTeamIdx: initialState.currentTeamIdx,
    biddingStatus: initialState.biddingStatus,
    currentHighestBid: initialState.currentHighestBid,
    currentHighestBidderName: initialState.currentHighestBidderName,
    bidHistory: initialState.bidHistory,
    soldTeams: initialState.soldTeams,
    auctionStatus:
      initialState.auctionStatus as AuctionChannelState['auctionStatus'],
    isConnected: false,
    onlineUsers: [],
    teamOrder: initialState.teamOrder ?? null,
    timerEndsAt: initialState.timerEndsAt ?? null,
    timerDurationMs: initialState.timerDurationMs ?? 0,
    timerIsRunning: !!(initialState.timerEndsAt && initialState.timerDurationMs && new Date(initialState.timerEndsAt) > new Date()),
    autoMode: initialState.autoMode ?? false,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase.channel(`auction:${sessionId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'AUCTION_STARTED' }, ({ payload }) => {
        setState((prev) => ({
          ...prev,
          auctionStatus: 'active',
          currentTeamIdx: payload.currentTeamIdx,
          biddingStatus: 'waiting',
          bidHistory: [],
          currentHighestBid: 0,
          currentHighestBidderName: null,
        }));
      })
      .on('broadcast', { event: 'TEAM_PRESENTED' }, ({ payload }) => {
        setState((prev) => ({
          ...prev,
          currentTeamIdx: payload.teamIdx,
          biddingStatus: 'waiting',
          bidHistory: [],
          currentHighestBid: 0,
          currentHighestBidderName: null,
        }));
      })
      .on('broadcast', { event: 'BIDDING_OPEN' }, () => {
        setState((prev) => ({ ...prev, biddingStatus: 'open' }));
      })
      .on('broadcast', { event: 'NEW_BID' }, ({ payload }) => {
        setState((prev) => {
          // Guard against out-of-order events: only update high bid if actually higher
          const isHigher = payload.amount > prev.currentHighestBid;
          return {
            ...prev,
            currentHighestBid: isHigher ? payload.amount : prev.currentHighestBid,
            currentHighestBidderName: isHigher ? payload.bidderName : prev.currentHighestBidderName,
            bidHistory: [
              ...prev.bidHistory,
              {
                bidderId: payload.bidderId,
                bidderName: payload.bidderName,
                amount: payload.amount,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        });
      })
      .on('broadcast', { event: 'BIDDING_CLOSED' }, () => {
        setState((prev) => ({
          ...prev,
          biddingStatus: 'closed',
          timerEndsAt: null,
          timerDurationMs: 0,
          timerIsRunning: false,
        }));
      })
      .on('broadcast', { event: 'TEAM_SOLD' }, ({ payload }) => {
        setState((prev) => {
          // Bundle sales include bundleTeamIds — add a SoldTeam entry for each member
          const newSoldTeams: SoldTeam[] = [];
          if (payload.bundleTeamIds && Array.isArray(payload.bundleTeamIds)) {
            const splitAmount = Math.round(payload.amount / payload.bundleTeamIds.length);
            const remainder = payload.amount - (splitAmount * payload.bundleTeamIds.length);
            for (let i = 0; i < payload.bundleTeamIds.length; i++) {
              newSoldTeams.push({
                teamId: payload.bundleTeamIds[i],
                winnerId: payload.winnerId,
                winnerName: payload.winnerName,
                amount: i === 0 ? splitAmount + remainder : splitAmount,
              });
            }
          } else {
            newSoldTeams.push({
              teamId: payload.teamId,
              winnerId: payload.winnerId,
              winnerName: payload.winnerName,
              amount: payload.amount,
            });
          }
          return {
            ...prev,
            soldTeams: [...prev.soldTeams, ...newSoldTeams],
            currentTeamIdx: payload.nextTeamIdx ?? prev.currentTeamIdx,
            biddingStatus: 'waiting',
            bidHistory: [],
            currentHighestBid: 0,
            currentHighestBidderName: null,
            auctionStatus: payload.isComplete ? 'completed' : prev.auctionStatus,
            timerEndsAt: null,
            timerDurationMs: 0,
            timerIsRunning: false,
          };
        });
      })
      .on('broadcast', { event: 'TEAM_SKIPPED' }, ({ payload }) => {
        setState((prev) => ({
          ...prev,
          currentTeamIdx: payload.nextTeamIdx ?? prev.currentTeamIdx,
          biddingStatus: 'waiting',
          bidHistory: [],
          currentHighestBid: 0,
          currentHighestBidderName: null,
          timerEndsAt: null,
          timerDurationMs: 0,
          timerIsRunning: false,
        }));
      })
      .on('broadcast', { event: 'SALE_UNDONE' }, ({ payload }) => {
        setState((prev) => {
          // Bundle undo includes bundleTeamIds — remove all member teams from soldTeams
          const teamIdsToRemove: Set<number> = new Set(
            payload.bundleTeamIds && Array.isArray(payload.bundleTeamIds)
              ? payload.bundleTeamIds
              : [payload.teamId]
          );
          return {
            ...prev,
            soldTeams: prev.soldTeams.filter(
              (t) => !teamIdsToRemove.has(t.teamId)
            ),
            currentTeamIdx: payload.teamIdx,
            biddingStatus: 'waiting',
            bidHistory: [],
            currentHighestBid: 0,
            currentHighestBidderName: null,
            auctionStatus: 'active',
          };
        });
      })
      .on('broadcast', { event: 'AUCTION_PAUSED' }, () => {
        setState((prev) => ({
          ...prev,
          auctionStatus: 'paused',
          timerEndsAt: null,
          timerDurationMs: 0,
          timerIsRunning: false,
        }));
      })
      .on('broadcast', { event: 'AUCTION_COMPLETED' }, () => {
        setState((prev) => ({ ...prev, auctionStatus: 'completed' }));
      })
      .on('broadcast', { event: 'TEAM_ORDER_UPDATED' }, ({ payload }) => {
        // Parse team order: DB returns text[] (all strings), but we need
        // numeric IDs as numbers and bundle IDs (b:...) as strings
        const parsed = (payload.teamOrder as string[]).map((item: string) => {
          if (typeof item === 'string' && item.startsWith('b:')) return item;
          const n = Number(item);
          return isNaN(n) ? item : n;
        });
        setState((prev) => ({ ...prev, teamOrder: parsed }));
      })
      .on('broadcast', { event: 'TIMER_START' }, ({ payload }) => {
        setState((prev) => ({
          ...prev,
          timerEndsAt: payload.endsAt,
          timerDurationMs: payload.durationMs,
          timerIsRunning: true,
        }));
      })
      .on('broadcast', { event: 'TIMER_RESET' }, ({ payload }) => {
        setState((prev) => ({
          ...prev,
          timerEndsAt: payload.endsAt,
          timerDurationMs: payload.durationMs,
          timerIsRunning: true,
        }));
      })
      .on('broadcast', { event: 'TIMER_STOP' }, () => {
        setState((prev) => ({
          ...prev,
          timerEndsAt: null,
          timerDurationMs: 0,
          timerIsRunning: false,
        }));
      })
      .on('broadcast', { event: 'AUTO_MODE_TOGGLED' }, ({ payload }) => {
        setState((prev) => ({ ...prev, autoMode: payload.autoMode }));
      })
      .on('broadcast', { event: 'RESULT_UPDATED' }, ({ payload }) => {
        const handler = (window as unknown as Record<string, unknown>).__tournamentResultUpdate;
        if (typeof handler === 'function') handler(payload);
      })
      .on('broadcast', { event: 'RESULTS_BULK_UPDATED' }, ({ payload }) => {
        const handler = (window as unknown as Record<string, unknown>).__tournamentBulkUpdate;
        if (typeof handler === 'function') handler(payload);
      })
      .on('broadcast', { event: 'TOURNAMENT_SETTLED' }, () => {
        // Could trigger a refresh or state update — for now the leaderboard reflects this
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const seen = new Set<string>();
        const users: AuctionChannelState['onlineUsers'] = [];
        for (const p of Object.values(presenceState).flat()) {
          const rec = p as Record<string, unknown>;
          const uid = rec.userId as string;
          if (!seen.has(uid)) {
            seen.add(uid);
            users.push({
              userId: uid,
              displayName: rec.displayName as string,
              isCommissioner: rec.isCommissioner as boolean,
            });
          }
        }
        setState((prev) => ({ ...prev, onlineUsers: users }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setState((prev) => ({ ...prev, isConnected: true }));
          await channel.track({
            userId,
            displayName,
            isCommissioner,
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setState((prev) => ({ ...prev, isConnected: false }));
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [sessionId, userId, displayName, isCommissioner]);

  return state;
}
