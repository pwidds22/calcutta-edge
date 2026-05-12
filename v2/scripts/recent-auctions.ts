/**
 * Show auctions created in the last N hours. Useful for tracking signups after
 * a marketing blast or product change.
 *
 * Usage:
 *   npx tsx scripts/recent-auctions.ts          # default 24h window
 *   HOURS=6 npx tsx scripts/recent-auctions.ts  # last 6h
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createAdminClient } from '@/lib/supabase/admin';

const HOURS = Number(process.env.HOURS ?? '24');
const sinceISO = new Date(Date.now() - HOURS * 60 * 60 * 1000).toISOString();

const supabase = createAdminClient();

async function main() {
  console.log(`\n📋 Auctions created in the last ${HOURS}h (since ${sinceISO})\n`);

  // Pull recent sessions. We don't join participants here because the join
  // shape is fiddly with PostgREST — instead we do a second query to find
  // the commissioner for each session.
  const { data: sessions, error } = await supabase
    .from('auction_sessions')
    .select('id, name, tournament_id, status, join_code, created_at, estimated_pot_size')
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!sessions || sessions.length === 0) {
    console.log('No new auctions in this window.');
    return;
  }

  // Find commissioner email for each session in a single batch query.
  const sessionIds = sessions.map((s) => s.id);
  const { data: participants } = await supabase
    .from('auction_participants')
    .select('session_id, user_id, display_name')
    .in('session_id', sessionIds)
    .eq('is_commissioner', true);

  const userIds = (participants ?? []).map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds);

  const emailByUserId = new Map((profiles ?? []).map((p) => [p.id, p.email as string]));
  const commissionerBySessionId = new Map<string, { email: string; displayName: string | null }>();
  for (const p of participants ?? []) {
    commissionerBySessionId.set(p.session_id, {
      email: emailByUserId.get(p.user_id) ?? '(unknown)',
      displayName: p.display_name ?? null,
    });
  }

  // Print one row per session.
  console.log(`${sessions.length} new session${sessions.length === 1 ? '' : 's'}:\n`);
  for (const s of sessions) {
    const commish = commissionerBySessionId.get(s.id);
    const when = new Date(s.created_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    console.log(`  ${s.tournament_id.padEnd(28)}  ${(s.name ?? '(unnamed)').padEnd(32)}  ${s.status.padEnd(10)}  pot:$${s.estimated_pot_size}  ${when}`);
    console.log(`    join: ${s.join_code}   host: ${commish?.displayName ?? '?'} <${commish?.email ?? '?'}>\n`);
  }

  // Grouped by tournament — quick summary.
  const byTournament = new Map<string, number>();
  for (const s of sessions) {
    byTournament.set(s.tournament_id, (byTournament.get(s.tournament_id) ?? 0) + 1);
  }
  console.log('Summary:');
  for (const [tid, count] of [...byTournament.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tid.padEnd(28)}  ${count}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
