/**
 * Read-only diagnostic: decompose a World Cup league's projected standings to see
 * exactly why the per-person nets don't sum to zero. Prints pot, total settled,
 * total projected, total blended, the gap (pot - blended), and per-round Σ odds
 * over alive teams vs the structural target. Run from v2/ with .env.local present:
 *   npx tsx scripts/diagnose-wc-standings.ts <sessionId>
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { getTournament } from '@/lib/tournaments/registry';
import { getWorldCupLiveTeamsTolerant } from '@/lib/tournaments/world-cup-live-odds';
import { calculateSoccerProjectedStandings } from '@/lib/auction/live/soccer-standings';
import { initializeTeams } from '@/lib/calculations/initialize';
import { dedupeBy } from '@/lib/auction/winning-bids';

const sessionId = process.argv[2] ?? '2b832a73-799f-4aa6-8b34-d454a368ab1f';

async function main() {
  const admin = createAdminClient();
  const { data: session } = await admin
    .from('auction_sessions')
    .select('tournament_id, payout_rules, prop_results')
    .eq('id', sessionId)
    .single();
  if (!session) throw new Error('session not found');

  const tournament = getTournament(session.tournament_id);
  if (!tournament) throw new Error('tournament not found');

  const { data: rawBids } = await admin
    .from('auction_bids')
    .select('team_id, bidder_id, amount, created_at')
    .eq('session_id', sessionId)
    .eq('is_winning_bid', true)
    .order('created_at', { ascending: true });
  const bids = dedupeBy(rawBids ?? [], (b) => b.team_id);

  const { data: participants } = await admin
    .from('auction_participants')
    .select('user_id, display_name')
    .eq('session_id', sessionId);
  const nameById = new Map((participants ?? []).map((p) => [p.user_id, p.display_name]));

  const soldTeams = bids.map((b) => ({
    teamId: b.team_id,
    winnerId: b.bidder_id,
    winnerName: nameById.get(b.bidder_id) ?? '?',
    amount: Number(b.amount),
  }));

  const { data: results } = await admin
    .from('tournament_results')
    .select('team_id, round_key, result')
    .eq('session_id', sessionId);

  const teams = await getWorldCupLiveTeamsTolerant(tournament.teams);
  const payoutRules = session.payout_rules;
  const pot = soldTeams.reduce((s, t) => s + t.amount, 0);

  const entries = calculateSoccerProjectedStandings(
    soldTeams,
    teams,
    payoutRules,
    tournament.config,
    (results ?? []) as never,
    (session.prop_results ?? []) as never
  );

  const totalSpent = entries.reduce((s, e) => s + e.totalSpent, 0);
  const totalSettled = entries.reduce((s, e) => s + e.settledEarnings, 0);
  const totalBlended = entries.reduce((s, e) => s + e.blendedEarnings, 0);
  const totalNet = entries.reduce((s, e) => s + e.projectedPL, 0);

  console.log('=== POT / TOTALS ===');
  console.log({ pot, totalSpent, totalSettled, totalBlended, totalProjected: totalBlended - totalSettled, totalNet, gap_pot_minus_blended: pot - totalBlended });

  // Per-round Σ devigged odds over ALIVE teams vs structural target.
  const valued = initializeTeams(teams, [], payoutRules, pot, tournament.config);
  const valuedById = new Map(valued.map((t) => [t.id, t]));
  const decided = new Map<number, Set<string>>();
  for (const r of results ?? []) {
    if (r.result === 'won' || r.result === 'lost') {
      if (!decided.has(r.team_id)) decided.set(r.team_id, new Set());
      decided.get(r.team_id)!.add(r.round_key);
    }
  }
  // A team is "eliminated" if it lost any non-parallel (ladder) round.
  const ladderKeys = new Set(tournament.config.rounds.filter((r) => !r.parallel).map((r) => r.key));
  const eliminated = new Set<number>();
  for (const r of results ?? []) {
    if (r.result === 'lost' && ladderKeys.has(r.round_key)) eliminated.add(r.team_id);
  }

  console.log('\n=== PER-ROUND Σ odds over alive+undecided teams (target = teamsAdvancing) ===');
  for (const round of tournament.config.rounds) {
    let sum = 0;
    for (const t of soldTeams) {
      if (decided.get(t.teamId)?.has(round.key)) continue;
      if (eliminated.has(t.teamId) && !round.parallel) continue;
      sum += valuedById.get(t.teamId)?.odds[round.key] ?? 0;
    }
    console.log(`${round.key.padEnd(9)} Σodds=${sum.toFixed(3).padStart(8)}  target=${round.teamsAdvancing}  payout%=${(payoutRules as Record<string, number>)[round.key]}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
