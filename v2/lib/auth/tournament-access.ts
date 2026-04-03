import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if a user has paid for access to a specific tournament's strategy tool.
 *
 * Checks the new `paid_tournaments` table first, then falls back to the legacy
 * `has_paid` boolean on `profiles` for backward compatibility with existing
 * March Madness 2026 customers.
 */
export async function hasTournamentAccess(
  supabase: SupabaseClient,
  userId: string,
  tournamentId: string
): Promise<boolean> {
  // 1. Check new per-tournament table
  const { data: purchase } = await supabase
    .from('paid_tournaments')
    .select('id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .single();

  if (purchase) return true;

  // 2. Fallback: legacy has_paid grants March Madness access
  //    (covers users who paid before per-tournament migration)
  if (tournamentId === 'march_madness_2026') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_paid')
      .eq('id', userId)
      .single();

    return profile?.has_paid ?? false;
  }

  return false;
}

/**
 * Get all tournament IDs a user has paid access to.
 */
export async function getUserPaidTournaments(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: purchases } = await supabase
    .from('paid_tournaments')
    .select('tournament_id')
    .eq('user_id', userId);

  const tournamentIds = (purchases ?? []).map((p) => p.tournament_id);

  // Fallback: if has_paid=true and march_madness_2026 not already in list
  if (!tournamentIds.includes('march_madness_2026')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_paid')
      .eq('id', userId)
      .single();

    if (profile?.has_paid) {
      tournamentIds.push('march_madness_2026');
    }
  }

  return tournamentIds;
}
