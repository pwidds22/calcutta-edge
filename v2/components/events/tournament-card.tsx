import Link from 'next/link';
import type { TournamentConfig } from '@/lib/tournaments/types';
import { Calendar, Users, Trophy, Layers, ArrowRight } from 'lucide-react';

interface TournamentCardProps {
  config: TournamentConfig;
  teamCount: number;
  isActive?: boolean;
}

const SPORT_COLORS: Record<string, string> = {
  ncaa: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  golf: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  horse_racing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  nfl: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  soccer: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sportLabel(sport: string): string {
  const labels: Record<string, string> = {
    ncaa: 'NCAA',
    golf: 'Golf',
    horse_racing: 'Horse Racing',
    nfl: 'NFL',
    soccer: 'Soccer',
  };
  return labels[sport] ?? sport.toUpperCase();
}

export function TournamentCard({ config, teamCount, isActive }: TournamentCardProps) {
  const colorClass = SPORT_COLORS[config.sport] ?? 'bg-white/5 text-white/60 border-white/10';

  return (
    <div
      className={`group relative rounded-xl border bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] ${
        isActive
          ? 'border-emerald-500/30 shadow-[0_0_20px_-6px_rgba(16,185,129,0.15)]'
          : 'border-white/[0.06]'
      }`}
    >
      {/* Sport badge + active indicator */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}>
          {sportLabel(config.sport)}
        </span>
        {isActive && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">
        {config.name}
      </h3>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3" />
          {formatDate(config.startDate)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="size-3" />
          {teamCount} {config.teamLabel}{teamCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Layers className="size-3" />
          {config.rounds.length} Round{config.rounds.length !== 1 ? 's' : ''}
        </span>
        {config.propBets.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3" />
            {config.propBets.length} Prop{config.propBets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Round labels */}
      <div className="mt-3 flex flex-wrap gap-1">
        {config.rounds.map((r) => (
          <span
            key={r.key}
            className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/30"
          >
            {r.label}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/host/create?tournament=${config.id}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Host Auction
          <ArrowRight className="size-3" />
        </Link>
        <Link
          href={`/strategy?tournament=${config.id}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          Strategy Tool
        </Link>
      </div>
    </div>
  );
}
