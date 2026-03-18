'use client';

import { useState } from 'react';
import { Users, Crown, X, LogOut, Loader2 } from 'lucide-react';
import { kickParticipant, leaveSession } from '@/actions/session';
import { useRouter } from 'next/navigation';

interface ParticipantListProps {
  onlineUsers: Array<{
    userId: string;
    displayName: string;
    isCommissioner: boolean;
  }>;
  sessionId?: string;
  isCommissioner?: boolean;
  isLobby?: boolean;
  userId?: string;
}

export function ParticipantList({
  onlineUsers,
  sessionId,
  isCommissioner,
  isLobby,
  userId,
}: ParticipantListProps) {
  const router = useRouter();
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const handleKick = async (targetUserId: string) => {
    if (!sessionId) return;
    setKickingId(targetUserId);
    const result = await kickParticipant(sessionId, targetUserId);
    if (result.error) {
      console.error('Kick failed:', result.error);
    }
    setKickingId(null);
  };

  const handleLeave = async () => {
    if (!sessionId) return;
    setLeaving(true);
    const result = await leaveSession(sessionId);
    if (result.error) {
      console.error('Leave failed:', result.error);
      setLeaving(false);
    } else {
      router.push('/host');
    }
  };

  const canLeave = sessionId && userId && !isCommissioner && isLobby;
  const canKick = sessionId && isCommissioner && isLobby;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <Users className="size-3.5 text-white/40" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Online ({onlineUsers.length})
        </h3>
      </div>
      <div className="max-h-40 overflow-y-auto p-2">
        {onlineUsers.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-white/30">
            No one online yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {onlineUsers.map((user) => (
              <div
                key={user.userId}
                className="group flex items-center gap-2 rounded-md px-3 py-1.5"
              >
                <div className="size-1.5 rounded-full bg-emerald-400" />
                <span className="flex-1 text-sm text-white/70">
                  {user.displayName}
                </span>
                {user.isCommissioner && (
                  <Crown className="size-3 text-amber-400" />
                )}
                {canKick && !user.isCommissioner && (
                  <button
                    type="button"
                    onClick={() => handleKick(user.userId)}
                    disabled={kickingId === user.userId}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400/60 hover:text-red-400"
                    title={`Remove ${user.displayName}`}
                  >
                    {kickingId === user.userId ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {canLeave && (
        <div className="border-t border-white/[0.06] px-3 py-2">
          <button
            type="button"
            onClick={handleLeave}
            disabled={leaving}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-400/80 hover:border-red-500/30 hover:text-red-400 transition-colors"
          >
            {leaving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <LogOut className="size-3" />
            )}
            {leaving ? 'Leaving...' : 'Leave Auction'}
          </button>
        </div>
      )}
    </div>
  );
}
