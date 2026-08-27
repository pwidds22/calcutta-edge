/**
 * Read-only regression snapshot: for every COMPLETED league with sold teams,
 * compute every number the Standings tab, Settlement tab, and dashboard P&L
 * derive from settlement math, and print one deterministic JSON document.
 *
 * Run it from two checkouts (branch vs origin/main) against the same prod DB
 * and diff the output — any moved number is a behavior change in shared
 * settlement code. Mirrors the real call sites:
 *   - baseTeams:  session.settings.teamSnapshot ?? registry teams  (live page)
 *   - soldTeams:  winning bids ordered by created_at, deduped by team_id
 *   - Standings:  calculateLeaderboard(...)
 *   - Settlement: calculateActualSettlement(...) (debt-simplification)
 *   - Round rates / break-even inputs: calculateSettlement(...).roundLabels
 *
 * Run from v2/ with .env.local vars present:
 *   npx tsx scripts/settlement-snapshot.ts > snapshot.json
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { getTournament } from '@/lib/tournaments/registry';
import { calculateLeaderboard } from '@/lib/auction/live/actual-payouts';
import { calculateActualSettlement } from '@/lib/auction/live/debt-simplification';
import { calculateSettlement } from '@/lib/auction/live/settlement';
import { dedupeBy } from '@/lib/auction/winning-bids';

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

async function main() {
  const admin = createAdminClient();

  const { data: sessions, error } = await admin
    .from('auction_sessions')
    .select('id, name, tournament_id, status, payout_rules, prop_results, settings')
    .eq('status', 'completed')
    .order('id');
  if (error) throw error;

  const out: Record<string, unknown> = {};

  for (const session of sessions ?? []) {
    const { data: rawBids, error: bidErr } = await admin
      .from('auction_bids')
      .select('team_id, bidder_id, amount, created_at')
      .eq('session_id', session.id)
      .eq('is_winning_bid', true)
      .order('created_at', { ascending: true });
    if (bidErr) throw bidErr;
    const bids = dedupeBy(rawBids ?? [], (b) => b.team_id);
    if (bids.length === 0) continue; // never drafted — nothing to settle

    const tournament = getTournament(session.tournament_id);
    if (!tournament) {
      out[session.id] = { name: session.name, error: 'no registry entry' };
      continue;
    }

    const { data: participants } = await admin
      .from('auction_participants')
      .select('user_id, display_name')
      .eq('session_id', session.id);
    const nameById = new Map((participants ?? []).map((p) => [p.user_id, p.display_name]));

    const soldTeams = bids.map((b) => ({
      teamId: b.team_id,
      winnerId: b.bidder_id,
      winnerName: nameById.get(b.bidder_id) ?? '?',
      amount: Number(b.amount),
    }));

    const { data: results, error: resErr } = await admin
      .from('tournament_results')
      .select('team_id, round_key, result, result_count')
      .eq('session_id', session.id)
      .order('team_id')
      .order('round_key');
    if (resErr) throw resErr;

    const settings = (session.settings ?? {}) as { teamSnapshot?: typeof tournament.teams };
    const baseTeams = settings.teamSnapshot ?? tournament.teams;
    const payoutRules = session.payout_rules as Record<string, number>;
    const propResults = (session.prop_results ?? []) as never[];

    const leaderboard = calculateLeaderboard(
      soldTeams, baseTeams, (results ?? []) as never, tournament.config, payoutRules, propResults,
    );
    const settlementTab = calculateActualSettlement(
      soldTeams, baseTeams, (results ?? []) as never, tournament.config, payoutRules, propResults,
    );
    const roundMatrix = calculateSettlement(soldTeams, baseTeams, tournament.config, payoutRules);

    const entries: Record<string, unknown> = {};
    for (const e of [...leaderboard.entries].sort((a, b) => a.participantId.localeCompare(b.participantId))) {
      const teams: Record<string, unknown> = {};
      for (const t of [...e.teams].sort((a, b) => a.teamId - b.teamId)) {
        teams[t.teamId] = {
          name: t.teamName, price: r6(t.purchasePrice), status: t.status,
          roundsWon: t.roundsWon, earnings: r6(t.earnings),
        };
      }
      entries[e.participantId] = {
        name: e.participantName,
        totalSpent: r6(e.totalSpent), totalEarned: r6(e.totalEarned), netPL: r6(e.netPL),
        teamsAlive: e.teamsAlive, teamsEliminated: e.teamsEliminated,
        propEarnings: e.propEarnings.map((p) => ({ key: p.propKey, amount: r6(p.amount) })),
        teams,
      };
    }

    const balances: Record<string, unknown> = {};
    for (const b of [...settlementTab.balances].sort((a, b) => a.id.localeCompare(b.id))) {
      balances[b.id] = { spent: r6(b.totalSpent), earned: r6(b.totalEarned), net: r6(b.netBalance) };
    }

    out[session.id] = {
      name: session.name,
      tournamentId: session.tournament_id,
      teamSource: settings.teamSnapshot ? 'snapshot' : 'registry',
      soldTeams: soldTeams.length,
      dupWinningBidRows: (rawBids?.length ?? 0) - bids.length,
      actualPot: r6(leaderboard.actualPot),
      completedRounds: leaderboard.completedRounds,
      currentRound: leaderboard.currentRound,
      isTournamentComplete: leaderboard.isTournamentComplete,
      standings: entries,
      settlement: {
        totalDistributed: r6(settlementTab.totalDistributed),
        isSettled: settlementTab.isSettled,
        balances,
        payments: settlementTab.payments.map((p) => ({ from: p.fromId, to: p.toId, amount: r6(p.amount) })),
      },
      roundRates: roundMatrix.roundLabels.map((r) => ({ key: r.key, pct: r6(r.pct), amount: r6(r.amount) })),
    };
  }

  console.log(JSON.stringify(out, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
