'use client';

import { useEffect, useState } from 'react';
import type { BaseTeam, TournamentConfig } from '@/lib/tournaments/types';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { GroupTableRow, SoccerMatch } from '@/lib/espn/soccer';

interface GroupTablesProps {
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  currentUserId?: string;
}

interface ScoreboardResponse {
  groups: Record<string, GroupTableRow[]>;
  recentMatches: SoccerMatch[];
  fixtures: SoccerMatch[];
}

/**
 * World Cup group standings computed from ESPN results, with each nation
 * tagged by its league owner. Tables come from /api/soccer/scoreboard;
 * ownership comes from the session's sold teams.
 */
export function GroupTables({ soldTeams, currentUserId }: GroupTablesProps) {
  const [data, setData] = useState<ScoreboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/soccer/scoreboard')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  }, []);

  // teamId → owner from sold teams. winnerId is the auth user id (same id
  // space as currentUserId), winnerName is the participant display name.
  const ownerByTeam = new Map<number, { ownerName: string; isMine: boolean }>();
  for (const s of soldTeams) {
    ownerByTeam.set(s.teamId, {
      ownerName: s.winnerName,
      isMine: !!currentUserId && s.winnerId === currentUserId,
    });
  }

  if (error) {
    return (
      <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/40">
        Results will appear as matches finish. ({error})
      </p>
    );
  }
  if (!data) {
    return <p className="px-4 py-6 text-center text-sm text-white/40">Loading group tables…</p>;
  }

  const groupKeys = Object.keys(data.groups).sort();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groupKeys.map((g) => (
          <div key={g} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Group {g}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30">
                  <th className="text-left font-medium">Team</th>
                  <th className="px-1 text-right font-medium">P</th>
                  <th className="px-1 text-right font-medium">GD</th>
                  <th className="px-1 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {data.groups[g].map((row, i) => {
                  const owner = ownerByTeam.get(row.teamId);
                  return (
                    <tr
                      key={row.teamId}
                      className={owner?.isMine ? 'text-emerald-300' : 'text-white/70'}
                    >
                      <td className="py-0.5">
                        <span className={i < 2 ? 'font-semibold' : ''}>{row.name}</span>
                        {owner && (
                          <span className="ml-1 text-[10px] text-white/30">{owner.ownerName}</span>
                        )}
                      </td>
                      <td className="px-1 text-right tabular-nums">{row.played}</td>
                      <td className="px-1 text-right tabular-nums">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="px-1 text-right font-semibold tabular-nums">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {data.recentMatches.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            Recent Results
          </h3>
          <div className="space-y-1 text-xs text-white/60">
            {data.recentMatches.map((m, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {m.homeName} {m.homeScore}–{m.awayScore} {m.awayName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.fixtures.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            Upcoming
          </h3>
          <div className="space-y-1 text-xs text-white/40">
            {data.fixtures.map((m, i) => (
              <div key={i}>
                {m.homeName} v {m.awayName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
