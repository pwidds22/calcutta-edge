'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import { updateResult, bulkUpdateResults } from '@/actions/tournament-results';
import { getAliveTeamsForRound } from '@/lib/auction/live/actual-payouts';
import { resolveUnitEntry, MAX_FLAT_RATE_UNITS } from '@/lib/auction/live/unit-entry';
import { roundBudget } from '@/lib/tournaments/payout-presets';
import { formatGroupLabel } from '@/lib/calculations/format';
import { CheckCircle2, XCircle, Clock, Trophy, Save } from 'lucide-react';

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
  const [savingAll, setSavingAll] = useState(false);
  const unitInputRefs = useRef(new Map<number, HTMLInputElement>());

  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const soldTeamIds = soldTeams.map((t) => t.teamId);

  // Build result lookup: "teamId:roundKey" -> result
  const resultMap = new Map<string, string>();
  for (const r of results) {
    resultMap.set(`${r.team_id}:${r.round_key}`, r.result);
  }

  // Build unit-count lookup for flat-rate rounds: "teamId:roundKey" -> count.
  // Lets the numeric input prefill with a previously-saved value on reopen.
  const countMap = new Map<string, number>();
  for (const r of results) {
    if (r.result_count != null) {
      countMap.set(`${r.team_id}:${r.round_key}`, r.result_count);
    }
  }

  // Get alive teams for the active round
  const aliveTeams = getAliveTeamsForRound(soldTeamIds, results, config, activeRound);
  const activeRoundConfig = config.rounds.find((r) => r.key === activeRound);

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

  // Sort alive teams by seed
  const sortedAlive = [...aliveTeams].sort((a, b) => {
    const teamA = teamMap.get(a);
    const teamB = teamMap.get(b);
    return (teamA?.seed ?? 99) - (teamB?.seed ?? 99);
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

  // Save a flat-rate round's unit count for one team. Zero wins is stored as
  // 'lost' with count 0, never 'won' with count 0 — storing 'won' with count 0
  // would pollute countWinnersPerRound and put a bogus "won" chip on the
  // leaderboard. An empty or non-numeric field means "no change": the
  // commissioner may be mid-edit (cleared the field to retype), and blurring
  // must never silently wipe a previously-saved count by writing 0. See
  // resolveUnitEntry for the empty-vs-zero distinction and clamping.
  const saveUnits = useCallback(
    async (teamId: number, rawValue: string) => {
      if (!isCommissioner) return;
      const decision = resolveUnitEntry(rawValue);
      if (decision.action === 'skip') return;
      const key = `${teamId}:${activeRound}`;
      setSaving(key);
      await updateResult(sessionId, teamId, activeRound, decision.result, decision.count);
      setSaving(null);
    },
    [sessionId, activeRound, isCommissioner]
  );

  // Batch-save every alive team's current input value for a flat-rate round in
  // one round trip, instead of one updateResult call per team every week.
  // Fields left empty (or non-numeric) are skipped rather than saved as 0 —
  // same no-change rule as saveUnits.
  // Plain function (not useCallback): it's only ever an onClick handler, so
  // there's no downstream memoization to preserve, and its inputs
  // (activeRoundConfig, sortedAlive) are derived values recomputed on every
  // render anyway.
  async function handleSaveAll() {
    if (!isCommissioner || !activeRoundConfig?.flatRate) return;
    setSavingAll(true);
    const updates = sortedAlive.reduce<
      { teamId: number; roundKey: string; result: 'won' | 'lost'; resultCount: number }[]
    >((acc, teamId) => {
      const decision = resolveUnitEntry(unitInputRefs.current.get(teamId)?.value ?? '');
      if (decision.action === 'save') {
        acc.push({
          teamId,
          roundKey: activeRound,
          result: decision.result,
          resultCount: decision.count,
        });
      }
      return acc;
    }, []);
    if (updates.length > 0) {
      await bulkUpdateResults(sessionId, updates);
    }
    setSavingAll(false);
  }

  // Sync flat-rate unit inputs from external updates (a broadcast from
  // another commissioner device, an ESPN sync, or this browser's own
  // updateResult echoing back) without disturbing a field being actively
  // typed into. updateResult resolves as soon as the server has *sent* the
  // broadcast, not once it round-trips back, and broadcastToChannel has no
  // sender exclusion — so the committing browser gets its own write back
  // while the field may already be mid-retype (blur-saved, then clicked
  // back in to fix a typo). The input stays uncontrolled (no value/onChange)
  // so typing itself never fights a render; this effect is the only thing
  // that writes into it post-mount, and skipping the focused element is
  // what keeps an in-flight edit safe from that echo. Runs off `results`
  // (a fresh array only when data actually changes) and `activeRound`
  // rather than the render-local countMap/sortedAlive, which are rebuilt
  // (new identity) on every render regardless of whether anything changed.
  useEffect(() => {
    unitInputRefs.current.forEach((el, teamId) => {
      if (document.activeElement === el) return;
      const external = results.find(
        (r) => r.team_id === teamId && r.round_key === activeRound
      );
      const nextValue = external?.result_count != null ? String(external.result_count) : '';
      if (el.value !== nextValue) el.value = nextValue;
    });
  }, [results, activeRound]);

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
            {activeRoundConfig?.flatRate
              ? `${activeRoundConfig.payoutUnits ?? activeRoundConfig.teamsAdvancing} ${
                  activeRoundConfig.unitLabel ?? 'unit'
                }s = ${roundBudget(activeRoundConfig, payoutRules[activeRound]).toFixed(1)}% of pot`
              : `${payoutRules[activeRound]}% of pot`}
          </span>
        )}
      </div>

      {isCommissioner && activeRoundConfig?.flatRate && aliveTeams.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={savingAll}
            className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Save className="size-3" />
            {savingAll ? 'Saving…' : 'Save All'}
          </button>
        </div>
      )}

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
                      {formatGroupLabel(team?.group, config)} · {sold?.winnerName ?? 'Unknown'} · ${sold?.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {isCommissioner ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {activeRoundConfig?.flatRate ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          // Keyed on teamId/round only — NOT on the saved
                          // count. Remounting on every external count change
                          // (the old approach) raced with our own broadcast
                          // echo: updateResult resolves on broadcast send,
                          // not round-trip, so the committing browser can
                          // receive its own write back and remount this
                          // field mid-retype, wiping an in-progress edit.
                          // The key still changes across rounds so switching
                          // tabs remounts with a fresh defaultValue; syncing
                          // an in-place external update (without disturbing
                          // an active edit) is handled by the sync effect
                          // above instead, via the ref set below.
                          key={`${teamId}:${activeRound}`}
                          type="number"
                          step={0.5}
                          min={0}
                          max={MAX_FLAT_RATE_UNITS}
                          defaultValue={countMap.get(`${teamId}:${activeRound}`) ?? ''}
                          onBlur={(e) => saveUnits(teamId, e.target.value)}
                          disabled={isSaving || savingAll}
                          ref={(el) => {
                            if (el) unitInputRefs.current.set(teamId, el);
                            else unitInputRefs.current.delete(teamId);
                          }}
                          placeholder="0"
                          className="w-16 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-right text-xs text-white focus:border-emerald-500/40 focus:outline-none"
                        />
                        <span className="text-[10px] text-white/30">
                          {activeRoundConfig.unitLabel ?? 'unit'}s
                        </span>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
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
