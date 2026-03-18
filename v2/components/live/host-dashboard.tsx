'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Radio, Users, ArrowRight, Trash2, Lock, Link2, Check, LogOut, Loader2 } from 'lucide-react';
import { deleteSession, leaveSession } from '@/actions/session';

interface Session {
  id: string;
  name: string;
  join_code: string;
  status: string;
  tournament_id: string;
  created_at: string;
  password_hash?: string | null;
  participant_count?: number;
}

interface HostDashboardProps {
  hostedSessions: Session[];
  joinedSessions: Session[];
}

const statusColors: Record<string, string> = {
  lobby: 'bg-amber-500/10 text-amber-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-400',
  completed: 'bg-white/[0.06] text-white/40',
};

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

function SessionCard({
  session,
  isHosted,
  onDelete,
  onLeave,
}: {
  session: Session;
  isHosted: boolean;
  onDelete?: (session: Session) => void;
  onLeave?: (session: Session) => void;
}) {
  const [copied, setCopied] = useState(false);
  const href = isHosted ? `/host/${session.id}` : `/live/${session.id}`;
  const canDelete = isHosted && session.status !== 'active';
  const canLeave = !isHosted && session.status !== 'active';
  const hasPassword = !!session.password_hash;
  const participantCount = session.participant_count ?? 0;

  const copyJoinLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/join?code=${session.join_code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:bg-white/[0.04]">
      <Link href={href} className="flex-1 p-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          {session.name}
          {hasPassword && (
            <span title="Password protected">
              <Lock className="size-3 text-amber-400/60" />
            </span>
          )}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusColors[session.status] ?? statusColors.lobby}`}
          >
            {session.status}
          </span>
          <span className="text-xs font-mono text-white/40">
            {session.join_code}
          </span>
          {participantCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/30">
              <Users className="size-3" />
              {participantCount}
            </span>
          )}
          <span className="text-xs text-white/30">
            {new Date(session.created_at).toLocaleDateString()}
          </span>
        </div>
      </Link>
      <div className="flex items-center gap-1 pr-4">
        {isHosted && (
          <button
            onClick={copyJoinLink}
            className={`rounded-lg p-2 transition-all ${
              copied
                ? 'text-emerald-400'
                : 'text-white/20 opacity-0 hover:bg-white/[0.06] hover:text-white/50 group-hover:opacity-100'
            }`}
            title={copied ? 'Copied!' : 'Copy join link'}
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Link2 className="size-4" />
            )}
          </button>
        )}
        {canLeave && onLeave && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLeave(session);
            }}
            className="rounded-lg p-2 text-white/20 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
            title="Leave auction"
          >
            <LogOut className="size-4" />
          </button>
        )}
        {canDelete && onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(session);
            }}
            className="rounded-lg p-2 text-white/20 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
            title="Delete session"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <Link href={href} className="p-2">
          <ArrowRight className="size-4 text-white/30" />
        </Link>
      </div>
    </div>
  );
}

export function HostDashboard({
  hostedSessions,
  joinedSessions,
}: HostDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDelete(session: Session) {
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

  function handleLeave(session: Session) {
    setError(null);
    setLeavingId(session.id);
    startTransition(async () => {
      const result = await leaveSession(session.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
      setLeavingId(null);
    });
  }

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

      {/* Error toast */}
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
          <h1 className="text-xl font-bold text-white">Live Auctions</h1>
          <p className="mt-1 text-sm text-white/40">
            Host or join live Calcutta auctions
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
              Create Auction
            </Button>
          </Link>
        </div>
      </div>

      {/* Hosted sessions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Radio className="size-4 text-white/40" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
            My Hosted Auctions
          </h2>
        </div>
        {hostedSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center">
            <p className="text-sm text-white/30">
              No auctions yet — create your first one!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {hostedSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isHosted
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Joined sessions */}
      {joinedSessions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-4 text-white/40" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
              Joined Auctions
            </h2>
          </div>
          <div className="space-y-2">
            {joinedSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isHosted={false}
                onLeave={handleLeave}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
