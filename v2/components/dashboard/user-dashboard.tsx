'use client';

import { useState } from 'react';
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
  Info,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardData, DashboardSession, DashboardTeam } from '@/actions/dashboard';

const statusColors: Record<string, string> = {
  lobby: 'bg-amber-500/10 text-amber-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-400',
  completed: 'bg-white/[0.06] text-white/40',
};

function StatCard({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <div className="flex items-center justify-center gap-1">
        <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
        {tooltip && (
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="text-white/20 hover:text-white/40"
          >
            <Info className="size-3" />
          </button>
        )}
      </div>
      <p className={`mt-1 text-xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {showTooltip && tooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 w-56 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-white/60 shadow-xl">
          {tooltip}
        </div>
      )}
    </div>
  );
}

function LeagueCard({ session }: { session: DashboardSession }) {
  const href = `/live/${session.id}`;

  // Show projected P&L for active golf sessions, actual P&L for completed
  const showProjected = session.projectedNetPL !== null && session.status === 'completed' && session.currentRound !== null;
  const displayPL = showProjected ? session.projectedNetPL! : session.userNetPL;
  const showPL = session.userTeamsCount > 0 && (
    session.status === 'completed' ||
    session.projectedNetPL !== null
  );

  const plColor =
    displayPL > 0
      ? 'text-emerald-400'
      : displayPL < 0
        ? 'text-red-400'
        : 'text-white/40';
  const PlIcon =
    displayPL > 0 ? TrendingUp : displayPL < 0 ? TrendingDown : Minus;

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
              {session.userTeamsCount} team{session.userTeamsCount !== 1 ? 's' : ''}
              {session.status === 'completed' && (
                <>
                  {session.userTeamsAlive > 0 && (
                    <span className="text-emerald-400/60">
                      {' '}· {session.userTeamsAlive} alive
                    </span>
                  )}
                  {session.userTeamsEliminated > 0 && (
                    <span className="text-red-400/50">
                      {' '}· {session.userTeamsEliminated} out
                    </span>
                  )}
                </>
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
        {showPL && (
          <div className="text-right">
            <div className={`flex items-center gap-1 text-sm font-mono font-medium ${plColor}`}>
              <PlIcon className="size-3" />
              {displayPL >= 0 ? '+' : ''}${Math.round(displayPL).toLocaleString()}
            </div>
            <p className="text-[10px] text-white/20">
              {showProjected
                ? `projected · earned $${Math.round(session.userTotalEarned).toLocaleString()}`
                : `bought in $${session.userTotalSpent.toLocaleString()}`}
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
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-white/20">{team.leagueName}</span>
            {team.roundsWon.length > 0 && (
              <div className="flex gap-0.5">
                {team.roundsWon.map((rk) => (
                  <span
                    key={rk}
                    className="rounded bg-emerald-500/10 px-1 py-px text-[8px] font-medium text-emerald-400/60"
                  >
                    {rk} ✓
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2 text-right">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-white/30">${team.purchasePrice}</span>
            {team.earnings > 0 && (
              <span className="text-emerald-400/70">+${Math.round(team.earnings).toLocaleString()}</span>
            )}
          </div>
          {team.breakEvenRound && team.earnings < team.purchasePrice && (
            <p className="text-[9px] text-amber-400/40">
              profit at {team.breakEvenRound}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function UserDashboard({ data }: { data: DashboardData }) {
  const { sessions, totalPotExposure, totalEarned, totalNetPL, aliveTeams } = data;
  // A session is "completed" when EITHER (a) the auction is done AND all tournament
  // rounds have results, OR (b) the tournament itself has ended (date-driven phase).
  // The phase check catches leagues where the host never marked the auction complete
  // but the real-world tournament is long over (e.g., March Madness 2026).
  const isCompletedSession = (s: DashboardSession) =>
    (s.status === 'completed' && s.currentRound === null) ||
    s.tournamentPhase === 'completed' ||
    s.tournamentPhase === 'archived';
  const completedSessions = sessions.filter(isCompletedSession);
  const activeSessions = sessions.filter((s) => !isCompletedSession(s));
  const hasAnyBids = sessions.some((s) => s.userTeamsCount > 0);
  const totalAlive = sessions.reduce((s, d) => s + d.userTeamsAlive, 0);
  const totalEliminated = sessions.reduce((s, d) => s + d.userTeamsEliminated, 0);

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

      {/* Masters 2026 Promotion — auto-hides after April 13, 2026 */}
      {new Date() < new Date('2026-04-14') && (
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-zinc-900/40 p-5">
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-emerald-500/5 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
                  Masters 2026
                </span>
                <span className="text-[10px] text-white/30">
                  Tournament starts April 9
                </span>
              </div>
              <h3 className="text-base font-bold text-white">
                Run a Masters Calcutta with your group
              </h3>
              <p className="text-xs text-white/40 max-w-md">
                89-player field, balanced bundles, live bidding — free to host.
                Strategy analytics show you what every golfer is worth before the auction.
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Link href="/strategy?tournament=masters_2026">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Sparkles className="size-3.5" />
                  Preview Analytics
                </Button>
              </Link>
              <Link href="/host/create?tournament=masters_2026">
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Plus className="size-3.5" />
                  Host Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Summary stats (only if user has bids) */}
      {hasAnyBids && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Buy-In"
            value={`$${totalPotExposure.toLocaleString()}`}
            color="text-white/70"
            tooltip="Total amount you spent acquiring teams across all leagues."
          />
          <StatCard
            label="Earned"
            value={`$${Math.round(totalEarned).toLocaleString()}`}
            color="text-emerald-400"
            tooltip="Cumulative payouts from all rounds your teams have won. Each round adds to the total."
          />
          <StatCard
            label="Net P&L"
            value={`${totalNetPL >= 0 ? '+' : ''}$${Math.round(totalNetPL).toLocaleString()}`}
            color={totalNetPL > 0 ? 'text-emerald-400' : totalNetPL < 0 ? 'text-red-400' : 'text-white/40'}
            tooltip="Earnings minus total cost for completed tournaments. For in-progress tournaments, only eliminated teams count as losses."
          />
          <StatCard
            label="Teams"
            value={`${totalAlive} / ${totalAlive + totalEliminated}`}
            color="text-white"
            tooltip={`${totalAlive} alive, ${totalEliminated} eliminated across all leagues.`}
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
