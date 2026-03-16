'use client';

import type { BaseTeam, TournamentConfig, PayoutRules, TeamBundle } from '@/lib/tournaments/types';
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
  bundles?: TeamBundle[];
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
  bundles = [],
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

  // Calculate projected pot from actual sales
  const soldValuePct = savedTeams.reduce((sum, s) => {
    const t = teams.find((team) => team.id === s.id);
    return sum + (t?.valuePercentage ?? 0);
  }, 0);
  const projectedPot =
    soldValuePct > 0 ? totalSpent / soldValuePct : estimatedPotSize;

  // For bundles, aggregate fair values of all member teams
  const isBundle = typeof currentTeamId === 'string' && currentTeamId.startsWith('b:');
  const bundleId = isBundle ? currentTeamId.slice(2) : null;
  const bundle = bundleId ? bundles.find((b) => b.id === bundleId) : null;

  let bundleTeams: typeof teams = [];
  let currentTeam: (typeof teams)[number] | null = null;

  if (isBundle && bundle) {
    bundleTeams = bundle.teamIds
      .map((tid) => teams.find((t) => t.id === tid))
      .filter((t): t is (typeof teams)[number] => !!t);
    if (bundleTeams.length === 0) return null;
  } else {
    currentTeam = teams.find((t) => t.id === currentTeamId) ?? null;
    if (!currentTeam) return null;
  }

  const fairValue = isBundle
    ? bundleTeams.reduce((sum, t) => sum + t.valuePercentage * projectedPot, 0)
    : currentTeam!.valuePercentage * projectedPot;
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
      {!isBundle && currentTeam && (
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
      )}

      {/* Bundle: per-member fair value breakdown */}
      {isBundle && bundleTeams.length > 0 && (
        <div className="mt-3 space-y-1">
          {bundleTeams.map((member) => {
            const memberFV = member.valuePercentage * projectedPot;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md bg-white/[0.04] px-2 py-1"
              >
                <span className="text-[10px] text-white/60">{member.name}</span>
                <span className="text-[10px] font-medium text-white/80">
                  {formatCurrency(memberFV)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
