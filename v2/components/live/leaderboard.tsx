'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import { calculateLeaderboard, type LeaderboardEntry } from '@/lib/auction/live/actual-payouts';
import { calculateProjectedStandings, type ProjectedEntry } from '@/lib/auction/live/projected-standings';
import {
  ChevronDown,
  ChevronRight,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

/** Format a dollar amount — show cents only when not a whole number */
function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

interface LeaderboardProps {
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  payoutRules: PayoutRules;
  results: TournamentResult[];
  propResults?: PropResult[];
}

export function Leaderboard({
  soldTeams,
  baseTeams,
  config,
  payoutRules,
  results,
  propResults = [],
}: LeaderboardProps) {
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(
    null
  );

  // Projected standings state (for golf pre-tournament / in-play)
  const [projected, setProjected] = useState<ProjectedEntry[] | null>(null);
  const [projLoading, setProjLoading] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);
  const [projLastUpdated, setProjLastUpdated] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGolf = config.sport === 'golf';
  const hasResults = results.length > 0;

  const actualPotCalc = soldTeams.reduce((sum, t) => sum + t.amount, 0);

  const [projSource, setProjSource] = useState<string | null>(null);

  const fetchProjections = useCallback(async () => {
    if (!isGolf) return;
    setProjLoading(true);
    try {
      const res = await fetch('/api/golf/projections');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error && (!data.players || data.players.length === 0)) {
        setProjError(data.error);
      } else {
        const entries = calculateProjectedStandings(
          soldTeams, baseTeams, payoutRules, data.players, results, config, propResults
        );
        setProjected(entries);
        setProjSource(data.source === 'in-play' ? 'Live odds' : 'Pre-tournament model');
        setProjLastUpdated(new Date().toLocaleTimeString());
        setProjError(null);
      }
    } catch (err) {
      setProjError(err instanceof Error ? err.message : 'Failed to fetch projections');
    } finally {
      setProjLoading(false);
    }
  }, [isGolf, soldTeams, baseTeams, payoutRules, results, config, propResults]);

  // Fetch projections on mount for golf tournaments, auto-refresh every 60s
  useEffect(() => {
    if (!isGolf) return;
    fetchProjections();
    intervalRef.current = setInterval(fetchProjections, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGolf, fetchProjections]);

  const leaderboard = calculateLeaderboard(
    soldTeams,
    baseTeams,
    results,
    config,
    payoutRules,
    propResults
  );

  const { entries, actualPot, completedRounds, currentRound, isTournamentComplete } =
    leaderboard;

  // ─── Projected Standings View (golf: always show projected until tournament complete) ───
  const showProjected = isGolf && !isTournamentComplete;
  if (showProjected) {
    return (
      <ProjectedLeaderboard
        projected={projected}
        loading={projLoading}
        error={projError}
        lastUpdated={projLastUpdated}
        source={projSource}
        actualPot={actualPotCalc}
        expandedParticipant={expandedParticipant}
        setExpandedParticipant={setExpandedParticipant}
        onRefresh={fetchProjections}
        settledEntries={hasResults ? entries : undefined}
        completedRounds={completedRounds}
        config={config}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Tournament progress */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Pot</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            ${actualPot.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">
            Rounds Complete
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {completedRounds.length} / {config.rounds.length}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">
            Current Round
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {isTournamentComplete
              ? 'Complete'
              : currentRound
                ? (() => {
                    const r = config.rounds.find((r) => r.key === currentRound);
                    return r?.gameLabel ?? r?.label ?? currentRound;
                  })()
                : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">
            Distributed
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            ${fmt(entries.reduce((s, e) => s + e.totalEarned, 0))}
          </p>
        </div>
      </div>

      {/* Leaderboard entries */}
      <div className="space-y-1.5">
        {entries.map((entry, rank) => {
          const isExpanded = expandedParticipant === entry.participantId;
          const plColor =
            entry.netPL > 0
              ? 'text-emerald-400'
              : entry.netPL < 0
                ? 'text-red-400'
                : 'text-white/50';
          const PlIcon =
            entry.netPL > 0
              ? TrendingUp
              : entry.netPL < 0
                ? TrendingDown
                : Minus;

          return (
            <div key={entry.participantId}>
              <button
                onClick={() =>
                  setExpandedParticipant(isExpanded ? null : entry.participantId)
                }
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank */}
                    <span
                      className={`flex size-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        rank === 0
                          ? 'bg-amber-500/20 text-amber-400'
                          : rank === 1
                            ? 'bg-white/10 text-white/60'
                            : rank === 2
                              ? 'bg-orange-500/10 text-orange-400/60'
                              : 'bg-white/[0.04] text-white/30'
                      }`}
                    >
                      {rank + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {entry.participantName}
                      </p>
                      <p className="text-[10px] text-white/30">
                        {entry.teamsOwned} team{entry.teamsOwned !== 1 ? 's' : ''} ·{' '}
                        <span className="text-emerald-400/50">
                          {entry.teamsAlive} alive
                        </span>
                        {entry.teamsEliminated > 0 && (
                          <>
                            {' '}
                            ·{' '}
                            <span className="text-red-400/50">
                              {entry.teamsEliminated} out
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 ml-2">
                    <div className="text-right">
                      <div className={`flex items-center gap-1 text-sm font-mono font-medium ${plColor}`}>
                        <PlIcon className="size-3" />
                        {entry.netPL >= 0 ? '+' : ''}${fmt(entry.netPL)}
                      </div>
                      <p className="text-[10px] text-white/20">
                        earned ${fmt(entry.totalEarned)} · spent ${entry.totalSpent.toLocaleString()}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-white/30" />
                    ) : (
                      <ChevronRight className="size-4 text-white/30" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded team details */}
              {isExpanded && (
                <div className="mt-1 rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-white/20">
                        <th className="px-3 py-1.5 text-left">Team</th>
                        <th className="px-3 py-1.5 text-center">Status</th>
                        <th className="px-3 py-1.5 text-right">Paid</th>
                        <th className="px-3 py-1.5 text-right">Earned</th>
                        <th className="px-3 py-1.5 text-right">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.teams.map((team) => {
                        const teamPL = team.earnings - team.purchasePrice;
                        return (
                          <tr
                            key={team.teamId}
                            className="border-b border-white/[0.02] last:border-0"
                          >
                            <td className="px-3 py-1.5">
                              <div>
                                <span className="text-white/30">({team.seed}) </span>
                                <span className="text-white/70">{team.teamName}</span>
                                <span className="ml-1 text-white/15">{team.group}</span>
                              </div>
                              {team.roundsWon.length > 0 && (
                                <div className="flex gap-1 mt-0.5">
                                  {team.roundsWon.map((rk) => (
                                    <span
                                      key={rk}
                                      className="rounded bg-emerald-500/10 px-1 py-px text-[9px] font-medium text-emerald-400/70"
                                    >
                                      {config.rounds.find((r) => r.key === rk)?.label ?? rk} ✓
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {team.status === 'champion' && (
                                <span className="inline-flex items-center gap-0.5 text-amber-400">
                                  <Trophy className="size-3" /> Champ
                                </span>
                              )}
                              {team.status === 'alive' && (
                                <span className="inline-flex items-center gap-0.5 text-emerald-400">
                                  <CheckCircle2 className="size-3" /> Alive
                                </span>
                              )}
                              {team.status === 'eliminated' && (() => {
                                const round = config.rounds.find(
                                  (r) => r.key === team.eliminatedInRound
                                );
                                return (
                                  <span className="inline-flex items-center gap-0.5 text-red-400/60">
                                    <XCircle className="size-3" />{' '}
                                    {round?.gameLabel ?? round?.label ?? team.eliminatedInRound}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-white/40">
                              ${team.purchasePrice.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-400/70">
                              ${fmt(team.earnings)}
                            </td>
                            <td
                              className={`px-3 py-1.5 text-right font-mono font-medium ${
                                teamPL > 0
                                  ? 'text-emerald-400'
                                  : teamPL < 0
                                    ? 'text-red-400'
                                    : 'text-white/30'
                              }`}
                            >
                              {teamPL >= 0 ? '+' : ''}${fmt(teamPL)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Prop earnings */}
                  {entry.propEarnings.length > 0 && (
                    <div className="border-t border-white/[0.04] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-white/20 mb-1">Prop Winnings</p>
                      {entry.propEarnings.map((pe) => (
                        <div key={pe.propKey} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-amber-400/70">{pe.propLabel}</span>
                          <span className="font-mono text-emerald-400/70">+${fmt(pe.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-8 text-center space-y-2">
          {results.length === 0 ? (
            <>
              <p className="text-sm text-white/40">No game results synced yet.</p>
              <p className="text-xs text-white/25">
                Click the <span className="text-emerald-400 font-medium">Sync Scores</span> button above to pull the latest scores.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-white/40">Games in progress</p>
              <p className="text-xs text-white/25">
                Payouts will appear as each round completes. Sync Scores to get the latest results.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Projected Leaderboard Component ──────────────────────────────

function ProjectedLeaderboard({
  projected,
  loading,
  error,
  lastUpdated,
  source,
  actualPot,
  expandedParticipant,
  setExpandedParticipant,
  onRefresh,
  settledEntries,
  completedRounds,
  config,
}: {
  projected: ProjectedEntry[] | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  source: string | null;
  actualPot: number;
  expandedParticipant: string | null;
  setExpandedParticipant: (id: string | null) => void;
  onRefresh: () => void;
  settledEntries?: LeaderboardEntry[];
  completedRounds?: string[];
  config?: TournamentConfig;
}) {
  // Build settled-earnings lookup by participant
  const settledMap = new Map<string, { earned: number; propEarnings: { propLabel: string; amount: number }[] }>();
  if (settledEntries) {
    for (const e of settledEntries) {
      settledMap.set(e.participantId, {
        earned: e.totalEarned,
        propEarnings: e.propEarnings,
      });
    }
  }
  const totalSettled = settledEntries?.reduce((s, e) => s + e.totalEarned, 0) ?? 0;
  if (loading && !projected) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40 gap-2">
        <RefreshCw className="size-4 animate-spin" />
        <span className="text-sm">Loading projected standings...</span>
      </div>
    );
  }

  if (error && !projected) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-8 text-center space-y-2">
        <BarChart3 className="size-6 text-white/20 mx-auto" />
        <p className="text-sm text-white/40">Projected standings unavailable</p>
        <p className="text-xs text-white/25">
          Live odds data will appear once the tournament is active in DataGolf.
        </p>
      </div>
    );
  }

  if (!projected || projected.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-8 text-center space-y-2">
        <BarChart3 className="size-6 text-white/20 mx-auto" />
        <p className="text-sm text-white/40">No projection data available yet.</p>
        <p className="text-xs text-white/25">
          Projected standings will appear once DataGolf publishes odds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Projected Standings</h3>
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            {source ?? 'Based on odds'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-white/25">Updated {lastUpdated}</span>
          )}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-white/40 hover:text-white/60 transition-colors"
          >
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Explainer */}
      <p className="text-xs text-white/40 leading-relaxed">
        {source === 'Live odds'
          ? 'Rankings based on DataGolf live tournament probabilities. Each team\'s projected value is calculated by multiplying their probability of reaching each payout position (cut, T20, T10, T5, win) by the corresponding payout amount. Updates every 60 seconds.'
          : 'Rankings based on DataGolf pre-tournament model predictions. Each team\'s projected value is calculated by multiplying their probability of reaching each payout position (cut, T20, T10, T5, win) by the corresponding payout amount. Will switch to live odds once the tournament begins.'}
      </p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Pot</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            ${actualPot.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">
            Rounds Complete
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {completedRounds?.length ?? 0} / {config?.rounds.length ?? '?'}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Settled</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            ${fmt(totalSettled)}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Source</p>
          <p className="mt-1 text-lg font-bold text-amber-400 text-sm">
            {source === 'Live odds' ? 'Live Odds' : 'Pre-Tournament'}
          </p>
        </div>
      </div>

      {/* Projected entries */}
      <div className="space-y-1.5">
        {projected.map((entry, rank) => {
          const isExpanded = expandedParticipant === entry.participantId;
          const plColor =
            entry.projectedPL > 0
              ? 'text-emerald-400'
              : entry.projectedPL < 0
                ? 'text-red-400'
                : 'text-white/50';
          const PlIcon =
            entry.projectedPL > 0
              ? TrendingUp
              : entry.projectedPL < 0
                ? TrendingDown
                : Minus;

          return (
            <div key={entry.participantId}>
              <button
                onClick={() =>
                  setExpandedParticipant(isExpanded ? null : entry.participantId)
                }
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex size-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        rank === 0
                          ? 'bg-amber-500/20 text-amber-400'
                          : rank === 1
                            ? 'bg-white/10 text-white/60'
                            : rank === 2
                              ? 'bg-orange-500/10 text-orange-400/60'
                              : 'bg-white/[0.04] text-white/30'
                      }`}
                    >
                      {rank + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {entry.participantName}
                      </p>
                      <p className="text-[10px] text-white/30">
                        {entry.teamsOwned} team{entry.teamsOwned !== 1 ? 's' : ''} · spent ${entry.totalSpent}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 ml-2">
                    <div className="text-right">
                      <div className={`flex items-center gap-1 text-sm font-mono font-medium ${plColor}`}>
                        <PlIcon className="size-3" />
                        {entry.projectedPL >= 0 ? '+' : ''}${fmt(entry.projectedPL)}
                      </div>
                      <p className="text-[10px] text-white/20">
                        {entry.settledEarnings > 0
                          ? `earned $${fmt(entry.settledEarnings)} · proj. $${fmt(entry.blendedEarnings)}`
                          : `proj. value $${fmt(entry.blendedEarnings)}`}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-white/30" />
                    ) : (
                      <ChevronRight className="size-4 text-white/30" />
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-1 rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-white/20">
                        <th className="px-3 py-1.5 text-left">Team</th>
                        <th className="px-3 py-1.5 text-right">Paid</th>
                        <th className="px-3 py-1.5 text-right">Earned</th>
                        <th className="px-3 py-1.5 text-right">Proj. EV</th>
                        <th className="px-3 py-1.5 text-right">Win %</th>
                        <th className="px-3 py-1.5 text-right">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.teams.map((team) => {
                        const displayEV = team.blendedEV ?? team.projectedEV ?? 0;
                        const teamPL = displayEV - team.purchasePrice;
                        return (
                          <tr
                            key={team.teamId}
                            className="border-b border-white/[0.02] last:border-0"
                          >
                            <td className="px-3 py-1.5">
                              <span className="text-white/30">({team.seed}) </span>
                              <span className="text-white/70">{team.teamName}</span>
                              <span className="ml-1 text-white/15">{team.group}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-white/40">
                              ${team.purchasePrice.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-400/70">
                              {team.settledEarnings > 0 ? `$${fmt(team.settledEarnings)}` : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-amber-400/70">
                              {team.blendedEV !== null ? `$${fmt(team.blendedEV)}` : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-white/40">
                              {team.winProb !== null ? `${(team.winProb * 100).toFixed(1)}%` : '—'}
                            </td>
                            <td
                              className={`px-3 py-1.5 text-right font-mono font-medium ${
                                teamPL > 0
                                  ? 'text-emerald-400'
                                  : teamPL < 0
                                    ? 'text-red-400'
                                    : 'text-white/30'
                              }`}
                            >
                              {(team.blendedEV !== null || team.projectedEV !== null)
                                ? `${teamPL >= 0 ? '+' : ''}$${fmt(teamPL)}`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
