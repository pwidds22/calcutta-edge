import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * Who may trigger a score sync for one session.
 *
 * Before this helper each sync route decided for itself, and only one of the
 * four decided correctly: `/api/nfl/sync` allowed the commissioner alone (so a
 * league member pressing the "Sync Scores" button that the dashboard already
 * shows them got a 403), while `/api/golf/sync`, `/api/soccer/sync` and
 * `/api/espn/sync` performed NO check at all — `middleware.ts` allowlists all
 * four under a comment claiming they handle their own auth.
 */
export type SyncAccess =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * True only when CRON_SECRET is configured AND the request presents it.
 *
 * The `!!secret` is the point: `header === \`Bearer ${process.env.CRON_SECRET}\``
 * — the shape the golf, soccer and espn routes still use inline — matches the
 * literal string 'Bearer undefined' whenever the variable is unset, granting
 * cron privileges to any caller who guesses that.
 */
export function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Authorize a member-initiated sync of a single session. Never called on the
 * cron path — cron carries no sessionId, it syncs every eligible session.
 *
 * Identity comes from the caller's own cookies; the session and membership
 * lookups go through the admin client so the check does not depend on the
 * caller being able to read those rows under RLS.
 */
export async function authorizeSessionSync(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<SyncAccess> {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Not authenticated' };

  const { data: session } = await admin
    .from('auction_sessions')
    .select('id, commissioner_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return { ok: false, status: 404, error: 'Session not found' };

  // Commissioner accepted directly, NOT only via a participant row:
  // `createSession` inserts that row without checking the result, so a failed
  // insert would otherwise lock a host out of their own league.
  if (session.commissioner_id === user.id) return { ok: true, userId: user.id };

  const { data: membership } = await admin
    .from('auction_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership) return { ok: true, userId: user.id };

  return { ok: false, status: 403, error: 'You are not a member of this league' };
}
