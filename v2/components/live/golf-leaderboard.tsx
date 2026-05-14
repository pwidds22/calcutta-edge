'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { DataGolfInPlayPlayer, DataGolfInPlayResponse } from '@/lib/datagolf/client';
import { formatPlayerName } from '@/lib/datagolf/client';
import { calculateDeadHeatFractions } from '@/lib/datagolf/leaderboard';
import { calculateLiveEV, normalizeName } from '@/lib/datagolf/ev';
import { RefreshCw, Activity, Wifi, Trophy, Calendar, Clock } from 'lucide-react';

interface GolfLeaderboardProps {
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  payoutRules: PayoutRules;
}

/**
 * Check if the in-play API event matches the tournament we're tracking.
 * DataGolf event names like "Masters Tournament" need fuzzy matching against
 * our config names like "The Masters 2026".
 *
 * We extract keywords from both names and check for overlap.
 */
function isMatchingEvent(apiEventName: string, configName: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z\s]/g, '').trim();

  const apiNorm = normalize(apiEventName);
  const configNorm = normalize(configName);

  // Direct substring match
  if (apiNorm.includes(configNorm) || configNorm.includes(apiNorm)) return true;

  // Keyword match: extract meaningful words (>3 chars) and check overlap
  const stopWords = new Set(['the', 'tournament', 'open', 'championship', 'invitational']);
  const keywords = (s: string) =>
    s.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  const apiWords = keywords(apiNorm);
  const configWords = keywords(configNorm);

  return apiWords.some(w => configWords.includes(w));
}

interface LeaderboardRow {
  player: DataGolfInPlayPlayer;
  displayName: string;
  teamId: number | null;
  owner: string | null;
  purchasePrice: number | null;
  liveEV: number | null;
  /** Dead heat fractions per tier (1 = full payout, 0.5 = half, etc.) */
  deadHeatFractions: Record<string, number> | null;
}

