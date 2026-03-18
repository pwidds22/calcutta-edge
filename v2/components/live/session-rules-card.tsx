'use client';

import type { PayoutRules } from '@/lib/tournaments/types';
import type { SessionSettings } from '@/lib/auction/live/types';
import { BID_INCREMENT_PRESETS } from '@/lib/auction/live/types';
import { BUNDLE_PRESETS } from '@/lib/tournaments/bundles';
import {
  DollarSign,
  Timer,
  TrendingUp,
  Layers,
  Gavel,
  Zap,
  Info,
} from 'lucide-react';

interface SessionRulesCardProps {
  payoutRules: PayoutRules;
  estimatedPotSize: number;
  settings: SessionSettings;
  teamCount: number;
}

export function SessionRulesCard({
  payoutRules,
  estimatedPotSize,
  settings,
  teamCount,
}: SessionRulesCardProps) {
  const timer = settings.timer;
  const increments = settings.bidIncrements;
  const bundlePreset = settings.bundlePreset;
  const bundles = settings.bundles ?? [];
  const minimumBid = settings.minimumBid ?? 0;

  // Determine increment preset label
  let incrementLabel = 'Custom';
  if (increments) {
    for (const [, preset] of Object.entries(BID_INCREMENT_PRESETS)) {
      if (
        preset.values.length === increments.length &&
        preset.values.every((v, i) => v === increments[i])
      ) {
        incrementLabel = `${preset.label} (${preset.description})`;
        break;
      }
    }
    if (incrementLabel === 'Custom') {
      incrementLabel = increments.map((v) => `$${v}`).join(', ');
    }
  }

  // Sort payout rules by round order and compute total
  const sortedRules = Object.entries(payoutRules)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a);
  const totalPayout = sortedRules.reduce((sum, [, pct]) => sum + pct, 0);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <Info className="size-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Auction Rules</h3>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {/* Payout Structure — the main thing people ask about */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-white/50">
            <TrendingUp className="size-3.5 text-emerald-400" />
            Payout Structure
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {sortedRules.map(([round, pct]) => (
              <div key={round} className="flex items-center justify-between">
                <span className="text-xs text-white/40 capitalize">
                  {formatRoundName(round)}
                </span>
                <span className="text-xs font-medium text-white/80">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
          {totalPayout !== 100 && (
            <p className="text-[11px] text-amber-400/80">
              Total: {totalPayout}% of pot
            </p>
          )}
        </div>

        {/* Pot + Teams */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/50">
            <DollarSign className="size-3.5 text-emerald-400" />
            Estimated Pot
          </div>
          <p className="mt-1 text-sm font-medium text-white">
            ${estimatedPotSize.toLocaleString()}
            <span className="ml-2 text-xs font-normal text-white/30">
              {teamCount} teams
            </span>
          </p>
          {minimumBid > 0 && (
            <p className="mt-0.5 text-xs text-white/40">
              Minimum bid: ${minimumBid}
            </p>
          )}
        </div>

        {/* Timer */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/50">
            <Timer className="size-3.5 text-emerald-400" />
            Timer
          </div>
          {timer?.enabled ? (
            <p className="mt-1 text-sm text-white/80">
              {timer.initialDurationSec}s per team
              <span className="mx-1.5 text-white/20">·</span>
              resets to {timer.resetDurationSec}s on new bid
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/40">No timer — commissioner closes manually</p>
          )}
        </div>

        {/* Bid Increments */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/50">
            <Gavel className="size-3.5 text-emerald-400" />
            Bid Increments
          </div>
          <p className="mt-1 text-sm text-white/80">{incrementLabel}</p>
        </div>

        {/* Bundling */}
        {bundles.length > 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white/50">
              <Layers className="size-3.5 text-emerald-400" />
              Team Bundling
            </div>
            <p className="mt-1 text-sm text-white/80">
              {bundlePreset && bundlePreset !== 'none'
                ? BUNDLE_PRESETS[bundlePreset]?.label ?? bundlePreset
                : `${bundles.length} custom bundles`}
            </p>
            <p className="mt-0.5 text-xs text-white/30">
              Bundled teams are auctioned and sold as a group
            </p>
          </div>
        )}

        {/* Auto Mode */}
        {settings.autoMode && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400/80">
              <Zap className="size-3.5" />
              Auto-mode enabled
            </div>
            <p className="mt-0.5 text-xs text-white/30">
              Bidding opens automatically when each team is presented
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Format DB round keys like "round_of_64" → "Round of 64" */
function formatRoundName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
