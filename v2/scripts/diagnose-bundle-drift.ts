/**
 * READ-ONLY diagnostic. Finds PGA sessions whose stored bundle.name surnames
 * no longer match the players that bundle.teamIds resolve to in the *current*
 * deployed config.
 *
 * Background: fetch-pga-odds.mjs assigns team `id` by current win-probability
 * rank, so re-running it reshuffles IDs. Bundles are snapshotted to DB at
 * session-creation time with both a frozen `name` string AND `teamIds`. After
 * an odds refresh, the title can show "Mitchell / Berger / Schmid / Putnam"
 * while the same teamIds resolve to a totally different group of golfers.
 *
 * This script ONLY reads. It never writes to the DB. Safe to run against prod.
 *
 * Usage (from main checkout, since .env.local is gitignored in worktrees):
 *   cd v2
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/diagnose-bundle-drift.ts
 *
 * Optional filter:
 *   TOURNAMENT=pga_championship_2026 npx tsx scripts/diagnose-bundle-drift.ts
 *   SESSION_ID=<uuid>                npx tsx scripts/diagnose-bundle-drift.ts
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { getTournament } from '@/lib/tournaments/registry';
import type { BaseTeam, TeamBundle } from '@/lib/tournaments/types';

const TOURNAMENT = process.env.TOURNAMENT ?? 'pga_championship_2026';
const SESSION_ID = process.env.SESSION_ID ?? null;

const supabase = createAdminClient();

interface BundleDriftRow {
  bundleId: string;
  storedName: string;
  storedSurnames: string[];
  resolvedSurnames: string[];
  missingIds: number[];
  drift: 'clean' | 'name-only' | 'missing-ids' | 'unparseable';
}

interface SessionReport {
  sessionId: string;
  sessionName: string;
  status: string;
  createdAt: string;
  hasWinningBids: boolean;
  bundleCount: number;
  driftedBundles: BundleDriftRow[];
}

/** Extract "Mitchell / Berger / ..." from "Group 24 (Mitchell / Berger / ...)". */
function parseSurnamesFromBundleName(name: string): string[] | null {
  const match = name.match(/\(([^)]+)\)/);
  if (!match) return null;
  return match[1].split('/').map((s) => s.trim()).filter((s) => s.length > 0);
}

function diagnoseBundle(
  bundle: TeamBundle,
  teamMap: Map<number, BaseTeam>,
): BundleDriftRow {
  const storedSurnames = parseSurnamesFromBundleName(bundle.name);
  const resolved = bundle.teamIds.map((id) => teamMap.get(id));
  const missingIds = bundle.teamIds.filter((id, i) => !resolved[i]);
  const resolvedSurnames = resolved
    .filter((t): t is BaseTeam => !!t)
    .map((t) => t.name.split(' ').pop() ?? t.name);

  if (storedSurnames === null) {
    return {
      bundleId: bundle.id,
      storedName: bundle.name,
      storedSurnames: [],
      resolvedSurnames,
      missingIds,
      drift: 'unparseable',
    };
  }

  if (missingIds.length > 0) {
    return {
      bundleId: bundle.id,
      storedName: bundle.name,
      storedSurnames,
      resolvedSurnames,
      missingIds,
      drift: 'missing-ids',
    };
  }

  // Compare element-wise (order matters because the title encodes assignment order)
  const sameLength = storedSurnames.length === resolvedSurnames.length;
  const allMatch =
    sameLength &&
    storedSurnames.every((s, i) => s === resolvedSurnames[i]);

  return {
    bundleId: bundle.id,
    storedName: bundle.name,
    storedSurnames,
    resolvedSurnames,
    missingIds: [],
    drift: allMatch ? 'clean' : 'name-only',
  };
}

