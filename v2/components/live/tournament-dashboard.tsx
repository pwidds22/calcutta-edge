'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult, EnabledProp } from '@/lib/tournaments/props';
import { AuctionComplete } from './auction-complete';
import { ResultsEntry } from './results-entry';
import { BracketEntry } from './bracket-entry';
import { Leaderboard } from './leaderboard';
import { GolfLeaderboard } from './golf-leaderboard';
import { SettlementMatrix } from './settlement-matrix';
import { PropsEntry } from './props-entry';
import { ClipboardList, Trophy, BarChart3, Calculator, DollarSign, Dice5, RefreshCw, Activity } from 'lucide-react';

interface TournamentDashboardProps {
  sessionId: string;
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  sessionName: string;
  isCommissioner: boolean;
  config: TournamentConfig;
  payoutRules: PayoutRules;
  initialResults: TournamentResult[];
  enabledProps?: EnabledProp[];
  initialPropResults?: PropResult[];
  initialPaymentTracking?: Record<string, boolean>;
}

type TabKey = 'summary' | 'bracket' | 'results' | 'props' | 'golf-leaderboard' | 'leaderboard' | 'settlement';

/**
 * Whether the dashboard should show the "Sync Scores" button for this
 * tournament. Golf tournaments are eligible if they declare liveSyncMatchers
 * (the same flag the cron + projections endpoint use). March Madness keeps
 * its ESPN-specific path. Adding a new tournament? Set liveSyncMatchers on
 * the config — don't hardcode the id here.
 */
function supportsManualSync(config: TournamentConfig): boolean {
  if (config.sport === 'golf') {
    return !!(config.liveSyncMatchers && config.liveSyncMatchers.length > 0);
  }
  return config.id === 'march_madness_2026';
}

