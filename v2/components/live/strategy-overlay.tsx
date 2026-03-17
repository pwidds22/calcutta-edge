'use client';

import { useState, useEffect, useMemo } from 'react';
import type { BaseTeam, TournamentConfig, PayoutRules, TeamBundle } from '@/lib/tournaments/types';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { OddsSourceRegistry } from '@/lib/tournaments/odds-sources';
import { blendProbabilities } from '@/lib/tournaments/odds-sources';
import { initializeTeams } from '@/lib/calculations/initialize';
import { formatCurrency } from '@/lib/calculations/format';
import { TrendingUp, Lock, ExternalLink, ChevronDown, SlidersHorizontal } from 'lucide-react';

const SUGGESTED_BID_KEY = 'calcutta_suggested_bid_pct';
const ODDS_SOURCE_KEY = 'calcutta_odds_source';
const BLEND_WEIGHTS_KEY = 'calcutta_blend_weights';
const DEFAULT_BID_PCT = 95;
const DEFAULT_BLEND_WEIGHTS: Record<string, number> = {
  evan_miya: 34,
  team_rankings: 33,
  fanduel: 0,
  draftkings: 0,
  pinnacle: 33,
};

/** Renders round-by-round odds + cumulative profit for a single team */
function RoundOddsRow({
  team,
  config,
  payoutRules,
  projectedPot,
  purchasePrice,
}: {
  team: { odds?: Record<string, number> };
  config: TournamentConfig;
  payoutRules: PayoutRules;
  projectedPot: number;
  purchasePrice: number;
}) {
  let cumulativePayout = 0;
  const roundData = config.rounds.map((round) => {
    cumulativePayout += (payoutRules[round.key] ?? 0) / 100 * projectedPot;
    const roundOdds = team.odds?.[round.key] ?? 0;
    const profit = purchasePrice > 0 ? cumulativePayout - purchasePrice : null;
    return { round, roundOdds, profit };
  });

  return (
    <div className="mt-3 flex gap-1.5">
      {roundData.map(({ round, roundOdds, profit }) => (
        <div
          key={round.key}
          className="flex-1 rounded-md bg-white/[0.04] px-1 py-1.5 text-center"
        >
          <p className="text-[9px] text-white/30">{round.label}</p>
          <p className="text-[10px] font-bold text-white/80">
            {(roundOdds * 100).toFixed(1)}%
          </p>
          {profit !== null && (
            <p
              className={`text-[9px] font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {profit >= 0 ? '+' : ''}
              {formatCurrency(profit)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

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
  oddsRegistry?: OddsSourceRegistry;
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
  oddsRegistry,
}: StrategyOverlayProps) {
  // --- Local state: odds source selection ---
  const [selectedSource, setSelectedSource] = useState<string>(() => {
    if (typeof window === 'undefined') return oddsRegistry?.defaultSourceId ?? 'evan_miya';
    return localStorage.getItem(ODDS_SOURCE_KEY) ?? oddsRegistry?.defaultSourceId ?? 'evan_miya';
  });
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // --- Local state: blend weights ---
  const [blendWeights, setBlendWeights] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return DEFAULT_BLEND_WEIGHTS;
    try {
      const stored = localStorage.getItem(BLEND_WEIGHTS_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_BLEND_WEIGHTS;
    } catch { return DEFAULT_BLEND_WEIGHTS; }
  });

  // --- Local state: suggested bid % ---
  const [bidPct, setBidPct] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_BID_PCT;
    const stored = localStorage.getItem(SUGGESTED_BID_KEY);
    return stored ? Number(stored) : DEFAULT_BID_PCT;
  });
  const [showBidSettings, setShowBidSettings] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(ODDS_SOURCE_KEY, selectedSource);
  }, [selectedSource]);
  useEffect(() => {
    localStorage.setItem(SUGGESTED_BID_KEY, String(bidPct));
  }, [bidPct]);
  useEffect(() => {
    localStorage.setItem(BLEND_WEIGHTS_KEY, JSON.stringify(blendWeights));
  }, [blendWeights]);

  // Blendable sources (models + sportsbooks only)
  const blendableSources = useMemo(
    () => oddsRegistry?.sources.filter(s => s.type === 'model' || s.type === 'sportsbook') ?? [],
    [oddsRegistry]
  );

  // --- Apply selected odds source to base teams ---
  const adjustedTeams = useMemo(() => {
    if (!oddsRegistry) return baseTeams;

    // Blend mode: compute weighted average
    if (selectedSource === 'blend') {
      const activeSources = blendableSources
        .filter(s => (blendWeights[s.id] ?? 0) > 0)
        .map(s => ({ data: oddsRegistry.staticData[s.id], weight: blendWeights[s.id] }))
        .filter(s => s.data);
      if (activeSources.length === 0) return baseTeams;

      const teamIds = baseTeams.map(t => t.id);
      const roundKeys = config.rounds.map(r => r.key);
      const blended = blendProbabilities(activeSources, teamIds, roundKeys);

      return baseTeams.map((bt) => {
        const teamProbs = blended.teams[bt.id];
        if (!teamProbs) return bt;
        return { ...bt, probabilities: teamProbs, americanOdds: {} as Record<string, number> };
      });
    }

    if (selectedSource === oddsRegistry.defaultSourceId) {
      return baseTeams;
    }
    const sourceData = oddsRegistry.staticData[selectedSource];
    if (!sourceData) return baseTeams;

    return baseTeams.map((bt) => {
      const teamProbs = sourceData.teams[bt.id];
      if (!teamProbs) return bt;
      return { ...bt, probabilities: teamProbs, americanOdds: {} as Record<string, number> };
    });
  }, [baseTeams, selectedSource, oddsRegistry, blendWeights, blendableSources, config.rounds]);

  const currentSourceName = selectedSource === 'blend'
    ? 'Blend'
    : (oddsRegistry?.sources.find(s => s.id === selectedSource)?.name ?? 'Default');

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

  const totalSpent = soldTeams.reduce((sum, s) => sum + s.amount, 0);

  const teams = initializeTeams(
    adjustedTeams,
    savedTeams,
    payoutRules,
    estimatedPotSize,
    config
  );

  const soldValuePct = savedTeams.reduce((sum, s) => {
    const t = teams.find((team) => team.id === s.id);
    return sum + (t?.valuePercentage ?? 0);
  }, 0);
  const projectedPot =
    soldValuePct > 0 ? totalSpent / soldValuePct : estimatedPotSize;

  // Current team / bundle resolution
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
  const edge =
    currentHighestBid > 0
      ? ((fairValue - currentHighestBid) / fairValue) * 100
      : null;
  const suggestedBid = fairValue * (bidPct / 100);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      {/* Header row: title + odds source + settings */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Strategy Data
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Odds source picker */}
          {oddsRegistry && (
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowSourcePicker(!showSourcePicker); setShowBidSettings(false); }}
                className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-white/50 hover:border-white/15 hover:text-white/70 transition-colors"
              >
                {currentSourceName}
                <ChevronDown className="size-2.5" />
              </button>
              {showSourcePicker && (
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-white/[0.08] bg-zinc-900 p-1 shadow-xl">
                  {oddsRegistry.sources
                    .filter(s => s.id !== 'custom')
                    .map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => { setSelectedSource(src.id); if (src.id !== 'blend') setShowSourcePicker(false); }}
                      className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        selectedSource === src.id
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'text-white/60 hover:bg-white/[0.06] hover:text-white/80'
                      }`}
                    >
                      <span className="font-medium">{src.name}</span>
                      <span className="ml-1.5 text-[10px] text-white/30">
                        {src.type === 'model' ? '📊' : src.type === 'blend' ? '⚖️' : '🏈'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Bid % settings toggle */}
          <button
            type="button"
            onClick={() => { setShowBidSettings(!showBidSettings); setShowSourcePicker(false); }}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors ${
              showBidSettings
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-white/[0.08] bg-white/[0.04] text-white/50 hover:border-white/15 hover:text-white/70'
            }`}
          >
            <SlidersHorizontal className="size-2.5" />
            {bidPct}%
          </button>
        </div>
      </div>

      {/* Blend weights panel */}
      {selectedSource === 'blend' && oddsRegistry && (
        <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-emerald-300">Blend Weights</span>
          </div>
          <div className="space-y-2">
            {blendableSources.map((src) => (
              <div key={src.id} className="flex items-center gap-2">
                <span className="w-20 text-[10px] text-white/50 truncate">{src.name}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={blendWeights[src.id] ?? 0}
                  onChange={(e) => setBlendWeights(prev => ({ ...prev, [src.id]: Number(e.target.value) }))}
                  className="flex-1 h-1 rounded-full appearance-none bg-white/10 accent-emerald-500 cursor-pointer"
                />
                <span className="w-8 text-right text-[10px] font-mono text-emerald-400">
                  {blendWeights[src.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested bid settings panel */}
      {showBidSettings && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-amber-300">Suggested Bid %</span>
            <span className="text-xs font-bold text-amber-400">{bidPct}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={bidPct}
            onChange={(e) => setBidPct(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-white/30">50% (aggressive)</span>
            <span className="text-[9px] text-white/30">100% (full value)</span>
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <p className="text-[10px] text-white/40">Fair Value</p>
          <p className="text-sm font-bold text-emerald-400">
            {formatCurrency(fairValue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/40">Sug. Bid</p>
          <p className="text-sm font-bold text-amber-400">
            {formatCurrency(suggestedBid)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/40">Edge</p>
          {edge !== null ? (
            <p
              className={`text-sm font-bold ${edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {edge > 0 ? '+' : ''}
              {edge.toFixed(1)}%
            </p>
          ) : (
            <p className="text-sm font-bold text-white/30">—</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-white/40">Proj. Pot</p>
          <p className="text-sm font-bold text-white/60">
            {formatCurrency(projectedPot)}
          </p>
        </div>
      </div>

      {/* Round-by-round odds + profit if team reaches that round */}
      {!isBundle && currentTeam && (
        <RoundOddsRow
          team={currentTeam}
          config={config}
          payoutRules={payoutRules}
          projectedPot={projectedPot}
          purchasePrice={currentHighestBid}
        />
      )}

      {/* Bundle: per-member with full round-by-round odds */}
      {isBundle && bundleTeams.length > 0 && (
        <div className="mt-3 space-y-2">
          {bundleTeams.map((member) => {
            const memberFV = member.valuePercentage * projectedPot;
            return (
              <div key={member.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-white/60">{member.name}</span>
                  <span className="text-[10px] font-medium text-emerald-400">
                    FV {formatCurrency(memberFV)}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {config.rounds.map((round) => {
                    const roundOdds = member.odds?.[round.key] ?? 0;
                    return (
                      <div
                        key={round.key}
                        className="flex-1 rounded-md bg-white/[0.04] px-1 py-1.5 text-center"
                      >
                        <p className="text-[9px] text-white/30">{round.label}</p>
                        <p className="text-[10px] font-bold text-white/80">
                          {(roundOdds * 100).toFixed(1)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
