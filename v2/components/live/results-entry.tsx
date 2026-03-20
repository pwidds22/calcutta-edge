'use client';

import { useState, useCallback } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import { updateResult } from '@/actions/tournament-results';
import { getAliveTeamsForRound } from '@/lib/auction/live/actual-payouts';
import { CheckCircle2, XCircle, Clock, Trophy } from 'lucide-react';

interface ResultsEntryProps {
  sessionId: string;
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  payoutRules: PayoutRules;
  results: TournamentResult[];
  isCommissioner: boolean;
}

export function ResultsEntry({
  sessionId,
  soldTeams,
  baseTeams,
  config,
  payoutRules,
  results,
  isCommissioner,
}: ResultsEntryProps) {
  const [activeRound, setActiveRound] = useState(config.rounds[0]?.key ?? '');
  const [saving, setSaving] = useState<string | null>(null);

  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const soldTeamIds = soldTeams.map((t) => t.teamId);

  // Build result lookup: "teamId:roundKey" -> result
  const resultMap = new Map<string, string>();
  for (const r of results) {
    resultMap.set(`${r.team_id}:${r.round_key}`, r.result);
  }

  // Get alive teams for the active round
  const aliveTeams = getAliveTeamsForRound(soldTeamIds, results, config, activeRound);

  // Get sold team info for display
  const soldTeamMap = new Map(soldTeams.map((t) => [t.teamId, t]));

  // Count resolved teams for this round
  const resolvedCount = aliveTeams.filter((id) => {
    const result = resultMap.get(`${id}:${activeRound}`);
    return result === 'won' || result === 'lost';
  }).length;

  // Check which rounds are complete
  const roundCompletion = config.rounds.map((round) => {
    const alive = getAliveTeamsForRound(soldTeamIds, results, config, round.key);
    if (alive.length === 0) return 'future';
    const resolved = alive.filter((id) => {
      const r = resultMap.get(`${id}:${round.key}`);
      return r === 'won' || r === 'lost';
    }).length;
    if (resolved === alive.length) return 'complete';
    if (resolved > 0) return 'partial';
    return 'pending';
  });

  const handleToggle = useCallback(
    async (teamId: number, newResult: 'won' | 'lost' | 'pending') => {
      if (!isCommissioner) return;
      const key = `${teamId}:${activeRound}`;
      setSaving(key);
      await updateResult(sessionId, teamId, activeRound, newResult);
      setSaving(null);
    },
    [sessionId, activeRound, isCommissioner]
  );

  // Sort alive teams by seed
  const sortedAlive = [...aliveTeams].sort((a, b) => {
    const teamA = teamMap.get(a);
    const teamB = teamMap.get(b);
    return (teamA?.seed ?? 99) - (teamB?.seed ?? 99);
  });

  return (
    <div className="space-y-4">
      {/* Round tabs */}
      <div className="flex flex-wrap gap-1.5">
        {config.rounds.map((round, idx) => {
          const completion = roundCompletion[idx];
          const isActive = round.key === activeRound;
          return (
            <button
              key={round.key}
              onClick={() => setActiveRound(round.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                  : completion === 'complete'
                    ? 'bg-emerald-500/5 text-emerald-400/60 hover:bg-emerald-500/10'
                    : completion === 'partial'
                      ? 'bg-amber-500/5 text-amber-400/60 hover:bg-amber-500/10'
                      : completion === 'future'
                        ? 'bg-white/[0.02] text-white/20 cursor-not-allowed'
                        : 'bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'
              }`}
              disabled={completion === 'future'}
            >
              {completion === 'complete' && <CheckCircle2 className="size-3" />}
              {completion === 'partial' && <Clock className="size-3" />}
              {round.gameLabel ?? round.label}
            </button>
          );
        })}
      </div>

      {/* Round progress */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>
          {aliveTeams.length > 0 ? (
            <>
              {resolvedCount} of {aliveTeams.length} teams resolved
            </>
          ) : (
            'Waiting for previous rounds to complete'
          )}
        </span>
        {payoutRules[activeRound] !== undefined && (
          <span className="text-emerald-400/60">
            {payoutRules[activeRound]}% of pot
          </span>
        )}
      </div>

      {/* Team list */}
      {aliveTeams.length === 0 ? (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-8 text-center">
          <p className="text-sm text-white/30">
            Complete previous rounds first to see teams for this round.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedAlive.map((teamId) => {
            const team = teamMap.get(teamId);
            const sold = soldTeamMap.get(teamId);
            const currentResult = resultMap.get(`${teamId}:${activeRound}`) ?? 'pending';
            const isSaving = saving === `${teamId}:${activeRound}`;

            return (
              <div
                key={teamId}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 transition-colors ${
                  currentResult === 'won'
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : currentResult === 'lost'
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-white/30 w-6 text-right flex-shrink-0">
                    ({team?.seed})
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {team?.name ?? `Team ${teamId}`}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {team?.group} · {sold?.winnerName ?? 'Unknown'} · ${sold?.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {isCommissioner ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button
                      onClick={() =>
                        handleToggle(teamId, currentResult === 'won' ? 'pending' : 'won')
                      }
                      disabled={isSaving}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        currentResult === 'won'
                          ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                          : 'bg-white/[0.04] text-white/40 hover:bg-emerald-500/10 hover:text-emerald-400'
                      }`}
                    >
                      <CheckCircle2 className="size-3" />
                      Won
                    </button>
                    <button
                      onClick={() =>
                        handleToggle(teamId, currentResult === 'lost' ? 'pending' : 'lost')
                      }
                      disabled={isSaving}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        currentResult === 'lost'
                          ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                          : 'bg-white/[0.04] text-white/40 hover:bg-red-500/10 hover:text-red-400'
                      }`}
                    >
                      <XCircle className="size-3" />
                      Lost
                    </button>
                  </div>
                ) : (
                  <div className="flex-shrink-0 ml-2">
                    {currentResult === 'won' && (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="size-3" /> Won
                      </span>
                    )}
                    {currentResult === 'lost' && (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-400">
                        <XCircle className="size-3" /> Lost
                      </span>
                    )}
                    {currentResult === 'pending' && (
                      <span className="flex items-center gap-1 text-xs font-medium text-white/30">
                        <Clock className="size-3" /> Pending
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Champion detection */}
      {(() => {
        const lastRound = config.rounds[config.rounds.length - 1];
        if (!lastRound) return null;
        const champResult = aliveTeams.find(
          (id) => resultMap.get(`${id}:${lastRound.key}`) === 'won'
        );
        if (!champResult) return null;
        const champTeam = teamMap.get(champResult);
        const champOwner = soldTeamMap.get(champResult);
        return (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <Trophy className="mx-auto mb-2 size-8 text-amber-400" />
            <p className="text-lg font-bold text-white">
              {champTeam?.name ?? `Team ${champResult}`}
            </p>
            <p className="text-sm text-amber-400/80">
              Champion · Owned by {champOwner?.winnerName ?? 'Unknown'}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
