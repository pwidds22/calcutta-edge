import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * How long after a successful sync we decline to run another for the same
 * session. Any league member can press "Sync Scores", so on a Sunday afternoon
 * a dozen people refreshing is otherwise a dozen upstream fetches and a dozen
 * 32-row writes per league, for data that moves a few times an hour.
 */
export const SYNC_COOLDOWN_MS = 60_000;

/**
 * When a sync last wrote rows for this session, or null if it never has.
 *
 * No new column: every sync route already stamps `entered_by: null` and
 * `entered_at: <now>` on the rows it writes, so the timestamp is already there.
 *
 * KNOWN GAP (accepted, see LEAGUE_SYNC_SPEC.md): this only throttles syncs that
 * WROTE something. A sync returning no rows — preseason, or ESPN reporting the
 * wrong season type — leaves `entered_at` untouched, so repeated presses still
 * reach upstream. That costs one GET and no writes, and stops once a season is
 * underway.
 */
export async function lastSystemSyncAt(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<Date | null> {
  const { data, error } = await admin
    .from('tournament_results')
    .select('entered_at')
    .eq('session_id', sessionId)
    .is('entered_by', null) // system-written rows only
    // `entered_at` is nullable and Postgres puts NULLs FIRST on a DESC sort, so
    // without this the newest row found could be one carrying no timestamp —
    // and the cooldown would never engage.
    .not('entered_at', 'is', null)
    .order('entered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.entered_at) return null;
  return new Date(data.entered_at as string);
}

/**
 * Milliseconds left on the cooldown; 0 means a sync may proceed.
 *
 * A future timestamp returns 0 rather than a huge wait: the database clock and
 * the function clock are different machines, and skew must not lock a league
 * out of syncing.
 */
export function cooldownRemainingMs(
  lastSyncAt: Date | null,
  now: Date = new Date()
): number {
  if (!lastSyncAt) return 0;
  const elapsed = now.getTime() - lastSyncAt.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.max(0, SYNC_COOLDOWN_MS - elapsed);
}
