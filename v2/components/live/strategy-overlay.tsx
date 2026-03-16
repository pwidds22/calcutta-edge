'use client';

import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import { initializeTeams } from '@/lib/calculations/initialize';
import { formatCurrency } from '@/lib/calculations/format';
import { TrendingUp, Lock, ExternalLink } from 'lucide-react';

interface StrategyOverlayProps {
  hasPaid: boolean;
  currentTeamId: number | string | null;
  currentHighestBid: number;
  config: TournamentConfig;
  baseTeams: BaseTeam[];
  payoutRules: PayoutRules;
  estimatedPotSize: number;
  soldTeams: SoldTeam[];
}

export function StrategyOverlay({
  hasPaid,
  currentTeamId,
  currentHighestBid,
  config,
  baseTeams,
  payoutRules,
  estimatedPotSize,
  soldTeams,
}: StrategyOverlayProps) {
  if (!hasPaid) {
    const paymentUrl = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL;

    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Lock className="size-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">
              Strategy Data Available
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              See fair values, suggested bids, edge %, and round-by-round
              profit projections for every team — live during bidding.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {paymentUrl ? (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
            >
              Unlock for $29.99
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <a
              href="/payment"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
            >
              Unlock for $29.99
            </a>
          )}
          <span className="text-[10px] text-white/30">
            Opens in new tab — come back to keep bidding
          </span>
        </div>
      </div>
    );
  }

  if (currentTeamId === null) return null;

  // Skip strategy overlay for bundles — no single-team fair value applies
  if (typeof currentTeamId === 'string') return null;

  // Build saved data from sold teams for calculation engine
  const savedTeams = soldTeams.map((s) => ({
    id: s.teamId,
    purchasePrice: s.amount,
    isMyTeam: false,
  }));

  // Use live pot (sum of all sales) to project total pot
  const totalSpent = soldTeams.reduce((sum, s) => sum + s.amount, 0);

  const teams = initializeTeams(
    baseTeams,
    savedTeams,
    payoutRules,
    estimatedPotSize,
    config
  );

  const currentTeam = teams.find((t) => t.id === currentTeamId);
  if (!currentTeam) return null;

  // Calculate projected pot from actual sales
  const soldValuePct = savedTeams.reduce((sum, s) => {
    const t = teams.find((team) => team.id === s.id);
    return sum + (t?.valuePercentage ?? 0);
  }, 0);
  const projectedPot =
    soldValuePct > 0 ? totalSpent / soldValuePct : estimatedPotSize;

  const fairValue = currentTeam.valuePercentage * projectedPot;
  const suggestedBid = fairValue * 0.95;
  const edge =
    currentHighestBid > 0
      ? ((fairValue - currentHighestBid) / fairValue) * 100
      : null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="size-4 text-emerald-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Strategy Data
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-white/40">Fair Value</p>
          <p className="text-sm font-bold text-white">
            {formatCurrency(fairValue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/40">Suggested Bid</p>
          <p className="text-sm font-bold text-emerald-400">
            {formatCurrency(suggestedBid)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/40">
            {edge !== null ? 'Edge' : 'Proj. Pot'}
          </p>
          {edge !== null ? (
            <p
              className={`text-sm font-bold ${edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {edge > 0 ? '+' : ''}
              {edge.toFixed(1)}%
            </p>
          ) : (
            <p className="text-sm font-bold text-white/60">
              {formatCurrency(projectedPot)}
            </p>
          )}
        </div>
      </div>

      {/* Round-by-round odds + profit */}
      <div className="mt-3 flex gap-1.5">
        {config.rounds.map((round) => {
          const roundOdds = currentTeam.odds?.[round.key] ?? 0;
          const cumulativeProfit = currentHighestBid > 0
            ? config.rounds
                .slice(0, config.rounds.indexOf(round) + 1)
                .reduce((sum, r) => {
                  const o = currentTeam.odds?.[r.key] ?? 0;
                  const p = (payoutRules[r.key] ?? 0) / 100;
                  return sum + o * p * projectedPot;
                }, 0) - currentHighestBid
            : null;

          return (
            <div
              key={round.key}
              className="flex-1 rounded-md bg-white/[0.04] px-1 py-1.5 text-center"
            >
              <p className="text-[9px] text-white/30">{round.label}</p>
              <p className="text-[10px] font-bold text-white/80">
                {(roundOdds * 100).toFixed(1)}%
              </p>
              {cumulativeProfit !== null && (
                <p
                  className={`text-[9px] font-medium ${cumulativeProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {cumulativeProfit >= 0 ? '+' : ''}
                  {formatCurrency(cumulativeProfit)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