export function TournamentDashboard({
  sessionId,
  soldTeams,
  baseTeams,
  sessionName,
  isCommissioner,
  config,
  payoutRules,
  initialResults,
  enabledProps = [],
  initialPropResults = [],
  initialPaymentTracking = {},
}: TournamentDashboardProps) {
  const hasBracket = !!config.bracketDevigConfig;
  const hasProps = enabledProps.length > 0;

  const [activeTab, setActiveTab] = useState<TabKey>(
    config.sport === 'golf'
      ? 'golf-leaderboard'
      : initialResults.length > 0
        ? 'leaderboard'
        : hasBracket
          ? 'bracket'
          : 'summary'
  );
  const [results, setResults] = useState<TournamentResult[]>(initialResults);
  const [propResults, setPropResults] = useState<PropResult[]>(initialPropResults);
  const [paymentTracking, setPaymentTracking] = useState<Record<string, boolean>>(initialPaymentTracking);

  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);

  // ESPN auto-sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Determine which sync endpoint to use based on tournament sport
  const syncEndpoint = config.sport === 'golf' ? '/api/golf/sync' : '/api/espn/sync';

  const handleEspnSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
      } else if (data.inserted === 0 && data.updated === 0) {
        const lowRoundMsg = data.lowRound
          ? ` | Low R${data.lowRound.round}: ${data.lowRound.players.join(', ')} (${data.lowRound.score > 0 ? '+' : ''}${data.lowRound.score})`
          : '';
        setSyncMessage(`No new results found${lowRoundMsg}`);
      } else {
        const count = data.games?.length ?? data.matched ?? 0;
        const lowRoundMsg = data.lowRound
          ? ` | Low R${data.lowRound.round}: ${data.lowRound.players.join(', ')} (${data.lowRound.score > 0 ? '+' : ''}${data.lowRound.score})`
          : '';
        setSyncMessage(`Synced ${count} ${config.sport === 'golf' ? 'players' : 'games'}${lowRoundMsg}`);
        // Results will update via broadcast — no manual refetch needed
      }
    } catch {
      setSyncMessage('Sync failed — check connection');
    } finally {
      setSyncing(false);
      // Clear message after 4 seconds
      setTimeout(() => setSyncMessage(null), 4000);
    }
  }, [sessionId, syncEndpoint, config.sport]);

  // Auto-sync ESPN on first visit if no results exist yet
  const hasAutoSynced = useRef(false);
  useEffect(() => {
    if (
      !hasAutoSynced.current &&
      (config.id === 'march_madness_2026' || config.id === 'masters_2026') &&
      initialResults.length === 0
    ) {
      hasAutoSynced.current = true;
      handleEspnSync();
    }
  }, [config.id, initialResults.length, handleEspnSync]);

  // Handle prop result updates (from broadcast or local save)
  const handlePropResultUpdate = useCallback(
    (data: PropResult | { propKey: string; propLabel: string; winnerParticipantId: string; winnerTeamId: number | null; metadata: string; payoutPercentage: number }) => {
      const result: PropResult = 'key' in data
        ? data as PropResult
        : {
            key: data.propKey,
            label: data.propLabel,
            winnerParticipantId: data.winnerParticipantId,
            winnerTeamId: data.winnerTeamId,
            metadata: data.metadata,
            payoutPercentage: data.payoutPercentage,
          };
      setPropResults((prev) => {
        const idx = prev.findIndex((r) => r.key === result.key);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = result;
          return next;
        }
        return [...prev, result];
      });
    },
    []
  );

  // Listen for real-time result updates from broadcast
  const handleResultUpdate = useCallback(
    (data: { teamId: number; roundKey: string; result: string }) => {
      setResults((prev) => {
        const idx = prev.findIndex(
          (r) => r.team_id === data.teamId && r.round_key === data.roundKey
        );
        const updated: TournamentResult = {
          team_id: data.teamId,
          round_key: data.roundKey,
          result: data.result as TournamentResult['result'],
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    },
    []
  );

  const handleBulkUpdate = useCallback(
    (data: {
      updates: Array<{ teamId: number; roundKey: string; result: string }>;
    }) => {
      setResults((prev) => {
        const next = [...prev];
        for (const u of data.updates) {
          const idx = next.findIndex(
            (r) => r.team_id === u.teamId && r.round_key === u.roundKey
          );
          const updated: TournamentResult = {
            team_id: u.teamId,
            round_key: u.roundKey,
            result: u.result as TournamentResult['result'],
          };
          if (idx >= 0) {
            next[idx] = updated;
          } else {
            next.push(updated);
          }
        }
        return next;
      });
    },
    []
  );

  // Handle payment tracking updates from broadcast
  const handlePaymentUpdate = useCallback(
    (data: { paymentTracking: Record<string, boolean> }) => {
      setPaymentTracking(data.paymentTracking ?? {});
    },
    []
  );

  // Expose handlers for parent to wire up broadcast events
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__tournamentResultUpdate = handleResultUpdate;
    (window as unknown as Record<string, unknown>).__tournamentBulkUpdate = handleBulkUpdate;
    (window as unknown as Record<string, unknown>).__propResultUpdate = handlePropResultUpdate;
    (window as unknown as Record<string, unknown>).__paymentUpdate = handlePaymentUpdate;
    return () => {
      delete (window as unknown as Record<string, unknown>).__tournamentResultUpdate;
      delete (window as unknown as Record<string, unknown>).__tournamentBulkUpdate;
      delete (window as unknown as Record<string, unknown>).__propResultUpdate;
      delete (window as unknown as Record<string, unknown>).__paymentUpdate;
    };
  }, [handleResultUpdate, handleBulkUpdate, handlePropResultUpdate, handlePaymentUpdate]);

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Trophy; commissionerOnly?: boolean }> = [
    { key: 'summary', label: 'Auction Summary', icon: ClipboardList },
    // Bracket tab: visible to all for bracket-type tournaments (commissioner can edit, others view only)
    ...(hasBracket
      ? [{ key: 'bracket' as TabKey, label: 'Bracket', icon: Trophy }]
      : []),
    // Flat results entry: only for commissioner on non-bracket tournaments (or as fallback)
    ...(isCommissioner && !hasBracket
      ? [{ key: 'results' as TabKey, label: 'Enter Results', icon: Calculator, commissionerOnly: true }]
      : []),
    ...(hasProps
      ? [{ key: 'props' as TabKey, label: 'Props', icon: Dice5 }]
      : []),
    ...(config.sport === 'golf'
      ? [{ key: 'golf-leaderboard' as TabKey, label: 'Live Leaderboard', icon: Activity }]
      : []),
    { key: 'leaderboard', label: 'Standings', icon: BarChart3 },
    { key: 'settlement', label: 'Settlement', icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar + sync button */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Auto-sync button — any tournament whose sync route can match upstream
            feeds. Golf opts in via liveSyncMatchers (PGA, Masters, US Open,
            Open Championship, TOUR Championship...). Basketball still routes
            through the ESPN-specific endpoint with its own hardcoded matcher
            inside the route. Do NOT add a new id here — extend liveSyncMatchers
            on the tournament config instead (see CLAUDE.md anti-pattern). */}
        {supportsManualSync(config) && (
          <button
            onClick={handleEspnSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
            title={`Sync ${config.sport === 'golf' ? 'leaderboard' : 'game results'} from ${config.sport === 'golf' ? 'DataGolf' : 'ESPN'}`}
          >
            <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Scores'}</span>
          </button>
        )}
      </div>

      {/* Sync status message */}
      {syncMessage && (
        <div className={`rounded-md px-3 py-2 text-xs ${
          syncMessage.startsWith('Error') || syncMessage.includes('failed')
            ? 'bg-red-500/10 text-red-400'
            : syncMessage.includes('No new')
              ? 'bg-white/[0.04] text-white/50'
              : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {syncMessage}
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'summary' && (
        <AuctionComplete
          soldTeams={soldTeams}
          baseTeams={baseTeams}
          sessionName={sessionName}
          isCommissioner={isCommissioner}
          config={config}
          payoutRules={payoutRules}
        />
      )}

      {activeTab === 'bracket' && hasBracket && (
        <BracketEntry
          sessionId={sessionId}
          baseTeams={baseTeams}
          config={config}
          results={results}
          isCommissioner={isCommissioner}
          soldTeams={soldTeams}
          payoutRules={payoutRules}
        />
      )}

      {activeTab === 'results' && isCommissioner && !hasBracket && (
        <ResultsEntry
          sessionId={sessionId}
          soldTeams={soldTeams}
          baseTeams={baseTeams}
          config={config}
          payoutRules={payoutRules}
          results={results}
          isCommissioner={isCommissioner}
        />
      )}

      {activeTab === 'props' && hasProps && (
        <PropsEntry
          sessionId={sessionId}
          enabledProps={enabledProps}
          propResults={propResults}
          soldTeams={soldTeams}
          baseTeams={baseTeams}
          isCommissioner={isCommissioner}
          actualPot={actualPot}
          isGolf={config.sport === 'golf'}
          onPropResultUpdate={handlePropResultUpdate}
        />
      )}

      {activeTab === 'golf-leaderboard' && config.sport === 'golf' && (
        <GolfLeaderboard
          soldTeams={soldTeams}
          baseTeams={baseTeams}
          config={config}
          payoutRules={payoutRules}
        />
      )}

      {activeTab === 'leaderboard' && (
        <Leaderboard
          soldTeams={soldTeams}
          baseTeams={baseTeams}
          config={config}
          payoutRules={payoutRules}
          results={results}
          propResults={propResults}
        />
      )}

      {activeTab === 'settlement' && (
        <SettlementMatrix
          sessionId={sessionId}
          soldTeams={soldTeams}
          baseTeams={baseTeams}
          config={config}
          payoutRules={payoutRules}
          results={results}
          propResults={propResults}
          isCommissioner={isCommissioner}
          paymentTracking={paymentTracking}
        />
      )}
    </div>
  );
}
