'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AuctionProvider, useAuction } from '@/lib/auction/auction-context';
import { useAutoSave } from '@/lib/auction/use-auto-save';
import { PotSizeSection } from './pot-size-section';
import { PayoutRulesEditor } from './payout-rules-editor';
import { SummaryStatsCards } from './summary-stats-cards';
import { TeamTable } from './team-table';
import { OddsSourceSelector } from './odds-source-selector';
import { initializeTeams } from '@/lib/calculations/initialize';
import { buildMarchMadness2026Registry } from '@/lib/tournaments/odds-sources';
import { Lock } from 'lucide-react';
import type { SavedTeamData, PayoutRules, TournamentConfig, BaseTeam } from '@/lib/calculations/types';

interface AuctionToolInnerProps {
  initialTeams: SavedTeamData[];
  initialPayoutRules: PayoutRules;
  initialPotSize: number;
  config: TournamentConfig;
  baseTeams: BaseTeam[];
  hasPaid: boolean;
}

function AuctionToolInner({
  initialTeams,
  initialPayoutRules,
  initialPotSize,
  config,
  baseTeams,
  hasPaid,
}: AuctionToolInnerProps) {
  const { state, dispatch } = useAuction();
  const { isSaving, lastSaved, error } = useAutoSave();
  const oddsRegistry = useMemo(() => buildMarchMadness2026Registry(), []);

  // Initialize on mount
  useEffect(() => {
    const teams = initializeTeams(
      baseTeams,
      initialTeams,
      initialPayoutRules,
      initialPotSize,
      config
    );
    dispatch({
      type: 'SET_INITIAL_DATA',
      teams,
      payoutRules: initialPayoutRules,
      estimatedPotSize: initialPotSize,
      config,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading auction data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upgrade banner for unpaid users */}
      {!hasPaid && (
        <div className="relative overflow-hidden rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-emerald-500/20 p-2">
                <Lock className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  You&apos;re viewing a preview
                </p>
                <p className="text-xs text-white/50">
                  Unlock all {state.teams.length || 64} teams with fair values, bid recommendations, and profit projections.
                </p>
              </div>
            </div>
            <Link
              href="/payment"
              className="w-full shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500 transition-colors sm:w-auto"
            >
              Unlock — $29.99
            </Link>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-white/30">
          {isSaving
            ? 'Saving...'
            : lastSaved
              ? `Saved ${lastSaved.toLocaleTimeString()}`
              : ''}
          {error && <span className="text-red-400"> Error: {error}</span>}
        </span>
      </div>

      {/* Odds source selector */}
      <OddsSourceSelector registry={oddsRegistry} />

      {/* Pot size */}
      <PotSizeSection />

      {/* Payout rules */}
      <PayoutRulesEditor />

      {/* Summary stats */}
      <SummaryStatsCards />

      {/* Team table */}
      <TeamTable />
    </div>
  );
}

export function AuctionTool(props: AuctionToolInnerProps) {
  return (
    <AuctionProvider hasPaid={props.hasPaid}>
      <AuctionToolInner {...props} />
    </AuctionProvider>
  );
}
