'use client';

import { useEffect, useState } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules, RoundKey } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import { calculateSoccerProjectedStandings } from '@/lib/auction/live/soccer-standings';
import { ChevronRight } from 'lucide-react';

interface SoccerStandingsProps {
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  payoutRules: PayoutRules;
  results: TournamentResult[];
  propResults: PropResult[];
  currentUserId?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(2)}`;

/**
 * Per-participant projected standings for the World Cup, with each owner's
 * expected payout (blended: settled rounds use real results, open rounds project
 * from live Kalshi odds). Expand a row to see each team's EV. The EV math is the
 * pure calculateSoccerProjectedStandings; only the live odds come from the server
 * (/api/worldcup/ev, ~1h cached). Falls back to the league's static config odds
 * until the live odds arrive.
 */
export function SoccerStandings({
  soldTeams,
  baseTeams,
  config,
  payoutRules,
  results,
  propResults,
  currentUserId,
}: SoccerStandingsProps) {
  const [liveTeams, setLiveTeams] = useState<BaseTeam[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/worldcup/ev')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.teams)) setLiveTeams(d.teams as BaseTeam[]);
      })
      .catch(() => {});
  }, []);

  // Overlay live probabilities (by team id) onto our base teams; static fallback.
  const teams = (() => {
    if (!liveTeams) return baseTeams;
    const liveById = new Map(liveTeams.map((t) => [t.id, t.probabilities]));
    return baseTeams.map((t) => {
      const p = liveById.get(t.id);
      return p ? { ...t, americanOdds: {} as Record<RoundKey, number>, probabilities: p } : t;
    });
  })();

  const entries = calculateSoccerProjectedStandings(
    soldTeams,
    teams,
    payoutRules,
    config,
    results,
    propResults
  );

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/40">
        Standings appear once teams are sold.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-4 text-[10px] font-medium uppercase tracking-wider text-white/30">
        <span>Owner</span>
        <span>Proj. EV · Net</span>
      </div>

      {entries.map((entry, rank) => {
        const isMine = !!currentUserId && entry.participantId === currentUserId;
        const isOpen = expanded === entry.participantId;
        const pl = entry.projectedPL;
        const plColor = pl > 0.005 ? 'text-emerald-400' : pl < -0.005 ? 'text-red-400' : 'text-white/40';

        return (
          <div key={entry.participantId}>
            <button
              onClick={() => setExpanded(isOpen ? null : entry.participantId)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                isMine ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 text-center text-xs font-semibold text-white/30">{rank + 1}</span>
                  <ChevronRight className={`size-3.5 text-white/30 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${isMine ? 'text-emerald-300' : 'text-white'}`}>
                      {entry.participantName}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {entry.teamsOwned} team{entry.teamsOwned !== 1 ? 's' : ''} · spent {money(entry.totalSpent)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-white/80">{money(entry.blendedEarnings)}</p>
                  <p className={`text-[11px] font-medium tabular-nums ${plColor}`}>{signed(pl)}</p>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="mt-1 space-y-0.5 rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2">
                {entry.teams.map((team) => {
                  const teamPL = (team.blendedEV ?? 0) - team.purchasePrice;
                  return (
                    <div key={team.teamId} className="flex items-center justify-between py-0.5 text-xs">
                      <span className="truncate text-white/60">
                        {team.group ? <span className="text-white/30">({team.group}) </span> : null}
                        {team.teamName}
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <span className="text-white/30">paid {money(team.purchasePrice)}</span>
                        <span className="text-white/70">{money(team.blendedEV ?? 0)}</span>
                        <span className={teamPL >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>{signed(teamPL)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="px-4 pt-1 text-[10px] text-white/25">
        {liveTeams ? 'Live odds (Kalshi) · ' : 'Pre-tournament odds · '}
        EV = fair payout from per-stage probabilities × your payout rules, blended with results as games finish.
      </p>
    </div>
  );
}
