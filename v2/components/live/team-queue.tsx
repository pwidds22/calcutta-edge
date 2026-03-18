'use client';

import type { BaseTeam, TeamBundle } from '@/lib/tournaments/types';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import { presentTeam } from '@/actions/bidding';
import { cn } from '@/lib/utils';
import { List, Package, Pointer } from 'lucide-react';

interface TeamQueueProps {
  sessionId: string;
  teamOrder: (number | string)[];
  baseTeams: BaseTeam[];
  soldTeams: SoldTeam[];
  currentTeamIdx: number | null;
  auctionStatus: string;
  bundles?: TeamBundle[];
  /** Commissioner can click unsold teams to present them */
  isCommissioner?: boolean;
  /** Current bidding status — commissioner can only jump when not 'open' */
  biddingStatus?: string;
}

export function TeamQueue({
  sessionId,
  teamOrder,
  baseTeams,
  soldTeams,
  currentTeamIdx,
  auctionStatus,
  bundles = [],
  isCommissioner = false,
  biddingStatus,
}: TeamQueueProps) {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const soldMap = new Map(soldTeams.map((s) => [s.teamId, s]));
  const bundleMap = new Map(bundles.map((b) => [b.id, b]));

  // Commissioner can click unsold teams to present them (only when bidding isn't open)
  const canJump = isCommissioner && auctionStatus === 'active' && biddingStatus !== 'open';

  const handleJump = async (idx: number) => {
    if (canJump) {
      await presentTeam(sessionId, idx);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <List className="size-3.5 text-white/40" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Team Queue ({teamOrder.length})
          </h3>
        </div>
        {canJump && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400/60">
            <Pointer className="size-3" />
            Click to present
          </span>
        )}
      </div>
      <div className="max-h-[40vh] lg:max-h-[calc(100vh-16rem)] overflow-y-auto p-1.5">
        {teamOrder.map((item, idx) => {
          const isBundle = typeof item === 'string' && item.startsWith('b:');
          const isCurrent = idx === currentTeamIdx;

          if (isBundle) {
            const bundleId = item.slice(2);
            const bundle = bundleMap.get(bundleId);
            const allMembersSold = bundle
              ? bundle.teamIds.every((tid) => soldMap.has(tid))
              : false;
            const totalSoldAmount = bundle
              ? bundle.teamIds.reduce(
                  (sum, tid) => sum + (soldMap.get(tid)?.amount ?? 0),
                  0
                )
              : 0;
            const isClickable = canJump && !allMembersSold && !isCurrent;

            return (
              <button
                key={item}
                onClick={() => isClickable && handleJump(idx)}
                disabled={!isClickable && !isCurrent}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                  isCurrent
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : allMembersSold
                      ? 'text-white/25'
                      : isClickable
                        ? 'text-white/60 hover:bg-emerald-500/5 hover:text-emerald-300 cursor-pointer'
                        : 'text-white/60'
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="text-xs text-white/30 w-5 text-right">
                    {idx + 1}
                  </span>
                  <Package className="size-3 flex-shrink-0 text-amber-400/60" />
                  <span className="truncate">
                    {bundle?.name ?? `Bundle ${bundleId}`}
                  </span>
                </span>
                {allMembersSold && totalSoldAmount > 0 && (
                  <span className="ml-2 flex-shrink-0 text-xs font-mono text-white/30">
                    ${totalSoldAmount}
                  </span>
                )}
              </button>
            );
          }

          // Regular team
          const teamId = item as number;
          const team = teamMap.get(teamId);
          const sold = soldMap.get(teamId);
          const isClickable = canJump && !sold && !isCurrent;

          return (
            <button
              key={teamId}
              onClick={() => isClickable && handleJump(idx)}
              disabled={!isClickable && !isCurrent}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                isCurrent
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : sold
                    ? 'text-white/25'
                    : isClickable
                      ? 'text-white/60 hover:bg-emerald-500/5 hover:text-emerald-300 cursor-pointer'
                      : 'text-white/60'
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="text-xs text-white/30 w-5 text-right">
                  {idx + 1}
                </span>
                <span className="truncate">
                  ({team?.seed}) {team?.name ?? `Team ${teamId}`}
                </span>
              </span>
              {sold && (
                <span className="ml-2 flex-shrink-0 text-xs font-mono text-white/30">
                  ${sold.amount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
