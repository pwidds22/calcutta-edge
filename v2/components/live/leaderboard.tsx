'use client';

import { useState } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import { calculateLeaderboard } from '@/lib/auction/live/actual-payouts';
import {
  ChevronDown,
  ChevronRight,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
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