async function main() {
  const entry = getTournament(TOURNAMENT);
  if (!entry) {
    console.error(`Unknown tournament: ${TOURNAMENT}`);
    process.exit(1);
  }
  const teamMap = new Map(entry.teams.map((t) => [t.id, t]));

  console.log(`\nDiagnosing bundle drift for: ${TOURNAMENT}`);
  console.log(`Current config: ${entry.teams.length} teams loaded\n`);

  // Pull all sessions for this tournament (or one specific session).
  const query = supabase
    .from('auction_sessions')
    .select('id, name, status, created_at, settings')
    .eq('tournament_id', TOURNAMENT)
    .order('created_at', { ascending: false });

  const { data: sessions, error } = SESSION_ID
    ? await query.eq('id', SESSION_ID)
    : await query;

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!sessions || sessions.length === 0) {
    console.log('No sessions found.');
    return;
  }

  // Find which sessions have winning bids — those are the ones the user
  // explicitly asked us NOT to mess with.
  const sessionIds = sessions.map((s) => s.id);
  const { data: bidRows } = await supabase
    .from('auction_bids')
    .select('session_id')
    .eq('is_winning_bid', true)
    .in('session_id', sessionIds);
  const sessionsWithBids = new Set((bidRows ?? []).map((b) => b.session_id));

  const reports: SessionReport[] = [];
  for (const s of sessions) {
    const settings = s.settings as { bundles?: TeamBundle[] } | null;
    const bundles = settings?.bundles ?? [];
    if (bundles.length === 0) continue;

    const drifted: BundleDriftRow[] = [];
    for (const b of bundles) {
      const row = diagnoseBundle(b, teamMap);
      if (row.drift !== 'clean') drifted.push(row);
    }

    reports.push({
      sessionId: s.id,
      sessionName: s.name ?? '(unnamed)',
      status: s.status,
      createdAt: s.created_at,
      hasWinningBids: sessionsWithBids.has(s.id),
      bundleCount: bundles.length,
      driftedBundles: drifted,
    });
  }

  // Sort: drafted (has bids) sessions LAST so they're visually separated.
  reports.sort((a, b) => Number(a.hasWinningBids) - Number(b.hasWinningBids));

  const driftedSessions = reports.filter((r) => r.driftedBundles.length > 0);
  const cleanSessions = reports.filter((r) => r.driftedBundles.length === 0);

  console.log(`Found ${sessions.length} sessions, ${reports.length} with bundles.`);
  console.log(`  ${driftedSessions.length} have bundle drift`);
  console.log(`  ${cleanSessions.length} are clean (or have no bundles)\n`);

  if (driftedSessions.length === 0) {
    console.log('No drift detected. Bundle names match current teamMap resolution.');
    return;
  }

  console.log('─'.repeat(80));
  console.log('SESSIONS WITH BUNDLE DRIFT');
  console.log('─'.repeat(80));

  for (const r of driftedSessions) {
    const created = new Date(r.createdAt).toISOString().slice(0, 10);
    const draftedLabel = r.hasWinningBids ? ' ⚠️  DRAFTED — DO NOT MODIFY' : '';
    console.log(`\n  ${r.sessionName}  (${r.status}, created ${created})${draftedLabel}`);
    console.log(`  session_id: ${r.sessionId}`);
    console.log(`  ${r.driftedBundles.length} of ${r.bundleCount} bundles drifted`);

    // Show first 3 drifted bundles for inspection — full output would be massive.
    for (const b of r.driftedBundles.slice(0, 3)) {
      console.log(`\n    bundle: ${b.bundleId}  (${b.drift})`);
      console.log(`      stored:   ${b.storedSurnames.join(' / ')}`);
      console.log(`      resolved: ${b.resolvedSurnames.join(' / ')}`);
      if (b.missingIds.length > 0) {
        console.log(`      missing IDs: ${b.missingIds.join(', ')}`);
      }
    }
    if (r.driftedBundles.length > 3) {
      console.log(`    ... and ${r.driftedBundles.length - 3} more drifted bundles`);
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log('SUMMARY');
  console.log('─'.repeat(80));
  console.log(`  Total sessions checked:       ${sessions.length}`);
  console.log(`  Sessions with bundles:        ${reports.length}`);
  console.log(`  Sessions with drift:          ${driftedSessions.length}`);
  console.log(`    ...of which DRAFTED:        ${driftedSessions.filter((r) => r.hasWinningBids).length}`);
  console.log(`    ...of which lobby/empty:    ${driftedSessions.filter((r) => !r.hasWinningBids).length}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
