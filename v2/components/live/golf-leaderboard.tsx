'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { DataGolfInPlayPlayer, DataGolfInPlayResponse } from '@/lib/datagolf/client';
import { formatPlayerName } from '@/lib/datagolf/client';
import { calculateDeadHeatFractions } from '@/lib/datagolf/leaderboard';
import { RefreshCw, Activity, Wifi } from 'lucide-react';

interface GolfLeaderboardProps {
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  payoutRules: PayoutRules;
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

/**
 * Calculate live expected value from DataGolf probabilities and session payout rules.
 * EV = sum(prob[tier] * pot * payoutPct[tier]) for each tier.
 */
function calculateLiveEV(
  player: DataGolfInPlayPlayer,
  actualPot: number,
  payoutRules: PayoutRules
): number | null {
  // Map DataGolf probability fields to payout rule keys
  const probMap: Array<[string, number | undefined]> = [
    ['winner', player.win_prob],
    ['top5', player.top_5_prob],
    ['top10', player.top_10_prob],
    ['top20', player.top_20_prob],
    ['makeCut', player.make_cut_prob],
  ];

  let hasAnyProb = false;
  let ev = 0;

  for (const [ruleKey, prob] of probMap) {
    if (prob === undefined || prob === null) continue;
    const pct = payoutRules[ruleKey];
    if (pct === undefined || pct === 0) continue;
    hasAnyProb = true;
    ev += prob * actualPot * (pct / 100);
  }

  return hasAnyProb ? ev : null;
}

/**
 * Build a name-matching map from baseTeams to quickly find teamId by player name.
 * Handles "First Last" format from DataGolf → baseTeam.name matching.
 */
function buildNameMap(baseTeams: BaseTeam[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of baseTeams) {
    map.set(t.name.toLowerCase(), t.id);
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
    const teamId = nameMap.get(displayName.toLowerCase()) ?? null;
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

  if (!data || rows.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-8 text-center space-y-2">
        <p className="text-sm text-white/40">No leaderboard data available yet.</p>
        <p className="text-xs text-white/25">
          Live leaderboard will appear once the tournament begins.
        </p>
      </div>
    );
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
                <th className="px-3 py-2 text-right" title="Live Expected Value based on DataGolf model probabilities">
                  Live EV
                </th>
                <th className="px-3 py-2 text-right" title="Win probability">Win%</th>
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

                    {/* Live EV */}
                    <td className="px-3 py-2 text-right font-mono">
                      {row.liveEV !== null ? (
                        <span className={row.liveEV > (row.purchasePrice ?? 0) ? 'text-emerald-400' : 'text-amber-400/70'}>
                          {fmtDollar(row.liveEV)}
                        </span>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </td>

                    {/* Win probability */}
                    <td className="px-3 py-2 text-right font-mono text-white/50">
                      {fmtPct(row.player.win_prob)}
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
