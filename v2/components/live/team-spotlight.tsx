'use client';

import type { BaseTeam, TournamentConfig } from '@/lib/tournaments/types';

interface TeamSpotlightProps {
  team: BaseTeam | null;
  config: TournamentConfig;
  teamIndex: number;
  totalTeams: number;
  bundleInfo?: { name: string; teams: BaseTeam[] };
}

export function TeamSpotlight({
  team,
  config,
  teamIndex,
  totalTeams,
  bundleInfo,
}: TeamSpotlightProps) {
  // Bundle display
  if (bundleInfo) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/40 mb-1">
              Item {teamIndex + 1} of {totalTeams}
            </p>
            <h2 className="text-2xl font-bold text-white">{bundleInfo.name}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                Bundle ({bundleInfo.teams.length} teams)
              </span>
            </div>
          </div>
        </div>

        {/* Member teams — identity only, strategy overlay handles numbers */}
        <div className="mt-4 flex flex-wrap gap-2">
          {bundleInfo.teams.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-1.5"
            >
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                #{member.seed}
              </span>
              <span className="text-sm font-medium text-white">
                {member.name}
              </span>
              <span className="text-xs text-white/30">{member.group}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Single team display
  if (!team) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-12">
        <p className="text-white/40">Waiting for team to be presented...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/40 mb-1">
            Team {teamIndex + 1} of {totalTeams}
          </p>
          <h2 className="text-2xl font-bold text-white">{team.name}</h2>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              #{team.seed} Seed
            </span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-white/60">
              {team.group}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
