'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuctionChannel } from '@/lib/auction/live/use-auction-channel';
import { useTimer } from '@/lib/auction/live/use-timer';
import type { BaseTeam, TournamentConfig, PayoutRules, TeamBundle } from '@/lib/tournaments/types';
import type { BidEntry, SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { SessionSettings } from '@/lib/auction/live/types';
import { updateTeamOrder } from '@/actions/session';
import { AuctionStatusBar } from './auction-status-bar';
import { TeamSpotlight } from './team-spotlight';
import { BiddingControls } from './bidding-controls';
import { BidPanel } from './bid-panel';
import { BidLadder } from './bid-ladder';
import { TeamQueue } from './team-queue';
import { ParticipantList } from './participant-list';
import { MyPortfolio } from './my-portfolio';
import { ResultsTable } from './results-table';
import { StrategyOverlay } from './strategy-overlay';
import { TimerDisplay } from './timer-display';
import { closeBidding, autoAdvance, toggleAutoMode } from '@/actions/bidding';
import { TournamentDashboard } from './tournament-dashboard';
import type { TournamentResult } from '@/actions/tournament-results';
import { Shuffle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CommissionerViewProps {
  session: {
    id: string;
    name: string;
    join_code: string;
    status: string;
    team_order: (number | string)[];
    current_team_idx: number;
    bidding_status: string;
    current_highest_bid: number;
    current_highest_bidder_id: string | null;
    payout_rules: PayoutRules;
    estimated_pot_size: number;
    tournament_id: string;
    settings: SessionSettings;
    timer_ends_at: string | null;
    timer_duration_ms: number | null;
  };
  participants: Array<{
    user_id: string;
    display_name: string;
    is_commissioner: boolean;
  }>;
  participantMap: Record<string, string>;
  winningBids: Array<{
    team_id: number;
    bidder_id: string;
    amount: number;
  }>;
  currentBids: Array<{
    bidder_id: string;
    amount: number;
    created_at: string;
  }>;
  config: TournamentConfig;
  baseTeams: BaseTeam[];
  userId: string;
  hasPaid: boolean;
  tournamentResults: TournamentResult[];
}

export function CommissionerView({
  session,
  participants,
  participantMap,
  winningBids,
  currentBids,
  config,
  baseTeams,
  userId,
  hasPaid,
  tournamentResults,
}: CommissionerViewProps) {
  const myParticipant = participants.find((p) => p.user_id === userId);

  // Build initial state from server data
  const initialSoldTeams: SoldTeam[] = winningBids.map((wb) => ({
    teamId: wb.team_id,
    winnerId: wb.bidder_id,
    winnerName: participantMap[wb.bidder_id] ?? 'Unknown',
    amount: wb.amount,
  }));

  const initialBidHistory: BidEntry[] = currentBids.map((b) => ({
    bidderId: b.bidder_id,
    bidderName: participantMap[b.bidder_id] ?? 'Unknown',
    amount: b.amount,
    timestamp: b.created_at,
  }));

  // Get current highest bidder name from initial data
  const currentHighestBidderName = session.current_highest_bidder_id
    ? (participantMap[session.current_highest_bidder_id] ?? null)
    : null;

  const channel = useAuctionChannel({
    sessionId: session.id,
    userId,
    displayName: myParticipant?.display_name ?? 'Commissioner',
    isCommissioner: true,
    initialState: {
      currentTeamIdx: session.current_team_idx,
      biddingStatus: session.bidding_status as 'waiting' | 'open' | 'closed',
      currentHighestBid: session.current_highest_bid,
      currentHighestBidderName,
      bidHistory: initialBidHistory,
      soldTeams: initialSoldTeams,
      auctionStatus: session.status,
      teamOrder: session.team_order,
      timerEndsAt: session.timer_ends_at,
      timerDurationMs: session.timer_duration_ms,
      autoMode: session.settings?.autoMode,
    },
  });

  // Use dynamic team order from channel (updated via broadcast) or fallback to session
  const activeTeamOrder = channel.teamOrder ?? session.team_order;

  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const bundles: TeamBundle[] = session.settings?.bundles ?? [];

  const currentOrderItem = channel.currentTeamIdx !== null ? activeTeamOrder[channel.currentTeamIdx] : null;
  const isCurrentBundle = typeof currentOrderItem === 'string' && currentOrderItem.startsWith('b:');
  const currentBundleId = isCurrentBundle ? currentOrderItem.slice(2) : null;
  const currentBundle = currentBundleId ? bundles.find(b => b.id === currentBundleId) : null;
  const currentTeamId = currentOrderItem;  // number | string | null — passed to strategy overlay

  // Fisher-Yates shuffle
  const handleShuffle = useCallback(async () => {
    const order = [...activeTeamOrder];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    await updateTeamOrder(session.id, order);
  }, [activeTeamOrder, session.id]);

  // Track autoMode via ref so the stable onExpire callback always reads the latest value
  const autoModeRef = useRef(channel.autoMode);
  autoModeRef.current = channel.autoMode;

  // Timer: commissioner auto-closes (or auto-advances in auto-mode) on expiry
  const timer = useTimer({
    isCommissioner: true,
    onExpire: useCallback(() => {
      if (autoModeRef.current) {
        autoAdvance(session.id);
      } else {
        closeBidding(session.id);
      }
    }, [session.id]),
  });

  // Toggle auto-mode handler
  const [togglingAutoMode, setTogglingAutoMode] = useState(false);
  const handleToggleAutoMode = useCallback(async () => {
    setTogglingAutoMode(true);
    await toggleAutoMode(session.id);
    setTogglingAutoMode(false);
  }, [session.id]);

  // Sync timer state from channel (includes DB-initialized state on mount)
  useEffect(() => {
    if (channel.timerIsRunning && channel.timerEndsAt) {
      timer.start(channel.timerEndsAt, channel.timerDurationMs);
    } else if (!channel.timerIsRunning) {
      timer.stop();
    }
  }, [channel.timerIsRunning, channel.timerEndsAt, channel.timerDurationMs]);

  const currentTeam = !isCurrentBundle && typeof currentOrderItem === 'number'
    ? teamMap.get(currentOrderItem) ?? null
    : null;
  const currentBundleInfo = currentBundle
    ? {
        name: currentBundle.name,
        teams: currentBundle.teamIds
          .map((tid) => teamMap.get(tid))
          .filter((t): t is BaseTeam => !!t),
      }
    : undefined;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 space-y-4">
      <AuctionStatusBar
        sessionName={session.name}
        joinCode={session.join_code}
        isConnected={channel.isConnected}
        onlineCount={channel.onlineUsers.length}
        auctionStatus={channel.auctionStatus}
      />

      {/* Auto-mode toggle — visible during active/paused auctions when timer is enabled */}
      {session.settings?.timer?.enabled && (channel.auctionStatus === 'active' || channel.auctionStatus === 'paused' || channel.auctionStatus === 'lobby') && (
        <button
          type="button"
          onClick={handleToggleAutoMode}
          disabled={togglingAutoMode}
          className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 transition-colors ${
            channel.autoMode
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className={`size-3.5 ${channel.autoMode ? 'text-amber-400' : 'text-white/40'}`} />
            <span className={`text-sm font-medium ${channel.autoMode ? 'text-amber-300' : 'text-white/50'}`}>
              {channel.autoMode ? 'Auto-auction ON' : 'Auto-auction OFF'}
            </span>
            <span className="text-[10px] text-white/30">
              {channel.autoMode
                ? '— bidding opens, closes, and sells automatically'
                : '— click to enable hands-free mode'}
            </span>
          </div>
          <div
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              channel.autoMode ? 'bg-amber-500' : 'bg-white/10'
            }`}
          >
            <span
              className={`inline-block size-3.5 transform rounded-full bg-white transition-transform ${
                channel.autoMode ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>
      )}

      {!channel.isConnected && channel.auctionStatus !== 'lobby' && channel.auctionStatus !== 'completed' && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-center text-sm text-red-400">
          Reconnecting...
        </div>
      )}

      {channel.auctionStatus === 'completed' ? (
        <TournamentDashboard
          sessionId={session.id}
          soldTeams={channel.soldTeams}
          baseTeams={baseTeams}
          sessionName={session.name}
          isCommissioner={true}
          config={config}
          payoutRules={session.payout_rules}
          initialResults={tournamentResults}
        />
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Team Queue — pushed below on mobile */}
          <div className="col-span-12 order-3 lg:order-none lg:col-span-3">
            {channel.auctionStatus === 'lobby' && (
              <Button
                onClick={handleShuffle}
                variant="outline"
                className="mb-2 w-full gap-2 border-white/10 text-white/60 hover:border-white/20 hover:text-white/80"
              >
                <Shuffle className="size-3.5" />
                Shuffle Team Order
              </Button>
            )}
            <TeamQueue
              sessionId={session.id}
              teamOrder={activeTeamOrder}
              baseTeams={baseTeams}
              soldTeams={channel.soldTeams}
              currentTeamIdx={channel.currentTeamIdx}
              auctionStatus={channel.auctionStatus}
              bundles={bundles}
            />
          </div>

          {/* Center: Auction area — first on mobile */}
          <div className="col-span-12 order-1 lg:order-none space-y-4 lg:col-span-6">
            <TeamSpotlight
              team={currentTeam}
              config={config}
              teamIndex={channel.currentTeamIdx ?? 0}
              totalTeams={activeTeamOrder.length}
              bundleInfo={currentBundleInfo}
            />

            <StrategyOverlay
              hasPaid={hasPaid}
              currentTeamId={currentTeamId}
              currentHighestBid={channel.currentHighestBid}
              config={config}
              baseTeams={baseTeams}
              payoutRules={session.payout_rules}
              estimatedPotSize={session.estimated_pot_size}
              soldTeams={channel.soldTeams}
            />

            <TimerDisplay timer={timer.state} />

            <BiddingControls
              sessionId={session.id}
              auctionStatus={channel.auctionStatus}
              biddingStatus={channel.biddingStatus}
              currentHighestBid={channel.currentHighestBid}
              currentHighestBidderName={channel.currentHighestBidderName}
              hasSoldTeams={channel.soldTeams.length > 0}
              currentTeamIdx={channel.currentTeamIdx}
              timerIsRunning={timer.state.isRunning}
              autoMode={channel.autoMode}
            />

            {/* Commissioner can bid too */}
            <BidPanel
              sessionId={session.id}
              biddingStatus={channel.biddingStatus}
              currentHighestBid={channel.currentHighestBid}
              currentHighestBidderName={channel.currentHighestBidderName}
              userId={userId}
              bidIncrements={session.settings?.bidIncrements}
            />

            <BidLadder
              bids={channel.bidHistory}
              currentHighestBid={channel.currentHighestBid}
              currentHighestBidderName={channel.currentHighestBidderName}
            />
          </div>

          {/* Right: Participants + Results — second on mobile */}
          <div className="col-span-12 order-2 lg:order-none space-y-4 lg:col-span-3">
            <ParticipantList onlineUsers={channel.onlineUsers} />
            <MyPortfolio
              soldTeams={channel.soldTeams}
              baseTeams={baseTeams}
              userId={userId}
            />
            <ResultsTable
              soldTeams={channel.soldTeams}
              baseTeams={baseTeams}
            />
          </div>
        </div>
      )}
    </div>
  );
}
