/**
 * Show users who signed up in the last N hours. Used for tracking conversions
 * after a marketing blast or product change.
 *
 * Usage:
 *   npx tsx scripts/recent-signups.ts           # default 24h
 *   HOURS=72 npx tsx scripts/recent-signups.ts  # last 3 days
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createAdminClient } from '@/lib/supabase/admin';

const HOURS = Number(process.env.HOURS ?? '24');
const sinceISO = new Date(Date.now() - HOURS * 60 * 60 * 1000).toISOString();

const supabase = createAdminClient();

async function main() {
  console.log(`\n👤 Signups in the last ${HOURS}h (since ${sinceISO})\n`);

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, created_at, has_paid')
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.log('No new signups in this window.');
    return;
  }

  console.log(`${profiles.length} new signup${profiles.length === 1 ? '' : 's'}:\n`);
  for (const p of profiles) {
    const when = new Date(p.created_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const paid = p.has_paid ? '💰' : '  ';
    console.log(`  ${paid} ${p.email.padEnd(40)}  ${when}`);
  }

  console.log(`\nTotal: ${profiles.length} new (${profiles.filter((p) => p.has_paid).length} converted to paid)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
