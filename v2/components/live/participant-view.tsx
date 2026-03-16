'use client';

import { useCallback, useEffect } from 'react';
import { useAuctionChannel } from '@/lib/auction/live/use-auction-channel';
import { useTimer } from '@/lib/auction/live/use-timer';
import type { BaseTeam, TournamentConfig, PayoutRules, TeamBundle } from '@/lib/tournaments/types';
import type { BidEntry, SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { SessionSettings } from '@/lib/auction/live/types';
import { AuctionStatusBar } from './auction-status-bar';
import { TeamSpotlight } from './team-spotlight';
import { BidPanel } from './bid-panel';
import { BidLadder } from './bid-ladder';
import { TeamQueue } from './team-queue';
import { ParticipantList } from './participant-list';
import { ResultsTable } from './results-table';
import { MyPortfolio } from './my-portfolio';
import { StrategyOverlay } from './strategy-overlay';
import { TimerDisplay } from './timer-display';
import { TournamentDashboard } from './tournament-dashboard';
import type { TournamentResult } from '@/actions/tournament-results';

interface ParticipantViewProps {
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

export function ParticipantView({
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
}: ParticipantViewProps) {
  const myParticipant = participants.find((p) => p.user_id === userId);

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

  const currentHighestBidderName = session.current_highest_bidder_id
    ? (participantMap[session.current_highest_bidder_id] ?? null)
    : null;

  const channel = useAuctionChannel({
    sessionId: session.id,
    userId,
    displayName: myParticipant?.display_name ?? 'Participant',
    isCommissioner: false,
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

  const activeTeamOrder = channel.teamOrder ?? session.team_order;

  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const bundles: TeamBundle[] = session.settings?.bundles ?? [];

  const currentOrderItem = channel.currentTeamIdx !== null ? activeTeamOrder[channel.currentTeamIdx] : null;
  const isCurrentBundle = typeof currentOrderItem === 'string' && currentOrderItem.startsWith('b:');
  const currentBundleId = isCurrentBundle ? currentOrderItem.slice(2) : null;
  const currentBundle = currentBundleId ? bundles.find(b => b.id === currentBundleId) : null;
  const currentTeamId = currentOrderItem;
  // Timer (participants don't trigger auto-close, just display)
  const timer = useTimer({
    isCommissioner: false,
    onExpire: useCallback(() => {}, []),
  });

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

  if (channel.auctionStatus === 'lobby') {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-4 space-y-4">
        <AuctionStatusBar
          sessionName={session.name}
          joinCode={session.join_code}
          isConnected={channel.isConnected}
          onlineCount={channel.onlineUsers.length}
          auctionStatus={channel.auctionStatus}
        />
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16">
          <p className="text-lg font-medium text-white/60">
            Waiting for the commissioner to start...
          </p>
          <p className="mt-2 text-sm text-white/30">
            {channel.onlineUsers.length} participant{channel.onlineUsers.length !== 1 ? 's' : ''} connected
          </p>
        </div>
        <ParticipantList onlineUsers={channel.onlineUsers} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 space-y-4">
      <AuctionStatusBar
        sessionName={session.name}
        joinCode={session.join_code}
        isConnected={channel.isConnected}
        onlineCount={channel.onlineUsers.length}
        auctionStatus={channel.auctionStatus}
      />

      {!channel.isConnected && channel.auctionStatus !== 'completed' && (
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
          isCommissioner={false}
          config={config}
          payoutRules={session.payout_rules}
          initialResults={tournamentResults}
        />
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Team Queue — pushed below on mobile */}
          <div className="col-span-12 order-3 lg:order-none lg:col-span-3">
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
