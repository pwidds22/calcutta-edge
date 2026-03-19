'use client';

import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Trophy,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Radio,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardData, DashboardSession, DashboardTeam } from '@/actions/dashboard';

const statusColors: Record<string, string> = {
  lobby: 'bg-amber-500/10 text-amber-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-400',
  completed: 'bg-white/[0.06] text-white/40',
};

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function LeagueCard({ session }: { session: DashboardSession }) {
  const href = `/live/${session.id}`;
  const plColor =
    session.userNetPL > 0
      ? 'text-emerald-400'
      : session.userNetPL < 0
        ? 'text-red-400'
        : 'text-white/40';
  const PlIcon =
    session.userNetPL > 0 ? TrendingUp : session.userNetPL < 0 ? TrendingDown : Minus;

  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white truncate">{session.name}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusColors[session.status] ?? statusColors.lobby}`}
          >
            {session.status}
          </span>
          {session.isCommissioner && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              Host
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/30">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {session.participantCount}
          </span>
          <span className="font-mono">Pot: ${session.potSize.toLocaleString()}</span>
          {session.userTeamsCount > 0 && (
            <span>
              {session.userTeamsCount} team{session.userTeamsCount !== 1 ? 's' : ''}{' '}
              {session.status === 'completed' && session.userTeamsAlive > 0 && (
                <span className="text-emerald-400/60">
                  · {session.userTeamsAlive} alive
                </span>
              )}
            </span>
          )}
          {session.currentRoundLabel && (
            <span className="text-amber-400/60">{session.currentRoundLabel}</span>
          )}
        </div>
      </div>

      {/* P&L for sessions with bids */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        {session.userTeamsCount > 0 && session.status === 'completed' && (
          <div className="text-right">
            <div className={`flex items-center gap-1 text-sm font-mono font-medium ${plColor}`}>
              <PlIcon className="size-3" />
              {session.userNetPL >= 0 ? '+' : ''}${Math.round(session.userNetPL).toLocaleString()}
            </div>
            <p className="text-[10px] text-white/20">
              spent ${session.userTotalSpent.toLocaleString()}
            </p>
          </div>
        )}
        <ArrowRight className="size-4 text-white/20 group-hover:text-white/40 transition-colors" />
      </div>
    </Link>
  );
}

function AliveTeamRow({ team }: { team: DashboardTeam }) {
  return (
    <Link
      href={`/live/${team.leagueId}`}
      className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2 transition-colors hover:bg-white/[0.03]"
    >
      <div className="flex items-center gap-2 min-w-0">
        {team.status === 'champion' ? (
          <Trophy className="size-3.5 text-amber-400 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="size-3.5 text-emerald-400 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs text-white/70 truncate">
            <span className="text-white/30">({team.seed})</span> {team.teamName}
            <span className="ml-1 text-white/15">{team.group}</span>
          </p>
          <p className="text-[10px] text-white/20">{team.leagueName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {team.roundsWon.length > 0 && (
          <div className="flex gap-0.5">
            {team.roundsWon.map((rk) => (
              <span
                key={rk}
                className="rounded bg-emerald-500/10 px-1 py-px text-[8px] font-medium text-emerald-400/60"
              >
                {rk.toUpperCase()}
              </span>
            ))}
          </div>
        )}
        {team.earnings > 0 && (
          <span className="text-xs font-mono text-emerald-400/70">
            +${Math.round(team.earnings).toLocaleString()}
          </span>
        )}
      </div>
    </Link>
  );
}

export function UserDashboard({ data }: { data: DashboardData }) {
  const { sessions, totalPotExposure, totalEarned, totalNetPL, aliveTeams } = data;
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const activeSessions = sessions.filter((s) => s.status !== 'completed');
  const hasAnyBids = sessions.some((s) => s.userTeamsCount > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-white/40">
            Your leagues and teams at a glance
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/join">
            <Button
              variant="outline"
              className="gap-1.5 border-white/10 text-white/60 hover:bg-white/[0.06]"
            >
              <Users className="size-4" />
              Join
            </Button>
          </Link>
          <Link href="/host/create">
            <Button className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="size-4" />
              Create
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary stats (only if user has bids) */}
      {hasAnyBids && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total Spent"
            value={`$${totalPotExposure.toLocaleString()}`}
            color="text-white/70"
          />
          <StatCard
            label="Total Earned"
            value={`$${Math.round(totalEarned).toLocaleString()}`}
            color="text-emerald-400"
          />
          <StatCard
            label="Net P&L"
            value={`${totalNetPL >= 0 ? '+' : ''}$${Math.round(totalNetPL).toLocaleString()}`}
            color={totalNetPL > 0 ? 'text-emerald-400' : totalNetPL < 0 ? 'text-red-400' : 'text-white/40'}
          />
        </div>
      )}

      {/* Alive teams */}
      {aliveTeams.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="size-4 text-emerald-400/60" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
              My Alive Teams ({aliveTeams.length})
            </h2>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {aliveTeams.map((team) => (
              <AliveTeamRow key={`${team.leagueId}-${team.seed}-${team.teamName}`} team={team} />
            ))}
          </div>
        </div>
      )}

      {/* Active / In-Progress Leagues */}
      {activeSessions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Radio className="size-4 text-emerald-400/60" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
              Active Leagues ({activeSessions.length})
            </h2>
          </div>
          <div className="space-y-2">
            {activeSessions.map((s) => (
              <LeagueCard key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Leagues */}
      {completedSessions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-white/20" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
              Completed Leagues ({completedSessions.length})
            </h2>
          </div>
          <div className="space-y-2">
            {completedSessions.map((s) => (
              <LeagueCard key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-12 text-center space-y-3">
          <p className="text-sm text-white/40">No leagues yet</p>
          <p className="text-xs text-white/25">
            Create an auction to host your league, or join one with a code.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/join">
              <Button variant="outline" size="sm" className="border-white/10 text-white/60">
                Join a League
              </Button>
            </Link>
            <Link href="/host/create">
              <Button size="sm" className="bg-emerald-600 text-white">
                Create Auction
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