/** Format score relative to par: -5 → "-5", 0 → "E", 3 → "+3" */
function fmtScore(score: number | null): string {
  if (score === null) return '—';
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

/** Format probability as percentage */
function fmtPct(prob: number | undefined): string {
  if (prob === undefined || prob === null) return '—';
  if (prob >= 0.01) return `${(prob * 100).toFixed(1)}%`;
  if (prob > 0) return `${(prob * 100).toFixed(2)}%`;
  return '—';
}

/** Format dollar amount */
function fmtDollar(n: number): string {
  return Number.isInteger(n) ? `$${n.toLocaleString()}` : `$${n.toFixed(2)}`;
}

// calculateLiveEV and normalizeName imported from @/lib/datagolf/ev

/**
 * Build a name-matching map from baseTeams to quickly find teamId by player name.
 * Handles "First Last" format from DataGolf → baseTeam.name matching.
 * Uses accent normalization for Scandinavian names (Åberg, Højgaard).
 */
function buildNameMap(baseTeams: BaseTeam[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of baseTeams) {
    map.set(normalizeName(t.name), t.id);
  }
  return map;
}

export function GolfLeaderboard({
  soldTeams,
  baseTeams,
  config,
  payoutRules,
}: GolfLeaderboardProps) {
  const [data, setData] = useState<DataGolfInPlayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);

  // Build ownership lookup: teamId → { ownerName, amount }
  const ownerMap = new Map<number, { name: string; amount: number }>();
  for (const s of soldTeams) {
    ownerMap.set(s.teamId, { name: s.winnerName, amount: s.amount });
  }
  const nameMap = buildNameMap(baseTeams);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/golf/in-play');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json: DataGolfInPlayResponse = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + auto-refresh every 60s
  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Get tier configs for dead heat calculation (exclude props)
  const tiers = config.rounds
    .filter(r => !r.key.startsWith('lowRound') && r.key !== 'worstRound' && r.key !== 'worstOverall')
    .map(r => ({ key: r.key, teamsAdvancing: r.teamsAdvancing }));

  // Build players array for dead heat calculation
  const playersForDeadHeat = (data?.data ?? [])
    .map((p) => {
      const pos = parsePos(p.current_pos);
      const isCut = p.current_pos === 'CUT' || p.current_pos === 'MDF';
      const isWithdrawn = p.current_pos === 'WD' || p.current_pos === 'DQ';
      return { id: p.dg_id, position: pos, isCut, isWithdrawn };
    });
  const deadHeatMap = calculateDeadHeatFractions(playersForDeadHeat, tiers);

  // Build rows by matching DataGolf players to auction teams
  const rows: LeaderboardRow[] = (data?.data ?? []).map((player) => {
    const displayName = formatPlayerName(player.player_name);
    const teamId = nameMap.get(normalizeName(displayName)) ?? null;
    const owner = teamId !== null ? ownerMap.get(teamId) : null;
    const liveEV = calculateLiveEV(player, actualPot, payoutRules);
    const fractions = deadHeatMap.get(player.dg_id) ?? null;

    return {
      player,
      displayName,
      teamId,
      owner: owner?.name ?? null,
      purchasePrice: owner?.amount ?? null,
      liveEV,
      deadHeatFractions: fractions,
    };
  });

  // Sort by position (numeric first, then non-numeric like CUT/WD/DQ)
  rows.sort((a, b) => {
    const posA = parsePos(a.player.current_pos);
    const posB = parsePos(b.player.current_pos);
    if (posA !== null && posB !== null) return posA - posB;
    if (posA !== null) return -1;
    if (posB !== null) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40 gap-2">
        <RefreshCw className="size-4 animate-spin" />
        <span className="text-sm">Loading live leaderboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center space-y-2">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="text-xs text-white/40 hover:text-white/60 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Check if the in-play data is for a DIFFERENT tournament (stale data)
  const isWrongEvent = data && !isMatchingEvent(data.event_name, config.name);

  if (!data || rows.length === 0 || isWrongEvent) {
    const startDate = config.startDate
      ? new Date(config.startDate + 'T00:00:00')
      : null;
    const now = new Date();
    const daysUntil = startDate
      ? Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-10 text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-500/10 p-3">
            <Calendar className="size-6 text-emerald-400" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/70">{config.name}</p>
          {startDate && daysUntil !== null && daysUntil > 0 ? (
            <p className="text-xs text-white/40">
              Starts {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' '}({daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`})
            </p>
          ) : startDate && daysUntil !== null && daysUntil === 0 ? (
            <p className="text-xs text-white/40 flex items-center justify-center gap-1">
              <Clock className="size-3" /> Starting today — leaderboard updates when play begins
            </p>
          ) : (
            <p className="text-xs text-white/25">
              Live leaderboard will appear once the tournament begins.
            </p>
          )}
        </div>
        {isWrongEvent && data && (
          <p className="text-[10px] text-white/15">
            DataGolf currently showing: {data.event_name}
          </p>
        )}
      </div>
    );
  }

  // ─── Low Round Leaders (Current + Completed Rounds) ─────────────
  const roundDayLabels: Record<number, string> = { 1: 'Thu', 2: 'Fri', 3: 'Sat', 4: 'Sun' };

  // Current round: use "today" score
  const playersWithScores = rows.filter(
    (r) => r.player.today !== null && r.player.current_pos !== 'CUT'
      && r.player.current_pos !== 'WD' && r.player.current_pos !== 'DQ'
  );
  const lowScore = playersWithScores.length > 0
    ? Math.min(...playersWithScores.map((r) => r.player.today!))
    : null;
  const lowRoundLeaders = lowScore !== null
    ? playersWithScores.filter((r) => r.player.today === lowScore)
    : [];

  // Completed rounds: use R1-R4 stroke counts
  const roundFields = ['R1', 'R2', 'R3', 'R4'] as const;
  const completedLowRounds: Array<{
    round: number; score: number; players: string[];
  }> = [];

  for (let i = 0; i < data.current_round - 1; i++) {
    const field = roundFields[i];
    const scores: Array<{ name: string; score: number }> = [];
    for (const row of rows) {
      const val = row.player[field];
      if (typeof val === 'number' && val > 0) {
        scores.push({ name: row.displayName, score: val });
      }
    }
    if (scores.length === 0) continue;
    const min = Math.min(...scores.map(s => s.score));
    completedLowRounds.push({
      round: i + 1,
      score: min,
      players: scores.filter(s => s.score === min).map(s => s.name),
    });
  }

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">
            {data.event_name} — Round {data.current_round}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="flex items-center gap-1 text-[10px] text-white/25">
              <Wifi className="size-3 text-emerald-400/50" />
              Updated {lastUpdated}
            </span>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Completed round low-round winners */}
      {completedLowRounds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {completedLowRounds.map((lr) => (
            <div
              key={lr.round}
              className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-1.5 flex items-center gap-2"
            >
              <Trophy className="size-3 text-emerald-400 shrink-0" />
              <span className="text-[10px] text-emerald-400/60 uppercase tracking-wider">
                R{lr.round} Low
              </span>
              <span className="text-xs font-medium text-white/80 truncate">
                {lr.players.join(', ')}
              </span>
              <span className="font-mono text-xs font-bold text-white/50">
                {lr.score}
              </span>
              {lr.players.length > 1 && (
                <span className="rounded bg-emerald-500/10 px-1 py-px text-[8px] text-emerald-400/60">
                  {lr.players.length}-way
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current round low-round leader banner */}
      {lowRoundLeaders.length > 0 && lowScore !== null && (
        <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-2.5 flex items-center gap-3">
          <Trophy className="size-4 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-amber-400/60">
              Low Round — {roundDayLabels[data.current_round] ?? `R${data.current_round}`}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-medium text-white truncate">
                {lowRoundLeaders.map((r) => r.displayName).join(', ')}
              </span>
              <span className="font-mono text-sm font-bold text-red-400">
                {fmtScore(lowScore)}
              </span>
              {lowRoundLeaders.length > 1 && (
                <span className="rounded bg-amber-500/10 px-1.5 py-px text-[10px] text-amber-400/70">
                  {lowRoundLeaders.length}-way tie
                </span>
              )}
              {lowRoundLeaders.some((r) => r.player.thru !== null && r.player.thru < 18) && (
                <span className="text-[10px] text-white/25">
                  (in progress)
                </span>
              )}
            </div>
          </div>
          {lowRoundLeaders.length === 1 && lowRoundLeaders[0].owner && (
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/70 shrink-0">
              {lowRoundLeaders[0].owner}
            </span>
          )}
        </div>
      )}

      {/* Leaderboard table */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/25">
                <th className="px-3 py-2 text-left w-12">Pos</th>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-center">Today</th>
                <th className="px-3 py-2 text-center">Thru</th>
                <th className="px-3 py-2 text-center">Total</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th
                  className="px-3 py-2 text-right"
                  title={
                    "Live Expected Value = sum over each payout tier of\n" +
                    "(probability × pot × payout %). Green delta = currently up\n" +
                    "on this player; red delta = currently down."
                  }
                >
                  Live EV
                </th>
                <th className="px-3 py-2 text-right" title="Win probability">Win%</th>
                <th className="px-3 py-2 text-right hidden lg:table-cell" title="Top 5 probability">T5%</th>
                <th className="px-3 py-2 text-right hidden lg:table-cell" title="Top 10 probability">T10%</th>
                <th className="px-3 py-2 text-right hidden xl:table-cell" title="Top 20 probability">T20%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const posDisplay = row.player.current_pos ?? '—';
                const isCut = posDisplay === 'CUT' || posDisplay === 'WD' || posDisplay === 'DQ' || posDisplay === 'MDF';
                const isLeader = i === 0 && !isCut;
                const isOwned = row.owner !== null;

                return (
                  <tr
                    key={row.player.dg_id}
                    className={`border-b border-white/[0.02] last:border-0 transition-colors ${
                      isCut
                        ? 'opacity-40'
                        : isOwned
                          ? 'bg-white/[0.02]'
                          : ''
                    }`}
                  >
                    {/* Position */}
                    <td className="px-3 py-2 text-left">
                      <span className={`font-mono font-medium ${
                        isLeader ? 'text-amber-400' : isCut ? 'text-red-400/60' : 'text-white/60'
                      }`}>
                        {posDisplay}
                      </span>
                      {row.deadHeatFractions && Object.values(row.deadHeatFractions).some(f => f > 0 && f < 1) && (
                        <span className="ml-1 rounded bg-amber-500/10 px-1 py-px text-[8px] font-mono text-amber-400/60" title="Dead heat at tier boundary">
                          DH
                        </span>
                      )}
                    </td>

                    {/* Player name */}
                    <td className="px-3 py-2 text-left">
                      <span className={`font-medium ${isOwned ? 'text-white' : 'text-white/50'}`}>
                        {row.displayName}
                      </span>
                    </td>

                    {/* Today */}
                    <td className="px-3 py-2 text-center font-mono">
                      <span className={
                        (row.player.today ?? 0) < 0
                          ? 'text-red-400'
                          : (row.player.today ?? 0) > 0
                            ? 'text-emerald-400/60'
                            : 'text-white/40'
                      }>
                        {fmtScore(row.player.today)}
                      </span>
                    </td>

                    {/* Thru */}
                    <td className="px-3 py-2 text-center font-mono text-white/30">
                      {row.player.thru !== null ? (row.player.thru === 18 ? 'F' : row.player.thru) : '—'}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-2 text-center font-mono">
                      <span className={`font-medium ${
                        (row.player.total ?? 0) < 0
                          ? 'text-red-400'
                          : (row.player.total ?? 0) > 0
                            ? 'text-emerald-400/60'
                            : 'text-white/50'
                      }`}>
                        {fmtScore(row.player.total)}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="px-3 py-2 text-left">
                      {row.owner ? (
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                          {row.owner}
                        </span>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </td>

                    {/* Purchase price */}
                    <td className="px-3 py-2 text-right font-mono text-white/30">
                      {row.purchasePrice !== null ? fmtDollar(row.purchasePrice) : '—'}
                    </td>

                    {/* Live EV — value on top in neutral white; delta vs paid
                        on a second line in red/green. Removing the old amber
                        "below paid" color since amber doesn't read as a loss
                        signal at a glance, and it ignored magnitude entirely
                        (a $1 dip and a $20 dip looked identical). For unowned
                        players we hide the delta — there's no purchase price
                        to compare against, so coloring is misleading. */}
                    <td className="px-3 py-2 text-right font-mono">
                      {row.liveEV !== null ? (
                        <div className="flex flex-col items-end leading-tight">
                          <span className={isOwned ? 'text-white/80' : 'text-white/40'}>
                            {fmtDollar(row.liveEV)}
                          </span>
                          {isOwned && row.purchasePrice !== null && (() => {
                            const delta = row.liveEV - row.purchasePrice;
                            // Treat tiny absolute deltas as flat so coin-flip
                            // EV doesn't flicker between red and green.
                            const flat = Math.abs(delta) < 0.5;
                            const color = flat
                              ? 'text-white/30'
                              : delta > 0
                                ? 'text-emerald-400/80'
                                : 'text-red-400/80';
                            const prefix = delta >= 0 ? '+' : '-';
                            return (
                              <span className={`text-[10px] ${color}`}>
                                {prefix}${fmtDollar(Math.abs(delta)).replace('$', '')}
                              </span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </td>

                    {/* Win probability */}
                    <td className="px-3 py-2 text-right font-mono text-white/50">
                      {fmtPct(row.player.win_prob)}
                    </td>

                    {/* Top 5 probability */}
                    <td className="px-3 py-2 text-right font-mono text-white/40 hidden lg:table-cell">
                      {fmtPct(row.player.top_5_prob)}
                    </td>

                    {/* Top 10 probability */}
                    <td className="px-3 py-2 text-right font-mono text-white/40 hidden lg:table-cell">
                      {fmtPct(row.player.top_10_prob)}
                    </td>

                    {/* Top 20 probability */}
                    <td className="px-3 py-2 text-right font-mono text-white/35 hidden xl:table-cell">
                      {fmtPct(row.player.top_20_prob)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer: data source + probability legend */}
      <div className="flex items-center justify-between text-[10px] text-white/20">
        <span>Source: DataGolf model probabilities</span>
        <span>EV = Σ(probability × pot × payout%) per tier</span>
      </div>
    </div>
  );
}

/** Parse position string to numeric (T8 → 8, CUT → null) */
function parsePos(pos: string | null): number | null {
  if (!pos) return null;
  const cleaned = pos.replace(/^T/, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}
