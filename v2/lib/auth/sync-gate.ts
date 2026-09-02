import { NextResponse } from 'next/server';
import type { createAdminClient } from '@/lib/supabase/admin';
import { authorizeSessionSync } from './sync-access';
import { lastSystemSyncAt, cooldownRemainingMs } from '@/lib/auction/sync-cooldown';

/** Shown to the pressing member when the cooldown swallows their request. */
export const SYNC_SKIPPED_MESSAGE = 'Just synced — already up to date';

/**
 * The standard gate for a member-initiated sync of one session: authorize the
 * caller, then apply the per-session cooldown.
 *
 * Returns a response to send back IMMEDIATELY, or `null` when the route may
 * proceed with its real work. Four routes need exactly this sequence, so it
 * lives here rather than being pasted into each - that also keeps the skipped
 * response's shape and copy in one place.
 *
 * NEVER call this on the cron path. Cron carries no sessionId and must never
 * be skipped because a member pressed the button a minute earlier.
 */
export async function guardMemberSync(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<NextResponse | null> {
  const access = await authorizeSessionSync(admin, sessionId);
  if (!access.ok) {
    // Returned before the cooldown lookup on purpose: a non-member must not be
    // able to learn when a league they cannot see last synced.
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const lastSync = await lastSystemSyncAt(admin, sessionId);
  const retryInMs = cooldownRemainingMs(lastSync);
  if (retryInMs > 0) {
    // 200, not 429. Nothing failed and the caller did nothing wrong - the data
    // is simply already fresh, and the dashboard renders this neutrally.
    return NextResponse.json({
      skipped: true,
      message: SYNC_SKIPPED_MESSAGE,
      lastSyncedAt: lastSync?.toISOString() ?? null,
      retryInMs,
    });
  }

  return null;
}
