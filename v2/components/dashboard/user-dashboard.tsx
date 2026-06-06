'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Trophy,
  ArrowRight,
  Trash2,
  CheckCircle2,
  XCircle,
  Radio,
  Plus,
  Info,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardData, DashboardFeaturedEvent, DashboardSession, DashboardTeam } from '@/actions/dashboard';
import { isCompletedDashboardSession } from '@/lib/dashboard/categorize';
import { deleteSession } from '@/actions/session';

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function FeaturedEventBanner({ event }: { event: DashboardFeaturedEvent }) {
  const dateLabel =
    event.phase === 'live'
      ? 'Happening now'
      : event.phase === 'hostable'
        ? `Tournament starts ${formatLongDate(event.startDate)}`
        : event.hostingOpensAt
          ? `Hosting opens ${formatLongDate(event.hostingOpensAt)}`
          : `Coming ${formatLongDate(event.startDate)}`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-zinc-900/40 p-5">
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-emerald-500/5 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
              {event.fullName}
            </span>
            <span className="text-[10px] text-white/30">{dateLabel}</span>
          </div>
          <h3 className="text-base font-bold text-white">
            Run a {event.shortName} Calcutta with your group
          </h3>
          <p className="text-xs text-white/40 max-w-md">
            {event.teamCount}-{event.teamLabel.toLowerCase()} field, live bidding,
            strategy analytics — free to host. See what every {event.teamLabel.toLowerCase()} is worth before the auction.
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {/* Hide "Preview Analytics" once the user has paid — they're not previewing anymore. */}
          {!event.userHasPaid && (
            <Link href={`/strategy?tournament=${event.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Sparkles className="size-3.5" />
                Preview Analytics
              </Button>
            </Link>
          )}
          {/* Hide "Host Free" once the user is already hosting an auction for this event. */}
          {!event.userHasHostedSession && (
            <Link href={`/host/create?tournament=${event.id}`}>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="size-3.5" />
                Host Free
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

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

function DeleteConfirmDialog({
  sessionName,
  onConfirm,
  onCancel,
  isPending,
}: {
  sessionName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">Delete Auction</h3>
        <p className="mt-2 text-sm text-white/50">
          Are you sure you want to delete{' '}
          <span className="font-medium text-white/70">{sessionName}</span>? This
          will permanently remove the session, all participants, and all bid
          history. This action cannot be undone.
        </p>
        <div className="mt-5 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="border-white/10 text-white/60 hover:bg-white/[0.06]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeagueCard({ session, onDelete }: { session: DashboardSession; onDelete?: (session: DashboardSession) => void }) {
  const href = `/live/${session.id}`;
  const canDelete = session.isCommissioner && session.status !== 'active';

  // A league is "over" if its tournament dates have passed OR the auction
  // is officially closed with all results in. Same dual check as elsewhere.
  const tournamentOver =
    session.tournamentPhase === 'completed' ||
    session.tournamentPhase === 'archived' ||
    (session.status === 'completed' && session.currentRound === null);

  // Show projected P&L whenever DataGolf is feeding live EV for an in-play
  // tournament — both the partial-results state (currentRound !== null) and
  // the draft-done-but-no-results-yet state (currentRound === null while the
  // tournament is live/hostable). We gate on `tournamentPhase` to keep the
  // projected label off Completed Leagues cards even if DataGolf still has
  // the event on its feed.
  const showProjected =
    session.projectedNetPL !== null &&
    session.status === 'completed' &&
    (session.tournamentPhase === 'live' || session.tournamentPhase === 'hostable');
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
              {/*
                For active tournaments, show alive/out breakdown (useful while in play).
                For completed tournaments, drop the breakdown — partial-payout sports
                like golf make "alive vs eliminated" misleading (a golfer can earn money
                even after being "eliminated" at the cut/T20/etc). The P&L column on the
                right tells the full story.
              */}
              {session.status === 'completed' && !tournamentOver && (
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
          {session.currentRoundLabel && !tournamentOver && (
            <span className="text-amber-400/60">{session.currentRoundLabel}</span>
          )}
        </div>
      </div>

      {/* P&L for sessions with bids */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        {showPL && (
          <div className="text-right">
            <div className={`flex items-center justify-end gap-1 text-sm font-mono font-medium ${plColor}`}>
              <PlIcon className="size-3" />
              {displayPL >= 0 ? '+' : ''}${Math.round(displayPL).toLocaleString()}
              {/*
                Visible "PROJ" pill — the subtitle below also says "projected",
                but readers scan the headline number first. Without an in-line
                marker, a projected +$45 looks identical to a settled +$45 and
                people will treat it as money in the bank.
              */}
              {showProjected && (
                <span className="ml-1 rounded bg-amber-500/10 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-400/80">
                  proj
                </span>
              )}
            </div>
            <p className="text-[10px] text-white/20">
              {showProjected
                ? session.userTotalEarned > 0
                  ? `projected · earned $${Math.round(session.userTotalEarned).toLocaleString()} · paid $${session.userTotalSpent.toLocaleString()}`
                  : `projected · paid $${session.userTotalSpent.toLocaleString()}`
                : `bought in $${session.userTotalSpent.toLocaleString()}`}
            </p>
          </div>
        )}
        {canDelete && onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(session);
            }}
            className="rounded-lg p-2 text-white/30 transition-all hover:bg-red-500/10 hover:text-red-400"
            title="Delete league"
          >
            <Trash2 className="size-4" />
          </button>
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

/**
 * Renders the "My Alive Teams" section. Stays expanded for small rosters
 * (bracket sports survivors are useful at-a-glance), collapses when the list
 * grows past the threshold. A golf host with 30+ owned golfers used to drown
 * the dashboard in rows before Friday's cut — collapsing keeps the section
 * informative without taking over the screen.
 */
function AliveTeamsSection({ teams }: { teams: DashboardTeam[] }) {
  const COLLAPSE_THRESHOLD = 6;
  const [expanded, setExpanded] = useState(teams.length <= COLLAPSE_THRESHOLD);
  const Icon = expanded ? ChevronUp : ChevronDown;
  const isCollapsible = teams.length > COLLAPSE_THRESHOLD;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        disabled={!isCollapsible}
        className="group flex items-center gap-2 mb-3 transition-colors enabled:hover:text-white/60 disabled:cursor-default"
        aria-expanded={expanded}
        aria-controls="alive-teams-list"
      >
        <Trophy className="size-4 text-emerald-400/60" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 group-enabled:group-hover:text-white/60 transition-colors">
          My Alive Teams ({teams.length})
        </h2>
        {isCollapsible && (
          <Icon className="size-3.5 text-white/30 group-hover:text-white/50 transition-colors" />
        )}
      </button>
      {expanded && (
        <div id="alive-teams-list" className="grid gap-1.5 sm:grid-cols-2">
          {teams.map((team) => (
            <AliveTeamRow key={`${team.leagueId}-${team.seed}-${team.teamName}`} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders the Completed Leagues section. Collapses by default when there are
 * 4+ entries — at that volume the section can dwarf the active leagues above,
 * which is usually what the user actually wants to see.
 */
function CompletedLeaguesSection({ sessions, onDelete }: { sessions: DashboardSession[]; onDelete?: (session: DashboardSession) => void }) {
  const COLLAPSE_THRESHOLD = 3;
  // Start collapsed when there are more than 3 — visible affordance via the header button.
  const [expanded, setExpanded] = useState(sessions.length <= COLLAPSE_THRESHOLD);
  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group flex items-center gap-2 mb-3 transition-colors hover:text-white/60"
        aria-expanded={expanded}
        aria-controls="completed-leagues-list"
      >
        <CheckCircle2 className="size-4 text-white/20 group-hover:text-white/40 transition-colors" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 group-hover:text-white/60 transition-colors">
          Completed Leagues ({sessions.length})
        </h2>
        <Icon className="size-3.5 text-white/30 group-hover:text-white/50 transition-colors" />
      </button>
      {expanded && (
        <div id="completed-leagues-list" className="space-y-2">
          {sessions.map((s) => (
            <LeagueCard key={s.id} session={s} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function UserDashboard({ data }: { data: DashboardData }) {
  const { sessions, totalPotExposure, totalEarned, totalNetPL, aliveTeams, featuredEvent } = data;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<DashboardSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDelete(session: DashboardSession) {
    setError(null);
    setDeleteTarget(session);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteSession(deleteTarget.id);
      if (result.error) {
        setError(result.error);
        setDeleteTarget(null);
      } else {
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }
  const completedSessions = sessions.filter(isCompletedDashboardSession);
  const activeSessions = sessions.filter((s) => !isCompletedDashboardSession(s));
  const hasAnyBids = sessions.some((s) => s.userTeamsCount > 0);
  // "Alive" teams in the lifetime stat only count from still-active leagues —
  // champions of past tournaments aren't actively in play anymore.
  const totalAlive = activeSessions.reduce((s, d) => s + d.userTeamsAlive, 0);
  const totalEliminated = sessions.reduce((s, d) => s + d.userTeamsEliminated, 0);

  return (
    <div className="space-y-8">
      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          sessionName={deleteTarget.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={isPending}
        />
      )}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400/60 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Phase-aware Next Event banner — hides when the user has already done
          both things it prompts (purchased strategy access AND set up an auction). */}
      {featuredEvent &&
        !(featuredEvent.userHasPaid && featuredEvent.userHasHostedSession) && (
          <FeaturedEventBanner event={featuredEvent} />
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

      {/* Alive teams — collapses by default for golf-sized rosters so the
          section is informative without burying the leagues below it. */}
      {aliveTeams.length > 0 && <AliveTeamsSection teams={aliveTeams} />}

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
              <LeagueCard key={s.id} session={s} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Leagues — collapse by default once the list grows past 3
          so the dashboard stays focused on current activity. */}
      {completedSessions.length > 0 && (
        <CompletedLeaguesSection sessions={completedSessions} onDelete={handleDelete} />
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
